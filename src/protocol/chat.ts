export type ChatMessage = {
  readonly id: string;
  readonly authorName: string;
  readonly kind: "group" | "agent-request" | "agent" | "system";
  readonly text: string;
  readonly createdAt: number;
};

export type McpToolSummary = {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
};

export type RoomProgress = {
  readonly active: boolean;
  readonly partialText: string;
  readonly tools: readonly {
    readonly name: string;
    readonly status: "pending" | "running" | "done";
    readonly output?: string;
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
