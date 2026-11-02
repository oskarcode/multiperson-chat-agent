import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { describe, expect, it, vi } from "vitest";
import { createCapabilityTools } from "../src/session/capability-tools";

describe("MCP capability tool", () => {
  it("only calls a tool advertised by the configured public MCP server", async () => {
    const listMcpTools = vi.fn(async () => [{ name: "search_docs", description: "Search public docs" }]);
    const callMcpTool = vi.fn(async () => ({ content: [{ type: "text", text: "Found a result" }] }));
    const tool = createCapabilityTools({ listMcpTools, callMcpTool })[0];
    const result = await tool.execute({ toolName: "search_docs", args: { query: "Workers" } } as never, {} as never, BACKGROUND_CONTEXT);
    expect(listMcpTools).toHaveBeenCalledOnce();
    expect(callMcpTool).toHaveBeenCalledWith({ toolName: "search_docs", args: { query: "Workers" } });
    expect(result.output?.[0]).toMatchObject({ type: "text", text: expect.stringContaining("Found a result") });
  });

  it("does not call an MCP tool that was not advertised", async () => {
    const callMcpTool = vi.fn();
    const tool = createCapabilityTools({ listMcpTools: async () => [], callMcpTool })[0];
    const result = await tool.execute({ toolName: "other_tool", args: {} } as never, {} as never, BACKGROUND_CONTEXT);
    expect(result.isError).toBe(true);
    expect(callMcpTool).not.toHaveBeenCalled();
  });
});
