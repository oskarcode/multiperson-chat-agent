import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolExecutionApi, type ToolRegistration } from "@earendil-works/pi-durable";

export type AgentCapabilityOperations = {
  listMcpTools(): Promise<readonly { name: string; title?: string; description?: string }[]>;
  callMcpTool(input: { toolName: string; args: Record<string, unknown> }): Promise<unknown>;
};

const textResult = (text: string) => ({ output: [{ type: "text" as const, text }] });

/** One Pi-native tool calls a tool advertised by the configured public MCP server. */
export function createCapabilityTools(operations: AgentCapabilityOperations): ToolRegistration[] {
  return [defineTool({
    name: "call_mcp_tool",
    description: "Call a tool from the public MCP server listed in the room context. Use an advertised tool name and provide its JSON arguments.",
    parameters: Type.Object({
      toolName: Type.String({ minLength: 1 }),
      args: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),
    replay: "unsafe",
    execute: async (args, _api: ToolExecutionApi, _context: Context) => {
      try {
        const available = await operations.listMcpTools();
        if (!available.some((tool) => tool.name === args.toolName)) {
          return { ...textResult(`MCP tool is not available: ${args.toolName}`), isError: true };
        }
        const result = await operations.callMcpTool({ toolName: args.toolName, args: args.args ?? {} });
        return textResult(JSON.stringify(result) ?? "null");
      } catch (error) {
        return { ...textResult(`MCP tool failed: ${error instanceof Error ? error.message : String(error)}`), isError: true };
      }
    },
  })];
}
