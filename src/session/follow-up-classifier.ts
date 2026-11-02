import type { Models } from "@earendil-works/pi-ai";
import type { ChatMessage } from "../protocol/chat";

/** Prefer the cheap path for an explicit open question; use Workers AI for ambiguous turns. */
export async function messageNeedsFollowUp(models: Models, modelId: string, message: ChatMessage, recentConversation: string): Promise<boolean> {
  if (message.text.includes("?")) return true;
  await models.refresh({ providers: ["cloudflare"] });
  const model = models.getModel("cloudflare", modelId);
  if (!model) return false;
  const prompt = `Decide whether to send one gentle follow-up if this remains the latest room message for 30 minutes. Reply only YES or NO.\n\nYES for an unanswered question, a requested confirmation, an open decision/action, or an invitation to a next step. NO for complete answers, casual updates, acknowledgements, or closed remarks.\n\nLatest speaker: ${message.authorName}\nLatest message: ${JSON.stringify(message.text.slice(0, 2000))}\n\nRecent room conversation:\n${recentConversation}`;
  const answer = await models.complete(model, { messages: [{ role: "user", content: prompt, timestamp: Date.now() }] }, { temperature: 0, maxTokens: 8 });
  const text = answer.content.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ").trim().toLowerCase();
  return /^yes\b/u.test(text);
}
