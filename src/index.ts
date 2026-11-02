import { MultiPersonChat } from "./durable/multiperson-chat";
import { createApp } from "./http/app";
import type { Env } from "./platform-env";
import { PiSession } from "./session/pi-session";

export { MultiPersonChat, PiSession };

const app = createApp();

export default {
  // Cloudflare calls this for every HTTP request. Hono owns the readable route
  // map; Durable Object state still lives behind the CHAT binding.
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
