<script lang="ts">
  import type { RecoQuery } from '@cuplog/api';
  import PageHeader from '../components/PageHeader.svelte';
  import RecoCard from '../components/RecoCard.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { showError } from '../lib/errors';
  import { query } from '../lib/query.svelte';
  import { toasts } from '../lib/toast.svelte';

  /** Discover (README §9.3 item 4): recommendations with why-text, filters, wishlist, exploration. */
  const COLD_START = 5;
  const PRICE_STEPS = [40, 60, 80, 120];

  let tab = $state<'forYou' | 'wishlist'>('forYou');
  let roastFor = $state<'' | 'espresso' | 'filter'>('');
  let roaster = $state('');
  let maxPrice = $state('');
  let decaf = $state(false);

  const q = $derived<RecoQuery>({
    ...(roastFor ? { roastFor } : {}),
    ...(roaster ? { roaster } : {}),
    ...(maxPrice ? { maxPricePerKg: Number(maxPrice) } : {}),
    ...(decaf ? { includeDecaf: true } : {}),
    limit: 20,
  });

  const info = query(() => api().getCatalogInfo(), ['catalog']);
  const roasters = query(() => api().listCatalogRoasters(), ['catalog']);
  const recs = query(() => api().getRecommendations(q), ['ratings', 'products', 'bags', 'settings', 'catalog']);
  // the wishlist tab shows saved coffees even when they'd be filtered or ranked out
  const wishlist = query(() => api().getRecommendations({ includeDecaf: true, limit: 500 }), ['settings', 'catalog', 'ratings']);
  const saved = query(() => api().listWishlist(), ['settings', 'catalog']);
  const wishItems = $derived.by(() => {
    const ids = new Set((saved.data ?? []).map((c) => c.id));
    return (wishlist.data?.items ?? []).filter((r) => ids.has(r.item.id));
  });

  async function wish(id: string, on: boolean): Promise<void> {
    try {
      await api().setWishlist(id, on);
      toasts.show(on ? t('discover.wishAdded') : t('discover.wishRemoved'));
    } catch (e) {
      showError(e);
    }
  }

  async function dismiss(id: string): Promise<void> {
    try {
      await api().dismissRecommendation(id);
      toasts.show(t('discover.dismissed'), {
        action: {
          label: t('common.undo'),
          run: async () => {
            const s = await api().getSettings();
            await api().updateSettings({ dismissed: s.dismissed.filter((x) => x !== id) });
          },
        },
      });
    } catch (e) {
      showError(e);
    }
  }
</script>

<PageHeader title={t('nav.discover')} />

{#if info.data && info.data.count === 0}
  <section class="card stack" data-testid="discover-empty">
    <p>{t('discover.noCatalog')}</p>
    <a class="btn btn-primary" href="#/settings">{t('discover.toSettings')}</a>
  </section>
{:else}
  <div class="segmented tabs" role="tablist" aria-label={t('nav.discover')}>
    <button type="button" role="tab" aria-selected={tab === 'forYou'} onclick={() => (tab = 'forYou')}>
      {t('discover.forYou')}
    </button>
    <button type="button" role="tab" aria-selected={tab === 'wishlist'} onclick={() => (tab = 'wishlist')}>
      {t('discover.wishlistTab', { count: saved.data?.length ?? 0 })}
    </button>
  </div>

  {#if tab === 'forYou'}
    <details class="card filters">
      <summary>{t('discover.filters')}</summary>
      <div class="stack">
        <div class="field">
          <span id="f-use">{t('discover.filterUse')}</span>
          <div class="segmented" role="radiogroup" aria-labelledby="f-use">
            {#each [['', t('discover.any')], ['espresso', t('roastFor.espresso')], ['filter', t('roastFor.filter')]] as [v, label] (v)}
              <button type="button" role="radio" aria-checked={roastFor === v} onclick={() => (roastFor = v as typeof roastFor)}>{label}</button>
            {/each}
          </div>
        </div>
        <div class="row">
          <label class="field">
            <span>{t('discover.filterRoaster')}</span>
            <select bind:value={roaster}>
              <option value="">{t('discover.any')}</option>
              {#each roasters.data ?? [] as r (r)}<option value={r}>{r}</option>{/each}
            </select>
          </label>
          <label class="field">
            <span>{t('discover.filterPrice')}</span>
            <select bind:value={maxPrice}>
              <option value="">{t('discover.any')}</option>
              {#each PRICE_STEPS as p (p)}<option value={String(p)}>{t('discover.upTo', { price: p })}</option>{/each}
            </select>
          </label>
        </div>
        <label class="check"><input type="checkbox" bind:checked={decaf} /><span>{t('discover.decaf')}</span></label>
      </div>
    </details>

    {#if recs.data}
      {#if recs.data.ratedProducts < COLD_START}
        <p class="card small" data-testid="cold-start">{t('discover.coldStart', { n: recs.data.ratedProducts, total: COLD_START })}</p>
      {/if}
      {#if recs.data.items.length === 0}
        <p class="muted">{t('discover.none')}</p>
      {:else}
        <ul class="list" aria-label={t('discover.forYou')}>
          {#each recs.data.items as rec (rec.item.id)}
            <li><RecoCard {rec} onwish={(on) => wish(rec.item.id, on)} ondismiss={() => dismiss(rec.item.id)} /></li>
          {/each}
        </ul>
      {/if}
    {/if}
  {:else if wishItems.length === 0}
    <p class="muted" data-testid="wishlist-empty">{t('discover.wishlistEmpty')}</p>
  {:else}
    <ul class="list" aria-label={t('discover.wishlistTab', { count: wishItems.length })}>
      {#each wishItems as rec (rec.item.id)}
        <li><RecoCard {rec} onwish={(on) => wish(rec.item.id, on)} /></li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .tabs {
    margin-bottom: var(--gap);
  }
  .filters {
    margin-bottom: var(--gap);
  }
  .filters summary {
    cursor: pointer;
    font-weight: 600;
    min-height: var(--tap);
    display: flex;
    align-items: center;
  }
</style>
