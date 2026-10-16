<script lang="ts">
  import BagCard from '../components/BagCard.svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { query } from '../lib/query.svelte';

  const bags = query(() => api().listBags(), ['bags', 'ratings', 'products']);
  const groups = $derived(
    (['open', 'unopened', 'finished'] as const)
      .map((status) => ({ status, items: (bags.data ?? []).filter((b) => b.status === status) }))
      .filter((g) => g.items.length),
  );
</script>

<PageHeader title={t('bags.title')}>
  {#snippet actions()}
    <a class="btn btn-primary" href="#/bags/new"><Icon name="plus" size={20} />{t('bags.add')}</a>
  {/snippet}
</PageHeader>

{#if bags.data && bags.data.length === 0}
  <p class="muted">{t('bags.empty')}</p>
{/if}

{#each groups as g (g.status)}
  <section class="group" aria-labelledby={`g-${g.status}`}>
    <h2 id={`g-${g.status}`}>{t(`bagStatus.${g.status}`)}</h2>
    <ul class="list">
      {#each g.items as view (view.bag.id)}
        <li><BagCard {view} /></li>
      {/each}
    </ul>
  </section>
{/each}

<p><a href="#/products">{t('bags.products')}</a></p>

<style>
  .group {
    margin-bottom: 1.25rem;
  }
</style>
