<script lang="ts">
  import type { DomainSettingsDto, ReminderRule } from '@cuplog/api';
  import { fmtNextTime, fmtWeekday } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { SUGGESTED_REMINDER_RULES, WEEKDAY_KEYS } from '../lib/domain';
  import { downloadText } from '../lib/download';
  import { showError } from '../lib/errors';
  import { query } from '../lib/query.svelte';

  /** Reminder rules in Settings (README §9.3 item 6, §12). Changes save immediately. */
  let { settings }: { settings: DomainSettingsDto } = $props();

  type Weekday = (typeof WEEKDAY_KEYS)[number];
  const cfg = $derived(settings.reminders);
  // without rules yet (welcome skipped), offer the suggestions switched off
  const rules = $derived<ReminderRule[]>(
    cfg.rules.length ? cfg.rules : (SUGGESTED_REMINDER_RULES.map((r) => ({ ...r, enabled: false })) as unknown as ReminderRule[]),
  );
  const next = query(() => api().getNextReminders(), ['settings', 'ratings', 'bags']);

  async function save(patch: Partial<DomainSettingsDto['reminders']>): Promise<void> {
    try {
      await api().updateSettings({ reminders: { ...cfg, rules, ...patch } });
    } catch (e) {
      showError(e);
    }
  }

  function setRule(id: string, patch: Partial<ReminderRule>): void {
    void save({ rules: rules.map((r) => (r.id === id ? ({ ...r, ...patch } as ReminderRule) : r)) });
  }

  function toggleDay(r: ReminderRule & { days: 'all' | Weekday[] }, d: Weekday): void {
    const cur = r.days === 'all' ? [...WEEKDAY_KEYS] : r.days;
    const nextDays = cur.includes(d) ? cur.filter((x) => x !== d) : WEEKDAY_KEYS.filter((x) => cur.includes(x) || x === d);
    if (nextDays.length === 0) return;
    setRule(r.id, { days: nextDays.length === 7 ? 'all' : nextDays });
  }

  function label(r: ReminderRule): string {
    switch (r.kind) {
      case 'nothingLoggedBy':
        return t('reminderRule.nothingLoggedBy');
      case 'fewerThanBy':
        return t('reminderRule.fewerThanBy', { count: r.count });
      case 'afterLastLog':
        return t('reminderRule.afterLastLog', { hours: r.hours, from: r.window.from, to: r.window.to });
      case 'fixedDaily':
        return t('reminderRule.fixedDaily');
      case 'bagExpiring':
        return t('reminderRule.bagExpiring', { days: r.daysBefore });
    }
  }

  /** "Mon–Fri", "Sat, Sun", "every day" */
  function daysSummary(days: 'all' | readonly Weekday[]): string {
    if (days === 'all' || days.length === 7) return t('reminderRule.everyDay');
    const idx = days.map((d) => WEEKDAY_KEYS.indexOf(d)).sort((a, b) => a - b);
    const run = idx.length > 2 && idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1);
    return run
      ? `${fmtWeekday(WEEKDAY_KEYS[idx[0]!]!)}–${fmtWeekday(WEEKDAY_KEYS[idx.at(-1)!]!)}`
      : idx.map((i) => fmtWeekday(WEEKDAY_KEYS[i]!)).join(', ');
  }

  async function calendar(r: ReminderRule): Promise<void> {
    try {
      const ics = await api().exportReminderIcs(r.id, { title: t('reminderRule.icsTitle'), description: t('reminderRule.icsText') });
      downloadText(`cuplog-reminder-${r.id}.ics`, ics, 'text/calendar');
    } catch (e) {
      showError(e);
    }
  }

  const nextAt = $derived(cfg.enabled ? next.data?.[0]?.at : undefined);
</script>

<section class="card stack" aria-labelledby="s-rem" data-testid="reminder-settings">
  <h2 id="s-rem">{t('reminderRule.title')}</h2>
  <label class="check">
    <input type="checkbox" checked={cfg.enabled} onchange={(e) => save({ enabled: e.currentTarget.checked })} />
    <span>{t('reminderRule.enabled')}</span>
  </label>
  <p class="small muted">
    {#if nextAt}{t('reminderRule.next', { when: fmtNextTime(nextAt, Date.now()) })}{:else}{t('welcome.remindersNote')}{/if}
  </p>

  {#if cfg.enabled}
    <ul class="list rules">
      {#each rules as r (r.id)}
        <li class="rule" data-testid="reminder-rule">
          <div class="head">
            <label class="check">
              <input type="checkbox" checked={r.enabled} onchange={(e) => setRule(r.id, { enabled: e.currentTarget.checked })} />
              <span
                >{label(r)}{#if 'days' in r && !r.enabled}<span class="small muted"> · {daysSummary(r.days)}</span>{/if}</span
              >
            </label>
            {#if 'time' in r}
              <label>
                <span class="visually-hidden">{t('welcome.time')}</span>
                <input
                  type="time"
                  value={r.time}
                  onchange={(e) => e.currentTarget.value && setRule(r.id, { time: e.currentTarget.value })}
                />
              </label>
            {/if}
          </div>
          {#if r.enabled && 'days' in r}
            <div class="days" role="group" aria-label={t('reminderRule.days')}>
              {#each WEEKDAY_KEYS as d (d)}
                <button
                  type="button"
                  class="chip"
                  aria-pressed={r.days === 'all' || r.days.includes(d)}
                  aria-label={fmtWeekday(d, 'long')}
                  onclick={() => toggleDay(r, d)}>{fmtWeekday(d)}</button
                >
              {/each}
            </div>
          {/if}
          {#if r.enabled && 'time' in r && r.kind !== 'bagExpiring'}
            <button type="button" class="btn-ghost small cal" onclick={() => calendar(r)}>{t('reminderRule.calendar')}</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .rules {
    gap: 0.75rem;
  }
  .rule {
    display: grid;
    gap: 0.4rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  .head {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }
  .head input[type='time'] {
    width: 9rem;
  }
  .days {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .days .chip {
    min-width: 2.75rem;
    padding-inline: 0.4rem;
  }
  .cal {
    justify-self: start;
  }
</style>
