import type { Bag } from './bag';
import { bagFreshness } from './bag';
import type { Derived } from './rating';
import { isoLocalDate, isoLocalHour, timeOfDayAt, type TimeOfDay } from './time';

/** `derived` block stored on home ratings at save time (README §4.3). */
export function computeDerived(bag: Pick<Bag, 'roastDate' | 'openedAt' | 'expiryDate'>, ratedAt: string): Derived {
  const f = bagFreshness(bag, isoLocalDate(ratedAt));
  return { daysSinceRoast: f.daysSinceRoast, daysSinceOpen: f.daysSinceOpen, pastExpiry: f.pastExpiry };
}

/** Time-of-day bucket of an ISO timestamp, using the wall-clock time it was recorded in. */
export function timeOfDayOf(ratedAt: string): TimeOfDay {
  return timeOfDayAt(isoLocalHour(ratedAt));
}
