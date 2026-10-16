<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let { title, back, actions }: { title: string; back?: string; actions?: Snippet } = $props();
</script>

<header>
  {#if back}
    <a class="btn btn-ghost icon-btn" href={`#${back}`} aria-label={t('common.back')}><Icon name="back" /></a>
  {/if}
  <h1>{title}</h1>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 3rem;
    margin-bottom: 0.75rem;
  }
  h1 {
    flex: 1;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    gap: 0.25rem;
  }
</style>
