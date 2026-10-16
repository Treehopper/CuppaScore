<script lang="ts">
  import { fmtNumber } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { displayScore } from '../lib/dates';

  /** Combined "more of this" score, −1 … +1 (README §5.5). */
  let { score, compact = false }: { score: number | null; compact?: boolean } = $props();

  const value = $derived(score === null ? null : displayScore(score));
  const width = $derived(value === null ? 0 : Math.abs(value) / 2);
</script>

<div class="gauge" class:compact data-testid="score-gauge" data-score={value ?? ''}>
  {#if !compact}<span class="end" aria-hidden="true">☕−</span>{/if}
  <div
    class="track"
    role="meter"
    aria-label={t('stats.score')}
    aria-valuemin={-100}
    aria-valuemax={100}
    aria-valuenow={value ?? 0}
    aria-valuetext={value === null ? t('stats.noScore') : `${value > 0 ? '+' : ''}${fmtNumber(value)}`}
  >
    <span class="mid"></span>
    {#if value !== null}
      <span class="bar" class:neg={value < 0} style:width={`${width}%`} style:left={value < 0 ? `${50 - width}%` : '50%'}></span>
    {/if}
  </div>
  {#if !compact}<span class="end" aria-hidden="true">☕+</span>{/if}
  <strong class="num">{value === null ? '–' : `${value > 0 ? '+' : ''}${fmtNumber(value)}`}</strong>
</div>

<style>
  .gauge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .track {
    position: relative;
    flex: 1;
    height: 0.6rem;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--border);
    overflow: hidden;
    min-width: 4rem;
  }
  .mid {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--muted);
  }
  .bar {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--good);
  }
  .bar.neg {
    background: var(--bad);
  }
  .num {
    min-width: 2.6rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .end {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .compact .track {
    height: 0.45rem;
  }
</style>
