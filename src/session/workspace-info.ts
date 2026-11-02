import { defineDoc } from "@earendil-works/pi-durable";
import type { WorkspaceInfo } from "../protocol/chat";

export type WorkspaceInfoState = { id: string; title: string; createdAt: number };

export const WorkspaceInfoDocument = defineDoc<WorkspaceInfoState>({
  kind: "app.workspace-info",
  version: 1,
  scope: "session",
  initial: () => ({ id: "", title: "", createdAt: 0 }),
});
