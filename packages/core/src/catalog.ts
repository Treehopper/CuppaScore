import { z } from 'zod';
import { Process, RoastFor } from './enums';
import { IsoDate, IsoDateTime } from './record';

/**
 * Munich coffee catalog as JSON (README §6.2): kept for the later `catalog-builder` pipeline.
 * v1 ships the CSV catalog instead (`catalogCsv.ts`, owner feedback F4).
 */

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
  roastLevel: z.number().int().min(1).max(3).nullable().optional(),
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
