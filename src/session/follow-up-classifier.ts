import type { Models } from "@earendil-works/pi-ai";
import type { ChatMessage } from "../protocol/chat";
import { hasExplicitOpenQuestion } from "../durable/validation";

/** Classify ambiguous room turns with Pi AI; explicit open questions retain the existing fast path. */
export async function messageNeedsFollowUp(
  models: Models,
  provider: "cloudflare" | "anthropic",
  modelId: string,
  message: ChatMessage,
  recentConversation: string,
): Promise<boolean> {
  if (hasExplicitOpenQuestion(message.text)) return true;
  await models.refresh({ providers: [provider] });
  const model = models.getModel(provider, modelId);
  if (!model) return false;
  const prompt = `Decide if MultiPersonChat should post one gentle follow-up if this remains the latest visible turn for 30 minutes. Reply only YES or NO.\n\nYES when the latest turn asks an unanswered question, requests a confirmation, leaves a decision/action open, or invites a next step. NO for complete answers, casual updates, acknowledgements, or closed remarks.\n\nLatest speaker: ${message.authorName}\nLatest message: ${JSON.stringify(message.text.slice(0, 4000))}\n\nRecent conversation:\n${recentConversation}`;
  const answer = await models.complete(model, { messages: [{ role: "user", content: prompt, timestamp: Date.now() }] }, { temperature: 0, maxTokens: 8 });
  const text = answer.content.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ").trim().toLowerCase();
  return /^yes\b/u.test(text);
}
