export type ChatMessage = {
  readonly id: string;
  readonly authorName: string;
  readonly kind: "group" | "agent-request" | "agent" | "system";
  readonly text: string;
  readonly createdAt: number;
};

export type McpServerConfig = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
};

export type McpToolSummary = {
  readonly serverId: string;
  readonly serverName: string;
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
};

export type McpServerStatus = {
  readonly id: string;
  readonly name: string;
  readonly tools: readonly McpToolSummary[];
  readonly error?: string;
};

export type RoomProgress = {
  readonly active: boolean;
  readonly phase: "idle" | "starting" | "responding" | "using-tools" | "waiting" | "retrying";
  readonly partialText: string;
  readonly tools: readonly {
    readonly id: string;
    readonly name: string;
    readonly status: "pending" | "running" | "done";
  }[];
};

export type WorkspaceInfo = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
};

export type RoomSnapshot = {
  readonly workspace?: WorkspaceInfo;
  readonly messages: readonly ChatMessage[];
  readonly progress: RoomProgress;
};

export type Schedule = {
  readonly id: string;
  readonly instruction: string;
  readonly runAt: number;
};
