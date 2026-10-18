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

/** 1 = light, 2 = medium, 3 = dark: the 1–3 beans most roasters print on the bag. */
export const ROAST_LEVELS = [1, 2, 3] as const;

export const BAG_FORMS = ['beans', 'ground', 'capsules', 'pods'] as const;

export const OUTLIER_METHODS = ['mad', 'trimmed', 'off'] as const;

export const TIMES_OF_DAY_KEYS = ['early', 'morning', 'midday', 'afternoon', 'evening'] as const;

export const WEEKDAY_KEYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

/** The README §4.7 / §9.1 reminder suggestion (plain data; validated by `ReminderRule` in core). */
export const SUGGESTED_REMINDER_RULES = [
  { id: 'rem_1', kind: 'nothingLoggedBy', time: '10:00', days: ['MO', 'TU', 'WE', 'TH', 'FR'], enabled: true },
  { id: 'rem_2', kind: 'nothingLoggedBy', time: '11:30', days: ['SA', 'SU'], enabled: false },
  { id: 'rem_3', kind: 'fewerThanBy', count: 2, time: '15:30', days: 'all', enabled: false },
  { id: 'rem_4', kind: 'afterLastLog', hours: 2, window: { from: '08:00', to: '18:00' }, days: 'all', enabled: false },
  { id: 'rem_5', kind: 'fixedDaily', time: '20:00', days: 'all', enabled: false },
  { id: 'rem_6', kind: 'bagExpiring', daysBefore: 2, time: '09:00', enabled: false },
] as const;

/** The context model (README §5.4) needs at least this many cups to say anything. */
export const MIN_CONTEXT_CUPS = 8;
