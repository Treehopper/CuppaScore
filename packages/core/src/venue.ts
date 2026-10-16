import { z } from 'zod';
import { Drink } from './enums';
import { RecordMeta } from './record';

/** Café / restaurant (README §4.4). */
export const VenueFields = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().max(200).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  catalogSellerId: z.string().max(100).nullable().default(null),
  lastDrink: Drink.nullable().default(null),
});
export type VenueFields = z.infer<typeof VenueFields>;
export type VenueInput = z.input<typeof VenueFields>;

export const Venue = RecordMeta.extend(VenueFields.shape);
export type Venue = z.infer<typeof Venue>;
