<script lang="ts">
  import type { ImportReport } from '@cuplog/api';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { todayIso } from '../lib/dates';
  import { downloadText } from '../lib/download';
  import { showError } from '../lib/errors';
  import { toasts } from '../lib/toast.svelte';

  /** Backup: JSON bundle export/import (merge or replace) and ratings as CSV (README §3 E2). */
  let mode = $state<'merge' | 'replace'>('merge');
  let busy = $state(false);
  let report = $state<ImportReport | null>(null);
  let fileInput = $state<HTMLInputElement>();

  async function exportJson(): Promise<void> {
    try {
      const bundle = await api().exportAll();
      downloadText(`cuplog-${todayIso()}.json`, JSON.stringify(bundle, null, 2), 'application/json');
    } catch (e) {
      showError(e);
    }
  }

  async function exportCsv(): Promise<void> {
    try {
      downloadText(`cuplog-ratings-${todayIso()}.csv`, await api().exportRatingsCsv(), 'text/csv');
    } catch (e) {
      showError(e);
    }
  }

  async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    if (mode === 'replace' && !confirm(t('data.replaceConfirm'))) return;
    busy = true;
    report = null;
    try {
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        toasts.show(t('data.notJson'), { kind: 'error' });
        return;
      }
      report = await api().importAll(json, mode);
      toasts.show(t('data.imported'));
    } catch (err) {
      showError(err);
    } finally {
      busy = false;
    }
  }

  const KINDS = ['products', 'bags', 'ratings', 'venues'] as const;
</script>

<section class="card stack" aria-labelledby="s-data" data-testid="data">
  <h2 id="s-data">{t('data.title')}</h2>
  <div class="row">
    <button type="button" onclick={exportJson}>{t('data.exportJson')}</button>
    <button type="button" onclick={exportCsv}>{t('data.exportCsv')}</button>
  </div>

  <div class="field">
    <span id="import-mode">{t('data.importMode')}</span>
    <div class="segmented" role="radiogroup" aria-labelledby="import-mode">
      {#each ['merge', 'replace'] as const as m (m)}
        <button type="button" role="radio" aria-checked={mode === m} onclick={() => (mode = m)}>{t(`data.${m}`)}</button>
      {/each}
    </div>
    <p class="small muted">{t(mode === 'merge' ? 'data.mergeHint' : 'data.replaceHint')}</p>
  </div>
  <input
    bind:this={fileInput}
    class="visually-hidden"
    type="file"
    accept="application/json,.json"
    onchange={onFile}
    data-testid="import-file"
    tabindex="-1"
    aria-hidden="true"
  />
  <button type="button" disabled={busy} onclick={() => fileInput?.click()}>{t('data.import')}</button>

  {#if report}
    <ul class="list small" data-testid="import-report">
      {#each KINDS as k (k)}
        <li>{t(`data.kind.${k}`)}: {t('data.counts', { ...report[k] })}</li>
      {/each}
    </ul>
  {/if}
</section>
