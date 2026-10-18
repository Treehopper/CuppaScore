import { z } from 'zod';
import { Bag } from './bag';
import { Product, roastLevelFrom5 } from './product';
import { Rating } from './rating';
import { IsoDateTime } from './record';
import { DomainSettings } from './settings';
import { Venue } from './venue';

/** Version of the export format; bump together with a migration in `migrateBundle`. */
export const EXPORT_SCHEMA_VERSION = 2;

/** Versioned export (README §8.3); doubles as the future server-migration path. */
export const ExportBundle = z.object({
  app: z.literal('cuplog'),
  schemaVersion: z.number().int().positive(),
  exportedAt: IsoDateTime,
  products: z.array(Product),
  bags: z.array(Bag),
  ratings: z.array(Rating),
  venues: z.array(Venue),
  settings: DomainSettings.nullable(),
});
export type ExportBundle = z.infer<typeof ExportBundle>;

export type BundleProblem =
  | { code: 'UNSUPPORTED_SCHEMA_VERSION'; version: unknown }
  | { code: 'IMPORT_INVALID'; issues: { path: string; code: string }[] };

/** Upgrades older bundles to the current shape and validates them. */
export function migrateBundle(raw: unknown): { ok: true; bundle: ExportBundle } | { ok: false; problem: BundleProblem } {
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version !== 'number' || version > EXPORT_SCHEMA_VERSION || version < 1) {
    return { ok: false, problem: { code: 'UNSUPPORTED_SCHEMA_VERSION', version } };
  }
  if (version === 1) raw = v1ToV2(raw as Record<string, unknown>);
  const res = ExportBundle.safeParse(raw);
  if (!res.success) {
    return {
      ok: false,
      problem: { code: 'IMPORT_INVALID', issues: res.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), code: i.code })) },
    };
  }
  return { ok: true, bundle: { ...res.data, schemaVersion: EXPORT_SCHEMA_VERSION } };
}

/** v2: product roast level 1–5 → 1–3. */
function v1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const products = Array.isArray(raw.products)
    ? raw.products.map((p: unknown) =>
        p && typeof p === 'object' && 'roastLevel' in p ? { ...p, roastLevel: roastLevelFrom5((p as { roastLevel: number | null }).roastLevel) } : p,
      )
    : raw.products;
  return { ...raw, products };
}

/** RFC 4180 CSV; cells containing separators, quotes or newlines are quoted. */
export function toCsv(rows: readonly (readonly (string | number | boolean | null | undefined)[])[]): string {
  const cell = (v: string | number | boolean | null | undefined): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // guard against spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
