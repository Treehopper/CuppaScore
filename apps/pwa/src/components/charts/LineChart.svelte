<script lang="ts" module>
  export interface Point {
    x: number;
    /** −1 … +1 unless `yDomain` says otherwise */
    y: number;
  }
  export interface Tick {
    value: number;
    label: string;
  }
</script>

<script lang="ts">
  import ChartTable from './ChartTable.svelte';

  /**
   * One series over x (dataviz: 2px line, 10% area wash to the zero line, end dot with a surface
   * ring, hairline grid, crosshair + tooltip on pointer and arrow keys, table view).
   */
  let {
    points,
    label,
    xTicks,
    yTicks = [
      { value: -1, label: '−100' },
      { value: 0, label: '0' },
      { value: 1, label: '+100' },
    ],
    yDomain = [-1, 1],
    tooltip,
    table,
    height = 170,
  }: {
    points: Point[];
    label: string;
    xTicks: Tick[];
    yTicks?: Tick[];
    yDomain?: [number, number];
    tooltip: (p: Point, i: number) => { value: string; detail: string };
    table: { head: string[]; rows: (string | number)[][] };
    height?: number;
  } = $props();

  const PAD = { l: 38, r: 14, t: 12, b: 24 };
  let width = $state(320);
  const x0 = $derived(Math.min(...points.map((p) => p.x), ...xTicks.map((t) => t.value)));
  const x1 = $derived(Math.max(...points.map((p) => p.x), ...xTicks.map((t) => t.value)));
  const sx = (v: number): number => PAD.l + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (width - PAD.l - PAD.r);
  const sy = (v: number): number => PAD.t + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * (height - PAD.t - PAD.b);
  const zero = $derived(sy(Math.min(Math.max(0, yDomain[0]), yDomain[1])));

  const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(''));
  const area = $derived(
    points.length > 1 ? `${line}L${sx(points.at(-1)!.x).toFixed(1)},${zero}L${sx(points[0]!.x).toFixed(1)},${zero}Z` : '',
  );

  let active = $state<number | null>(null);
  const tip = $derived(active === null ? null : tooltip(points[active]!, active));

  function nearest(clientX: number, el: Element): number {
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(sx(points[i]!.x) - x) < Math.abs(sx(points[best]!.x) - x)) best = i;
    return best;
  }

  function onKey(e: KeyboardEvent): void {
    if (!points.length) return;
    if (e.key === 'ArrowRight') active = Math.min(points.length - 1, (active ?? -1) + 1);
    else if (e.key === 'ArrowLeft') active = Math.max(0, (active ?? points.length) - 1);
    else if (e.key === 'Escape') active = null;
    else return;
    e.preventDefault();
  }
</script>

<div class="chart">
  <div class="plot" bind:clientWidth={width}>
  <!-- the crosshair is a slider over the points: arrows move it, the value text reads it -->
  <div
    class="scrub"
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={Math.max(0, points.length - 1)}
    aria-valuenow={active ?? 0}
    aria-valuetext={tip ? `${tip.value}, ${tip.detail}` : label}
    onpointermove={(e) => (active = nearest(e.clientX, e.currentTarget))}
    onpointerleave={() => (active = null)}
    onkeydown={onKey}
    onblur={() => (active = null)}
  >
    <svg {width} {height} aria-hidden="true">
      {#each yTicks as t, i (i)}
        <line class="grid" x1={PAD.l} x2={width - PAD.r} y1={sy(t.value)} y2={sy(t.value)} />
        <text class="tick" x={PAD.l - 6} y={sy(t.value)} dy="0.32em" text-anchor="end">{t.label}</text>
      {/each}
      {#each xTicks as t, i (i)}
        <text class="tick" x={sx(t.value)} y={height - 6} text-anchor="middle">{t.label}</text>
      {/each}
      {#if area}<path class="area" d={area} />{/if}
      <path class="line" d={line} />
      {#if points.length}
        {@const last = points.at(-1)!}
        <circle class="dot" cx={sx(last.x)} cy={sy(last.y)} r="4.5" />
      {/if}
      {#if active !== null}
        {@const p = points[active]!}
        <line class="cross" x1={sx(p.x)} x2={sx(p.x)} y1={PAD.t} y2={height - PAD.b} />
        <circle class="dot" cx={sx(p.x)} cy={sy(p.y)} r="5" />
      {/if}
    </svg>
  </div>
    {#if tip && active !== null}
      <div class="tip" style:left={`${Math.min(Math.max(sx(points[active]!.x), 70), width - 70)}px`} aria-hidden="true">
        <strong>{tip.value}</strong>
        <span>{tip.detail}</span>
      </div>
    {/if}
  </div>
  <ChartTable head={table.head} rows={table.rows} />
</div>

<style>
  .plot {
    position: relative;
    width: 100%;
  }
  .scrub {
    border-radius: var(--radius-sm);
    touch-action: pan-y;
  }
  svg {
    display: block;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }
  .tick {
    fill: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .area {
    fill: var(--accent);
    opacity: 0.1;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .dot {
    fill: var(--accent);
    stroke: var(--surface);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }
  .tip {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    display: grid;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--text);
    color: var(--bg);
    font-size: 0.8rem;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
