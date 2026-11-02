// MCP connector persistence and authorization. Network protocol details stay in
// src/integrations/mcp.ts; this module stores connector metadata and OAuth state.
import { callMcpTool, completeMcpOAuth, connectAndListTools, type McpOAuthStateAccess, type StoredMcpConnector } from "../../integrations/mcp";
import type { DurableFeatureContext } from "../feature-context";
import type { Connector, McpToolSummary } from "../../protocol/chat";
import { now, safeText } from "../validation";

export async function listConnectors(ctx: DurableFeatureContext, memberId: string): Promise<Connector[]> {
  await ctx.requireMember(memberId);
  return listStoredConnectors(ctx).map((connector) => connectorFromStored(ctx, connector));
}

// Only admins can add connector endpoints because they can expose private tools
// to the group agent and receive OAuth callback state.
export async function addConnector(ctx: DurableFeatureContext, input: { actorId: string; label: string; url: string; publicOrigin: string }): Promise<Connector> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can add connectors");
  const url = new URL(safeText(input.url, "MCP server URL", 1000));
  if (url.protocol !== "https:") throw new Error("MCP server URL must use https");
  const id = crypto.randomUUID();
  const createdAt = now();
  ctx.state.storage.sql.exec(
    "INSERT INTO connectors (id, label, url, created_by, created_at, status, tool_cache) VALUES (?, ?, ?, ?, ?, 'untested', '[]')",
    id,
    safeText(input.label, "Connector label", 100),
    url.href,
    actor.id,
    createdAt,
  );
  return refreshConnector(ctx, { actorId: actor.id, connectorId: id, publicOrigin: input.publicOrigin });
}

export async function refreshConnector(ctx: DurableFeatureContext, input: { actorId: string; connectorId: string; publicOrigin: string }): Promise<Connector> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can refresh connectors");
  const connector = requireStoredConnector(ctx, input.connectorId);
  const result = await connectAndListTools({ connector, publicOrigin: input.publicOrigin, state: mcpStateAccess(ctx) });
  saveMcpResult(ctx, input.connectorId, result.status, result.tools, result.authorizationUrl, result.error);
  return connectorFromStored(ctx, requireStoredConnector(ctx, input.connectorId));
}

export async function completeConnectorOAuth(ctx: DurableFeatureContext, input: { connectorId: string; callbackUrl: string; publicOrigin: string }): Promise<Connector> {
  const connector = requireStoredConnector(ctx, input.connectorId);
  const result = await completeMcpOAuth({
    connector,
    callbackUrl: input.callbackUrl,
    publicOrigin: input.publicOrigin,
    state: mcpStateAccess(ctx),
  });
  saveMcpResult(ctx, input.connectorId, result.status, result.tools, result.authorizationUrl, result.error);
  return connectorFromStored(ctx, requireStoredConnector(ctx, input.connectorId));
}

export async function callConnectorTool(ctx: DurableFeatureContext, input: { actorId: string; connectorId: string; publicOrigin: string; toolName: string; args: Record<string, unknown> }): Promise<unknown> {
  const actor = await ctx.requireMember(input.actorId);
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("Only owners and admins can call connector tools in this starter");
  const connector = requireStoredConnector(ctx, input.connectorId);
  return callMcpTool({
    connector,
    publicOrigin: input.publicOrigin,
    state: mcpStateAccess(ctx),
    toolName: safeText(input.toolName, "Tool name", 200),
    args: input.args,
  });
}

function listStoredConnectors(ctx: DurableFeatureContext): StoredMcpConnector[] {
  return ctx.state.storage.sql
    .exec<{
      id: string;
      label: string;
      url: string;
      created_by: string;
      created_at: number;
      status: Connector["status"];
      oauth_state: string | null;
      tool_cache: string | null;
      authorization_url: string | null;
      last_error: string | null;
    }>(
      "SELECT id, label, url, created_by, created_at, status, oauth_state, tool_cache, authorization_url, last_error FROM connectors ORDER BY created_at DESC",
    )
    .toArray()
    .map((row) => ({
      id: row.id,
      label: row.label,
      url: row.url,
      createdBy: row.created_by,
      createdAt: row.created_at,
      oauthState: row.oauth_state === null ? null : JSON.parse(row.oauth_state) as StoredMcpConnector["oauthState"],
      tools: parseTools(row.tool_cache),
      lastError: row.last_error,
    }));
}

function requireStoredConnector(ctx: DurableFeatureContext, connectorId: string): StoredMcpConnector {
  const row = ctx.state.storage.sql
    .exec<{
      id: string;
      label: string;
      url: string;
      created_by: string;
      created_at: number;
      oauth_state: string | null;
      tool_cache: string | null;
      last_error: string | null;
    }>(
      "SELECT id, label, url, created_by, created_at, oauth_state, tool_cache, last_error FROM connectors WHERE id = ?",
      connectorId,
    )
    .toArray()[0];
  if (row === undefined) throw new Error("Connector not found");
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    oauthState: row.oauth_state === null ? null : JSON.parse(row.oauth_state) as StoredMcpConnector["oauthState"],
    tools: parseTools(row.tool_cache),
    lastError: row.last_error,
  };
}

function connectorFromStored(ctx: DurableFeatureContext, connector: StoredMcpConnector): Connector {
  const row = ctx.state.storage.sql
    .exec<{ status: Connector["status"]; authorization_url: string | null }>(
      "SELECT status, authorization_url FROM connectors WHERE id = ?",
      connector.id,
    )
    .one();
  return {
    id: connector.id,
    label: connector.label,
    url: connector.url,
    createdBy: connector.createdBy,
    createdAt: connector.createdAt,
    status: row.status,
    ...(row.authorization_url === null ? {} : { authorizationUrl: row.authorization_url }),
    tools: summarizeTools(connector.tools),
    lastError: connector.lastError,
  };
}

function parseTools(value: string | null): StoredMcpConnector["tools"] {
  if (value === null || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as StoredMcpConnector["tools"] : [];
  } catch {
    return [];
  }
}

function summarizeTools(tools: StoredMcpConnector["tools"]): McpToolSummary[] {
  return tools.map((tool) => ({
    name: tool.name,
    ...(tool.title === undefined ? {} : { title: tool.title }),
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: tool.inputSchema,
  }));
}

function saveMcpResult(ctx: DurableFeatureContext, connectorId: string, status: Connector["status"], tools: StoredMcpConnector["tools"], authorizationUrl?: string, error?: string): void {
  ctx.state.storage.sql.exec(
    "UPDATE connectors SET status = ?, tool_cache = ?, authorization_url = ?, last_error = ? WHERE id = ?",
    status,
    JSON.stringify(tools),
    authorizationUrl ?? null,
    error ?? null,
    connectorId,
  );
}

// Adapter passed to the MCP client so OAuth state remains inside Durable Object
// storage instead of process memory, which can disappear between requests.
function mcpStateAccess(ctx: DurableFeatureContext): McpOAuthStateAccess {
  return {
    load: (connectorId) => requireStoredConnector(ctx, connectorId).oauthState,
    save: (connectorId, state) => {
      ctx.state.storage.sql.exec(
        "UPDATE connectors SET oauth_state = ? WHERE id = ?",
        JSON.stringify(state),
        connectorId,
      );
    },
  };
}
