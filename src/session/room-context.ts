import { defineDoc } from "@earendil-works/pi-durable";

export const RoomPromptContext = defineDoc<{ text: string }>({
  kind: "app.room-prompt-context",
  version: 1,
  scope: "session",
  initial: () => ({ text: "" }),
});
