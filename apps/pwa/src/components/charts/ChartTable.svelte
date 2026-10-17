<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';

  /** "Show as table": every value of a chart, reachable without hovering (dataviz a11y). */
  let { head, rows }: { head: string[]; rows: (string | number)[][] } = $props();
</script>

<details class="table-view">
  <summary class="small">{t('chart.table')}</summary>
  <table>
    <thead>
      <tr>{#each head as h (h)}<th scope="col">{h}</th>{/each}</tr>
    </thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr>{#each r as c, j (j)}<td>{c}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</details>

<style>
  .table-view summary {
    cursor: pointer;
    color: var(--muted);
    min-height: 2.25rem;
    display: flex;
    align-items: center;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: left;
    padding: 0.25rem 0.4rem;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--muted);
    font-weight: 600;
  }
</style>
