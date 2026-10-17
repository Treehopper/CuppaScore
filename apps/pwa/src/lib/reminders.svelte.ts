import type { DueReminder, ReminderAction, ReminderCheck } from '@cuplog/api';
import { api } from './api';
import { showError } from './errors';
import { router } from './router.svelte';

/** Re-check at least this often: timers drift or stop while a phone sleeps. */
const MAX_TIMER_MS = 60 * 60_000;

/**
 * In-app reminders (README §12.1/12.3): checked at start, when the app returns to the
 * foreground, on a timer armed for the next due time, and whenever ratings/settings change.
 */
class Reminders {
  check = $state<ReminderCheck | null>(null);
  /** due rules hidden by "Log now" until the due set changes */
  #hiddenKey = $state<string | null>(null);
  #timer: ReturnType<typeof setTimeout> | null = null;
  #started = false;

  due = $derived<DueReminder[]>(this.check?.due ?? []);
  #key = $derived(this.due.map((d) => d.ruleId).join(','));
  visible = $derived(this.due.length > 0 && this.#key !== this.#hiddenKey);
  /** README §12.3: the top rule, plus a bag-expiry line */
  primary = $derived(this.due.find((d) => d.kind !== 'bagExpiring') ?? null);
  bag = $derived(this.due.find((d) => d.kind === 'bagExpiring') ?? null);

  start(): void {
    if (this.#started || typeof window === 'undefined') return;
    this.#started = true;
    const refresh = () => void this.refresh();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    window.addEventListener('pageshow', refresh);
    for (const topic of ['ratings', 'settings', 'bags'] as const) api().subscribe(topic, refresh);
    void this.syncTimeZone().then(refresh);
  }

  /** Rules follow the device's zone when travelling (F7). */
  async syncTimeZone(): Promise<void> {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const s = await api().getSettings();
      if (tz && s.timeZone !== tz) await api().updateSettings({ timeZone: tz });
    } catch (e) {
      showError(e);
    }
  }

  async refresh(): Promise<void> {
    try {
      this.check = await api().checkReminders();
    } catch {
      return; // reminders never get in the way of logging
    }
    this.#arm();
  }

  #arm(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const at = this.check?.nextDueAt;
    if (!at) return;
    const delay = Math.min(Math.max(Date.parse(at) - Date.now(), 1000), MAX_TIMER_MS);
    this.#timer = setTimeout(() => void this.refresh(), delay);
  }

  /** "Later" / "Not today" for everything in the banner. */
  async act(action: Exclude<ReminderAction, 'logged'>): Promise<void> {
    try {
      for (const d of this.due) await api().ackReminder(d.ruleId, action);
    } catch (e) {
      showError(e);
    }
  }

  /** "Log now": open the quick log; saving the cup marks the rules as done. */
  logNow(): void {
    this.#hiddenKey = this.#key;
    router.go('/log?mode=home');
  }
}

export const reminders = new Reminders();
