import type { Models } from "@earendil-works/pi-ai";
import type { ChatMessage } from "../protocol/chat";

/** Review the recent room conversation for an unanswered or still-open item. */
export async function messageNeedsFollowUp(models: Models, modelId: string, message: ChatMessage, recentConversation: string): Promise<boolean> {
  await models.refresh({ providers: ["cloudflare"] });
  const model = models.getModel("cloudflare", modelId);
  if (!model) return false;
  const prompt = `Review the recent group conversation below, not just the latest line. Decide whether one gentle follow-up from the workspace agent would help now, after the room has been quiet for a while. Reply only YES or NO.

Reply YES when an important question, request for help, confirmation, decision, promised action, or blocker still appears unanswered or unresolved after considering all later replies. Prefer the most recent unresolved item, but do not ignore an earlier important request just because someone posted a casual update afterward.

Reply NO when a person or the agent has already answered, the group has made a decision, the request was declined or closed, the question is rhetorical, or a follow-up would just interrupt casual conversation. A question mark alone is not enough.

Latest group message from ${message.authorName}: ${JSON.stringify(message.text.slice(0, 2000))}

Recent conversation in chronological order:
${recentConversation}`;
  const answer = await models.complete(model, { messages: [{ role: "user", content: prompt, timestamp: Date.now() }] }, { temperature: 0, maxTokens: 8 });
  const text = answer.content.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ").trim().toLowerCase();
  return /^yes\b/u.test(text);
}
