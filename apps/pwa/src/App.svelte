<script lang="ts">
  import ThemePicker from './components/ThemePicker.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { api } from './lib/api';
  import { router } from './lib/router.svelte';
  import { applyThemeEffect } from './themes/apply.svelte';

  applyThemeEffect();

  const route = $derived(router.current);
  const backend = api().getSettings();
</script>

<UpdateBanner />
{#await backend then}<span hidden data-testid="api-ready"></span>{/await}
<main>
  <h1>CupLog</h1>
  {#if route.segments[0] === 'about'}
    <p data-testid="about">Version {__APP_VERSION__} · built {__BUILD_TIME__}</p>
    <ThemePicker />
  {:else}
    <p data-testid="home">Log your next cup.</p>
  {/if}
</main>

<style>
  main {
    padding: 1rem;
    max-width: 40rem;
    margin: 0 auto;
  }
</style>
