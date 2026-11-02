import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolExecutionApi, type ToolRegistration } from "@earendil-works/pi-durable";
import type { Context } from "@earendil-works/chord";

export type AgentCapabilityOperations = {
  callConnector(input: { connectorId: string; toolName: string; args: Record<string, unknown> }): Promise<unknown>;
  readSkillFile(input: { slug: string; path?: string }): Promise<{ path: string; content: string }>;
};

const textResult = (text: string) => ({ output: [{ type: "text" as const, text }] });
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Pi-native tool boundary for app-owned, role-checked MCP connectors and skills. */
export function createCapabilityTools(operations: AgentCapabilityOperations): ToolRegistration[] {
  const callConnector = defineTool({
    name: "call_connector_tool",
    description: "Call a tool from a configured MCP connector. Use only connectors and tool names listed in room context, and only when their result is needed to answer the user.",
    parameters: Type.Object({
      connectorId: Type.String({ minLength: 1 }),
      toolName: Type.String({ minLength: 1 }),
      args: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),
    replay: "unsafe",
    execute: async (args, _api: ToolExecutionApi, _context: Context) => {
      try {
        const result = await operations.callConnector({ connectorId: args.connectorId, toolName: args.toolName, args: args.args ?? {} });
        return textResult(JSON.stringify(result) ?? "null");
      } catch (error) {
        return { ...textResult(`Connector tool failed: ${errorText(error)}`), isError: true };
      }
    },
  });

  const readSkillFile = defineTool({
    name: "read_skill_file",
    description: "Read an instruction or reference file from an enabled group skill. Use the skill slug and relative file path listed in room context; omit path to read SKILL.md.",
    parameters: Type.Object({
      slug: Type.String({ minLength: 1 }),
      path: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    }),
    replay: "safe",
    execute: async (args) => {
      try {
        const file = await operations.readSkillFile(args);
        return textResult(`# ${args.slug}/${file.path}\n\n${file.content}`);
      } catch (error) {
        return { ...textResult(`Skill file unavailable: ${errorText(error)}`), isError: true };
      }
    },
  });

  return [callConnector, readSkillFile];
}
