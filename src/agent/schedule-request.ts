export type ParsedScheduleRequest = {
  readonly instruction: string;
  readonly runAt: number;
};

const RELATIVE_TIME = /\b(?:later\s+)?(?:in|after)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/iu;
const SCHEDULE_INTENT = /\b(?:remind|reminder|schedule|scheduled|scheduling|todo|to-do|to do)\b/iu;

const unitMs = (unit: string): number => {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("min")) return 60_000;
  if (normalized.startsWith("hour") || normalized.startsWith("hr")) return 60 * 60_000;
  return 24 * 60 * 60_000;
};

const cleanInstruction = (value: string): string =>
  value
    .replace(/^[\s:,.!?-]+/u, "")
    .replace(/^(?:please\s+)?(?:help me\s+)?(?:create|add|set|save|schedule|scheduled|scheduling|remind me|reminder|todo|to-do|to do)(?:\s+(?:a|an|the|me|us|list|item|reminder|todo|to-do|to do))*\s*/iu, "")
    .replace(/^(?:to|for|about)\s+/iu, "")
    .replace(/[\s.!,;:]+$/u, "")
    .trim();

export function parseScheduleRequest(text: string, baseTime = Date.now()): ParsedScheduleRequest | null {
  if (!SCHEDULE_INTENT.test(text)) return null;
  const relative = RELATIVE_TIME.exec(text);
  if (relative === null) return null;
  const amount = Number(relative[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const runAt = baseTime + amount * unitMs(relative[2]);
  const afterTime = text.slice(relative.index + relative[0].length);
  const beforeTime = text.slice(0, relative.index);
  const afterMatch = /\b(?:to|for|about)\s+(.+)$/iu.exec(afterTime);
  const beforeMatch = /\b(?:to|for|about)\s+(.+)$/iu.exec(beforeTime);
  const instruction = cleanInstruction(afterMatch?.[1] ?? beforeMatch?.[1] ?? (beforeTime || text));
  if (instruction.length === 0) return null;
  return { instruction, runAt };
}

export const scheduleConfirmation = (instruction: string, runAt: number): string =>
  `Saved to Calendar.\n\n- **Task:** ${instruction}\n- **When:** ${new Date(runAt).toLocaleString()}\n\nThis starter stores the schedule so it appears in Settings → Calendar. It does not send push notifications yet.`;
