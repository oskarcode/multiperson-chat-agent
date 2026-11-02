import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";

/** Ephemeral Pi AI credential adapter. App-owned secrets remain in CHAT storage and are supplied per run. */
export class SessionCredentialStore implements CredentialStore {
  readonly #credentials = new Map<string, Credential>();

  async read(providerId: string): Promise<Credential | undefined> {
    return this.#credentials.get(providerId);
  }

  async list(): Promise<readonly CredentialInfo[]> {
    return [...this.#credentials.entries()].map(([providerId, credential]) => ({ providerId, type: credential.type }));
  }

  async modify(providerId: string, update: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined> {
    const next = await update(this.#credentials.get(providerId));
    if (next !== undefined) this.#credentials.set(providerId, next);
    return next;
  }

  async delete(providerId: string): Promise<void> {
    this.#credentials.delete(providerId);
  }

  async setAnthropicKey(key: string | undefined): Promise<void> {
    if (!key) {
      await this.delete("anthropic");
      return;
    }
    await this.modify("anthropic", async () => ({ type: "api_key", key }));
  }
}
