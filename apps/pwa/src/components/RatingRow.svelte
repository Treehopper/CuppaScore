<script lang="ts">
  import type { RatingDto } from '@cuplog/api';
  import { fmtDateTime, fmtNumber, fmtTime } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';

  /** `context` (bag or café) is shown in lists that mix bags and cafés. */
  let { rating, context = '', timeOnly = false }: { rating: RatingDto; context?: string; timeOnly?: boolean } = $props();
  const r = $derived(rating);
</script>

<a class="row-link" href={`#/ratings/${r.id}`} data-testid="rating-row">
  <span class="value" aria-label={r.level === 'swipe' ? t(`swipe.${r.swipe}`) : `${r.overall} ★`}>
    {#if r.level === 'swipe'}{r.swipe === 'more' ? '👍' : '👎'}{:else}★ {fmtNumber(r.overall ?? 0)}{/if}
  </span>
  <span class="what">
    <span>{r.brew ? t(`brew.${r.brew.method}`) : r.cafe ? t(`drink.${r.cafe.drink}`) : ''}</span>
    {#if context}<span class="muted"> · {context}</span>{/if}
    {#if r.meal.type !== 'unspecified' && r.meal.type !== 'none'}<span class="muted"> · {t(`meal.${r.meal.type}`)}</span>{/if}
    {#if r.excluded}<span class="badge badge-bad">{t('stats.excludedManual')}</span>{/if}
  </span>
  <span class="when small muted">{timeOnly ? fmtTime(r.ratedAt) : fmtDateTime(r.ratedAt)}</span>
</a>

<style>
  .row-link {
    display: grid;
    grid-template-columns: 3.5rem 1fr;
    grid-template-rows: auto auto;
    column-gap: 0.5rem;
    padding: 0.5rem 0.25rem;
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
  }
  .value {
    grid-row: span 2;
    align-self: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
