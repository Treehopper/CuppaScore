import {
  EXPORT_SCHEMA_VERSION,
  migrateBundle,
  toCsv,
  toZonedIso,
  type ExportBundle,
  type RecordMeta,
} from '@cuplog/core';
import { DomainError } from './errors';
import type { Ctx, Repo, Repositories } from './ports';

export type ImportMode = 'merge' | 'replace';

export interface ImportCounts {
  added: number;
  updated: number;
  skipped: number;
}

export interface ImportReport {
  mode: ImportMode;
  products: ImportCounts;
  bags: ImportCounts;
  ratings: ImportCounts;
  venues: ImportCounts;
  settings: 'replaced' | 'kept' | 'none';
}

/** The newer of two versions of a record wins: higher rev, then later updatedAt. */
function isNewer(a: RecordMeta, b: RecordMeta): boolean {
  return a.rev > b.rev || (a.rev === b.rev && Date.parse(a.updatedAt) > Date.parse(b.updatedAt));
}

export async function exportAll(repos: Repositories, ctx: Ctx): Promise<ExportBundle> {
  const all = { includeDeleted: true };
  const [products, bags, ratings, venues, settings] = await Promise.all([
    repos.products.list(ctx.ownerId, all),
    repos.bags.list(ctx.ownerId, all),
    repos.ratings.list(ctx.ownerId, all),
    repos.venues.list(ctx.ownerId, all),
    repos.settings.get(ctx.ownerId),
  ]);
  return {
    app: 'cuplog',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: toZonedIso(ctx.clock.now(), settings?.timeZone),
    products,
    bags,
    ratings,
    venues,
    settings: settings ?? null,
  };
}

async function importInto<T extends RecordMeta>(repo: Repo<T>, rows: T[], ownerId: string, mode: ImportMode): Promise<ImportCounts> {
  const counts: ImportCounts = { added: 0, updated: 0, skipped: 0 };
  for (const raw of rows) {
    const row = { ...raw, ownerId };
    const existing = mode === 'merge' ? await repo.get(ownerId, row.id) : undefined;
    if (!existing) {
      await repo.put(row);
      counts.added++;
    } else if (isNewer(row, existing)) {
      await repo.put(row);
      counts.updated++;
    } else {
      counts.skipped++;
    }
  }
  return counts;
}

/**
 * Imports a bundle. "replace" wipes this owner's data first; "merge" keeps the newer version
 * of each record (by rev/updatedAt). Records are re-owned by the importing owner.
 */
export async function importAll(repos: Repositories, ctx: Ctx, raw: unknown, mode: ImportMode): Promise<ImportReport> {
  const res = migrateBundle(raw);
  if (!res.ok) throw new DomainError(res.problem.code, res.problem);
  const b = res.bundle;
  const owner = ctx.ownerId;
  return repos.uow.run(async () => {
    if (mode === 'replace') {
      await Promise.all([
        repos.products.clear(owner),
        repos.bags.clear(owner),
        repos.ratings.clear(owner),
        repos.venues.clear(owner),
        repos.settings.clear(owner),
      ]);
    }
    const products = await importInto(repos.products, b.products, owner, mode);
    const bags = await importInto(repos.bags, b.bags, owner, mode);
    const venues = await importInto(repos.venues, b.venues, owner, mode);
    const ratings = await importInto(repos.ratings, b.ratings, owner, mode);
    let settings: ImportReport['settings'] = 'none';
    if (b.settings) {
      const cur = await repos.settings.get(owner);
      if (!cur || mode === 'replace' || b.settings.rev > cur.rev) {
        await repos.settings.put(owner, b.settings);
        settings = 'replaced';
      } else settings = 'kept';
    }
    return { mode, products, bags, ratings, venues, settings };
  });
}

export const RATINGS_CSV_HEADER = [
  'id', 'ratedAt', 'level', 'source', 'roaster', 'product', 'bag', 'venue', 'method', 'drink', 'milk',
  'doseG', 'waterG', 'yieldG', 'grind', 'tempC', 'timeS', 'swipe', 'overall', 'strength',
  'acidity', 'sweetness', 'bitterness', 'body', 'aftertaste', 'flavourTags', 'meal', 'mealNote',
  'wouldBuyAgain', 'timeOfDay', 'daysSinceRoast', 'excluded', 'excludeReason', 'note',
] as const;

/** Ratings as CSV for spreadsheets (E2). Enum keys stay untranslated. */
export async function exportRatingsCsv(repos: Repositories, ctx: Ctx): Promise<string> {
  const o = ctx.ownerId;
  const [ratings, products, bags, venues] = await Promise.all([
    repos.ratings.list(o),
    repos.products.list(o, { includeDeleted: true }),
    repos.bags.list(o, { includeDeleted: true }),
    repos.venues.list(o, { includeDeleted: true }),
  ]);
  const P = new Map(products.map((p) => [p.id, p]));
  const B = new Map(bags.map((b) => [b.id, b]));
  const V = new Map(venues.map((v) => [v.id, v]));
  ratings.sort((a, b) => Date.parse(a.ratedAt) - Date.parse(b.ratedAt));
  const rows = ratings.map((r) => {
    const p = r.productId ? P.get(r.productId) : undefined;
    return [
      r.id, r.ratedAt, r.level, r.source, p?.roaster, p?.name, r.bagId ? B.get(r.bagId)?.label : undefined,
      r.venueId ? V.get(r.venueId)?.name : undefined, r.brew?.method, r.cafe?.drink, r.brew?.milk ?? r.cafe?.milk,
      r.brew?.doseG, r.brew?.waterG, r.brew?.yieldG, r.brew?.grind, r.brew?.tempC, r.brew?.timeS,
      r.swipe, r.overall, r.strength, r.profile?.acidity, r.profile?.sweetness, r.profile?.bitterness,
      r.profile?.body, r.profile?.aftertaste, r.flavourTags?.join(' '), r.meal.type, r.meal.note,
      r.wouldBuyAgain, r.timeOfDay, r.derived?.daysSinceRoast, r.excluded, r.excludeReason, r.note,
    ];
  });
  return toCsv([[...RATINGS_CSV_HEADER], ...rows]);
}
