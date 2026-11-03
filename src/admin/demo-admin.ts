import { DurableObject } from "cloudflare:workers";
import type { Env } from "../platform-env";
import type { McpServerConfig, WorkspaceInfo } from "../protocol/chat";

const WORKSPACE_PREFIX = "workspace:";
const MCP_SERVERS_KEY = "global-mcp-servers";
const LEGACY_MCP_URL_KEY = "global-mcp-url";
const MAX_MCP_SERVERS = 8;
type WorkspaceRecord = WorkspaceInfo & { deleting?: true };

/** Stores the demo-wide MCP endpoints and the index of shareable workspaces. */
export class DemoAdmin extends DurableObject<Env> {
  async listWorkspaces(): Promise<WorkspaceRecord[]> {
    const records = await this.ctx.storage.list<WorkspaceRecord>({ prefix: WORKSPACE_PREFIX });
    return [...records.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async getWorkspaceInfo(id: string): Promise<WorkspaceInfo | undefined> {
    const record = await this.ctx.storage.get<WorkspaceRecord>(`${WORKSPACE_PREFIX}${id}`);
    return record?.deleting ? undefined : record;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const key = `${WORKSPACE_PREFIX}${id}`;
    const workspace = await this.ctx.storage.get<WorkspaceRecord>(key);
    if (!workspace) return false;
    if (!workspace.deleting) await this.ctx.storage.put(key, { ...workspace, deleting: true });
    await this.env.ROOMS.getByName(id).deleteWorkspace();
    await this.ctx.storage.delete(key);
    return true;
  }

  async createWorkspace(title: string): Promise<WorkspaceInfo> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || normalizedTitle.length > 80) throw new Error("Workspace names must be 1–80 characters.");
    const workspace: WorkspaceInfo = {
      id: crypto.randomUUID(),
      title: normalizedTitle,
      createdAt: Date.now(),
    };
    await this.ctx.storage.put(`${WORKSPACE_PREFIX}${workspace.id}`, workspace);
    await this.env.ROOMS.getByName(workspace.id).initializeWorkspace(workspace);
    return workspace;
  }

  async getMcpServers(): Promise<McpServerConfig[]> {
    const migratedId = crypto.randomUUID();
    return this.ctx.storage.transaction(async (txn) => {
      const current = await txn.get<McpServerConfig[]>(MCP_SERVERS_KEY);
      if (Array.isArray(current)) return current;
      const legacy = await txn.get<string>(LEGACY_MCP_URL_KEY);
      const url = legacy ?? this.env.MCP_URL?.trim() ?? "";
      let name = "MCP server";
      if (url) {
        try { name = new URL(url).hostname || name; }
        catch { /* Preserve an invalid legacy value so the admin UI can show its connection error. */ }
      }
      const servers = url ? [{ id: migratedId, name, url }] : [];
      await txn.put(MCP_SERVERS_KEY, servers);
      await txn.delete(LEGACY_MCP_URL_KEY);
      return servers;
    });
  }

  async addMcpServer(input: { name: string; url: string }): Promise<McpServerConfig> {
    await this.getMcpServers();
    const server: McpServerConfig = { id: crypto.randomUUID(), name: input.name.trim(), url: input.url };
    return this.ctx.storage.transaction(async (txn) => {
      const servers = await txn.get<McpServerConfig[]>(MCP_SERVERS_KEY) ?? [];
      if (servers.length >= MAX_MCP_SERVERS) throw new Error(`You can connect up to ${MAX_MCP_SERVERS} MCP servers.`);
      if (servers.some((item) => item.url === server.url)) throw new Error("This MCP endpoint is already connected.");
      if (servers.some((item) => item.name.toLowerCase() === server.name.toLowerCase())) throw new Error("Choose a unique name for each MCP server.");
      await txn.put(MCP_SERVERS_KEY, [...servers, server]);
      return server;
    });
  }

  async removeMcpServer(id: string): Promise<boolean> {
    return this.ctx.storage.transaction(async (txn) => {
      const servers = await txn.get<McpServerConfig[]>(MCP_SERVERS_KEY) ?? [];
      const remaining = servers.filter((server) => server.id !== id);
      if (remaining.length === servers.length) return false;
      await txn.put(MCP_SERVERS_KEY, remaining);
      return true;
    });
  }
}
