<script lang="ts">
  import { fmtNumber } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { activeTheme } from '../themes/apply.svelte';

  /** 0.5 … 5 in half steps; null = not rated yet. Tap the left part of a star for a half. */
  let { value = $bindable(null), label }: { value?: number | null; label: string } = $props();
  const uid = $props.id();

  // the coffee themes draw beans instead of stars (README §10)
  const bean = $derived(activeTheme.id === 'crema' || activeTheme.id === 'espresso');
  const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
  const BEAN = 'M12 2.5c4.7 0 7.5 4.3 7.5 9.5s-2.8 9.5-7.5 9.5-7.5-4.3-7.5-9.5S7.3 2.5 12 2.5z';
  const SEAM = 'M12 3.5c-2.2 2.6-2.2 5.6 0 8.5s2.2 5.9 0 8.5';

  // one handler on the slider: the stars are plain spans, so no controls are nested in it
  function pick(e: MouseEvent): void {
    const el = (e.target as Element).closest<HTMLElement>('[data-star]');
    if (!el) return;
    const i = Number(el.dataset.star);
    const r = el.getBoundingClientRect();
    // left 40 % = half star, so a tap near the centre counts as a whole star
    const half = e.clientX - r.left < r.width * 0.4;
    value = half ? i - 0.5 : i;
  }

  function onKey(e: KeyboardEvent): void {
    const cur = value ?? 0;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, cur + 0.5);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0.5, cur - 0.5);
    else if (e.key === 'Home') next = 0.5;
    else if (e.key === 'End') next = 5;
    if (next !== null) {
      e.preventDefault();
      value = next;
    }
  }

  const fill = (i: number): number => (value === null ? 0 : value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0);
</script>

<div
  class="stars"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin={0.5}
  aria-valuemax={5}
  aria-valuenow={value ?? undefined}
  aria-valuetext={value === null ? t('log.pickStars') : t('log.starsValue', { value: fmtNumber(value) })}
  onkeydown={onKey}
  onclick={pick}
  data-testid="star-input"
>
  {#each [1, 2, 3, 4, 5] as i (i)}
    <span class="star" aria-hidden="true" data-star={i}>
      <svg viewBox="0 0 24 24" width="40" height="40">
        <defs>
          <clipPath id={`${uid}-half-${i}`}><rect x="0" y="0" width={24 * fill(i)} height="24" /></clipPath>
        </defs>
        <path d={bean ? BEAN : STAR} class="empty" />
        <path d={bean ? BEAN : STAR} class="full" clip-path={`url(#${uid}-half-${i})`} />
        {#if bean}<path d={SEAM} class="seam" />{/if}
      </svg>
    </span>
  {/each}
  <span class="value" aria-hidden="true">{value === null ? '' : fmtNumber(value)}</span>
</div>

<style>
  .stars {
    display: flex;
    align-items: center;
    gap: 0.1rem;
    border-radius: var(--radius-sm);
    width: fit-content;
    cursor: pointer;
  }
  .star {
    display: inline-flex;
    padding: 0.15rem;
  }
  .empty {
    fill: none;
    stroke: var(--star);
    stroke-width: 1.4;
  }
  .full {
    fill: var(--star);
    stroke: var(--star);
    stroke-width: 1.4;
  }
  .seam {
    fill: none;
    stroke: var(--bg);
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  .value {
    margin-left: 0.5rem;
    min-width: 2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
