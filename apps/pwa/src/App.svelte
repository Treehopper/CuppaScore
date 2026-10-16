<script lang="ts">
  import Nav from './components/Nav.svelte';
  import Toasts from './components/Toasts.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { applyLangEffect, t } from './i18n/i18n.svelte';
  import { router } from './lib/router.svelte';
  import { api } from './lib/api';
  import BagDetailPage from './pages/BagDetailPage.svelte';
  import BagFormPage from './pages/BagFormPage.svelte';
  import BagsPage from './pages/BagsPage.svelte';
  import NotFound from './pages/NotFound.svelte';
  import ProductDetailPage from './pages/ProductDetailPage.svelte';
  import ProductFormPage from './pages/ProductFormPage.svelte';
  import ProductsPage from './pages/ProductsPage.svelte';
  import Placeholder from './pages/Placeholder.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import { applyThemeEffect } from './themes/apply.svelte';

  applyThemeEffect();
  applyLangEffect();

  const route = $derived(router.current);
  const section = $derived(route.segments[0] ?? 'log');
  const sub = $derived(route.segments[1]);
  const action = $derived(route.segments[2]);
</script>

<UpdateBanner />
<main>
  {#if section === 'log'}
    <Placeholder title={t('nav.log')} />
  {:else if section === 'bags'}
    {#if !sub}
      <BagsPage />
    {:else if sub === 'new'}
      {#key route.query.product}<BagFormPage />{/key}
    {:else if action === 'edit'}
      {#key sub}
        {#await api().getBag(sub) then view}<BagFormPage initial={view.bag} />{:catch}<NotFound />{/await}
      {/key}
    {:else}
      {#key sub}<BagDetailPage id={sub} />{/key}
    {/if}
  {:else if section === 'products'}
    {#if !sub}
      <ProductsPage />
    {:else if sub === 'new'}
      <ProductFormPage />
    {:else if action === 'edit'}
      {#key sub}
        {#await api().getProduct(sub) then p}<ProductFormPage initial={p} />{:catch}<NotFound />{/await}
      {/key}
    {:else}
      {#key sub}<ProductDetailPage id={sub} />{/key}
    {/if}
  {:else if section === 'stats'}
    <Placeholder title={t('nav.stats')} />
  {:else if section === 'discover'}
    <Placeholder title={t('nav.discover')} />
  {:else if section === 'settings' || section === 'about'}
    <SettingsPage />
  {:else}
    <NotFound />
  {/if}
</main>
<Toasts />
<Nav />

<style>
  main {
    padding: 0.75rem 1rem calc(var(--nav-h) + env(safe-area-inset-bottom) + 1.5rem);
    max-width: 40rem;
    margin: 0 auto;
  }
</style>
