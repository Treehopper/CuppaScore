<script lang="ts">
  import { t } from '../i18n/i18n.svelte';

  type Dir = 'more' | 'less';

  /** Drag right = "more of this", left = "less of this"; releasing past 30 % of the width commits (README §9.2). */
  let {
    title,
    subtitle,
    disabled = false,
    onswipe,
  }: { title: string; subtitle: string; disabled?: boolean; onswipe: (dir: Dir) => void } = $props();

  const THRESHOLD = 0.3;
  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let card = $state<HTMLElement>();
  let dx = $state(0);
  let startX = 0;
  let pointerId = $state<number | null>(null);
  let flying = $state(false);

  const width = (): number => card?.offsetWidth || 1;
  const progress = $derived(Math.max(-1, Math.min(1, dx / (width() * THRESHOLD))));

  function down(e: PointerEvent): void {
    if (disabled || flying || pointerId !== null) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    card?.setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    dx = e.clientX - startX;
  }

  function up(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (Math.abs(dx) >= width() * THRESHOLD) {
      const dir: Dir = dx > 0 ? 'more' : 'less';
      flying = true;
      dx = Math.sign(dx) * width() * 1.5;
      setTimeout(
        () => {
          onswipe(dir);
          flying = false;
          dx = 0;
        },
        reduceMotion ? 0 : 180,
      );
    } else {
      dx = 0;
    }
  }

  function cancel(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    dx = 0;
  }
</script>

<div class="track">
  <div class="hints" aria-hidden="true">
    <span class:active={progress <= -1}>◀ {t('swipe.less')}</span>
    <span class:active={progress >= 1}>{t('swipe.more')} ▶</span>
  </div>
  <div
    bind:this={card}
    class="card swipe"
    class:dragging={pointerId !== null}
    class:disabled
    style:transform={`translateX(${dx}px) rotate(${dx / 25}deg)`}
    style:--glow={progress > 0 ? 'var(--good)' : 'var(--bad)'}
    style:--glow-a={`${Math.round(Math.abs(progress) * 100)}%`}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={cancel}
    data-testid="swipe-card"
    aria-hidden="true"
  >
    <strong>{title}</strong>
    <span class="muted small">{subtitle}</span>
  </div>
</div>

<style>
  .track {
    overflow: hidden;
    margin: -0.25rem;
    padding: 0.25rem;
  }
  .hints {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .hints .active {
    color: var(--text);
    font-weight: 700;
  }
  .swipe {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 1.4rem 1rem;
    text-align: center;
    touch-action: pan-y;
    user-select: none;
    cursor: grab;
    transition: transform 180ms ease-out;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--glow) var(--glow-a), transparent);
  }
  .swipe.dragging {
    cursor: grabbing;
    transition: none;
  }
  .swipe.disabled {
    opacity: 0.6;
  }
  @media (prefers-reduced-motion: reduce) {
    .swipe {
      transition: none;
    }
  }
</style>
