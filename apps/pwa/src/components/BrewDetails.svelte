<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { HOME_MILKS, type BrewMethod } from '../lib/domain';
  import type { BrewForm } from '../lib/logForm';

  /** "Brew details ▾" (README §9.2): common fields plus AeroPress / Flair NEO parameters. */
  let { method, form, onchange }: { method: BrewMethod; form: BrewForm; onchange: (f: BrewForm) => void } = $props();

  const set = <K extends keyof BrewForm>(k: K, v: BrewForm[K]): void => onchange({ ...form, [k]: v });
  const espresso = $derived(method === 'flairNeo' || method === 'espressoMachine' || method === 'beanToCup');
</script>

{#snippet num(k: 'doseG' | 'waterG' | 'yieldG' | 'tempC' | 'timeS' | 'steepS' | 'bypassG' | 'preinfusionS', label: string)}
  <label class="field">
    <span>{label}</span>
    <input inputmode="decimal" value={form[k]} oninput={(e) => set(k, e.currentTarget.value)} />
  </label>
{/snippet}

<details class="disclosure" data-testid="brew-details">
  <summary>{t('log.brewDetails')}</summary>
  <div class="stack">
    <div class="row">
      {@render num('doseG', t('brewField.doseG'))}
      {#if espresso}
        {@render num('yieldG', t('brewField.yieldG'))}
      {:else}
        {@render num('waterG', t('brewField.waterG'))}
      {/if}
    </div>
    <div class="row">
      {@render num('tempC', t('brewField.tempC'))}
      {@render num('timeS', t('brewField.timeS'))}
    </div>
    <label class="field">
      <span>{t('brewField.grind')}</span>
      <input value={form.grind} oninput={(e) => set('grind', e.currentTarget.value)} />
    </label>
    <label class="field">
      <span>{t('brewField.milk')}</span>
      <select value={form.milk} onchange={(e) => set('milk', e.currentTarget.value as BrewForm['milk'])}>
        <option value="">–</option>
        {#each HOME_MILKS as m (m)}
          <option value={m}>{t(`milk.${m}`)}</option>
        {/each}
      </select>
    </label>

    {#if method === 'aeropress'}
      <div class="row">
        <label class="field">
          <span>{t('brewField.orientation')}</span>
          <select
            value={form.orientation}
            onchange={(e) => set('orientation', e.currentTarget.value as BrewForm['orientation'])}
          >
            <option value="">–</option>
            <option value="standard">{t('brewField.standard')}</option>
            <option value="inverted">{t('brewField.inverted')}</option>
          </select>
        </label>
        <label class="field">
          <span>{t('brewField.filter')}</span>
          <select value={form.filter} onchange={(e) => set('filter', e.currentTarget.value as BrewForm['filter'])}>
            <option value="">–</option>
            <option value="paper">{t('brewField.paper')}</option>
            <option value="metal">{t('brewField.metal')}</option>
          </select>
        </label>
      </div>
      <div class="row">
        {@render num('steepS', t('brewField.steepS'))}
        {@render num('bypassG', t('brewField.bypassG'))}
      </div>
    {:else if method === 'flairNeo'}
      <div class="row">
        <label class="field">
          <span>{t('brewField.basket')}</span>
          <select value={form.basket} onchange={(e) => set('basket', e.currentTarget.value as BrewForm['basket'])}>
            <option value="">–</option>
            <option value="flowControl">{t('brewField.flowControl')}</option>
            <option value="standard">{t('brewField.standard')}</option>
          </select>
        </label>
        <label class="field">
          <span>{t('brewField.pressure')}</span>
          <select value={form.pressure} onchange={(e) => set('pressure', e.currentTarget.value as BrewForm['pressure'])}>
            <option value="">–</option>
            <option value="low">{t('brewField.low')}</option>
            <option value="medium">{t('brewField.medium')}</option>
            <option value="high">{t('brewField.high')}</option>
          </select>
        </label>
      </div>
      <div class="row">
        {@render num('preinfusionS', t('brewField.preinfusionS'))}
        <label class="field">
          <span>{t('brewField.preheat')}</span>
          <select value={form.preheat} onchange={(e) => set('preheat', e.currentTarget.value as BrewForm['preheat'])}>
            <option value="">–</option>
            <option value="yes">{t('common.yes')}</option>
            <option value="no">{t('common.no')}</option>
          </select>
        </label>
      </div>
    {/if}
  </div>
</details>
