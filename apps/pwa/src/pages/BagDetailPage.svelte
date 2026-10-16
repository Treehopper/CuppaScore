<script lang="ts">
  import BagBadges from '../components/BagBadges.svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import RatingRow from '../components/RatingRow.svelte';
  import StatsPanel from '../components/StatsPanel.svelte';
  import { fmtDate, fmtMoney } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { todayIso } from '../lib/dates';
  import { showError } from '../lib/errors';
  import { bagTitle, methodLabel, productTitle } from '../lib/labels';
  import { query } from '../lib/query.svelte';

  let { id }: { id: string } = $props();

  let includeOutliers = $state(false);
  const view = query(() => api().getBag(id), ['bags', 'ratings', 'products']);
  const stats = query(() => api().getBagStats(id, { includeOutliers }), ['ratings', 'settings']);
  const ratings = query(() => api().listRatings({ bagId: id }), ['ratings']);

  async function patch(p: { openedAt?: string | null; finishedAt?: string | null }): Promise<void> {
    try {
      await api().updateBag(id, p);
    } catch (e) {
      showError(e);
    }
  }

</script>

{#if view.error}
  <PageHeader title={t('page.notFound')} back="/bags" />
{:else if view.data}
  {@const v = view.data}
  <PageHeader title={bagTitle(v)} back="/bags">
    {#snippet actions()}
      <a class="btn btn-ghost icon-btn" href={`#/bags/${id}/edit`} aria-label={t('common.edit')}><Icon name="edit" /></a>
    {/snippet}
  </PageHeader>

  <div class="stack">
    <section class="card stack">
      <a href={`#/products/${v.bag.productId}`}>{productTitle(v.product)}</a>
      <BagBadges view={v} />
      <dl class="facts small">
        {#if v.bag.roastDate}<div><dt>{t('bag.roastDate')}</dt><dd>{fmtDate(v.bag.roastDate)}</dd></div>{/if}
        {#if v.bag.openedAt}<div><dt>{t('bag.openedAt')}</dt><dd>{fmtDate(v.bag.openedAt)}</dd></div>{/if}
        {#if v.bag.expiryDate}<div><dt>{t('bag.expiryDate')}</dt><dd>{fmtDate(v.bag.expiryDate)}</dd></div>{/if}
        {#if v.bag.priceEur !== null}<div><dt>{t('bag.priceEur')}</dt><dd>{fmtMoney(v.bag.priceEur)}</dd></div>{/if}
        {#if v.bag.shop}<div><dt>{t('bag.shop')}</dt><dd>{v.bag.shop}</dd></div>{/if}
        {#if v.cupsLeft !== null && v.status !== 'finished'}<div><dt>{t('bag.weightG')}</dt><dd>{t('bags.cupsLeft', { count: v.cupsLeft })}</dd></div>{/if}
      </dl>
      <div class="row">
        {#if v.status === 'unopened'}
          <button type="button" onclick={() => patch({ openedAt: todayIso() })}>{t('bags.openToday')}</button>
        {:else if v.status === 'open'}
          <button type="button" onclick={() => patch({ finishedAt: todayIso() })}>{t('bags.finish')}</button>
        {:else}
          <button type="button" onclick={() => patch({ finishedAt: null })}>{t('bags.reopen')}</button>
        {/if}
      </div>
    </section>

    {#if stats.data && stats.data.summary.n > 0}
      <StatsPanel stats={stats.data} bind:includeOutliers groupLabel={methodLabel} ratings={ratings.data ?? []} />
    {/if}

    <section class="card">
      <h2>{t('ratings.timeline')}</h2>
      {#if ratings.data?.length}
        <ul class="list">
          {#each ratings.data as r (r.id)}<li><RatingRow rating={r} /></li>{/each}
        </ul>
      {:else}
        <p class="muted">{t('ratings.empty')}</p>
      {/if}
    </section>
  </div>
{/if}

<style>
  .facts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.4rem 1rem;
    margin: 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
</style>
