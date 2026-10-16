import { registerSW } from 'virtual:pwa-register';

/** Service-worker lifecycle: "New version — reload" prompt and offline-ready flag (README §14.3). */
class PwaState {
  needRefresh = $state(false);
  offlineReady = $state(false);
  #update: ((reload?: boolean) => Promise<void>) | null = null;

  register(): void {
    if (!('serviceWorker' in navigator)) return;
    this.#update = registerSW({
      onNeedRefresh: () => {
        this.needRefresh = true;
      },
      onOfflineReady: () => {
        this.offlineReady = true;
      },
    });
  }

  async reload(): Promise<void> {
    this.needRefresh = false;
    await this.#update?.(true);
  }

  dismiss(): void {
    this.needRefresh = false;
  }
}

export const pwa = new PwaState();
