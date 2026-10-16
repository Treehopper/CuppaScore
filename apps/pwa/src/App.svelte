<script lang="ts">
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { api } from './lib/api';
  import { router } from './lib/router.svelte';

  const route = $derived(router.current);
  let ready = $state(false);

  $effect(() => {
    api()
      .getSettings()
      .then(() => (ready = true));
  });
</script>

<UpdateBanner />
<main data-api-ready={ready}>
  <h1>CupLog</h1>
  {#if route.segments[0] === 'about'}
    <p data-testid="about">Version {__APP_VERSION__} · built {__BUILD_TIME__}</p>
  {:else}
    <p data-testid="home">Log your next cup.</p>
  {/if}
</main>
