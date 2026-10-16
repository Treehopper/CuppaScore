<script lang="ts">
  import { untrack } from 'svelte';
  import type { ProductDto } from '@cuplog/api';
  import PageHeader from '../components/PageHeader.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { PROCESSES, ROAST_FOR } from '../lib/domain';
  import { showError } from '../lib/errors';
  import { splitList } from '../lib/labels';
  import { router } from '../lib/router.svelte';

  /** `initial` → edit; otherwise create. `?then=bag` returns to "Add bag" with the new product. */
  let { initial }: { initial?: ProductDto } = $props();

  type Process = (typeof PROCESSES)[number];
  type RoastFor = (typeof ROAST_FOR)[number];

  function fromProduct(p: ProductDto | undefined) {
    return {
      roaster: p?.roaster ?? '',
      name: p?.name ?? '',
      country: p?.origin.country ?? '',
      region: p?.origin.region ?? '',
      farm: p?.origin.farm ?? '',
      altitude: p?.origin.altitudeM == null ? '' : String(p.origin.altitudeM),
      process: (p?.process ?? '') as Process | '',
      varietals: p?.varietals.join(', ') ?? '',
      roastLevel: (p?.roastLevel ?? null) as number | null,
      roastFor: [...(p?.roastFor ?? [])] as RoastFor[],
      isBlend: p?.isBlend ?? false,
      decaf: p?.decaf ?? false,
      labelNotes: p?.labelNotes.join(', ') ?? '',
    };
  }

  // the form edits a copy; `initial` is only the starting point
  const id = $derived(initial?.id);
  let form = $state(untrack(() => fromProduct(initial)));
  let saving = $state(false);

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    saving = true;
    const alt = form.altitude.trim() === '' ? null : Math.round(Number(form.altitude));
    const cmd = {
      roaster: form.roaster.trim(),
      name: form.name.trim(),
      origin: {
        country: form.country.trim() || null,
        region: form.region.trim() || null,
        farm: form.farm.trim() || null,
        altitudeM: alt !== null && Number.isFinite(alt) ? alt : null,
      },
      process: form.process || null,
      varietals: splitList(form.varietals),
      roastLevel: form.roastLevel,
      roastFor: form.roastFor,
      isBlend: form.isBlend,
      decaf: form.decaf,
      labelNotes: splitList(form.labelNotes),
    };
    try {
      if (id) {
        await api().updateProduct(id, cmd);
        router.go(`/products/${id}`, { replace: true });
      } else {
        const p = await api().addProduct(cmd);
        if (router.current.query.then === 'bag') router.go(`/bags/new?product=${p.id}`, { replace: true });
        else router.go(`/products/${p.id}`, { replace: true });
      }
    } catch (err) {
      showError(err);
    } finally {
      saving = false;
    }
  }

  function toggleRoastFor(r: RoastFor): void {
    form.roastFor = form.roastFor.includes(r) ? form.roastFor.filter((x) => x !== r) : [...form.roastFor, r];
  }
</script>

<PageHeader title={id ? t('products.editTitle') : t('products.add')} back={id ? `/products/${id}` : '/bags'} />

<form class="stack" onsubmit={submit}>
  <div class="card">
    <label class="field"><span>{t('product.roaster')}</span><input required bind:value={form.roaster} autocomplete="off" /></label>
    <label class="field"><span>{t('product.name')}</span><input required bind:value={form.name} autocomplete="off" /></label>
    <div class="row">
      <label class="field"><span>{t('product.country')}</span><input bind:value={form.country} /></label>
      <label class="field"><span>{t('product.region')}</span><input bind:value={form.region} /></label>
    </div>
    <div class="row">
      <label class="field"><span>{t('product.farm')}</span><input bind:value={form.farm} /></label>
      <label class="field">
        <span>{t('product.altitude')}</span>
        <input type="number" inputmode="numeric" min="0" max="5000" bind:value={form.altitude} />
      </label>
    </div>
  </div>

  <div class="card">
    <label class="field">
      <span>{t('product.process')}</span>
      <select bind:value={form.process}>
        <option value="">–</option>
        {#each PROCESSES as p (p)}<option value={p}>{t(`process.${p}`)}</option>{/each}
      </select>
    </label>
    <div class="field">
      <span id="roast-level">{t('product.roastLevel')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="roast-level">
        {#each [1, 2, 3, 4, 5] as lvl (lvl)}
          <button
            type="button"
            role="radio"
            aria-checked={form.roastLevel === lvl}
            title={t(`roastLevel.${lvl}`)}
            onclick={() => (form.roastLevel = form.roastLevel === lvl ? null : lvl)}>{lvl}</button
          >
        {/each}
      </div>
      {#if form.roastLevel}<span class="small muted">{t(`roastLevel.${form.roastLevel}`)}</span>{/if}
    </div>
    <div class="field">
      <span id="roast-for">{t('product.roastFor')}</span>
      <div class="chips" role="group" aria-labelledby="roast-for">
        {#each ROAST_FOR as r (r)}
          <button type="button" class="chip" aria-pressed={form.roastFor.includes(r)} onclick={() => toggleRoastFor(r)}>
            {t(`roastFor.${r}`)}
          </button>
        {/each}
      </div>
    </div>
    <label class="field">
      <span>{t('product.varietals')} <span class="small">({t('product.listHint')})</span></span>
      <input bind:value={form.varietals} />
    </label>
    <label class="field">
      <span>{t('product.labelNotes')} <span class="small">({t('product.listHint')})</span></span>
      <input bind:value={form.labelNotes} />
    </label>
    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={form.isBlend} />{t('product.isBlend')}</label>
      <label class="check"><input type="checkbox" bind:checked={form.decaf} />{t('product.decaf')}</label>
    </div>
  </div>

  <button class="btn-primary btn-block" type="submit" disabled={saving}>{t('common.save')}</button>
</form>
