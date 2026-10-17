<script lang="ts">
  import ChartTable from './ChartTable.svelte';

  /** Magnitude per bin (dataviz: one sequential hue, ≤ 24px columns, value on the tallest cap). */
  let {
    bins,
    label,
    head,
    fmt = (n: number) => String(n),
  }: { bins: { key: string; label: string; n: number }[]; label: string; head: [string, string]; fmt?: (n: number) => string } =
    $props();

  const max = $derived(Math.max(1, ...bins.map((b) => b.n)));
  const top = $derived(bins.reduce((m, b) => (b.n > m ? b.n : m), 0));
  let active = $state<string | null>(null);
</script>

<div class="chart" role="group" aria-label={label}>
  <div class="cols">
    {#each bins as b (b.key)}
      <button
        type="button"
        class="col"
        aria-label={`${b.label} ${fmt(b.n)}`}
        onpointerenter={() => (active = b.key)}
        onpointerleave={() => (active = null)}
        onfocus={() => (active = b.key)}
        onblur={() => (active = null)}
        onclick={() => (active = active === b.key ? null : b.key)}
      >
        <!-- label first so the visible text reads in the same order as the accessible name -->
        <span class="lab" aria-hidden="true">{b.label}</span>
        <span class="val" aria-hidden="true">{b.n > 0 && (b.n === top || active === b.key) ? fmt(b.n) : ''}</span>
        <span class="bar" class:on={active === b.key} style:height={`${(b.n / max) * 100}%`}></span>
      </button>
    {/each}
  </div>
  <ChartTable {head} rows={bins.map((b) => [b.label, fmt(b.n)])} />
</div>

<style>
  .cols {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 2px;
    height: 8.5rem;
    border-bottom: 1px solid var(--border);
    padding-top: 1.1rem;
    /* room for the bin labels below the baseline */
    margin-bottom: 1.6rem;
  }
  .col {
    position: relative;
    min-height: 0;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    border-radius: var(--radius-sm);
  }
  .bar {
    width: min(100%, 24px);
    min-height: 0;
    background: var(--star);
    border-radius: 4px 4px 0 0;
  }
  .bar.on {
    filter: brightness(1.12);
  }
  .val {
    position: absolute;
    top: -1.1rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .lab {
    position: absolute;
    bottom: -1.35rem;
    font-size: 0.7rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
