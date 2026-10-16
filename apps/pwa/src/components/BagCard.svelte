<script lang="ts">
  import type { BagView } from '@cuplog/api';
  import { t } from '../i18n/i18n.svelte';
  import { bagTitle } from '../lib/labels';
  import BagBadges from './BagBadges.svelte';
  import ScoreGauge from './ScoreGauge.svelte';

  let { view }: { view: BagView } = $props();
</script>

<a class="card bag" href={`#/bags/${view.bag.id}`} data-testid="bag-card">
  <div class="head">
    <strong>{bagTitle(view)}</strong>
    <BagBadges {view} />
  </div>
  {#if view.cups > 0}<ScoreGauge score={view.score} compact />{/if}
  <div class="meta small muted">
    <span>{t('common.cups', { count: view.cups })}</span>
    {#if view.freshness.daysSinceRoast !== null && view.status !== 'finished'}
      <span>· {t('bags.daysSinceRoast', { days: view.freshness.daysSinceRoast })}</span>
    {/if}
    {#if view.cupsLeft !== null && view.status !== 'finished'}
      <span>· {t('bags.cupsLeft', { count: view.cupsLeft })}</span>
    {/if}
  </div>
</a>

<style>
  .bag {
    display: grid;
    gap: 0.4rem;
    text-decoration: none;
    color: var(--text);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: baseline;
    justify-content: space-between;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
