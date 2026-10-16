<script lang="ts">
  import { pwa } from '../lib/pwa.svelte';
</script>

{#if pwa.needRefresh}
  <div class="update" role="status" data-testid="update-banner">
    <span>New version available</span>
    <button type="button" onclick={() => pwa.reload()}>Reload</button>
    <button type="button" class="ghost" onclick={() => pwa.dismiss()}>Later</button>
  </div>
{/if}

<style>
  .update {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.75rem;
    background: var(--surface, #efe1cc);
    border: 1px solid var(--border, #dcc7ab);
  }
  span {
    flex: 1;
  }
</style>
