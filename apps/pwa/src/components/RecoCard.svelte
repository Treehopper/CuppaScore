<script lang="ts">
  import type { RecommendationView } from '@cuplog/api';
  import { t } from '../i18n/i18n.svelte';
  import { originText } from '../lib/catalog';
  import { eur, mapUrl, whyText } from '../lib/reco';
  import Icon from './Icon.svelte';

  /** One "You might like" card (README §9.3 item 4, D1–D6). */
  let {
    rec,
    onwish,
    ondismiss,
  }: { rec: RecommendationView; onwish: (on: boolean) => void; ondismiss?: () => void } = $props();

  const c = $derived(rec.item);
</script>

<article class="card reco" data-testid="reco-card" aria-labelledby="reco-{c.id}">
  <div class="head">
    <h3 id="reco-{c.id}"><span class="name">{c.name}</span> <span class="muted roaster">· {c.roaster}</span></h3>
    {#if rec.similarity !== null}
      <span class="badge match" title={t('discover.matchHint')}>{t('discover.match', { pct: Math.round(Math.max(0, rec.similarity) * 100) })}</span>
    {/if}
  </div>
  {#if rec.explanation.kind === 'explore'}<span class="badge explore">{t('discover.somethingDifferent')}</span>{/if}
  <p class="why" data-testid="reco-why">{whyText(rec)}</p>
  <p class="small muted">
    {[originText(c), c.process ? t(`process.${c.process}`) : null, c.roastLevel ? t(`roastLevel.${c.roastLevel}`) : null, c.roastFor.map((r) => t(`roastFor.${r}`)).join(', ')].filter(Boolean).join(' · ')}
  </p>
  {#if c.tastingNotes.length}<p class="small"><em>{c.tastingNotes.join(', ')}</em></p>{/if}
  <p class="small">
    {#if rec.pricePerKg !== null}
      <strong>{t('discover.perKg', { price: eur(rec.pricePerKg) })}</strong>
      {#if c.priceEur !== null && c.weightG}<span class="muted"> · {eur(c.priceEur)} / {c.weightG} g</span>{/if}
    {:else}
      <span class="muted">{t('discover.noPrice')}</span>
    {/if}
    {#if c.roasterCity}<span class="muted"> · {c.roasterCity}</span>{/if}
  </p>
  <div class="actions">
    <button type="button" class="icon-text" aria-pressed={rec.wishlisted} onclick={() => onwish(!rec.wishlisted)}>
      <Icon name="heart" size={20} />{rec.wishlisted ? t('discover.wishlisted') : t('discover.wish')}
    </button>
    <a class="btn icon-text" href={`#/bags/new?catalog=${encodeURIComponent(c.id)}`}><Icon name="bag" size={20} />{t('discover.addBag')}</a>
    {#if c.url}<a class="btn btn-ghost" href={c.url} target="_blank" rel="noopener noreferrer">{t('discover.shop')}</a>{/if}
    <a class="btn btn-ghost icon-text" href={mapUrl(c)} target="_blank" rel="noopener noreferrer"><Icon name="map" size={20} />{t('discover.map')}</a>
    {#if ondismiss}<button type="button" class="btn-ghost" onclick={ondismiss}>{t('discover.dismiss')}</button>{/if}
  </div>
</article>

<style>
  .reco {
    display: grid;
    gap: 0.35rem;
  }
  .reco p {
    margin: 0;
  }
  .head {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .roaster {
    font-weight: 400;
  }
  .match {
    flex-shrink: 0;
  }
  .explore {
    justify-self: start;
    border-color: var(--accent-2);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.25rem;
  }
  .icon-text {
    gap: 0.35rem;
  }
  button[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--text);
  }
  button[aria-pressed='true'] :global(svg) {
    fill: var(--accent);
    color: var(--accent);
  }
</style>
