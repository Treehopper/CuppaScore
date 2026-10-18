import { z } from 'zod';
import { Process, RoastFor } from './enums';
import { IsoDate, IsoDateTime } from './record';

/** Munich coffee catalog (README §6.2). Built offline by `catalog-builder`, read-only in the app. */

/** Flavour dimensions of the catalog's `flavourVector` (README §6.2, §7.1). */
export const CATALOG_FLAVOURS = ['fruity', 'floral', 'chocolate', 'nutty', 'caramel', 'spice', 'earthy', 'citrus'] as const;
export const SENSORY_AXES = ['acidity', 'sweetness', 'body', 'bitterness'] as const;

const Unit = z.number().min(0).max(1);

export const SellerType = z.enum(['roaster', 'roaster-cafe', 'shop', 'cafe', 'supermarket']);

export const Seller = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  type: SellerType,
  addresses: z
    .array(
      z.object({
        street: z.string(),
        zip: z.string(),
        city: z.string().optional(),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
      }),
    )
    .default([]),
  webshop: z.url().nullable().optional(),
  shipsTo: z.array(z.string().length(2)).default([]),
  pickup: z.boolean().default(false),
});
export type Seller = z.infer<typeof Seller>;

export const CatalogCoffee = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  sellerIds: z.array(z.string()).min(1),
  roaster: z.string().min(1),
  name: z.string().min(1),
  origin: z
    .object({ country: z.string().nullable().optional(), region: z.string().nullable().optional() })
    .default({}),
  process: Process.nullable().optional(),
  varietals: z.array(z.string()).default([]),
  roastLevel: z.number().int().min(1).max(5).nullable().optional(),
  roastFor: z.array(RoastFor).default([]),
  isBlend: z.boolean().default(false),
  decaf: z.boolean().default(false),
  /** the roaster's own wording, untranslated (E7) */
  tastingNotes: z.array(z.string()).default([]),
  flavourVector: z.partialRecord(z.enum(CATALOG_FLAVOURS), Unit).default({}),
  sensory: z.partialRecord(z.enum(SENSORY_AXES), Unit).default({}),
  priceEurPerKg: z.number().positive().nullable().optional(),
  sizesG: z.array(z.number().positive()).default([]),
  url: z.url().nullable().optional(),
  barcode: z.string().regex(/^\d{8,14}$/).nullable().optional(),
  available: z.boolean().default(true),
  lastSeen: IsoDate.nullable().optional(),
  source: z.string().default('manual'),
});
export type CatalogCoffee = z.infer<typeof CatalogCoffee>;

export const Catalog = z.object({
  version: z.string().min(1),
  generatedAt: IsoDateTime.nullable(),
  featureSchema: z.number().int().positive(),
  sellers: z.array(Seller),
  coffees: z.array(CatalogCoffee),
});
export type Catalog = z.infer<typeof Catalog>;

export const EMPTY_CATALOG: Catalog = { version: '0', generatedAt: null, featureSchema: 1, sellers: [], coffees: [] };

/** JSON Schema of the catalog file, for the builder's validation step and editors (README §6.3 step 7). */
export function catalogJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(Catalog, { io: 'input', target: 'draft-2020-12' }) as Record<string, unknown>;
}

// ---------- search ----------

export interface CatalogQuery {
  text?: string;
  process?: z.infer<typeof Process>[];
  roastFor?: z.infer<typeof RoastFor>[];
  sellerId?: string;
  decaf?: boolean;
  /** include coffees not seen for 30 days (default: available only) */
  includeUnavailable?: boolean;
  maxPricePerKg?: number;
  barcode?: string;
  limit?: number;
}

/** Lower-case, accents and umlauts folded ("Kolumbien" ≈ "kolumbien", "Café" ≈ "cafe"). */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const FIELD_WEIGHTS: [(c: CatalogCoffee) => string, number][] = [
  [(c) => c.name, 5],
  [(c) => c.roaster, 4],
  [(c) => `${c.origin.country ?? ''} ${c.origin.region ?? ''}`, 3],
  [(c) => [...c.varietals, c.process ?? ''].join(' '), 2],
  [(c) => c.tastingNotes.join(' '), 1],
];

/**
 * Every query word must prefix-match a word in some field; matches in the name count most.
 * Ties: available first, then roaster and name.
 */
export function searchCatalog(cat: Catalog, q: CatalogQuery = {}): CatalogCoffee[] {
  const words = foldText(q.text ?? '').split(' ').filter(Boolean);
  const scored: { c: CatalogCoffee; score: number }[] = [];
  for (const c of cat.coffees) {
    if (!q.includeUnavailable && !c.available) continue;
    if (q.barcode && c.barcode !== q.barcode) continue;
    if (q.process?.length && (!c.process || !q.process.includes(c.process))) continue;
    if (q.roastFor?.length && !c.roastFor.some((r) => q.roastFor!.includes(r))) continue;
    if (q.sellerId && !c.sellerIds.includes(q.sellerId)) continue;
    if (q.decaf !== undefined && c.decaf !== q.decaf) continue;
    if (q.maxPricePerKg !== undefined && (c.priceEurPerKg ?? Infinity) > q.maxPricePerKg) continue;
    let score = 0;
    let all = true;
    const fields = FIELD_WEIGHTS.map(([get, w]) => [foldText(get(c)).split(' '), w] as const);
    for (const word of words) {
      let best = 0;
      for (const [tokens, w] of fields) {
        for (const tok of tokens) {
          if (tok === word) best = Math.max(best, w * 2);
          else if (tok.startsWith(word)) best = Math.max(best, w);
        }
      }
      if (best === 0) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) scored.push({ c, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.c.available) - Number(a.c.available) ||
      a.c.roaster.localeCompare(b.c.roaster) ||
      a.c.name.localeCompare(b.c.name),
  );
  return scored.slice(0, q.limit ?? 50).map((s) => s.c);
}
