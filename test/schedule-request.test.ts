import { describe, expect, it } from "vitest";
import { parseScheduleRequest } from "../src/agent/schedule-request";

describe("schedule request parsing", () => {
  it("extracts a relative reminder from room chat text", () => {
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);
    const parsed = parseScheduleRequest("help me schedule a to do list later in 5 minutes to take out trash", base);
    expect(parsed).toEqual({ instruction: "take out trash", runAt: base + 5 * 60_000 });
  });

  it("ignores normal chat without schedule intent", () => {
    expect(parseScheduleRequest("is dinner at six?", Date.now())).toBeNull();
  });
});
