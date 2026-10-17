<script lang="ts">
  import Nav from './components/Nav.svelte';
  import ReminderBanner from './components/ReminderBanner.svelte';
  import Toasts from './components/Toasts.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { applyLangEffect, t } from './i18n/i18n.svelte';
  import { router } from './lib/router.svelte';
  import { api } from './lib/api';
  import { reminders } from './lib/reminders.svelte';
  import BagDetailPage from './pages/BagDetailPage.svelte';
  import BagFormPage from './pages/BagFormPage.svelte';
  import BagsPage from './pages/BagsPage.svelte';
  import LogPage from './pages/log/LogPage.svelte';
  import NotFound from './pages/NotFound.svelte';
  import ProductDetailPage from './pages/ProductDetailPage.svelte';
  import ProductFormPage from './pages/ProductFormPage.svelte';
  import ProductsPage from './pages/ProductsPage.svelte';
  import Placeholder from './pages/Placeholder.svelte';
  import RatingPage from './pages/RatingPage.svelte';
  import RatingsPage from './pages/RatingsPage.svelte';
  import VenuesPage from './pages/VenuesPage.svelte';
  import WelcomePage from './pages/WelcomePage.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import { applyThemeEffect } from './themes/apply.svelte';

  applyThemeEffect();
  applyLangEffect();
  reminders.start();

  // first launch from the home screen / root URL opens the welcome flow; deep links skip it
  if (router.current.segments.length === 0) {
    void api()
      .getSettings()
      .then((s) => {
        if (!s.onboardingCompletedAt && router.current.segments.length === 0) router.go('/welcome', { replace: true });
      });
  }

  const route = $derived(router.current);
  const section = $derived(route.segments[0] ?? 'log');
  const sub = $derived(route.segments[1]);
  const action = $derived(route.segments[2]);
</script>

<UpdateBanner />
{#if section !== 'welcome'}<ReminderBanner />{/if}
<main>
  {#if section === 'log'}
    <LogPage />
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
  {:else if section === 'welcome'}
    <WelcomePage />
  {:else if section === 'ratings'}
    {#if !sub}
      <RatingsPage />
    {:else}
      {#key sub}
        {#await api().getRating(sub) then r}<RatingPage initial={r} />{:catch}<NotFound />{/await}
      {/key}
    {/if}
  {:else if section === 'venues'}
    <VenuesPage />
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
{#if section !== 'welcome'}<Nav />{/if}

<style>
  main {
    /* room for the nav and a toast above it, so the last control can always be uncovered */
    padding: 0.75rem 1rem calc(var(--nav-h) + env(safe-area-inset-bottom) + 5rem);
    max-width: 40rem;
    margin: 0 auto;
  }
</style>
