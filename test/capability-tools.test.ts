import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { describe, expect, it, vi } from "vitest";
import { createCapabilityTools } from "../src/session/capability-tools";

describe("Pi room capability tools", () => {
  it("routes connector calls and enabled skill reads through app-owned operations", async () => {
    const callConnector = vi.fn(async () => ({ content: [{ type: "text", text: "calendar result" }] }));
    const readSkillFile = vi.fn(async () => ({ path: "SKILL.md", content: "Use the group calendar." }));
    const tools = createCapabilityTools({ callConnector, readSkillFile });
    const api = {} as never;
    const connectorResult = await tools.find((tool) => tool.name === "call_connector_tool")!.execute(
      { connectorId: "calendar", toolName: "list_events", args: { range: "today" } } as never,
      api,
      BACKGROUND_CONTEXT,
    );
    expect(callConnector).toHaveBeenCalledWith({ connectorId: "calendar", toolName: "list_events", args: { range: "today" } });
    expect(connectorResult.output?.find((part) => part.type === "text")?.text).toContain("calendar result");

    const skillResult = await tools.find((tool) => tool.name === "read_skill_file")!.execute(
      { slug: "group-calendar" } as never,
      api,
      BACKGROUND_CONTEXT,
    );
    expect(readSkillFile).toHaveBeenCalledWith({ slug: "group-calendar" });
    expect(skillResult.output?.find((part) => part.type === "text")?.text).toContain("Use the group calendar.");
  });

  it("returns a failed tool result when app authorization rejects the connector call", async () => {
    const tools = createCapabilityTools({
      callConnector: async () => { throw new Error("Only owners and admins can call connector tools"); },
      readSkillFile: async () => ({ path: "SKILL.md", content: "" }),
    });
    const result = await tools.find((tool) => tool.name === "call_connector_tool")!.execute(
      { connectorId: "private", toolName: "delete_data", args: {} } as never,
      {} as never,
      BACKGROUND_CONTEXT,
    );
    expect(result.isError).toBe(true);
    expect(result.output?.find((part) => part.type === "text")?.text).toContain("Only owners and admins");
  });
});
