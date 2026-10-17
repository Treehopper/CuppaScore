<script lang="ts">
  import type { InsightsView } from '@cuplog/api';
  import PageHeader from '../components/PageHeader.svelte';
  import ScoreGauge from '../components/ScoreGauge.svelte';
  import Columns from '../components/charts/Columns.svelte';
  import DivergingBars, { type Bar } from '../components/charts/DivergingBars.svelte';
  import LineChart from '../components/charts/LineChart.svelte';
  import { fmtMoney, fmtNumber } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { MIN_INSIGHT_CUPS } from '../lib/domain';
  import { query } from '../lib/query.svelte';

  /** Insights (README §9.3 item 3, Epic C): what moves your score, freshness, beans, cafés. */
  const insights = query(() => api().getInsights(), ['ratings', 'bags', 'products', 'venues', 'settings']);
  const products = query(() => api().listProducts(), ['products']);
  const venues = query(() => api().listVenues(), ['venues']);

  type Effect = NonNullable<InsightsView['context']>['effects'][number];
  const productName = (id: string): string => products.data?.find((p) => p.product.id === id)?.product.name ?? '–';
  const venueName = (id: string): string => venues.data?.find((v) => v.venue.id === id)?.venue.name ?? '–';

  function bars(i: InsightsView, group: Effect['group']): Bar[] {
    return (i.context?.effects ?? [])
      .filter((e) => e.group === group && !(group === 'meal' && e.level === 'unspecified'))
      .map((e) => ({
        key: e.level,
        label: group === 'method' ? t(`brew.${e.level}`) : group === 'drink' ? t(`drink.${e.level}`) : t(`${group}.${e.level}`),
        value: e.effect,
        n: e.n,
      }));
  }

  const score = (p: number): string => {
    const n = Math.round(p * 100);
    return n > 0 ? `+${n}` : String(n);
  };

  /** "best around N days after roast" from the curve's highest knot */
  const peak = (curve: { day: number; effect: number }[]): number =>
    curve.reduce((best, k) => (k.effect > best.effect ? k : best), curve[0]!).day;

  const avg = (xs: (number | null)[]): number | null => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
</script>

<PageHeader title={t('nav.stats')} />

{#if insights.data}
  {@const i = insights.data}
  {#if i.cups === 0}
    <p class="muted">{t('insights.empty')}</p>
  {:else}
    <div class="stack" data-testid="insights">
      <div class="tiles">
        <div class="card tile">
          <span class="small muted">{t('insights.cups')}</span>
          <strong>{fmtNumber(i.cups)}</strong>
          <span class="small muted">{t('insights.levels', { swipe: i.byLevel.swipe, stars: i.byLevel.stars, advanced: i.byLevel.advanced })}</span>
        </div>
        {#if avg(i.products.map((p) => p.costPerCup)) !== null}
          <div class="card tile">
            <span class="small muted">{t('insights.homeCost')}</span>
            <strong>{fmtMoney(avg(i.products.map((p) => p.costPerCup))!)}</strong>
            <span class="small muted">{t('insights.perCup')}</span>
          </div>
        {/if}
        {#if i.cafe.avgPriceEur !== null}
          <div class="card tile">
            <span class="small muted">{t('insights.cafeCost')}</span>
            <strong>{fmtMoney(i.cafe.avgPriceEur)}</strong>
            <span class="small muted">{t('insights.perCup')}</span>
          </div>
        {/if}
      </div>

      <section class="card stack" aria-labelledby="i-context">
        <h2 id="i-context">{t('insights.context')}</h2>
        {#if i.context}
          <p class="small muted">{t('insights.contextHint')}</p>
          {#each [['meal', 'insights.byMeal'], ['timeOfDay', 'insights.byTime'], ['method', 'insights.byMethod'], ['drink', 'insights.byDrink']] as const as [group, title] (group)}
            {@const b = bars(i, group)}
            <!-- one level alone compares to nothing -->
            {#if b.length > 1}
              <h3>{t(title)}</h3>
              <DivergingBars bars={b} label={t(title)} />
            {/if}
          {/each}
        {:else}
          <p class="muted">{t('insights.needMore', { n: MIN_INSIGHT_CUPS })}</p>
        {/if}
      </section>

      {#if i.context?.freshness}
        {@const curve = i.context.freshness}
        <section class="card stack" aria-labelledby="i-fresh" data-testid="freshness">
          <h2 id="i-fresh">{t('insights.freshness')}</h2>
          <p>{t('insights.peak', { days: peak(curve) })}</p>
          <LineChart
            points={curve.map((k) => ({ x: k.day, y: k.effect }))}
            label={t('insights.freshness')}
            xTicks={curve.map((k) => ({ value: k.day, label: t('insights.dayTick', { days: k.day }) }))}
            yTicks={[
              { value: -0.5, label: '−50' },
              { value: 0, label: '0' },
              { value: 0.5, label: '+50' },
            ]}
            yDomain={[-0.5, 0.5]}
            tooltip={(p) => ({ value: score(p.y), detail: t('insights.daysAfterRoast', { days: p.x }) })}
            table={{ head: [t('insights.daysCol'), t('chart.effect')], rows: curve.map((k) => [k.day, score(k.effect)]) }}
          />
        </section>
      {/if}

      {#if i.products.some((p) => p.cups > 0)}
        <section class="card stack" aria-labelledby="i-beans">
          <h2 id="i-beans">{t('insights.beans')}</h2>
          <ol class="list beans">
            {#each i.products.filter((p) => p.cups > 0) as p (p.productId)}
              <li>
                <a class="bean" href={`#/products/${p.productId}`} data-testid="bean-row">
                  <span class="name">{productName(p.productId)}</span>
                  <ScoreGauge score={p.beanScore ?? p.score} compact />
                  <span class="small muted">
                    {t('common.cups', { count: p.cups })}{#if p.costPerCup !== null}{` · ${t('insights.costPerCup', { cost: fmtMoney(p.costPerCup) })}`}{/if}
                  </span>
                </a>
              </li>
            {/each}
          </ol>
          {#if i.context}<p class="small muted">{t('insights.beanHint')}</p>{/if}
        </section>
      {/if}

      <section class="card stack" aria-labelledby="i-dist">
        <h2 id="i-dist">{t('insights.distribution')}</h2>
        {#if i.byLevel.stars + i.byLevel.advanced > 0}
          <Columns
            bins={i.distribution.stars.map((b) => ({ key: String(b.value), label: fmtNumber(b.value), n: b.n }))}
            label={t('insights.distribution')}
            head={[t('log.stars'), t('chart.cups')]}
          />
        {/if}
        {#if i.byLevel.swipe > 0}
          <p class="small">
            👍 {t('swipe.more')}: <strong>{i.distribution.swipe.more}</strong> · 👎 {t('swipe.less')}:
            <strong>{i.distribution.swipe.less}</strong>
          </p>
        {/if}
      </section>

      {#if i.profile.n > 0 || i.profile.likedTags.length}
        <section class="card stack" aria-labelledby="i-profile">
          <h2 id="i-profile">{t('insights.profile')}</h2>
          {#if Object.keys(i.profile.attrs).length}
            <ul class="list attrs">
              {#each Object.entries(i.profile.attrs) as [attr, v] (attr)}
                <li class="attr">
                  <span>{t(`attr.${attr}`)}</span>
                  <span class="meter" role="meter" aria-valuemin={1} aria-valuemax={5} aria-valuenow={v} aria-label={t(`attr.${attr}`)}>
                    <span style:width={`${((v - 1) / 4) * 100}%`}></span>
                  </span>
                  <strong>{fmtNumber(v)}</strong>
                </li>
              {/each}
            </ul>
          {/if}
          {#each i.profile.wishes.filter((w) => w.more + w.less > w.justRight) as w (w.attr)}
            <p class="small">
              {w.more >= w.less
                ? t('stats.wishMore', { attr: t(`attr.${w.attr}`).toLowerCase() })
                : t('stats.wishLess', { attr: t(`attr.${w.attr}`).toLowerCase() })}
            </p>
          {/each}
          {#if i.profile.likedTags.length}
            <p class="small muted">{t('insights.likedTags')}</p>
            <div class="chips">
              {#each i.profile.likedTags.slice(0, 8) as tag (tag.tag)}
                <span class="chip">{t(`flavour.${tag.tag}`)} · {tag.n}</span>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      {#if i.cafe.ranking.length}
        <section class="card stack" aria-labelledby="i-cafe" data-testid="venue-ranking">
          <h2 id="i-cafe">{t('insights.venues')}</h2>
          {#each i.cafe.ranking as r (r.drink)}
            <h3>{t(`drink.${r.drink}`)}</h3>
            <ol class="list">
              {#each r.venues as v (v.venueId)}
                <li class="venue">
                  <span>{venueName(v.venueId)}</span>
                  <ScoreGauge score={v.score} compact />
                  <span class="small muted">{t('common.cups', { count: v.n })}</span>
                </li>
              {/each}
            </ol>
          {/each}
        </section>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: var(--gap);
  }
  .tile {
    display: grid;
    gap: 0.15rem;
  }
  .tile strong {
    font-size: 1.6rem;
    font-weight: 600;
  }
  h3 {
    margin: 0.5rem 0 0;
    font-size: 0.95rem;
  }
  .bean {
    display: grid;
    gap: 0.2rem;
    padding: 0.4rem 0;
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
  }
  .bean .name {
    font-weight: 600;
  }
  .attrs {
    gap: 0.4rem;
  }
  .attr,
  .venue {
    display: grid;
    grid-template-columns: minmax(6rem, 35%) 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }
  .meter {
    height: 10px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    overflow: hidden;
  }
  .meter > span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 0 4px 4px 0;
  }
</style>
