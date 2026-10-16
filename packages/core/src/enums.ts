import { z } from 'zod';

/** Domain vocabularies. These are enum keys; the UI translates them (README §8.1, §11). */

export const BREW_METHODS = [
  'aeropress',
  'flairNeo',
  'espressoMachine',
  'v60',
  'chemex',
  'kalita',
  'frenchPress',
  'moka',
  'filterMachine',
  'coldBrew',
  'beanToCup',
] as const;
export const BrewMethod = z.enum(BREW_METHODS);
export type BrewMethod = z.infer<typeof BrewMethod>;

export const DRINKS = [
  'espresso',
  'doppio',
  'ristretto',
  'americano',
  'cappuccino',
  'flatWhite',
  'latte',
  'cortado',
  'macchiato',
  'batch',
  'pourOver',
  'coldBrew',
  'other',
] as const;
export const Drink = z.enum(DRINKS);
export type Drink = z.infer<typeof Drink>;

export const HOME_MILKS = ['none', 'dairy', 'oat', 'soy', 'almond', 'otherPlant'] as const;
export const HomeMilk = z.enum(HOME_MILKS);
export type HomeMilk = z.infer<typeof HomeMilk>;

export const CAFE_MILKS = ['none', 'dairy', 'plant', 'unknown'] as const;
export const CafeMilk = z.enum(CAFE_MILKS);
export type CafeMilk = z.infer<typeof CafeMilk>;

export const CUP_SIZES = ['small', 'regular', 'large'] as const;
export const CupSize = z.enum(CUP_SIZES);
export type CupSize = z.infer<typeof CupSize>;

export const MEAL_TYPES = ['none', 'sweet', 'savory', 'mixed', 'unspecified'] as const;
export const MealType = z.enum(MEAL_TYPES);
export type MealType = z.infer<typeof MealType>;

export const RATING_LEVELS = ['swipe', 'stars', 'advanced'] as const;
export const RatingLevel = z.enum(RATING_LEVELS);
export type RatingLevel = z.infer<typeof RatingLevel>;

export const RATING_SOURCES = ['home', 'cafe'] as const;
export const RatingSource = z.enum(RATING_SOURCES);
export type RatingSource = z.infer<typeof RatingSource>;

export const TimeOfDayEnum = z.enum(['early', 'morning', 'midday', 'afternoon', 'evening']);

export const FLAVOUR_TAGS = [
  'chocolate',
  'nutty',
  'caramel',
  'berry',
  'citrus',
  'stoneFruit',
  'tropical',
  'floral',
  'spice',
  'earthy',
  'herbal',
  'winey',
] as const;
export const FlavourTag = z.enum(FLAVOUR_TAGS);
export type FlavourTag = z.infer<typeof FlavourTag>;

export const PROFILE_ATTRS = ['acidity', 'sweetness', 'bitterness', 'body', 'aftertaste'] as const;
export const ProfileAttr = z.enum(PROFILE_ATTRS);
export type ProfileAttr = z.infer<typeof ProfileAttr>;

export const WISHES = ['more', 'justRight', 'less'] as const;
export const Wish = z.enum(WISHES);
export type Wish = z.infer<typeof Wish>;

export const PROCESSES = ['washed', 'natural', 'honey', 'anaerobic', 'other'] as const;
export const Process = z.enum(PROCESSES);
export type Process = z.infer<typeof Process>;

export const ROAST_FOR = ['filter', 'espresso', 'omni'] as const;
export const RoastFor = z.enum(ROAST_FOR);
export type RoastFor = z.infer<typeof RoastFor>;

export const BAG_FORMS = ['beans', 'ground', 'capsules', 'pods'] as const;
export const BagForm = z.enum(BAG_FORMS);
export type BagForm = z.infer<typeof BagForm>;

export const OUTLIER_METHODS = ['mad', 'trimmed', 'off'] as const;
export const OutlierMethod = z.enum(OUTLIER_METHODS);
export type OutlierMethod = z.infer<typeof OutlierMethod>;
