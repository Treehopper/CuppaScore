<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import ScoreGauge from '../components/ScoreGauge.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { query } from '../lib/query.svelte';

  const products = query(() => api().listProducts(), ['products', 'bags', 'ratings']);
  const hasFavourites = $derived(products.data?.some((p) => p.product.favourite) ?? true);
  // ranked by score; unrated products last (README §9.3)
  const ranked = $derived(
    [...(products.data ?? [])].sort(
      (a, b) => (b.score ?? -2) - (a.score ?? -2) || a.product.name.localeCompare(b.product.name),
    ),
  );
</script>

<PageHeader title={t('products.title')} back="/bags">
  {#snippet actions()}
    <a class="btn btn-ghost icon-btn" href="#/products/new" aria-label={t('products.add')}><Icon name="plus" /></a>
  {/snippet}
</PageHeader>

{#if products.data && products.data.length === 0}
  <p class="muted">{t('products.empty')}</p>
{/if}
{#if !hasFavourites}
  <p class="card small" data-testid="favourites-hint">{t('products.favouritesHint')}</p>
{/if}
<p><a class="btn" href="#/products/new?favourite=1"><span aria-hidden="true">♥</span>{t('products.addFavourite')}</a></p>

<ol class="list">
  {#each ranked as p (p.product.id)}
    <li>
      <a class="card item" href={`#/products/${p.product.id}`} data-testid="product-card">
        <span>
          {#if p.product.favourite}<span class="fav" role="img" aria-label={t('product.favourite')}>♥</span>{/if}
          <strong>{p.product.name}</strong> <span class="muted">· {p.product.roaster}</span>
        </span>
        {#if p.cups}<ScoreGauge score={p.score} compact />{/if}
        <span class="small muted">{t('products.bagsCount', { count: p.bags })} · {t('common.cups', { count: p.cups })}</span>
      </a>
    </li>
  {/each}
</ol>

<style>
  .item {
    display: grid;
    gap: 0.35rem;
    color: var(--text);
    text-decoration: none;
  }
  .fav {
    color: var(--accent);
  }
</style>
