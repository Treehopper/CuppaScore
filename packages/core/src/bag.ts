import { z } from 'zod';
import { BagForm } from './enums';
import { Id, IsoDate, RecordMeta } from './record';
import { daysBetween } from './time';

/** User-editable bag fields (README §4.2). */
export const BagFields = z.object({
  productId: Id,
  label: z.string().max(60).default(''),
  weightG: z.number().positive().max(10_000).nullable().default(null),
  priceEur: z.number().nonnegative().max(10_000).nullable().default(null),
  shop: z.string().max(120).default(''),
  purchasedAt: IsoDate.nullable().default(null),
  roastDate: IsoDate.nullable().default(null),
  expiryDate: IsoDate.nullable().default(null),
  openedAt: IsoDate.nullable().default(null),
  finishedAt: IsoDate.nullable().default(null),
  form: BagForm.default('beans'),
  storage: z.string().max(80).default(''),
  notes: z.string().max(2000).default(''),
});
export type BagFields = z.infer<typeof BagFields>;
export type BagInput = z.input<typeof BagFields>;

export const Bag = RecordMeta.extend(BagFields.shape);
export type Bag = z.infer<typeof Bag>;

export type BagStatus = 'unopened' | 'open' | 'finished';

export function bagStatus(bag: Pick<Bag, 'openedAt' | 'finishedAt'>): BagStatus {
  if (bag.finishedAt) return 'finished';
  if (bag.openedAt) return 'open';
  return 'unopened';
}

export interface BagFreshness {
  daysSinceRoast: number | null;
  daysSinceOpen: number | null;
  pastExpiry: boolean;
  /** Days until expiry (negative once past), null without an expiry date. */
  daysToExpiry: number | null;
}

export function bagFreshness(
  bag: Pick<Bag, 'roastDate' | 'openedAt' | 'expiryDate'>,
  today: string,
): BagFreshness {
  const daysToExpiry = bag.expiryDate ? daysBetween(today, bag.expiryDate) : null;
  return {
    daysSinceRoast: bag.roastDate ? daysBetween(bag.roastDate, today) : null,
    daysSinceOpen: bag.openedAt ? daysBetween(bag.openedAt, today) : null,
    pastExpiry: daysToExpiry !== null && daysToExpiry < 0,
    daysToExpiry,
  };
}

/** Default "stale" threshold for the warning in A7 (days past roast). */
export const STALE_AFTER_ROAST_DAYS = 60;

export type BagWarning = 'pastExpiry' | 'staleRoast';

export function bagWarnings(bag: Pick<Bag, 'roastDate' | 'openedAt' | 'expiryDate'>, today: string, staleAfterDays = STALE_AFTER_ROAST_DAYS): BagWarning[] {
  const f = bagFreshness(bag, today);
  const out: BagWarning[] = [];
  if (f.pastExpiry) out.push('pastExpiry');
  if (f.daysSinceRoast !== null && f.daysSinceRoast > staleAfterDays) out.push('staleRoast');
  return out;
}

/** Typical dose when a bag's cups don't record one (grams). */
export const DEFAULT_DOSE_G = 15;

/**
 * Cost per cup of a bag (README §3 C8): price / cups for a finished bag, otherwise estimated from
 * weight and the average dose. Null without a price (or without cups and weight).
 */
export function bagCostPerCup(
  bag: Pick<Bag, 'priceEur' | 'weightG' | 'openedAt' | 'finishedAt'>,
  cups: number,
  avgDoseG: number = DEFAULT_DOSE_G,
): number | null {
  if (bag.priceEur === null || bag.priceEur === undefined) return null;
  if (bagStatus(bag) === 'finished' && cups > 0) return bag.priceEur / cups;
  if (bag.weightG && avgDoseG > 0) return bag.priceEur / Math.max(1, bag.weightG / avgDoseG);
  return null;
}
