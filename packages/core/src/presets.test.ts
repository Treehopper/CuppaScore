import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { derivePresets, presetKeyOf } from './presets';
import { makeRating } from './testing';

const NOW = Date.parse('2026-10-16T08:00:00+02:00'); // Friday morning
const TZ = 'Europe/Berlin';
const openBag = { openedAt: '2026-10-06', finishedAt: null, roastDate: '2026-10-02', expiryDate: '2027-04-02' };
const bags = new Map([
  ['bag1', openBag],
  ['bag2', openBag],
  ['done', { ...openBag, finishedAt: '2026-10-10' }],
  ['old', { ...openBag, expiryDate: '2026-10-01' }],
]);

const home = (bagId: string, method: 'aeropress' | 'flairNeo', ratedAt: string, extra = {}) =>
  makeRating({ bagId, ratedAt, brew: { method, doseG: 15 }, ...extra });

describe('derivePresets', () => {
  it('groups by bag + method and keeps the last parameters and level', () => {
    const ps = derivePresets(
      [
        home('bag1', 'aeropress', '2026-10-14T07:30:00+02:00', { level: 'stars' }),
        home('bag1', 'aeropress', '2026-10-15T07:30:00+02:00', {
          level: 'swipe',
          brew: { method: 'aeropress', doseG: 16, methodParams: { kind: 'aeropress', orientation: 'inverted' } },
        }),
      ],
      { nowMs: NOW, timeZone: TZ, bags },
    );
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ key: 'home:bag1:aeropress', uses: 2, lastLevel: 'swipe', method: 'aeropress' });
    expect(ps[0]!.lastBrew?.doseG).toBe(16);
  });

  it('ranks by recency, frequency and time-of-day match', () => {
    const rs = [
      // Flair: used often, but in the afternoon
      ...[10, 11, 12, 13].map((d) => home('bag2', 'flairNeo', `2026-10-${d}T15:00:00+02:00`)),
      // AeroPress: mornings, most recent
      home('bag1', 'aeropress', '2026-10-15T07:30:00+02:00'),
      home('bag1', 'aeropress', '2026-10-14T07:30:00+02:00'),
    ];
    const morning = derivePresets(rs, { nowMs: NOW, timeZone: TZ, bags });
    expect(morning.map((p) => p.method)).toEqual(['aeropress', 'flairNeo']);
    const afternoon = derivePresets(rs, { nowMs: Date.parse('2026-10-13T16:00:00+02:00'), timeZone: TZ, bags });
    expect(afternoon[0]!.method).toBe('flairNeo');
  });

  it('puts pinned presets first and hides finished or expired bags', () => {
    const rs = [
      home('bag1', 'aeropress', '2026-10-15T07:30:00+02:00'),
      home('bag2', 'flairNeo', '2026-09-01T07:30:00+02:00'),
      home('done', 'aeropress', '2026-10-15T07:30:00+02:00'),
      home('old', 'aeropress', '2026-10-15T07:30:00+02:00'),
      home('ghost', 'aeropress', '2026-10-15T07:30:00+02:00'),
    ];
    const ps = derivePresets(rs, { nowMs: NOW, timeZone: TZ, bags, pinned: new Set(['home:bag2:flairNeo']) });
    expect(ps.map((p) => p.key)).toEqual(['home:bag2:flairNeo', 'home:bag1:aeropress']);
    expect(ps[0]!.pinned).toBe(true);
  });

  it('derives café presets by venue + drink + milk + size', () => {
    const cafe = makeRating({
      source: 'cafe',
      bagId: null,
      productId: null,
      brew: undefined,
      venueId: 'v1',
      beanKnown: 'house',
      cafe: { drink: 'cappuccino', milk: 'dairy', size: 'regular' },
    });
    expect(presetKeyOf(cafe)).toBe('cafe:v1:cappuccino:dairy:regular');
    const ps = derivePresets([cafe], { nowMs: NOW, timeZone: TZ, bags, source: 'cafe' });
    expect(ps[0]).toMatchObject({ venueId: 'v1', drink: 'cappuccino', lastBeanKnown: 'house' });
  });

  it('scores are within [0, 1] and every visible combination appears once', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            bag: fc.constantFrom('bag1', 'bag2'),
            method: fc.constantFrom('aeropress' as const, 'flairNeo' as const),
            day: fc.integer({ min: 1, max: 15 }),
            hour: fc.integer({ min: 5, max: 22 }),
          }),
          { maxLength: 30 },
        ),
        (items) => {
          const rs = items.map((i) =>
            home(i.bag, i.method, `2026-10-${String(i.day).padStart(2, '0')}T${String(i.hour).padStart(2, '0')}:00:00+02:00`),
          );
          const ps = derivePresets(rs, { nowMs: NOW, timeZone: TZ, bags });
          expect(new Set(ps.map((p) => p.key)).size).toBe(new Set(items.map((i) => `${i.bag}${i.method}`)).size);
          for (const p of ps) {
            expect(p.score).toBeGreaterThanOrEqual(0);
            expect(p.score).toBeLessThanOrEqual(1);
          }
          for (let i = 1; i < ps.length; i++) expect(ps[i - 1]!.score).toBeGreaterThanOrEqual(ps[i]!.score);
        },
      ),
    );
  });
});
