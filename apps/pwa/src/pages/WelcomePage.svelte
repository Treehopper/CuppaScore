<script lang="ts">
  import type { ReminderRule } from '@cuplog/api';
  import Icon from '../components/Icon.svelte';
  import LanguagePicker from '../components/LanguagePicker.svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { BREW_METHODS, RATING_LEVELS, SUGGESTED_REMINDER_RULES, type BrewMethod, type RatingLevel } from '../lib/domain';
  import { showError } from '../lib/errors';
  import { install } from '../lib/install.svelte';
  import { query } from '../lib/query.svelte';
  import { router } from '../lib/router.svelte';

  /** First launch (README §9.1): short, skippable; everything can be changed in Settings. */
  type Step = 'hello' | 'install' | 'gear' | 'reminders';

  // decided once: installing mid-flow shouldn't make the card vanish under the user
  const steps: Step[] = install.standalone ? ['hello', 'gear', 'reminders'] : ['hello', 'install', 'gear', 'reminders'];
  let index = $state(0);
  const step = $derived(steps[index]!);

  const settings = query(() => api().getSettings(), ['settings']);

  // gear & rating style
  let owned = $state<BrewMethod[] | null>(null);
  let level = $state<RatingLevel | null>(null);
  const ownedNow = $derived(owned ?? settings.data?.ownedMethods ?? [...BREW_METHODS]);
  const levelNow = $derived(level ?? settings.data?.defaultLevel ?? 'stars');

  function toggleMethod(m: BrewMethod, on: boolean): void {
    const next = on ? [...ownedNow, m] : ownedNow.filter((x) => x !== m);
    owned = BREW_METHODS.filter((x) => next.includes(x));
  }

  // reminders: the four suggestions shown on the card, times editable inline
  const SHOWN = ['rem_1', 'rem_2', 'rem_3', 'rem_6'];
  let rules = $state<ReminderRule[]>(structuredClone(SUGGESTED_REMINDER_RULES) as unknown as ReminderRule[]);
  const shown = $derived(rules.filter((r) => SHOWN.includes(r.id)));

  let busy = $state(false);

  async function save(patch: Parameters<ReturnType<typeof api>['updateSettings']>[0]): Promise<boolean> {
    busy = true;
    try {
      await api().updateSettings(patch);
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      busy = false;
    }
  }

  async function finish(extra: Parameters<ReturnType<typeof api>['updateSettings']>[0] = {}): Promise<void> {
    if (await save({ ...extra, onboardingCompletedAt: new Date().toISOString() })) router.go('/log', { replace: true });
  }

  function go(i: number): void {
    index = i;
    // each card starts at the top
    window.scrollTo({ top: 0 });
  }

  async function next(): Promise<void> {
    if (step === 'gear' && !(await save({ ownedMethods: ownedNow, defaultLevel: levelNow }))) return;
    go(Math.min(index + 1, steps.length - 1));
  }

  async function enableReminders(): Promise<void> {
    const cur = settings.data?.reminders;
    await finish({
      reminders: { enabled: true, timeZone: cur?.timeZone ?? 'Europe/Berlin', quietHours: cur?.quietHours ?? null, pausedUntil: null, rules },
    });
  }

  function ruleLabel(r: ReminderRule): string {
    switch (r.kind) {
      case 'nothingLoggedBy':
        return t(r.days === 'all' || r.days.includes('MO') ? 'welcome.remWeekdays' : 'welcome.remWeekends');
      case 'fewerThanBy':
        return t('welcome.remFewer', { count: r.count });
      case 'bagExpiring':
        return t('welcome.remBag', { days: r.daysBefore });
      default:
        return '';
    }
  }
</script>

<div class="welcome stack">
  <div class="top">
    <p class="small muted" aria-live="polite">{t('welcome.step', { n: index + 1, total: steps.length })}</p>
    <button type="button" class="btn-ghost" onclick={() => finish()} disabled={busy}>{t('common.skip')}</button>
  </div>

  {#if step === 'hello'}
    <section class="stack" aria-labelledby="w-hello">
      <h1 id="w-hello">{t('welcome.hello')}</h1>
      <p>{t('welcome.helloText')}</p>
      <LanguagePicker />
      <ThemePicker />
    </section>
  {:else if step === 'install'}
    <section class="stack" aria-labelledby="w-install">
      <h1 id="w-install">{t('welcome.install')}</h1>
      <p>{t('welcome.installWhy')}</p>
      {#if install.platform === 'ios'}
        <ol class="ios card stack">
          <li><Icon name="share" />{t('welcome.ios1')}</li>
          <li><Icon name="addBox" />{t('welcome.ios2')}</li>
          <li><Icon name="cup" />{t('welcome.ios3')}</li>
        </ol>
      {:else if install.canPrompt}
        <button type="button" class="btn-primary btn-block" onclick={() => install.prompt()}>
          <Icon name="download" />{t('welcome.installButton')}
        </button>
      {:else}
        <p class="card small">{t('welcome.installMenu')}</p>
      {/if}
    </section>
  {:else if step === 'gear'}
    <section class="stack" aria-labelledby="w-gear">
      <h1 id="w-gear">{t('welcome.gear')}</h1>
      <fieldset class="stack">
        <legend class="label">{t('settings.ownedMethods')}</legend>
        <div class="methods">
          {#each BREW_METHODS as m (m)}
            <label class="check">
              <input type="checkbox" checked={ownedNow.includes(m)} onchange={(e) => toggleMethod(m, e.currentTarget.checked)} />
              <span>{t(`brew.${m}`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="field">
        <span id="w-level">{t('settings.defaultLevel')}</span>
        <div class="segmented" role="radiogroup" aria-labelledby="w-level">
          {#each RATING_LEVELS as l (l)}
            <button type="button" role="radio" aria-checked={levelNow === l} onclick={() => (level = l)}>{t(`level.${l}`)}</button>
          {/each}
        </div>
        <p class="small muted">{t(`welcome.level.${levelNow}`)}</p>
      </div>
    </section>
  {:else}
    <section class="stack" aria-labelledby="w-rem">
      <h1 id="w-rem"><Icon name="bell" />{t('welcome.reminders')}</h1>
      <p>{t('welcome.remindersText')}</p>
      <ul class="list rules">
        {#each shown as r (r.id)}
          <li class="rule card">
            <label class="check">
              <input type="checkbox" bind:checked={r.enabled} />
              <span>{ruleLabel(r)}</span>
            </label>
            {#if r.kind !== 'afterLastLog'}
              <label class="time">
                <span class="visually-hidden">{t('welcome.time')}</span>
                <input type="time" bind:value={r.time} required />
              </label>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="small muted">{t('welcome.remindersNote')}</p>
    </section>
  {/if}

  <div class="actions">
    {#if index > 0}
      <button type="button" class="btn-ghost" onclick={() => go(index - 1)}>{t('common.back')}</button>
    {/if}
    {#if step === 'reminders'}
      <button type="button" onclick={() => finish({ remindersDeclinedAt: new Date().toISOString() })} disabled={busy}>
        {t('welcome.notNow')}
      </button>
      <button type="button" class="btn-primary" onclick={enableReminders} disabled={busy || !rules.some((r) => r.enabled)}>
        {t('welcome.enableReminders')}
      </button>
    {:else}
      <button type="button" class="btn-primary" onclick={next} disabled={busy}>
        {step === 'install' ? t('welcome.notNow') : t('common.next')}
      </button>
    {/if}
  </div>
</div>

<style>
  .welcome {
    min-height: calc(100dvh - 3rem);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h1 {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }
  .methods {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 0.25rem 0.75rem;
  }
  .ios li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .rules {
    gap: 0.5rem;
  }
  .rule {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }
  .time input {
    /* room for 12-hour formats ("10:00 AM") */
    width: 9rem;
  }
  .actions {
    margin-top: auto;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
</style>
