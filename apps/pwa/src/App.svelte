<script lang="ts">
  import { router } from './lib/router.svelte';

  const route = $derived(router.current);
</script>

<main>
  <h1>CupLog</h1>
  {#if route.segments[0] === 'about'}
    <p data-testid="about">Version {__APP_VERSION__}</p>
  {:else}
    <p data-testid="home">Log your next cup.</p>
  {/if}
</main>
