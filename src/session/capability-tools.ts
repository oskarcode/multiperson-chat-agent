import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolExecutionApi, type ToolRegistration } from "@earendil-works/pi-durable";
import type { McpToolSummary } from "../protocol/chat";

export type AgentCapabilityOperations = {
  listMcpTools(): Promise<readonly McpToolSummary[]>;
  callMcpTool(input: { serverId: string; serverName: string; toolName: string; args: Record<string, unknown> }): Promise<unknown>;
};

const textResult = (text: string) => ({ output: [{ type: "text" as const, text }] });

/** One Pi-native tool routes calls to an advertised tool on a configured public MCP server. */
export function createCapabilityTools(operations: AgentCapabilityOperations): ToolRegistration[] {
  return [defineTool({
    name: "call_mcp_tool",
    description: "Call an advertised tool from a configured public MCP server. Use the exact serverId, serverName, and toolName shown in the room context; tool names may be duplicated across servers.",
    parameters: Type.Object({
      serverId: Type.String({ minLength: 1 }),
      serverName: Type.String({ minLength: 1 }),
      toolName: Type.String({ minLength: 1 }),
      args: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),
    replay: "unsafe",
    execute: async (args, _api: ToolExecutionApi, _context: Context) => {
      try {
        const available = await operations.listMcpTools();
        if (!available.some((tool) => tool.serverId === args.serverId && tool.serverName === args.serverName && tool.name === args.toolName)) {
          return { ...textResult(`MCP tool is not available on the selected server: ${args.toolName}`), isError: true };
        }
        const result = await operations.callMcpTool({ serverId: args.serverId, serverName: args.serverName, toolName: args.toolName, args: args.args ?? {} });
        return textResult(JSON.stringify(result) ?? "null");
      } catch (error) {
        return { ...textResult(`MCP tool failed: ${error instanceof Error ? error.message : String(error)}`), isError: true };
      }
    },
  })];
}
