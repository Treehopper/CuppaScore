<script lang="ts">
  /** Tiny trend line of p values (−1 … +1) in chronological order. */
  let { values, label, height = 40 }: { values: number[]; label: string; height?: number } = $props();

  const W = 200;
  const points = $derived(
    values
      .map((v, i) => {
        const x = values.length === 1 ? W / 2 : (i / (values.length - 1)) * W;
        const y = ((1 - v) / 2) * (height - 4) + 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' '),
  );
</script>

{#if values.length}
  <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
    <line x1="0" x2={W} y1={height / 2} y2={height / 2} class="zero" />
    <polyline {points} />
    {#if values.length === 1}<circle cx={W / 2} cy={((1 - values[0]!) / 2) * (height - 4) + 2} r="3" />{/if}
  </svg>
{/if}

<style>
  svg {
    width: 100%;
    height: 2.5rem;
    display: block;
  }
  .zero {
    stroke: var(--border);
    stroke-dasharray: 3 3;
  }
  polyline {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  circle {
    fill: var(--accent);
  }
</style>
