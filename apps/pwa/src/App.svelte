<script lang="ts">
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { router } from './lib/router.svelte';

  const route = $derived(router.current);
</script>

<UpdateBanner />
<main>
  <h1>CupLog</h1>
  {#if route.segments[0] === 'about'}
    <p data-testid="about">Version {__APP_VERSION__} · built {__BUILD_TIME__}</p>
  {:else}
    <p data-testid="home">Log your next cup.</p>
  {/if}
</main>
