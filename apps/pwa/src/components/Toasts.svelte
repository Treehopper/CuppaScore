<script lang="ts">
  import { toasts } from '../lib/toast.svelte';
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.items as item (item.id)}
    <div class="toast" class:error={item.kind === 'error'} role={item.kind === 'error' ? 'alert' : 'status'}>
      <span>{item.text}</span>
      {#if item.action}
        {@const action = item.action}
        <button
          type="button"
          class="btn-ghost"
          onclick={async () => {
            toasts.dismiss(item.id);
            await action.run();
          }}>{action.label}</button
        >
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 0.75rem);
    z-index: 20;
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    pointer-events: none;
    padding: 0 1rem;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 30rem;
    width: 100%;
    padding: 0.4rem 0.4rem 0.4rem 1rem;
    border-radius: var(--radius-sm);
    background: var(--text);
    color: var(--bg);
    box-shadow: var(--shadow);
  }
  .toast span {
    flex: 1;
  }
  .toast button {
    color: var(--bg);
    font-weight: 700;
    text-decoration: underline;
  }
  .error {
    border-left: 6px solid var(--bad);
  }
</style>
