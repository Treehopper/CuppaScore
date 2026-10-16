import { z } from 'zod';
import { BREW_METHODS, DRINKS, HOME_MILKS, CAFE_MILKS, CUP_SIZES, MEAL_TYPES, RATING_LEVELS, RATING_SOURCES, FLAVOUR_TAGS, PROFILE_ATTRS, WISHES, PROCESSES, ROAST_FOR, BAG_FORMS, OUTLIER_METHODS } from './vocab';

export { BREW_METHODS, DRINKS, HOME_MILKS, CAFE_MILKS, CUP_SIZES, MEAL_TYPES, RATING_LEVELS, RATING_SOURCES, FLAVOUR_TAGS, PROFILE_ATTRS, WISHES, PROCESSES, ROAST_FOR, BAG_FORMS, OUTLIER_METHODS };

/** Domain vocabularies. These are enum keys; the UI translates them (README §8.1, §11). */

export const BrewMethod = z.enum(BREW_METHODS);
export type BrewMethod = z.infer<typeof BrewMethod>;

export const Drink = z.enum(DRINKS);
export type Drink = z.infer<typeof Drink>;

export const HomeMilk = z.enum(HOME_MILKS);
export type HomeMilk = z.infer<typeof HomeMilk>;

export const CafeMilk = z.enum(CAFE_MILKS);
export type CafeMilk = z.infer<typeof CafeMilk>;

export const CupSize = z.enum(CUP_SIZES);
export type CupSize = z.infer<typeof CupSize>;

export const MealType = z.enum(MEAL_TYPES);
export type MealType = z.infer<typeof MealType>;

export const RatingLevel = z.enum(RATING_LEVELS);
export type RatingLevel = z.infer<typeof RatingLevel>;

export const RatingSource = z.enum(RATING_SOURCES);
export type RatingSource = z.infer<typeof RatingSource>;

export const TimeOfDayEnum = z.enum(['early', 'morning', 'midday', 'afternoon', 'evening']);

export const FlavourTag = z.enum(FLAVOUR_TAGS);
export type FlavourTag = z.infer<typeof FlavourTag>;

export const ProfileAttr = z.enum(PROFILE_ATTRS);
export type ProfileAttr = z.infer<typeof ProfileAttr>;

export const Wish = z.enum(WISHES);
export type Wish = z.infer<typeof Wish>;

export const Process = z.enum(PROCESSES);
export type Process = z.infer<typeof Process>;

export const RoastFor = z.enum(ROAST_FOR);
export type RoastFor = z.infer<typeof RoastFor>;

export const BagForm = z.enum(BAG_FORMS);
export type BagForm = z.infer<typeof BagForm>;

export const OutlierMethod = z.enum(OUTLIER_METHODS);
export type OutlierMethod = z.infer<typeof OutlierMethod>;
