import { defineDoc } from "@earendil-works/pi-durable";

export const RoomPromptContext = defineDoc<{
  workspaceId: string;
  workspaceTitle: string;
  actorId: string;
  text: string;
}>({
  kind: "app.room-prompt-context",
  version: 2,
  scope: "session",
  initial: () => ({ workspaceId: "", workspaceTitle: "Room", actorId: "", text: "" }),
  migrate: (value) => ({
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : "",
    workspaceTitle: typeof value.workspaceTitle === "string" ? value.workspaceTitle : "Room",
    actorId: typeof value.actorId === "string" ? value.actorId : "",
    text: typeof value.text === "string" ? value.text : "",
  }),
});
