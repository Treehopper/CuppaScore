<script lang="ts">
  import type { RatingDto, StatsView } from '@cuplog/api';
  import { fmtDateTime, fmtNumber } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { PROFILE_ATTRS } from '../lib/domain';
  import ScoreGauge from './ScoreGauge.svelte';
  import Sparkline from './Sparkline.svelte';

  let {
    stats,
    includeOutliers = $bindable(false),
    groupLabel = (key: string) => key,
    ratings = [],
  }: {
    stats: StatsView;
    includeOutliers?: boolean;
    groupLabel?: (key: string) => string;
    /** used to show dates of excluded cups */
    ratings?: RatingDto[];
  } = $props();

  const dateOf = (id: string): string => {
    const r = ratings.find((x) => x.id === id);
    return r ? fmtDateTime(r.ratedAt) : '';
  };

  const s = $derived(stats.summary);
  const showTrimmed = $derived(s.robustMethod === 'trimmed' && s.nCounted >= 3);
  const wishHints = $derived(
    PROFILE_ATTRS.flatMap((a) => {
      const w = s.wishes[a];
      if (!w) return [];
      const total = w.more + w.justRight + w.less;
      if (w.more / total >= 0.5) return [t('stats.wishMore', { attr: t(`attr.${a}`).toLowerCase() })];
      if (w.less / total >= 0.5) return [t('stats.wishLess', { attr: t(`attr.${a}`).toLowerCase() })];
      return [];
    }),
  );
</script>

<div class="stack" data-testid="stats">
  <section class="card stack">
    <h2>{t('stats.score')}</h2>
    <ScoreGauge score={s.currentScore} />
    <p class="small muted">
      {t('stats.levelCounts', { n: s.n, swipe: s.byLevel.swipe, stars: s.byLevel.stars, advanced: s.byLevel.advanced })}
    </p>
    {#if showTrimmed}<p class="small muted">{t('stats.trimmedNote')}</p>{/if}
    {#if s.series.length > 1}
      <Sparkline values={s.series.map((x) => x.p)} label={t('stats.trend')} />
    {/if}
  </section>

  {#if s.stars}
    <section class="card">
      <dl class="grid">
        <div><dt>{t('stats.starAvg')}</dt><dd>★ {fmtNumber(s.stars.mean, { maximumFractionDigits: 2 })}</dd></div>
        <div><dt>{t('stats.median')}</dt><dd>★ {fmtNumber(s.stars.median)}</dd></div>
        <div><dt>{t('stats.trimmed')}</dt><dd>★ {fmtNumber(s.stars.trimmedMean, { maximumFractionDigits: 2 })}</dd></div>
        <div><dt>{t('stats.spread')}</dt><dd>± {fmtNumber(s.stars.sd, { maximumFractionDigits: 2 })}</dd></div>
      </dl>
    </section>
  {/if}

  {#if s.profile}
    {@const profile = s.profile}
    <section class="card">
      <h2>{t('stats.profile')}</h2>
      <ul class="list bars">
        {#each PROFILE_ATTRS as a (a)}
          {#if profile[a] !== undefined}
            <li>
              <span>{t(`attr.${a}`)}</span>
              <meter min="1" max="5" value={profile[a]}></meter>
              <span class="num">{fmtNumber(profile[a]!)}</span>
            </li>
          {/if}
        {/each}
      </ul>
      {#each wishHints as h (h)}<p class="small">{h}</p>{/each}
    </section>
  {/if}

  {#if stats.byMethod.length > 1}
    <section class="card">
      <h2>{t('stats.byMethod')}</h2>
      <ul class="list">
        {#each stats.byMethod as g (g.key)}
          <li class="group">
            <span>{groupLabel(g.key)} <span class="muted small">({g.n})</span></span>
            <ScoreGauge score={g.score} compact />
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if s.excluded.length || s.robustMethod === 'mad'}
    <section class="card">
      <h2>{t('stats.excluded')}</h2>
      {#if s.excluded.length}
        <ul class="list small">
          {#each s.excluded as e (e.ratingId)}
            <li>
              <a href={`#/ratings/${e.ratingId}`}>
                {dateOf(e.ratingId)} ·
                {e.reason.kind === 'manual' ? t('stats.excludedManual') : t('stats.excludedAuto', { z: fmtNumber(e.reason.z) })}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
      <label class="check"><input type="checkbox" bind:checked={includeOutliers} />{t('stats.includeOutliers')}</label>
    </section>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem 1rem;
    margin: 0;
  }
  dt {
    font-size: 0.8rem;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .bars li,
  .group {
    display: grid;
    grid-template-columns: 7rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }
  .group {
    grid-template-columns: minmax(6rem, 40%) 1fr;
  }
  meter {
    width: 100%;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
</style>
