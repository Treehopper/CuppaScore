import { z } from 'zod';
import { Process, RoastFor } from './enums';
import { Id, RecordMeta } from './record';

export const Origin = z.object({
  country: z.string().max(80).nullable().default(null),
  region: z.string().max(80).nullable().default(null),
  farm: z.string().max(120).nullable().default(null),
  altitudeM: z.number().int().min(0).max(5000).nullable().default(null),
});
export type Origin = z.infer<typeof Origin>;

/** User-editable product fields (README §4.1). */
export const ProductFields = z.object({
  catalogId: z.string().max(200).nullable().default(null),
  roaster: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  origin: Origin.default({ country: null, region: null, farm: null, altitudeM: null }),
  process: Process.nullable().default(null),
  varietals: z.array(z.string().max(60)).max(20).default([]),
  /** 1 = very light … 5 = dark */
  roastLevel: z.number().int().min(1).max(5).nullable().default(null),
  roastFor: z.array(RoastFor).max(3).default([]),
  isBlend: z.boolean().default(false),
  labelNotes: z.array(z.string().max(60)).max(30).default([]),
  decaf: z.boolean().default(false),
  barcode: z.string().max(32).nullable().default(null),
  /** MediaStore reference (README §8.3). */
  photoMediaId: Id.nullable().default(null),
});
export type ProductFields = z.infer<typeof ProductFields>;
export type ProductInput = z.input<typeof ProductFields>;

export const Product = RecordMeta.extend(ProductFields.shape);
export type Product = z.infer<typeof Product>;
