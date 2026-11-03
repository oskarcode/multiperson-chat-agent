import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { describe, expect, it, vi } from "vitest";
import { createCapabilityTools } from "../src/session/capability-tools";

const sharedNameTools = [
  { serverId: "server-docs", serverName: "Product docs", name: "search", description: "Search public docs" },
  { serverId: "server-code", serverName: "Code search", name: "search", description: "Search source code" },
] as const;

describe("MCP capability tool", () => {
  it("routes a duplicated tool name to the selected configured server", async () => {
    const listMcpTools = vi.fn(async () => sharedNameTools);
    const callMcpTool = vi.fn(async () => ({ content: [{ type: "text", text: "Found a source result" }] }));
    const tool = createCapabilityTools({ listMcpTools, callMcpTool })[0];
    const result = await tool.execute({ serverId: "server-code", serverName: "Code search", toolName: "search", args: { query: "Workers" } } as never, {} as never, BACKGROUND_CONTEXT);
    expect(listMcpTools).toHaveBeenCalledOnce();
    expect(callMcpTool).toHaveBeenCalledWith({ serverId: "server-code", serverName: "Code search", toolName: "search", args: { query: "Workers" } });
    expect(result.output?.[0]).toMatchObject({ type: "text", text: expect.stringContaining("Found a source result") });
  });

  it("does not call a tool unless both its server and name are advertised", async () => {
    const callMcpTool = vi.fn();
    const tool = createCapabilityTools({ listMcpTools: async () => sharedNameTools, callMcpTool })[0];
    const result = await tool.execute({ serverId: "unknown-server", serverName: "Unknown", toolName: "search", args: {} } as never, {} as never, BACKGROUND_CONTEXT);
    expect(result.isError).toBe(true);
    expect(callMcpTool).not.toHaveBeenCalled();
  });
});
