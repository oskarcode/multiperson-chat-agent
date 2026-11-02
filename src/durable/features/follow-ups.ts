// Pi Durable owns new proactive follow-up classification, scheduling, cancellation,
// recovery, and delivery. The app table below is retained only to drain any
// pending alarm-backed follow-ups created by earlier deployments.
import type { DurableFeatureContext } from "../feature-context";
import type { ChatMessage } from "../../protocol/chat";
import { FOLLOW_UP_RECOVERY_DELAY_MS, now } from "../validation";

export async function trackFollowUp(ctx: DurableFeatureContext, message: ChatMessage): Promise<void> {
  // Resolve legacy checkpoints when any newer room message arrives.
  ctx.state.storage.sql.exec(
    "UPDATE proactive_followups SET status = 'resolved' WHERE workspace_id = ? AND status = 'pending' AND trigger_message_id < ?",
    message.workspaceId,
    message.id,
  );
  const recent = ctx.recentWorkspaceMessages(message.workspaceId, 12)
    .map((item) => `${item.authorName}: ${item.text}`)
    .join("\n")
    .slice(-6000);
  const workspace = (await ctx.listAllWorkspaces()).find((item) => item.id === message.workspaceId);
  const session = ctx.env.SESSIONS.getByName(message.workspaceId) as unknown as {
    observeGroupMessage(input: { message: ChatMessage; recentConversation: string; workspaceTitle: string }): Promise<void>;
  };
  await session.observeGroupMessage({ message, recentConversation: recent, workspaceTitle: workspace?.title ?? "Room" });
  await refreshFollowUpAlarm(ctx);
}

// Legacy recovery for records written before follow-ups moved into Pi Durable.
export function recoverInterruptedFollowUps(ctx: DurableFeatureContext): void {
  const current = now();
  ctx.state.storage.sql.exec(
    "UPDATE proactive_followups SET status = 'pending', due_at = ? WHERE status = 'delivering' AND due_at <= ?",
    current + FOLLOW_UP_RECOVERY_DELAY_MS,
    current - FOLLOW_UP_RECOVERY_DELAY_MS,
  );
}

// Temporary compatibility path for pre-migration rows only; new follow-ups are Pi tasks.
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
      const trigger = ctx.state.storage.sql
        .exec<{ author_id: string }>("SELECT author_id FROM messages WHERE id = ? AND workspace_id = ?", followUp.trigger_message_id, followUp.workspace_id)
        .toArray()[0];
      if (!trigger) {
        ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'resolved' WHERE id = ?", followUp.id);
        continue;
      }
      const transcript = ctx.recentWorkspaceMessages(followUp.workspace_id, 16)
        .map((item) => `${item.authorName}: ${item.text}`)
        .join("\n")
        .slice(-7000);
      const session = ctx.env.SESSIONS.getByName(followUp.workspace_id) as unknown as {
        scheduleLegacyFollowUp(input: { legacyId: string; actorId: string; authorName: string; workspaceId: string; message: string; recentConversation: string }): Promise<void>;
      };
      await session.scheduleLegacyFollowUp({
        legacyId: `legacy-follow-up:${followUp.id}`,
        actorId: trigger.author_id,
        authorName: followUp.author_name,
        workspaceId: followUp.workspace_id,
        message: followUp.message,
        recentConversation: transcript,
      });
      ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'delivered' WHERE id = ?", followUp.id);
    } catch (error) {
      console.error(JSON.stringify({ message: "Legacy follow-up transfer to Pi Durable failed", followUpId: followUp.id, error: error instanceof Error ? error.message : String(error) }));
      ctx.state.storage.sql.exec("UPDATE proactive_followups SET status = 'pending', due_at = ? WHERE id = ?", now() + FOLLOW_UP_RECOVERY_DELAY_MS, followUp.id);
    }
  }
}

export async function refreshFollowUpAlarm(ctx: DurableFeatureContext): Promise<void> {
  recoverInterruptedFollowUps(ctx);
  const dueAt = ctx.state.storage.sql
    .exec<{ due_at: number | null }>("SELECT MIN(due_at) AS due_at FROM proactive_followups WHERE status = 'pending'")
    .one().due_at;
  if (dueAt === null) await ctx.state.storage.deleteAlarm();
  else await ctx.state.storage.setAlarm(dueAt);
}
