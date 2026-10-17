import { describe, expect, it } from 'vitest';
import { isDomainError } from './errors';
import { makeTestService } from './testing';

async function setup() {
  const t = makeTestService();
  const product = await t.svc.addProduct({ roaster: 'Vits der Kaffee', name: 'Ethiopia Guji Natural', process: 'natural', roastLevel: 2 });
  const bag = await t.svc.addBag({ productId: product.id, label: 'Bag #3', weightG: 250, roastDate: '2026-10-02' });
  return { ...t, product, bag };
}

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isDomainError(err), `expected DomainError ${code}, got ${String(err)}`).toBe(true);
  expect((err as { code: string }).code).toBe(code);
}

describe('products & bags', () => {
  it('creates records with server-ready meta', async () => {
    const { product, bag } = await setup();
    expect(product).toMatchObject({ ownerId: 'local', rev: 1, deletedAt: null, createdAt: '2026-10-16T08:00:00+02:00' });
    expect(product.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(bag.productId).toBe(product.id);
  });

  it('validates input and references', async () => {
    const { svc } = await setup();
    await expectCode(svc.addProduct({ roaster: '', name: 'x' }), 'VALIDATION');
    await expectCode(svc.addBag({ productId: 'nope' }), 'NOT_FOUND');
  });

  it('updates bump rev and updatedAt', async () => {
    const { svc, bag, clock } = await setup();
    clock.advance(60_000);
    const b = await svc.updateBag(bag.id, { openedAt: '2026-10-16' });
    expect(b.rev).toBe(2);
    expect(b.updatedAt).toBe('2026-10-16T08:01:00+02:00');
    expect((await svc.getBag(bag.id)).status).toBe('open');
  });

  it('lists bags open first, with freshness, warnings and cups left', async () => {
    const { svc, product, bag } = await setup();
    const unopened = await svc.addBag({ productId: product.id, label: 'Bag #4' });
    await svc.addBag({ productId: product.id, label: 'old', finishedAt: '2026-10-01', openedAt: '2026-09-01' });
    await svc.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: bag.id, brew: { method: 'aeropress', doseG: 25 } });
    const views = await svc.listBags();
    expect(views.map((v) => v.bag.label)).toEqual(['Bag #3', 'Bag #4', 'old']);
    expect(views[0]).toMatchObject({ status: 'open', cups: 1, cupsLeft: 9, freshness: { daysSinceRoast: 14 } });
    expect(views[1]!.bag.id).toBe(unopened.id);
    expect((await svc.listBags({ status: ['finished'] })).length).toBe(1);
  });
});

describe('logging ratings', () => {
  it('logs a swipe with derived data and opens the bag', async () => {
    const { svc, bag, product } = await setup();
    const r = await svc.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: bag.id, brew: { method: 'aeropress' } });
    expect(r).toMatchObject({
      productId: product.id,
      ratedAt: '2026-10-16T08:00:00+02:00',
      timeOfDay: 'morning',
      presetKey: `home:${bag.id}:aeropress`,
      derived: { daysSinceRoast: 14, daysSinceOpen: 0, pastExpiry: false },
      meal: { type: 'unspecified' },
    });
    expect((await svc.getBag(bag.id)).bag.openedAt).toBe('2026-10-16');
  });

  it('strips fields of other levels and checks the shape', async () => {
    const { svc, bag } = await setup();
    const r = await svc.logRating({ level: 'stars', overall: 4, strength: 3, source: 'home', bagId: bag.id, brew: { method: 'v60' } } as never);
    expect(r.strength).toBeUndefined();
    await expectCode(svc.logRating({ level: 'stars', source: 'home', bagId: bag.id, brew: { method: 'v60' } }), 'INVALID_RATING_SHAPE');
    await expectCode(svc.logRating({ level: 'stars', overall: 4.2, source: 'home', bagId: bag.id, brew: { method: 'v60' } }), 'VALIDATION');
  });

  it('refuses finished bags', async () => {
    const { svc, bag } = await setup();
    await svc.updateBag(bag.id, { finishedAt: '2026-10-15' });
    await expectCode(svc.logRating({ level: 'swipe', swipe: 'less', source: 'home', bagId: bag.id, brew: { method: 'v60' } }), 'BAG_FINISHED');
  });

  it('logs café cups; known beans count towards the product (C10)', async () => {
    const { svc, product } = await setup();
    const venue = await svc.addVenue({ name: 'Vits', address: 'Rumfordstraße' });
    const house = await svc.logRating({
      level: 'stars', overall: 4.5, source: 'cafe', venueId: venue.id, beanKnown: 'house',
      cafe: { drink: 'cappuccino', milk: 'dairy' }, meal: { type: 'sweet', note: 'Zwetschgendatschi' },
    });
    expect(house).toMatchObject({ productId: null, presetKey: `cafe:${venue.id}:cappuccino:dairy:regular`, bagId: null });
    const known = await svc.logRating({ level: 'swipe', swipe: 'more', source: 'cafe', venueId: venue.id, beanKnown: product.id, cafe: { drink: 'espresso' } });
    expect(known.productId).toBe(product.id);
    const stats = await svc.getProductStats(product.id);
    expect(stats.cafeCups).toBe(1);
    expect((await svc.listVenues())[0]).toMatchObject({ visits: 2, venue: { lastDrink: 'espresso' } });
    await expectCode(svc.logRating({ level: 'swipe', swipe: 'more', source: 'cafe', venueId: venue.id, beanKnown: 'house' }), 'INVALID_RATING_SHAPE');
  });

  it('edits: level change drops stale fields, ratedAt change re-buckets time of day', async () => {
    const { svc, bag } = await setup();
    const r = await svc.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: bag.id, brew: { method: 'aeropress' } });
    const u = await svc.updateRating(r.id, { level: 'advanced', overall: 4, strength: 3, profile: { sweetness: 2 }, ratedAt: '2026-10-15T15:00:00+02:00' });
    expect(u.swipe).toBeUndefined();
    expect('swipe' in u).toBe(false);
    expect(u).toMatchObject({ level: 'advanced', overall: 4, timeOfDay: 'afternoon', rev: 2, derived: { daysSinceRoast: 13 } });
    const t = await svc.updateRating(r.id, { timeOfDay: 'evening' });
    expect(t.timeOfDay).toBe('evening');
    expect((await svc.updateRating(r.id, { note: 'x' })).timeOfDay).toBe('evening');
  });

  it('edits: null clears optional fields; ratedAt accepts wall-clock time in the settings zone', async () => {
    const { svc, bag } = await setup();
    const r = await svc.logRating({
      level: 'advanced',
      overall: 4,
      wouldBuyAgain: true,
      strength: 3,
      flavourTags: ['berry'],
      source: 'home',
      bagId: bag.id,
      brew: { method: 'aeropress' },
    });
    const u = await svc.updateRating(r.id, { wouldBuyAgain: null, flavourTags: null, ratedAt: '2026-10-15T19:30' });
    expect('wouldBuyAgain' in u).toBe(false);
    expect('flavourTags' in u).toBe(false);
    expect(u).toMatchObject({ strength: 3, ratedAt: '2026-10-15T19:30:00+02:00', timeOfDay: 'evening' });
    // UTC input is stored zoned too
    expect((await svc.updateRating(r.id, { ratedAt: '2026-10-15T05:00:00Z' })).ratedAt).toBe('2026-10-15T07:00:00+02:00');
    await expectCode(svc.updateRating(r.id, { ratedAt: 'yesterday' }), 'VALIDATION');
    // overall is required at this level, so clearing it is rejected
    await expectCode(svc.updateRating(r.id, { overall: null }), 'INVALID_RATING_SHAPE');
  });

  it('excludes, deletes and restores', async () => {
    const { svc, bag } = await setup();
    const r = await svc.logRating({ level: 'stars', overall: 1, source: 'home', bagId: bag.id, brew: { method: 'aeropress' } });
    expect((await svc.setRatingExcluded(r.id, true, 'machine problem')).excludeReason).toBe('machine problem');
    expect((await svc.getBagStats(bag.id)).summary.excluded).toEqual([{ ratingId: r.id, reason: { kind: 'manual' } }]);
    await svc.deleteRating(r.id);
    expect(await svc.listRatings()).toEqual([]);
    await expectCode(svc.getRating(r.id), 'NOT_FOUND');
    await svc.restoreRating(r.id);
    expect((await svc.listRatings()).length).toBe(1);
  });
});

describe('presets, stats & settings', () => {
  it('lists presets with bag/product, pinned first', async () => {
    const { svc, bag, product, clock } = await setup();
    const bag2 = await svc.addBag({ productId: product.id, label: 'Bag #1' });
    await svc.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: bag.id, brew: { method: 'aeropress', doseG: 15 } });
    clock.advance(3_600_000);
    await svc.logRating({ level: 'stars', overall: 4, source: 'home', bagId: bag2.id, brew: { method: 'flairNeo', methodParams: { kind: 'flairNeo', pressure: 'medium' } } });
    let ps = await svc.listPresets({ source: 'home' });
    expect(ps.map((p) => p.preset.method)).toEqual(['flairNeo', 'aeropress']);
    expect(ps[1]!.product?.name).toBe('Ethiopia Guji Natural');
    await svc.setPresetPinned(ps[1]!.preset.key, true);
    ps = await svc.listPresets({ source: 'home' });
    expect(ps[0]!.preset).toMatchObject({ method: 'aeropress', pinned: true, lastLevel: 'swipe' });
    expect((await svc.methodUsage()).slice(0, 2).map((m) => m.method).sort()).toEqual(['aeropress', 'flairNeo']);
  });

  it('bag stats break down by method, meal and time of day', async () => {
    const { svc, bag, clock } = await setup();
    for (const [method, overall] of [['aeropress', 4], ['aeropress', 5], ['v60', 2]] as const) {
      await svc.logRating({ level: 'stars', overall, source: 'home', bagId: bag.id, brew: { method }, meal: { type: 'sweet' } });
      clock.advance(60_000);
    }
    const s = await svc.getBagStats(bag.id);
    expect(s.summary.n).toBe(3);
    expect(s.byMethod.map((g) => [g.key, g.n])).toEqual([['aeropress', 2], ['v60', 1]]);
    expect(s.byMeal[0]).toMatchObject({ key: 'sweet', n: 3 });
    expect(s.summary.stars?.mean).toBeCloseTo(11 / 3);
  });

  it('settings default and validate', async () => {
    const { svc } = await setup();
    expect((await svc.getSettings()).halfLifeDays).toBe(60);
    const s = await svc.updateSettings({ halfLifeDays: 30, ownedMethods: ['aeropress', 'flairNeo'] });
    expect(s).toMatchObject({ halfLifeDays: 30, rev: 1 });
    await expectCode(svc.updateSettings({ halfLifeDays: -1 }), 'VALIDATION');
    expect((await svc.methodUsage()).map((m) => m.method)).toEqual(['aeropress', 'flairNeo']);
  });
});

describe('reminders', () => {
  const rules = [
    { id: 'wd', kind: 'nothingLoggedBy' as const, time: '10:00', days: 'all' as const, enabled: true },
    { id: 'daily', kind: 'fixedDaily' as const, time: '10:30', days: 'all' as const, enabled: true },
    { id: 'bag', kind: 'bagExpiring' as const, daysBefore: 2, time: '09:00', enabled: true },
  ];

  async function withRules() {
    const t = await setup(); // clock: 2026-10-16 08:00 Berlin
    await t.svc.updateSettings({ reminders: { enabled: true, timeZone: 'Europe/Berlin', quietHours: null, pausedUntil: null, rules } });
    return t;
  }

  it('checks due rules and the next time from history', async () => {
    const { svc, clock } = await withRules();
    expect(await svc.checkReminders()).toEqual({ due: [], nextDueAt: '2026-10-16T10:00:00+02:00' });
    clock.set('2026-10-16T10:45:00+02:00');
    const c = await svc.checkReminders();
    expect(c.due.map((d) => d.ruleId)).toEqual(['wd', 'daily']);
    expect(await svc.getNextReminders()).toEqual([
      { ruleId: 'wd', kind: 'nothingLoggedBy', at: '2026-10-17T10:00:00+02:00' },
      { ruleId: 'daily', kind: 'fixedDaily', at: '2026-10-17T10:30:00+02:00' },
    ]);
  });

  it('logging a cup satisfies every due rule, including unconditional ones', async () => {
    const { svc, clock, bag } = await withRules();
    clock.set('2026-10-16T10:45:00+02:00');
    await svc.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: bag.id, brew: { method: 'aeropress' } });
    expect((await svc.checkReminders()).due).toEqual([]);
    expect((await svc.getSettings()).reminderState.daily?.handledAt).toBe('2026-10-16T10:45:00+02:00');
  });

  it('later / not today / unknown rule', async () => {
    const { svc, clock } = await withRules();
    clock.set('2026-10-16T10:45:00+02:00');
    const later = await svc.ackReminder('wd', 'later');
    expect(later.due.map((d) => d.ruleId)).toEqual(['daily']);
    expect(later.nextDueAt).toBe('2026-10-16T11:15:00+02:00');
    expect((await svc.ackReminder('daily', 'notToday')).due).toEqual([]);
    clock.set('2026-10-16T11:15:00+02:00');
    expect((await svc.checkReminders()).due.map((d) => d.ruleId)).toEqual(['wd']);
    await expectCode(svc.ackReminder('nope', 'later'), 'NOT_FOUND');
  });

  it('expiring bags come from open/unopened bags', async () => {
    const { svc, clock, bag } = await withRules();
    await svc.updateBag(bag.id, { expiryDate: '2026-10-18' });
    clock.set('2026-10-16T09:00:00+02:00');
    expect((await svc.checkReminders()).due).toEqual([
      expect.objectContaining({ ruleId: 'bag', payload: { bagId: bag.id, daysLeft: 2 } }),
    ]);
    await svc.updateBag(bag.id, { finishedAt: '2026-10-16' });
    expect((await svc.checkReminders()).due).toEqual([]);
  });

  it('follows the device time zone (travel)', async () => {
    const { svc, clock } = await withRules();
    clock.set('2026-10-16T12:00:00Z'); // 14:00 Berlin, 08:00 New York
    expect((await svc.checkReminders()).due.length).toBeGreaterThan(0);
    await svc.updateSettings({ timeZone: 'America/New_York' });
    expect(await svc.checkReminders()).toEqual({ due: [], nextDueAt: '2026-10-16T10:00:00-04:00' });
  });

  it('exports a fixed-time rule as .ics', async () => {
    const { svc } = await withRules();
    const ics = await svc.exportReminderIcs('wd', { title: 'Rate your coffee' });
    expect(ics).toContain('DTSTART:20261016T100000\r\n');
    expect(ics).toContain('SUMMARY:Rate your coffee\r\n');
    await expectCode(svc.exportReminderIcs('nope', { title: 'x' }), 'NOT_FOUND');
  });

  it('off by default', async () => {
    const { svc, clock } = await setup();
    clock.set('2026-10-16T23:00:00+02:00');
    expect(await svc.checkReminders()).toEqual({ due: [], nextDueAt: null });
  });
});

describe('personal calibration (README §5.1)', () => {
  it('a habitual 4-star rater: 4 ★ is neutral, 4.5 ★ is "more of this"', async () => {
    const { svc, product, bag, clock } = await setup();
    const other = await svc.addBag({ productId: product.id, label: 'Bag #4' });
    const log = (bagId: string, overall: number) =>
      svc.logRating({ level: 'stars', overall, source: 'home', bagId, brew: { method: 'aeropress' } });
    for (let i = 0; i < 10; i++) {
      clock.advance(3_600_000);
      await log(bag.id, 4);
    }
    // 11 star ratings centred on 4 ★ (the fixed mapping would score 4 ★ as +0.5)
    clock.advance(3_600_000);
    await log(other.id, 4.5);
    const bags = await svc.listBags();
    const score = (id: string) => bags.find((b) => b.bag.id === id)!.score!;
    expect(score(bag.id)).toBeCloseTo(0, 1);
    expect(score(other.id)).toBeGreaterThan(0.3);
  });
});
