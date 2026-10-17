/** Install state for the welcome flow (README §9.1 card 2, §13). */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with touch
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : 'other';
}

class InstallState {
  readonly platform = detectPlatform();
  standalone = $state(false);
  /** Chromium's deferred install prompt, if the browser offered one */
  #deferred = $state<BeforeInstallPromptEvent | null>(null);
  canPrompt = $derived(this.#deferred !== null);

  /** Call once at startup, before the browser fires `beforeinstallprompt`. */
  init(): void {
    if (typeof window === 'undefined') return;
    const mq = matchMedia('(display-mode: standalone)');
    this.standalone = mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    mq.addEventListener('change', (e) => (this.standalone = e.matches));
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.#deferred = e as BeforeInstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => {
      this.#deferred = null;
      this.standalone = true;
    });
  }

  async prompt(): Promise<boolean> {
    const e = this.#deferred;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.#deferred = null;
    return outcome === 'accepted';
  }
}

export const install = new InstallState();
