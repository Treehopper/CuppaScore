/**
 * Asks the browser to keep IndexedDB data under storage pressure (README §13).
 * Chromium grants it silently for installed / engaged sites; Firefox may prompt, so it is requested
 * after the first saved cup (a user action), not on start.
 */
class StoragePersistence {
  /** null = unknown or unsupported */
  persisted = $state<boolean | null>(null);
  #asked = false;

  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.storage?.persist;
  }

  async refresh(): Promise<void> {
    if (!this.supported) return;
    this.persisted = await navigator.storage.persisted();
  }

  async request(): Promise<boolean> {
    if (!this.supported) return false;
    this.#asked = true;
    this.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    return this.persisted;
  }

  /** Once per session, and only if not persisted yet. */
  async ensure(): Promise<void> {
    if (this.#asked || !this.supported) return;
    this.#asked = true;
    await this.refresh();
    if (!this.persisted) await this.request();
  }
}

export const storagePersistence = new StoragePersistence();
