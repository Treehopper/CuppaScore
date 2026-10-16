import { describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { makeTestService } from '@cuplog/services/testing';
import { createDexieRepos } from './repos';

describe('services on Dexie', () => {
  it('logs a cup inside a transaction and opens the bag', async () => {
    const repos = createDexieRepos({ name: 'svc', indexedDB: new IDBFactory(), IDBKeyRange });
    const { svc } = makeTestService('2026-10-16T08:00:00+02:00', repos);
    const p = await svc.addProduct({ roaster: 'Supremo', name: 'Espresso Blend' });
    const b = await svc.addBag({ productId: p.id });
    const venue = await svc.addVenue({ name: 'Man versus Machine' });
    await svc.logRating({ level: 'stars', overall: 4, source: 'home', bagId: b.id, brew: { method: 'flairNeo' } });
    await svc.logRating({ level: 'swipe', swipe: 'more', source: 'cafe', venueId: venue.id, beanKnown: 'house', cafe: { drink: 'flatWhite' } });
    expect((await svc.getBag(b.id)).status).toBe('open');
    expect((await svc.listVenues())[0]!.venue.lastDrink).toBe('flatWhite');
    expect(await svc.listRatings()).toHaveLength(2);
    expect((await svc.listPresets({ source: 'home' }))[0]!.preset.method).toBe('flairNeo');
  });
});
