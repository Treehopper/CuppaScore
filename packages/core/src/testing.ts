/** Test fixtures shared by core, services and adapters. Not used by production code. */
import { Product, type ProductInput } from './product';
import { Rating, type RatingInput } from './rating';
import { LOCAL_OWNER, type RecordMeta } from './record';
import { timeOfDayOf } from './derive';

let seq = 0;

export function makeRating(over: Partial<RatingInput> & Partial<RecordMeta> = {}): Rating {
  const ratedAt = over.ratedAt ?? '2026-10-15T08:10:00+02:00';
  const level = over.level ?? 'stars';
  const base: Record<string, unknown> = {
    id: over.id ?? `r${++seq}`,
    ownerId: LOCAL_OWNER,
    createdAt: ratedAt,
    updatedAt: ratedAt,
    deletedAt: null,
    rev: 1,
    level,
    source: 'home',
    ratedAt,
    timeOfDay: timeOfDayOf(ratedAt),
    bagId: 'bag1',
    productId: 'prod1',
    brew: { method: 'aeropress' },
  };
  if (level === 'swipe' && over.swipe === undefined) base.swipe = 'more';
  if (level !== 'swipe' && over.overall === undefined) base.overall = 3;
  return Rating.parse({ ...base, ...over });
}

export function makeProduct(over: Partial<ProductInput> & Partial<RecordMeta> = {}): Product {
  const at = '2026-10-01T08:00:00+02:00';
  return Product.parse({
    id: `p${++seq}`,
    ownerId: LOCAL_OWNER,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    rev: 1,
    roaster: 'Vits der Kaffee',
    name: 'Ethiopia Guji Natural',
    ...over,
  });
}
