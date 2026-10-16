import { describe, expect, it } from 'vitest';
import {
  BagFields,
  bagStatus,
  bagWarnings,
  computeDerived,
  defaultSettings,
  ProductFields,
  RatingFields,
  stripForLevel,
  timeOfDayOf,
  validateRatingShape,
} from './index';

const home = {
  source: 'home',
  ratedAt: '2026-10-16T07:45:00+02:00',
  timeOfDay: 'morning',
  bagId: 'b1',
  productId: 'p1',
  brew: { method: 'aeropress', doseG: 15, methodParams: { kind: 'aeropress', orientation: 'inverted' } },
} as const;

describe('schemas', () => {
  it('fills product defaults', () => {
    const p = ProductFields.parse({ roaster: 'Vits der Kaffee', name: 'Ethiopia Guji Natural' });
    expect(p.varietals).toEqual([]);
    expect(p.origin.country).toBeNull();
    expect(() => ProductFields.parse({ roaster: ' ', name: 'x' })).toThrow();
  });

  it('validates bag dates', () => {
    expect(BagFields.parse({ productId: 'p1', roastDate: '2026-10-02' }).form).toBe('beans');
    expect(() => BagFields.parse({ productId: 'p1', roastDate: '02.10.2026' })).toThrow();
  });

  it('stars are half steps', () => {
    expect(() => RatingFields.parse({ ...home, level: 'stars', overall: 4.5 })).not.toThrow();
    expect(() => RatingFields.parse({ ...home, level: 'stars', overall: 4.3 })).toThrow();
    expect(() => RatingFields.parse({ ...home, level: 'stars', overall: 0 })).toThrow();
  });

  it('checks level and source shape', () => {
    const swipe = RatingFields.parse({ ...home, level: 'swipe', swipe: 'more' });
    expect(validateRatingShape(swipe)).toEqual([]);
    expect(swipe.meal.type).toBe('unspecified');
    expect(validateRatingShape(RatingFields.parse({ ...home, level: 'swipe', overall: 4 }))).toEqual([
      'SWIPE_REQUIRED',
      'FIELD_NOT_ALLOWED_FOR_LEVEL',
    ]);
    expect(validateRatingShape(RatingFields.parse({ ...home, level: 'stars', overall: 4, strength: 3 }))).toEqual([
      'FIELD_NOT_ALLOWED_FOR_LEVEL',
    ]);
    const cafe = RatingFields.parse({
      level: 'stars',
      source: 'cafe',
      ratedAt: '2026-10-15T14:20:00+02:00',
      timeOfDay: 'afternoon',
      venueId: 'v1',
      beanKnown: 'house',
      cafe: { drink: 'cappuccino', milk: 'dairy' },
      overall: 4.5,
    });
    expect(validateRatingShape(cafe)).toEqual([]);
    expect(cafe.cafe?.size).toBe('regular');
    expect(validateRatingShape({ ...cafe, bagId: 'b1' })).toEqual(['FIELD_NOT_ALLOWED_FOR_SOURCE']);
    expect(
      validateRatingShape(
        RatingFields.parse({ ...home, level: 'stars', overall: 3, brew: { method: 'v60', methodParams: { kind: 'flairNeo' } } }),
      ),
    ).toEqual(['METHOD_PARAMS_MISMATCH']);
  });

  it('strips fields of other levels', () => {
    const r = stripForLevel({ level: 'swipe' as const, swipe: 'more' as const, overall: 4, strength: 2 });
    expect(r).toEqual({ level: 'swipe', swipe: 'more' });
  });

  it('derives freshness, status, warnings and time of day', () => {
    const bag = { roastDate: '2026-10-02', openedAt: '2026-10-06', expiryDate: '2026-10-10', finishedAt: null };
    expect(computeDerived(bag, '2026-10-15T08:10:00+02:00')).toEqual({ daysSinceRoast: 13, daysSinceOpen: 9, pastExpiry: true });
    expect(bagStatus(bag)).toBe('open');
    expect(bagWarnings(bag, '2026-12-15')).toEqual(['pastExpiry', 'staleRoast']);
    expect(timeOfDayOf('2026-10-15T14:20:00+02:00')).toBe('afternoon');
  });

  it('default settings', () => {
    const s = defaultSettings();
    expect(s.halfLifeDays).toBe(60);
    expect(s.confidence).toEqual({ swipe: 0.5, stars: 1, advanced: 1.2 });
    expect(s.ownedMethods).toContain('flairNeo');
  });
});
