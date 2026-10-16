/** Domain vocabularies as plain constants (no zod), safe to ship to the UI bundle. */

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

export const HOME_MILKS = ['none', 'dairy', 'oat', 'soy', 'almond', 'otherPlant'] as const;

export const CAFE_MILKS = ['none', 'dairy', 'plant', 'unknown'] as const;

export const CUP_SIZES = ['small', 'regular', 'large'] as const;

export const MEAL_TYPES = ['none', 'sweet', 'savory', 'mixed', 'unspecified'] as const;

export const RATING_LEVELS = ['swipe', 'stars', 'advanced'] as const;

export const RATING_SOURCES = ['home', 'cafe'] as const;

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

export const PROFILE_ATTRS = ['acidity', 'sweetness', 'bitterness', 'body', 'aftertaste'] as const;

export const WISHES = ['more', 'justRight', 'less'] as const;

export const PROCESSES = ['washed', 'natural', 'honey', 'anaerobic', 'other'] as const;

export const ROAST_FOR = ['filter', 'espresso', 'omni'] as const;

export const BAG_FORMS = ['beans', 'ground', 'capsules', 'pods'] as const;

export const OUTLIER_METHODS = ['mad', 'trimmed', 'off'] as const;

export const TIMES_OF_DAY_KEYS = ['early', 'morning', 'midday', 'afternoon', 'evening'] as const;
