<script lang="ts">
  import type { CatalogImportReport } from '@cuplog/api';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { issueText } from '../lib/catalog';
  import { showError } from '../lib/errors';
  import { query } from '../lib/query.svelte';
  import { toasts } from '../lib/toast.svelte';

  /** Settings → Catalog (F4): source, size and date; reload the region file or import a custom CSV. */
  const info = query(() => api().getCatalogInfo(), ['catalog']);
  const settings = query(() => api().getSettings(), ['settings']);

  let busy = $state(false);
  let report = $state<CatalogImportReport | null>(null);
  let fileInput = $state<HTMLInputElement>();

  const MAX_ISSUES = 20;

  const dateText = (iso: string): string =>
    new Intl.DateTimeFormat(i18n.intl, { dateStyle: 'medium' }).format(new Date(`${iso}T12:00:00`));

  async function run(fn: () => Promise<CatalogImportReport>): Promise<void> {
    busy = true;
    report = null;
    try {
      report = await fn();
      toasts.show(t('catalog.imported'));
    } catch (e) {
      showError(e);
    } finally {
      busy = false;
    }
  }

  async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (file) await run(async () => api().importCatalogCsv(await file.text(), file.name));
  }

  async function setRegion(on: boolean): Promise<void> {
    try {
      await api().updateSettings({ catalogRegion: on ? 'munich' : null });
      if (on) await run(() => api().loadRegionCatalog('munich'));
    } catch (e) {
      showError(e);
    }
  }
</script>

<section class="card stack" aria-labelledby="s-catalog" data-testid="catalog">
  <h2 id="s-catalog">{t('catalog.title')}</h2>
  {#if info.data}
    {@const meta = info.data.meta}
    <p class="small" data-testid="catalog-info">
      {#if meta && info.data.count > 0}
        {t('catalog.info', {
          source: meta.source === 'file' ? (meta.fileName ?? t('catalog.ownFile')) : t(`region.${meta.source}`),
          count: info.data.count,
        })}
        {#if meta.updatedAt}<br /><span class="muted">{t('catalog.updated', { date: dateText(meta.updatedAt) })}</span>{/if}
      {:else}
        <span class="muted">{t('catalog.empty')}</span>
      {/if}
    </p>
  {/if}
  {#if settings.data}
    <label class="check">
      <input type="checkbox" checked={settings.data.catalogRegion === 'munich'} onchange={(e) => setRegion(e.currentTarget.checked)} />
      <span>{t('catalog.useRegion', { region: t('region.munich') })}</span>
    </label>
  {/if}
  <div class="row">
    <button type="button" disabled={busy || settings.data?.catalogRegion !== 'munich'} onclick={() => run(() => api().loadRegionCatalog('munich'))}>
      {t('catalog.reload', { region: t('region.munich') })}
    </button>
    <button type="button" disabled={busy} onclick={() => fileInput?.click()}>{t('catalog.importFile')}</button>
  </div>
  <input bind:this={fileInput} type="file" accept=".csv,text/csv" hidden onchange={onFile} data-testid="catalog-file" />
  <p class="small muted">{t('catalog.fileHint')}</p>
  {#if report}
    <div class="small" role="status" data-testid="catalog-report">
      <p>{t('catalog.report', { rows: report.rows, added: report.added, updated: report.updated, unchanged: report.unchanged })}</p>
      {#if report.skipped.length}
        <p><strong>{t('catalog.skipped', { count: new Set(report.skipped.map((i) => i.line)).size })}</strong></p>
        <ul class="issues">
          {#each report.skipped.slice(0, MAX_ISSUES) as i (`${i.line}-${i.field}`)}<li>{issueText(i)}</li>{/each}
        </ul>
        {#if report.skipped.length > MAX_ISSUES}<p class="muted">{t('catalog.more', { count: report.skipped.length - MAX_ISSUES })}</p>{/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  .issues {
    margin: 0;
    padding-left: 1.2rem;
  }
</style>
