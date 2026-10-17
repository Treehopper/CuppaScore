<script lang="ts" module>
  export interface Bar {
    key: string;
    label: string;
    /** −1 … +1 */
    value: number;
    n: number;
  }
</script>

<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import ChartTable from './ChartTable.svelte';

  /**
   * Effects above / below "no effect" (dataviz: diverging bars, two hues and a neutral axis).
   * Polarity is also carried by direction and the signed value, never colour alone.
   */
  let { bars, label }: { bars: Bar[]; label: string } = $props();

  const fmt = (v: number): string => {
    const n = Math.round(v * 100);
    return n > 0 ? `+${n}` : String(n);
  };
  // symmetric scale, at least ±20 so tiny effects don't look dramatic
  const max = $derived(Math.max(0.2, ...bars.map((b) => Math.abs(b.value))));
  let active = $state<string | null>(null);
</script>

<div class="chart" role="group" aria-label={label}>
  <ul class="rows">
    {#each bars as b (b.key)}
      {@const w = (Math.abs(b.value) / max) * 50}
      <li>
        <button
          type="button"
          class="row"
          aria-label={`${b.label}: ${fmt(b.value)} · ${t('common.cups', { count: b.n })}`}
          onpointerenter={() => (active = b.key)}
          onpointerleave={() => (active = null)}
          onfocus={() => (active = b.key)}
          onblur={() => (active = null)}
          onclick={() => (active = active === b.key ? null : b.key)}
        >
        <span class="name">{b.label}</span>
        <span class="track" aria-hidden="true">
          <span class="axis"></span>
          <span
            class="bar"
            class:neg={b.value < 0}
            class:on={active === b.key}
            style:width={`${w}%`}
            style:left={b.value < 0 ? `${50 - w}%` : '50%'}
          ></span>
        </span>
        <span class="val" aria-hidden="true">{fmt(b.value)}</span>
          {#if active === b.key}
            <span class="tip" aria-hidden="true"><strong>{fmt(b.value)}</strong> {t('common.cups', { count: b.n })}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
  <ChartTable head={[label, t('chart.effect'), t('chart.cups')]} rows={bars.map((b) => [b.label, fmt(b.value), b.n])} />
</div>

<style>
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
  }
  .row {
    position: relative;
    width: 100%;
    padding: 0 0.25rem;
    border: none;
    background: transparent;
    color: var(--text);
    font-weight: 400;
    text-align: left;
    display: grid;
    grid-template-columns: minmax(5rem, 38%) 1fr 2.6rem;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;
    border-radius: var(--radius-sm);
    outline-offset: 1px;
  }
  .name {
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }
  .track {
    position: relative;
    height: 14px;
  }
  .axis {
    position: absolute;
    left: 50%;
    top: -4px;
    bottom: -4px;
    width: 1px;
    background: var(--border);
  }
  .bar {
    position: absolute;
    top: 0;
    height: 14px;
    background: var(--more);
    /* rounded data-end, square at the baseline */
    border-radius: 0 4px 4px 0;
  }
  .bar.neg {
    background: var(--less);
    border-radius: 4px 0 0 4px;
  }
  .bar.on {
    filter: brightness(1.12);
  }
  .val {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .tip {
    position: absolute;
    right: 3rem;
    bottom: calc(100% - 0.25rem);
    z-index: 2;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--text);
    color: var(--bg);
    font-size: 0.8rem;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
