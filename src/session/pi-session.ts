import { DurableObject } from "cloudflare:workers";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, type HarnessInspection } from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { Env } from "../platform-env";
import { createStarterHarnessOptions } from "./harness";

type PiSessionStatus = {
  readonly ok: true;
  readonly rootConversationId: number;
  readonly liveTasks: number;
  readonly queuedSubmissions: number;
};

// First Pi Durable-backed Durable Object in the starter. It is intentionally
// small: opening the Harness and root conversation gives us a safe migration
// point before moving the public chat routes from custom message rows to Pi
// Durable entries, tools, tasks, and schedule handling.
export class PiSession extends DurableObject<Env> {
  readonly #ready: Promise<Harness>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#ready = ctx.blockConcurrencyWhile(() => this.#openHarness());
  }

  async status(): Promise<PiSessionStatus> {
    const harness = await this.#ready;
    const root = await harness.root(BACKGROUND_CONTEXT);
    const inspection: HarnessInspection = await harness.inspect(BACKGROUND_CONTEXT);
    return {
      ok: true,
      rootConversationId: root.id,
      liveTasks: inspection.tasks.length,
      queuedSubmissions: inspection.submissions.length,
    };
  }

  async alarm(): Promise<void> {
    const harness = await this.#ready;
    harness.resume();
  }

  async #openHarness(): Promise<Harness> {
    const storage = await openDurableObjectSqliteStorage(this.ctx.storage);
    return Harness.open(storage, createStarterHarnessOptions(), BACKGROUND_CONTEXT);
  }
}
