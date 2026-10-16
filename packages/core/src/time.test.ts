import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays, daysBetween, localParts, timeOfDayAt, toZonedIso, zonedTimeToMs } from './time';

describe('time', () => {
  it('formats with the Berlin offset in summer and winter', () => {
    expect(toZonedIso(Date.parse('2026-10-16T05:45:00Z'))).toBe('2026-10-16T07:45:00+02:00');
    expect(toZonedIso(Date.parse('2026-12-01T05:45:00Z'))).toBe('2026-12-01T06:45:00+01:00');
    expect(toZonedIso(Date.parse('2026-12-01T05:45:00Z'), 'America/New_York')).toBe('2026-12-01T00:45:00-05:00');
  });

  it('weekday and minute of day', () => {
    const p = localParts(Date.parse('2026-10-16T08:10:00+02:00'));
    expect(p.weekday).toBe('FR');
    expect(p.minuteOfDay).toBe(8 * 60 + 10);
  });

  it('zonedTimeToMs round-trips across DST', () => {
    expect(zonedTimeToMs('2026-03-29', 10 * 60)).toBe(Date.parse('2026-03-29T10:00:00+02:00'));
    expect(zonedTimeToMs('2026-10-25', 10 * 60)).toBe(Date.parse('2026-10-25T10:00:00+01:00'));
    // 02:30 doesn't exist on 2026-03-29 in Berlin → shifted forward by the gap, like Temporal's "compatible"
    expect(toZonedIso(zonedTimeToMs('2026-03-29', 150))).toBe('2026-03-29T03:30:00+02:00');
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 730 }), fc.integer({ min: 0, max: 1439 }), (d, m) => {
        const date = addDays('2026-01-01', d);
        const ms = zonedTimeToMs(date, m);
        const back = localParts(ms);
        if (back.date === date && back.minuteOfDay === m) return;
        // only DST gaps may not round-trip
        expect(date === '2026-03-29' || date === '2027-03-28').toBe(true);
      }),
    );
  });

  it('daysBetween / addDays', () => {
    expect(daysBetween('2026-10-02', '2026-10-15')).toBe(13);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('time of day buckets', () => {
    expect([6, 7, 10, 11, 13, 14, 17, 18, 23].map(timeOfDayAt)).toEqual([
      'early', 'morning', 'morning', 'midday', 'midday', 'afternoon', 'afternoon', 'evening', 'evening',
    ]);
  });
});
