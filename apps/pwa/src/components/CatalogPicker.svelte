<script lang="ts">
  import type { CatalogProductDto } from '@cuplog/api';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { originNames, originText } from '../lib/catalog';
  import { query } from '../lib/query.svelte';

  /** Searchable list over the region catalog (F4); the form prefills itself from the picked entry. `form = false`: no form below to fall back to. */
  let { onpick, form = true }: { onpick: (c: CatalogProductDto) => void; form?: boolean } = $props();

  const uid = $props.id();
  const info = query(() => api().getCatalogInfo(), ['catalog']);
  let text = $state('');
  let debounced = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function onInput(e: Event & { currentTarget: HTMLInputElement }): void {
    text = e.currentTarget.value;
    clearTimeout(timer);
    timer = setTimeout(() => (debounced = text.trim()), 150);
  }

  const results = query(
    () => (debounced ? api().searchCatalog({ text: debounced, originNames: originNames(), limit: 30 }) : Promise.resolve([])),
    ['catalog'],
  );

  const price = (c: CatalogProductDto): string | null =>
    c.priceEur === null
      ? null
      : `${new Intl.NumberFormat(i18n.intl, { style: 'currency', currency: 'EUR' }).format(c.priceEur)}${c.weightG ? ` / ${c.weightG} g` : ''}`;

  function pick(c: CatalogProductDto): void {
    onpick(c);
    text = '';
    debounced = '';
  }
</script>

{#if info.data && info.data.count > 0}
  <div class="card field picker" data-testid="catalog-picker">
    <label for="{uid}-q">{t('catalog.search')}</label>
    <input
      id="{uid}-q"
      type="search"
      value={text}
      oninput={onInput}
      placeholder={t('catalog.searchHint')}
      autocomplete="off"
      enterkeyhint="search"
    />
    {#if debounced && results.data}
      {#if results.data.length === 0}
        <p class="small muted" role="status">{form ? t('catalog.noMatch') : t('catalog.noMatchOnly')}</p>
      {:else}
        <ul class="list results" aria-label={t('catalog.results')}>
          {#each results.data as c (c.id)}
            <li>
              <button type="button" class="result" onclick={() => pick(c)} data-testid="catalog-result">
                <span class="title"><strong>{c.name}</strong> · {c.roaster}</span>
                <span class="small muted">
                  {[originText(c), c.roastLevel ? t(`roastLevel.${c.roastLevel}`) : null, price(c)].filter(Boolean).join(' · ')}
                </span>
                {#if !c.available}<span class="badge">{t('catalog.soldOut')}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
    {#if form}<p class="small muted">{t('catalog.manualHint')}</p>{/if}
  </div>
{/if}

<style>
  .picker {
    margin: 0;
  }
  .picker label {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .results {
    max-height: 22rem;
    overflow-y: auto;
    gap: 0.35rem;
  }
  .result {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0.15rem;
    padding: 0.5rem 0.75rem;
  }
</style>
