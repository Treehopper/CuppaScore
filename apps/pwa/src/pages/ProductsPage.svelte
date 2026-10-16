<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import ScoreGauge from '../components/ScoreGauge.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { query } from '../lib/query.svelte';

  const products = query(() => api().listProducts(), ['products', 'bags', 'ratings']);
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

<ol class="list">
  {#each ranked as p (p.product.id)}
    <li>
      <a class="card item" href={`#/products/${p.product.id}`} data-testid="product-card">
        <span><strong>{p.product.name}</strong> <span class="muted">· {p.product.roaster}</span></span>
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
</style>
