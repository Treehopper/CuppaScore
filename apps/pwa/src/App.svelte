<script lang="ts">
  import Nav from './components/Nav.svelte';
  import Toasts from './components/Toasts.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { applyLangEffect, t } from './i18n/i18n.svelte';
  import { router } from './lib/router.svelte';
  import NotFound from './pages/NotFound.svelte';
  import Placeholder from './pages/Placeholder.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import { applyThemeEffect } from './themes/apply.svelte';

  applyThemeEffect();
  applyLangEffect();

  const route = $derived(router.current);
  const section = $derived(route.segments[0] ?? 'log');
</script>

<UpdateBanner />
<main>
  {#if section === 'log'}
    <Placeholder title={t('nav.log')} />
  {:else if section === 'bags'}
    <Placeholder title={t('nav.bags')} />
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
