import { catalogUpdatedAt, parseCatalogCsv, type CatalogProduct, type CatalogRegion, type CatalogRowIssue } from '@cuplog/core';
import { DomainError } from './errors';
import type { Ctx, Repositories } from './ports';

/** Device-state key of the catalog bookkeeping. */
export const CATALOG_META_KEY = 'catalog';

export interface CatalogMeta {
  /** region file name or `file` for a custom CSV */
  source: CatalogRegion | 'file';
  fileName: string | null;
  /** newest `updated_at` in the last imported file */
  updatedAt: string | null;
  /** epoch ms of the last import */
  importedAt: number;
}

export interface CatalogInfo {
  count: number;
  meta: CatalogMeta | null;
}

export interface CatalogImportReport {
  source: CatalogMeta['source'];
  /** rows in the file that passed validation */
  rows: number;
  added: number;
  updated: number;
  /** already present with the same or a newer `updated_at` */
  unchanged: number;
  skipped: CatalogRowIssue[];
}

export async function getCatalogInfo(repos: Repositories): Promise<CatalogInfo> {
  const [count, meta] = await Promise.all([repos.catalog.count(), repos.device.get<CatalogMeta>(CATALOG_META_KEY)]);
  return { count, meta: meta ?? null };
}

/**
 * Validates a catalog CSV and upserts it by id: a row replaces the stored one only when its
 * `updated_at` is newer. Never touches the user's own products, bags or ratings.
 */
export async function importCatalogCsv(
  repos: Repositories,
  ctx: Ctx,
  text: string,
  source: CatalogMeta['source'],
  fileName: string | null = null,
): Promise<CatalogImportReport> {
  const res = parseCatalogCsv(text, source);
  if (!res.ok) throw new DomainError(res.problem.code, res.problem);
  const existing = new Map((await repos.catalog.list()).map((p) => [p.id, p]));
  const changed: CatalogProduct[] = [];
  let added = 0;
  let updated = 0;
  for (const p of res.products) {
    const cur = existing.get(p.id);
    if (!cur) added++;
    else if (p.updatedAt > cur.updatedAt) updated++;
    else continue;
    changed.push(p);
  }
  if (res.products.length === 0) throw new DomainError('CATALOG_CSV_EMPTY', { skipped: res.skipped.length });
  await repos.catalog.putMany(changed);
  const meta: CatalogMeta = { source, fileName, updatedAt: catalogUpdatedAt(res.products), importedAt: ctx.clock.now() };
  await repos.device.set(CATALOG_META_KEY, meta);
  return { source, rows: res.products.length, added, updated, unchanged: res.products.length - changed.length, skipped: res.skipped };
}
