<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import ScoreGauge from '../components/ScoreGauge.svelte';
  import { fmtDate } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { query } from '../lib/query.svelte';

  /** Cafés you've rated, most recent visit first (README §9.3 Venues). */
  const venues = query(() => api().listVenues(), ['venues', 'ratings']);
</script>

<PageHeader title={t('venues.title')} back="/log?mode=cafe" />

{#if venues.data && venues.data.length === 0}
  <p class="muted">{t('venues.empty')}</p>
{/if}

<ul class="list">
  {#each venues.data ?? [] as v (v.venue.id)}
    <li class="card item" data-testid="venue-card">
      <strong>{v.venue.name}</strong>
      {#if v.visits}<ScoreGauge score={v.score} compact />{/if}
      <span class="small muted">
        {t('venues.visits', { count: v.visits })}
        {#if v.venue.lastDrink}· {t(`drink.${v.venue.lastDrink}`)}{/if}
        {#if v.lastVisitAt}· {fmtDate(v.lastVisitAt)}{/if}
      </span>
      {#if v.visits}
        <a class="btn" href={`#/log?mode=cafe&venue=${encodeURIComponent(v.venue.id)}`}>{t('log.sameAsLastTime')}</a>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .item {
    display: grid;
    gap: 0.35rem;
  }
</style>
