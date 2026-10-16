<script lang="ts">
  import BagCard from '../components/BagCard.svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import StatsPanel from '../components/StatsPanel.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { methodLabel } from '../lib/labels';
  import { query } from '../lib/query.svelte';

  let { id }: { id: string } = $props();

  let includeOutliers = $state(false);
  const product = query(() => api().getProduct(id), ['products']);
  const bags = query(() => api().listBags({ productId: id }), ['bags', 'ratings']);
  const stats = query(() => api().getProductStats(id, { includeOutliers }), ['ratings', 'settings']);
  const ratings = query(() => api().listRatings({ productId: id }), ['ratings']);

  const bagLabel = (bagId: string): string => bags.data?.find((b) => b.bag.id === bagId)?.bag.label || t('bags.unnamed');
</script>

{#if product.error}
  <PageHeader title={t('page.notFound')} back="/products" />
{:else if product.data}
  {@const p = product.data}
  <PageHeader title={p.name} back="/products">
    {#snippet actions()}
      <a class="btn btn-ghost icon-btn" href={`#/products/${id}/edit`} aria-label={t('common.edit')}><Icon name="edit" /></a>
    {/snippet}
  </PageHeader>

  <div class="stack">
    <section class="card">
      <p><strong>{p.roaster}</strong></p>
      <p class="small">
        {[p.origin.country, p.origin.region, p.origin.farm].filter(Boolean).join(' · ')}
        {#if p.process}· {t(`process.${p.process}`)}{/if}
        {#if p.roastLevel}· {t(`roastLevel.${p.roastLevel}`)}{/if}
        {#if p.roastFor.length}· {p.roastFor.map((r) => t(`roastFor.${r}`)).join(', ')}{/if}
      </p>
      {#if p.varietals.length}<p class="small muted">{p.varietals.join(', ')}</p>{/if}
      {#if p.labelNotes.length}<p class="small"><em>{p.labelNotes.join(', ')}</em></p>{/if}
    </section>

    {#if stats.data && stats.data.summary.n > 0}
      <StatsPanel stats={stats.data} bind:includeOutliers groupLabel={methodLabel} ratings={ratings.data ?? []} />
      {#if stats.data.byBag.length > 1}
        <section class="card">
          <h2>{t('stats.byBag')}</h2>
          <ul class="list">
            {#each stats.data.byBag as g (g.key)}
              <li class="small">{bagLabel(g.key)} ({g.n}): {g.score === null ? '–' : Math.round(g.score * 100)}</li>
            {/each}
          </ul>
        </section>
      {/if}
    {/if}

    <section>
      <div class="row head">
        <h2>{t('bags.title')}</h2>
        <a class="btn" href={`#/bags/new?product=${id}`}><Icon name="plus" size={20} />{t('bags.add')}</a>
      </div>
      <ul class="list">
        {#each bags.data ?? [] as view (view.bag.id)}<li><BagCard {view} /></li>{/each}
      </ul>
    </section>
  </div>
{/if}

<style>
  .head {
    justify-content: space-between;
  }
  .head > * {
    flex: none;
  }
</style>
