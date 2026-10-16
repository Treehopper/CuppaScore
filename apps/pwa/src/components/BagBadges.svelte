<script lang="ts">
  import type { BagView } from '@cuplog/api';
  import { t } from '../i18n/i18n.svelte';

  let { view }: { view: BagView } = $props();
  const f = $derived(view.freshness);
</script>

<span class="badges">
  <span class="badge">{t(`bagStatus.${view.status}`)}</span>
  {#if view.warnings.includes('pastExpiry')}
    <span class="badge badge-bad">{t('warning.pastExpiry')}</span>
  {:else if view.status !== 'finished' && f.daysToExpiry !== null && f.daysToExpiry <= 14}
    <span class="badge badge-bad">{t('bags.expiresIn', { days: f.daysToExpiry })}</span>
  {/if}
  {#if view.warnings.includes('staleRoast') && f.daysSinceRoast !== null}
    <span class="badge badge-bad">{t('warning.staleRoast', { days: f.daysSinceRoast })}</span>
  {/if}
</span>

<style>
  .badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
