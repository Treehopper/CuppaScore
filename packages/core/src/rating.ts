import { z } from 'zod';
import {
  BrewMethod,
  CafeMilk,
  CupSize,
  Drink,
  FlavourTag,
  HomeMilk,
  MealType,
  ProfileAttr,
  RatingLevel,
  RatingSource,
  TimeOfDayEnum,
  Wish,
} from './enums';
import { Id, IsoDateTime, RecordMeta } from './record';

/** AeroPress parameters (B2a). */
export const AeroPressParams = z.object({
  kind: z.literal('aeropress'),
  orientation: z.enum(['standard', 'inverted']).optional(),
  steepS: z.number().int().min(0).max(3600).optional(),
  filter: z.enum(['paper', 'metal']).optional(),
  bypassG: z.number().min(0).max(1000).optional(),
});

/** Flair NEO (manual lever espresso) parameters (B2a). */
export const FlairNeoParams = z.object({
  kind: z.literal('flairNeo'),
  basket: z.enum(['flowControl', 'standard']).optional(),
  preheat: z.boolean().optional(),
  preinfusionS: z.number().int().min(0).max(120).optional(),
  pressure: z.enum(['low', 'medium', 'high']).optional(),
});

export const MethodParams = z.discriminatedUnion('kind', [AeroPressParams, FlairNeoParams]);
export type MethodParams = z.infer<typeof MethodParams>;

export const Brew = z.object({
  method: BrewMethod,
  doseG: z.number().positive().max(1000).nullable().optional(),
  waterG: z.number().positive().max(5000).nullable().optional(),
  yieldG: z.number().positive().max(5000).nullable().optional(),
  grind: z.string().max(60).nullable().optional(),
  tempC: z.number().min(0).max(100).nullable().optional(),
  timeS: z.number().int().min(0).max(86_400).nullable().optional(),
  milk: HomeMilk.optional(),
  methodParams: MethodParams.nullable().optional(),
});
export type Brew = z.infer<typeof Brew>;

export const CafeDetails = z.object({
  drink: Drink,
  milk: CafeMilk.default('unknown'),
  size: CupSize.default('regular'),
  priceEur: z.number().nonnegative().max(1000).nullable().optional(),
});
export type CafeDetails = z.infer<typeof CafeDetails>;

export const Meal = z.object({
  type: MealType,
  note: z.string().max(80).optional(),
});
export type Meal = z.infer<typeof Meal>;

/** 1–5 per attribute (advanced level). */
export const Profile = z.partialRecord(ProfileAttr, z.number().int().min(1).max(5));
export type Profile = z.infer<typeof Profile>;
export const WishMap = z.partialRecord(ProfileAttr, Wish);
export type WishMap = z.infer<typeof WishMap>;

/** 0.5 … 5 in half steps. */
export const Stars = z.number().min(0.5).max(5).multipleOf(0.5);

export const Derived = z.object({
  daysSinceRoast: z.number().int().nullable(),
  daysSinceOpen: z.number().int().nullable(),
  pastExpiry: z.boolean(),
});
export type Derived = z.infer<typeof Derived>;

/**
 * Everything a user can record for one cup (README §4.3). Only the fields of the chosen
 * `level` and `source` may be present; `validateRatingShape` enforces that.
 */
export const RatingFields = z.object({
  level: RatingLevel,
  source: RatingSource,
  ratedAt: IsoDateTime,
  timeOfDay: TimeOfDayEnum,
  /** Deterministic preset key this cup was logged from (see presets). */
  presetKey: z.string().max(200).nullable().default(null),

  // home
  bagId: Id.nullable().default(null),
  productId: Id.nullable().default(null),
  brew: Brew.optional(),

  // café
  venueId: Id.nullable().default(null),
  /** "unknown" | "house" | a productId / catalogId named by the café. */
  beanKnown: z.string().max(200).optional(),
  cafe: CafeDetails.optional(),

  // swipe
  swipe: z.enum(['more', 'less']).optional(),
  // stars + advanced
  overall: Stars.optional(),
  wouldBuyAgain: z.boolean().optional(),
  // advanced
  strength: z.number().int().min(1).max(5).optional(),
  profile: Profile.optional(),
  flavourTags: z.array(FlavourTag).max(20).optional(),
  wish: WishMap.optional(),

  meal: Meal.default({ type: 'unspecified' }),
  excluded: z.boolean().default(false),
  excludeReason: z.string().max(200).nullable().default(null),
  derived: Derived.optional(),
  note: z.string().max(2000).default(''),
});
export type RatingFields = z.infer<typeof RatingFields>;
export type RatingInput = z.input<typeof RatingFields>;

export const Rating = RecordMeta.extend(RatingFields.shape);
export type Rating = z.infer<typeof Rating>;

export type RatingShapeIssue =
  | 'SWIPE_REQUIRED'
  | 'OVERALL_REQUIRED'
  | 'FIELD_NOT_ALLOWED_FOR_LEVEL'
  | 'BAG_REQUIRED'
  | 'BREW_REQUIRED'
  | 'VENUE_REQUIRED'
  | 'CAFE_REQUIRED'
  | 'FIELD_NOT_ALLOWED_FOR_SOURCE'
  | 'METHOD_PARAMS_MISMATCH';

/** Checks level/source consistency; returns issue codes (empty = valid). */
export function validateRatingShape(r: RatingFields): RatingShapeIssue[] {
  const issues: RatingShapeIssue[] = [];
  const has = (v: unknown): boolean => v !== undefined;
  if (r.level === 'swipe') {
    if (!has(r.swipe)) issues.push('SWIPE_REQUIRED');
    if ([r.overall, r.wouldBuyAgain, r.strength, r.profile, r.flavourTags, r.wish].some(has))
      issues.push('FIELD_NOT_ALLOWED_FOR_LEVEL');
  } else {
    if (!has(r.overall)) issues.push('OVERALL_REQUIRED');
    if (has(r.swipe)) issues.push('FIELD_NOT_ALLOWED_FOR_LEVEL');
    if (r.level === 'stars' && [r.strength, r.profile, r.flavourTags, r.wish].some(has))
      issues.push('FIELD_NOT_ALLOWED_FOR_LEVEL');
  }
  if (r.source === 'home') {
    if (!r.bagId || !r.productId) issues.push('BAG_REQUIRED');
    if (!r.brew) issues.push('BREW_REQUIRED');
    if (r.venueId || has(r.cafe) || has(r.beanKnown)) issues.push('FIELD_NOT_ALLOWED_FOR_SOURCE');
    const mp = r.brew?.methodParams;
    if (mp && mp.kind !== r.brew?.method) issues.push('METHOD_PARAMS_MISMATCH');
  } else {
    if (!r.venueId) issues.push('VENUE_REQUIRED');
    if (!r.cafe) issues.push('CAFE_REQUIRED');
    if (r.bagId || has(r.brew) || has(r.derived)) issues.push('FIELD_NOT_ALLOWED_FOR_SOURCE');
  }
  return issues;
}

/** Fields that belong to a level; used to strip stale fields when the level changes on edit. */
export const LEVEL_FIELDS = {
  swipe: ['swipe'],
  stars: ['overall', 'wouldBuyAgain'],
  advanced: ['overall', 'wouldBuyAgain', 'strength', 'profile', 'flavourTags', 'wish'],
} as const satisfies Record<RatingLevel, readonly (keyof RatingFields)[]>;

const ALL_LEVEL_FIELDS = ['swipe', 'overall', 'wouldBuyAgain', 'strength', 'profile', 'flavourTags', 'wish'] as const;

/** Removes fields that don't belong to the rating's level (README §4.3: absent, not zero). */
export function stripForLevel<T extends { level: RatingLevel }>(r: T): T {
  const keep = new Set<string>(LEVEL_FIELDS[r.level]);
  const out: Record<string, unknown> = { ...r };
  for (const f of ALL_LEVEL_FIELDS) if (!keep.has(f)) delete out[f];
  return out as T;
}
