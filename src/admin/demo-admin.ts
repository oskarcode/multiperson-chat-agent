import { DurableObject } from "cloudflare:workers";
import type { Env } from "../platform-env";
import type { WorkspaceInfo } from "../protocol/chat";

const WORKSPACE_PREFIX = "workspace:";
const MCP_URL_KEY = "global-mcp-url";

/** Stores the demo-wide MCP endpoint and the index of shareable workspaces. */
export class DemoAdmin extends DurableObject<Env> {
  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    const records = await this.ctx.storage.list<WorkspaceInfo>({ prefix: WORKSPACE_PREFIX });
    return [...records.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async getWorkspaceInfo(id: string): Promise<WorkspaceInfo | undefined> {
    return this.ctx.storage.get<WorkspaceInfo>(`${WORKSPACE_PREFIX}${id}`);
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

  async getMcpUrl(): Promise<string> {
    const configured = await this.ctx.storage.get<string>(MCP_URL_KEY);
    return configured ?? this.env.MCP_URL?.trim() ?? "";
  }

  async setMcpUrl(url: string): Promise<void> {
    await this.ctx.storage.put(MCP_URL_KEY, url);
  }
}
