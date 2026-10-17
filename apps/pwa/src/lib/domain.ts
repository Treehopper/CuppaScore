// UI-side domain helpers. Vocabularies come from @cuplog/api (re-exported from core, zod-free).
import type { DomainSettingsDto, RatingDto } from '@cuplog/api';

export {
  BAG_FORMS,
  BREW_METHODS,
  CAFE_MILKS,
  CUP_SIZES,
  DRINKS,
  FLAVOUR_TAGS,
  HOME_MILKS,
  OUTLIER_METHODS,
  PROCESSES,
  PROFILE_ATTRS,
  RATING_LEVELS,
  ROAST_FOR,
  SUGGESTED_REMINDER_RULES,
  TIMES_OF_DAY_KEYS as TIMES_OF_DAY,
  WEEKDAY_KEYS,
  WISHES,
} from '@cuplog/api';

export type BrewMethod = NonNullable<RatingDto['brew']>['method'];
export type RatingLevel = RatingDto['level'];
export type MealType = RatingDto['meal']['type'];
export type OutlierMethod = DomainSettingsDto['outlierMethod'];

/** Meal choices offered in the UI ("unspecified" is implicit). */
export const MEAL_CHOICES = ['none', 'sweet', 'savory', 'mixed'] as const satisfies readonly MealType[];
