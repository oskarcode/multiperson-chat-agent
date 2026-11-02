import { defineDoc } from "@earendil-works/pi-durable";

export const RoomPromptContext = defineDoc<{
  workspaceId: string;
  workspaceTitle: string;
  actorId: string;
  publicOrigin: string;
  text: string;
}>({
  kind: "app.room-prompt-context",
  version: 3,
  scope: "session",
  initial: () => ({ workspaceId: "", workspaceTitle: "Room", actorId: "", publicOrigin: "", text: "" }),
  migrate: (value) => ({
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : "",
    workspaceTitle: typeof value.workspaceTitle === "string" ? value.workspaceTitle : "Room",
    actorId: typeof value.actorId === "string" ? value.actorId : "",
    publicOrigin: typeof value.publicOrigin === "string" ? value.publicOrigin : "",
    text: typeof value.text === "string" ? value.text : "",
  }),
});
