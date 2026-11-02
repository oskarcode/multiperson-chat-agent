// Minimal client for a public Streamable HTTP MCP server configured by the Worker owner.
import { McpClient, StreamableHttpTransport, type CallToolResult, type Tool } from "@earendil-works/pi-mcp";

const clientName = "multiperson-chat-demo";
const clientVersion = "0.2.0";

function assertPublicHttpsUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("MCP_URL must be a public HTTPS URL without embedded credentials.");
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.startsWith("[")) {
    throw new Error("MCP_URL must use a public DNS hostname.");
  }
  return url.href;
}

async function withClient<T>(url: string, timeoutMs: number, run: (client: McpClient, signal: AbortSignal) => Promise<T>): Promise<T> {
  const client = new McpClient({ name: clientName, version: clientVersion, requestTimeoutMs: timeoutMs });
  await client.connect(new StreamableHttpTransport({ url: assertPublicHttpsUrl(url), openGetStream: false }));
  try {
    return await run(client, AbortSignal.timeout(timeoutMs));
  } finally {
    await client.close().catch(() => undefined);
  }
}

export function listMcpTools(url: string): Promise<Tool[]> {
  return withClient(url, 20_000, (client, signal) => client.listTools({ signal }));
}

export function callMcpTool(url: string, toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
  return withClient(url, 30_000, (client, signal) => client.callTool(toolName, args, { signal }));
}
