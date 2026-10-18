<script lang="ts">
  import { untrack } from 'svelte';
  import type { BagDto, CatalogProductDto } from '@cuplog/api';
  import { sameGtin } from '@cuplog/api';
  import BarcodeScanner from '../components/BarcodeScanner.svelte';
  import CatalogPicker from '../components/CatalogPicker.svelte';
  import { toasts } from '../lib/toast.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { catalogTitle, productFromCatalog } from '../lib/catalog';
  import { BAG_FORMS } from '../lib/domain';
  import { showError } from '../lib/errors';
  import { productTitle } from '../lib/labels';
  import { query } from '../lib/query.svelte';
  import { router } from '../lib/router.svelte';

  /** `initial` → edit; otherwise create (optionally preselecting `?product=`). */
  let { initial }: { initial?: BagDto } = $props();

  const NEW_PRODUCT = '__new__';
  const products = query(() => api().listProducts(), ['products']);
  const num = (v: number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

  function fromBag(b: BagDto | undefined) {
    return {
      productId: b?.productId ?? router.current.query.product ?? '',
      label: b?.label ?? '',
      weightG: b ? num(b.weightG) : '250',
      priceEur: num(b?.priceEur),
      shop: b?.shop ?? '',
      purchasedAt: b?.purchasedAt ?? '',
      roastDate: b?.roastDate ?? '',
      expiryDate: b?.expiryDate ?? '',
      openedAt: b?.openedAt ?? '',
      finishedAt: b?.finishedAt ?? '',
      form: (b?.form ?? 'beans') as (typeof BAG_FORMS)[number],
      storage: b?.storage ?? '',
      notes: b?.notes ?? '',
    };
  }

  const id = $derived(initial?.id);
  let form = $state(untrack(() => fromBag(initial)));
  let saving = $state(false);

  // default to the newest product when creating
  const productId = $derived(
    form.productId ||
      ([...(products.data ?? [])].sort((a, b) => b.product.createdAt.localeCompare(a.product.createdAt))[0]?.product.id ??
        ''),
  );

  /** catalog entry picked instead of one of your products (F4); its product is created on save */
  let picked = $state<CatalogProductDto | null>(null);

  function pick(c: CatalogProductDto): void {
    picked = c;
    if (c.weightG !== null) form.weightG = String(c.weightG);
    if (c.priceEur !== null) form.priceEur = c.priceEur.toFixed(2);
    if (!form.shop.trim()) form.shop = c.roaster;
  }

  /** Your product for the picked catalog entry: the one you already have, else a new one. */
  async function productForPick(c: CatalogProductDto): Promise<string> {
    const mine = products.data?.find((p) => p.product.catalogId === c.id && !p.product.deletedAt);
    return mine ? mine.product.id : (await api().addProduct(productFromCatalog(c))).id;
  }

  /** A scanned bag: your product with that barcode, otherwise add the coffee once (A2). */
  function onScan(code: string): void {
    const mine = products.data?.find((p) => p.product.barcode && sameGtin(p.product.barcode, code));
    if (mine) {
      picked = null;
      form.productId = mine.product.id;
      toasts.show(t('barcode.found', { title: productTitle(mine.product) }));
    } else {
      toasts.show(t('barcode.unknown'));
      router.go(`/products/new?then=bag&barcode=${code}`);
    }
  }

  function onProductChange(e: Event & { currentTarget: HTMLSelectElement }): void {
    if (e.currentTarget.value === NEW_PRODUCT) router.go('/products/new?then=bag');
    else form.productId = e.currentTarget.value;
  }

  const optNum = (s: string): number | null => {
    const n = Number(s.replace(',', '.'));
    return s.trim() === '' || !Number.isFinite(n) ? null : n;
  };
  const optDate = (s: string): string | null => s || null;

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    saving = true;
    const fields = {
      label: form.label.trim(),
      weightG: optNum(form.weightG),
      priceEur: optNum(form.priceEur),
      shop: form.shop.trim(),
      purchasedAt: optDate(form.purchasedAt),
      roastDate: optDate(form.roastDate),
      expiryDate: optDate(form.expiryDate),
      openedAt: optDate(form.openedAt),
      finishedAt: optDate(form.finishedAt),
      form: form.form,
      storage: form.storage.trim(),
      notes: form.notes,
    };
    try {
      const bag = id
        ? await api().updateBag(id, fields)
        : await api().addBag({ productId: picked ? await productForPick(picked) : productId, ...fields });
      router.go(`/bags/${bag.id}`, { replace: true });
    } catch (err) {
      showError(err);
    } finally {
      saving = false;
    }
  }
</script>

<PageHeader title={id ? t('bags.editTitle') : t('bags.add')} back={id ? `/bags/${id}` : '/bags'} />

<form class="stack" onsubmit={submit}>
  {#if !id && !picked}
    <CatalogPicker onpick={pick} />
  {/if}
  <div class="card">
    {#if picked}
      <p class="picked" data-testid="catalog-picked">
        <span>{t('catalog.picked', { title: catalogTitle(picked) })}</span>
        <button type="button" class="btn-ghost small" onclick={() => (picked = null)}>{t('catalog.unpick')}</button>
      </p>
    {:else if !id}
      <label class="field">
        <span>{t('bag.product')}</span>
        <select required value={productId} onchange={onProductChange} data-testid="bag-product">
          <option value="" disabled>–</option>
          {#each products.data ?? [] as p (p.product.id)}
            <option value={p.product.id}>{productTitle(p.product)}</option>
          {/each}
          <option value={NEW_PRODUCT}>{t('bag.newProduct')}</option>
        </select>
      </label>
      <BarcodeScanner onresult={onScan} />
    {/if}
    <label class="field">
      <span>{t('bag.label')}</span>
      <input bind:value={form.label} placeholder={t('bag.labelHint')} autocomplete="off" />
    </label>
    <div class="row">
      <label class="field"><span>{t('bag.roastDate')}</span><input type="date" bind:value={form.roastDate} /></label>
      <label class="field"><span>{t('bag.expiryDate')}</span><input type="date" bind:value={form.expiryDate} /></label>
    </div>
    <div class="row">
      <label class="field"><span>{t('bag.purchasedAt')}</span><input type="date" bind:value={form.purchasedAt} /></label>
      <label class="field"><span>{t('bag.openedAt')}</span><input type="date" bind:value={form.openedAt} /></label>
    </div>
    {#if id}
      <label class="field"><span>{t('bag.finishedAt')}</span><input type="date" bind:value={form.finishedAt} /></label>
    {/if}
  </div>

  <div class="card">
    <div class="row">
      <label class="field"><span>{t('bag.weightG')}</span><input inputmode="decimal" bind:value={form.weightG} /></label>
      <label class="field"><span>{t('bag.priceEur')}</span><input inputmode="decimal" bind:value={form.priceEur} /></label>
    </div>
    <label class="field"><span>{t('bag.shop')}</span><input bind:value={form.shop} /></label>
    <div class="row">
      <label class="field">
        <span>{t('bag.form')}</span>
        <select bind:value={form.form}>
          {#each BAG_FORMS as f (f)}<option value={f}>{t(`form.${f}`)}</option>{/each}
        </select>
      </label>
      <label class="field"><span>{t('bag.storage')}</span><input bind:value={form.storage} /></label>
    </div>
    <label class="field"><span>{t('bag.notes')}</span><textarea bind:value={form.notes}></textarea></label>
  </div>

  <button class="btn-primary btn-block" type="submit" disabled={saving || (!id && !productId && !picked)}>{t('common.save')}</button>
</form>

