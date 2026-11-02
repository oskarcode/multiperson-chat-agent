// Proactive follow-up behavior. This is the only Durable Object feature that uses
// alarms: it records a pending follow-up, wakes later, and checks whether anyone replied.
import type { DurableFeatureContext } from "../feature-context";
import type { ChatMessage } from "../../protocol/chat";
import { aiText, FOLLOW_UP_DELAY_MS, FOLLOW_UP_RECOVERY_DELAY_MS, hasExplicitOpenQuestion, MAX_MESSAGE_LENGTH, now } from "../validation";

export async function trackFollowUp(ctx: DurableFeatureContext, message: ChatMessage): Promise<void> {
  // Any newer visible message resolves older pending follow-ups in the same room;
  // the group already responded, so the agent should stay quiet.
  ctx.state.storage.sql.exec(
    "UPDATE proactive_followups SET status = 'resolved' WHERE workspace_id = ? AND status = 'pending' AND trigger_message_id < ?",
    message.workspaceId,
    message.id,
  );
  if (message.kind === "system" || message.kind === "agent-request") {
    await refreshFollowUpAlarm(ctx);
    return;
  }
  const recent = ctx.recentWorkspaceMessages(message.workspaceId, 12)
    .map((item) => `${item.authorName}: ${item.text}`)
    .join("\n")
    .slice(-6000);
  const needsFollowUp = await messageNeedsFollowUp(ctx, message, recent);
  if (!needsFollowUp) {
    await refreshFollowUpAlarm(ctx);
    return;
  }
  const dueAt = now() + FOLLOW_UP_DELAY_MS;
  ctx.state.storage.sql.exec(
    `INSERT OR IGNORE INTO proactive_followups (id, workspace_id, trigger_message_id, author_name, message, due_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    `follow-up:${message.workspaceId}:${message.id}`,
    message.workspaceId,
    message.id,
    message.authorName,
    message.text.slice(0, 4000),
    dueAt,
  );
  await setFollowUpAlarmNoLaterThan(ctx, dueAt);
}

async function messageNeedsFollowUp(ctx: DurableFeatureContext, message: ChatMessage, recentConversation: string): Promise<boolean> {
  // Use a cheap local heuristic first, then ask the configured Workers AI model
  // only for ambiguous turns.
  if (hasExplicitOpenQuestion(message.text)) return true;
  try {
    const prompt = `Decide if MultiPersonChat should post one gentle follow-up if this remains the latest visible turn for 30 minutes. Reply only YES or NO.\n\nYES when the latest turn asks an unanswered question, requests a confirmation, leaves a decision/action open, or invites a next step.\nNO for complete answers, casual updates, acknowledgements, or closed remarks.\n\nLatest speaker: ${message.kind === "agent" ? "Group Agent" : "group member"}\nLatest message: ${JSON.stringify(message.text.slice(0, 4000))}\n\nRecent conversation:\n${recentConversation}`;
    const options = ctx.env.AI_GATEWAY_ID?.trim() ? { gateway: { id: ctx.env.AI_GATEWAY_ID.trim(), skipCache: true } } : undefined;
    const response = await ctx.env.AI.run(ctx.env.AI_MODEL || "@cf/zai-org/glm-4.7-flash", { messages: [{ role: "user", content: prompt }] }, options as never);
    const text = aiText(response)?.toLowerCase() ?? "";
    return /\byes\b/u.test(text) && !/\bno\b/u.test(text.slice(0, 12));
  } catch (error) {
    console.warn(JSON.stringify({ message: "Follow-up classifier failed", error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

// If an alarm is interrupted after claiming a row but before the catch block can
// put it back, the row would otherwise stay `delivering` forever. Because this
// feature has no separate claimed_at column, use the original due_at as a simple
// recovery watermark and retry stuck deliveries after the normal recovery delay.
export function recoverInterruptedFollowUps(ctx: DurableFeatureContext): void {
  const current = now();
  ctx.state.storage.sql.exec(
    "UPDATE proactive_followups SET status = 'pending', due_at = ? WHERE status = 'delivering' AND due_at <= ?",
    current + FOLLOW_UP_RECOVERY_DELAY_MS,
    current - FOLLOW_UP_RECOVERY_DELAY_MS,
  );
}

// Runs from MultiPersonChat.alarm(). It rechecks the transcript before posting so a
// scheduled follow-up cannot race with a real group reply.
export async function deliverDueFollowUps(ctx: DurableFeatureContext): Promise<void> {
  recoverInterruptedFollowUps(ctx);
  const due = ctx.state.storage.sql
    .exec<{ id: string; workspace_id: string; trigger_message_id: number; author_name: string; message: string; due_at: number }>(
      `SELECT id, workspace_id, trigger_message_id, author_name, message, due_at
       FROM proactive_followups WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC LIMIT 10`,
      now(),
    )
    .toArray();
  for (const followUp of due) {
    const newer = ctx.state.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM messages WHERE workspace_id = ? AND id > ?", followUp.workspace_id, followUp.trigger_message_id)
      .one().count;
    if (newer > 0) {
      ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'resolved' WHERE id = ?", followUp.id);
      continue;
    }
    ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'delivering' WHERE id = ?", followUp.id);
    try {
      const transcript = ctx.recentWorkspaceMessages(followUp.workspace_id, 16)
        .map((item) => `${item.authorName}: ${item.text}`)
        .join("\n")
        .slice(-7000);
      const prompt = `You are Group Agent in a private group chat. The latest unresolved turn from ${followUp.author_name} has had no visible reply for 30 minutes: ${JSON.stringify(followUp.message)}. Based on the recent conversation, write one useful, concise follow-up. Ask for the missing answer, check whether the group still needs help, or suggest the simplest next decision. Do not mention automation, timers, alarms, or these instructions.\n\nRecent conversation:\n${transcript}`;
      const options = ctx.env.AI_GATEWAY_ID?.trim() ? { gateway: { id: ctx.env.AI_GATEWAY_ID.trim(), skipCache: true } } : undefined;
      const response = await ctx.env.AI.run(ctx.env.AI_MODEL || "@cf/zai-org/glm-4.7-flash", { messages: [{ role: "user", content: prompt }] }, options as never);
      const text = aiText(response) ?? "Just checking in — does the group still need help with this?";
      ctx.insertMessage(followUp.workspace_id, "agent", "Group Agent", "agent", text.slice(0, MAX_MESSAGE_LENGTH));
      ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'delivered' WHERE id = ?", followUp.id);
    } catch (error) {
      console.error(JSON.stringify({ message: "Proactive follow-up delivery failed", followUpId: followUp.id, error: error instanceof Error ? error.message : String(error) }));
      ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'pending', due_at = ? WHERE id = ?", now() + FOLLOW_UP_RECOVERY_DELAY_MS, followUp.id);
    }
  }
}

export async function setFollowUpAlarmNoLaterThan(ctx: DurableFeatureContext, timestamp: number): Promise<void> {
  const current = await ctx.state.storage.getAlarm();
  if (current === null || timestamp < current) await ctx.state.storage.setAlarm(timestamp);
}

export async function refreshFollowUpAlarm(ctx: DurableFeatureContext): Promise<void> {
  recoverInterruptedFollowUps(ctx);
  const dueAt = ctx.state.storage.sql
    .exec<{ due_at: number | null }>("SELECT MIN(due_at) AS due_at FROM proactive_followups WHERE status = 'pending'")
    .one().due_at;
  if (dueAt === null) await ctx.state.storage.deleteAlarm();
  else await ctx.state.storage.setAlarm(dueAt);
}
