<script lang="ts">
  import type { DueReminder } from '@cuplog/api';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { bagTitle } from '../lib/labels';
  import { query } from '../lib/query.svelte';
  import { reminders } from '../lib/reminders.svelte';
  import Icon from './Icon.svelte';

  /** One combined reminder banner (README §12.3), no modal and no sound. */
  const bagId = $derived(reminders.bag?.payload.bagId ?? null);
  const bag = query(() => (bagId ? api().getBag(bagId) : Promise.resolve(null)), ['bags']);

  function text(d: DueReminder): string {
    switch (d.kind) {
      case 'fewerThanBy':
        return t('reminder.fewerThanBy', { cups: d.payload.cupsToday ?? 0, time: d.time });
      case 'afterLastLog':
        return t('reminder.afterLastLog');
      default:
        return t(`reminder.${d.kind}`, { time: d.time });
    }
  }
</script>

{#if reminders.visible}
  <section class="banner" role="status" aria-label={t('reminder.label')} data-testid="reminder-banner">
    <div class="msg">
      <Icon name="bell" size={20} />
      <div>
        {#if reminders.primary}<p class="primary">{text(reminders.primary)}</p>{/if}
        {#if reminders.bag && bag.data}
          <p class:small={!!reminders.primary}>
            <a href={`#/bags/${bag.data.bag.id}`}>{bagTitle(bag.data)}</a>
            {t('reminder.bagExpiring', { days: reminders.bag.payload.daysLeft ?? 0 })}
          </p>
        {/if}
      </div>
    </div>
    <div class="actions">
      <button type="button" class="btn-primary" onclick={() => reminders.logNow()}>{t('reminder.logNow')}</button>
      <button type="button" onclick={() => reminders.act('later')}>{t('common.later')}</button>
      <button type="button" class="btn-ghost" onclick={() => reminders.act('notToday')}>{t('reminder.notToday')}</button>
    </div>
  </section>
{/if}

<style>
  .banner {
    display: grid;
    gap: 0.6rem;
    margin: 0.75rem 1rem 0;
    padding: 0.75rem;
    border-radius: var(--radius);
    background: var(--surface);
    border: 2px solid var(--accent);
  }
  .msg {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    color: var(--text);
  }
  .msg :global(svg) {
    flex-shrink: 0;
    color: var(--accent);
    margin-top: 0.1rem;
  }
  p {
    margin: 0;
  }
  .primary {
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
</style>
