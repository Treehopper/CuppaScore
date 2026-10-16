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
