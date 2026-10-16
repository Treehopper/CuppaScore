import { describe, expect, it } from 'vitest';
import type { CupLogApi } from '@cuplog/api';
import { isApiError } from '@cuplog/api';

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    expect(isApiError(e), `expected ApiError, got ${String(e)}`).toBe(true);
    return (e as { code: string }).code;
  }
}

/**
 * API contract (README §8.6): the same suite runs against the in-process LocalApi, the
 * worker transport and, later, HttpApi. `make` returns an API over empty storage whose clock
 * reads 2026-10-16T08:00:00+02:00.
 */
export function describeApiContract(name: string, make: () => Promise<CupLogApi> | CupLogApi): void {
  describe(`API contract: ${name}`, () => {
    it('home flow: product → bag → cups → presets → stats', async () => {
      const api = await make();
      const p = await api.addProduct({ roaster: 'Vits der Kaffee', name: 'Ethiopia Guji Natural', process: 'natural' });
      const b = await api.addBag({ productId: p.id, label: 'Bag #3', roastDate: '2026-10-02', weightG: 250 });
      const r1 = await api.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: b.id, brew: { method: 'aeropress', doseG: 15 } });
      expect(r1).toMatchObject({ productId: p.id, ratedAt: '2026-10-16T08:00:00+02:00', timeOfDay: 'morning' });
      await api.logRating({
        level: 'advanced', overall: 4.5, strength: 3, profile: { acidity: 4, sweetness: 3 }, flavourTags: ['berry'],
        wish: { sweetness: 'more' }, source: 'home', bagId: b.id,
        brew: { method: 'aeropress', doseG: 15, methodParams: { kind: 'aeropress', orientation: 'inverted', filter: 'paper' } },
        meal: { type: 'sweet', note: 'Croissant' }, wouldBuyAgain: true,
      });
      const presets = await api.listPresets({ source: 'home' });
      expect(presets).toHaveLength(1);
      expect(presets[0]).toMatchObject({ preset: { uses: 2, lastLevel: 'advanced', method: 'aeropress' }, product: { id: p.id } });
      const stats = await api.getBagStats(b.id);
      expect(stats.summary).toMatchObject({ n: 2, byLevel: { swipe: 1, stars: 0, advanced: 1 } });
      expect(stats.summary.score).toBeGreaterThan(0.5);
      const bags = await api.listBags();
      expect(bags[0]).toMatchObject({ status: 'open', cups: 2 });
      expect((await api.listProducts())[0]).toMatchObject({ cups: 2, bags: 1 });
      expect(await api.listRatings({ bagId: b.id, limit: 1 })).toHaveLength(1);
    });

    it('café flow', async () => {
      const api = await make();
      const v = await api.addVenue({ name: 'Man versus Machine' });
      await api.logRating({ level: 'stars', overall: 4, source: 'cafe', venueId: v.id, beanKnown: 'house', cafe: { drink: 'flatWhite', milk: 'plant' } });
      const presets = await api.listPresets({ source: 'cafe' });
      expect(presets[0]).toMatchObject({ venue: { id: v.id }, preset: { drink: 'flatWhite', milk: 'plant' } });
      expect((await api.listVenues())[0]).toMatchObject({ visits: 1 });
    });

    it('errors carry codes, not text', async () => {
      const api = await make();
      expect(await codeOf(api.getBag('missing'))).toBe('NOT_FOUND');
      expect(await codeOf(api.addProduct({ roaster: '', name: '' }))).toBe('VALIDATION');
      const p = await api.addProduct({ roaster: 'R', name: 'N' });
      const b = await api.addBag({ productId: p.id, finishedAt: '2026-10-01' });
      expect(await codeOf(api.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: b.id, brew: { method: 'v60' } }))).toBe('BAG_FINISHED');
    });

    it('edit, exclude, delete, restore', async () => {
      const api = await make();
      const p = await api.addProduct({ roaster: 'R', name: 'N' });
      const b = await api.addBag({ productId: p.id });
      const r = await api.logRating({ level: 'stars', overall: 3, source: 'home', bagId: b.id, brew: { method: 'v60' } });
      expect((await api.updateRating(r.id, { overall: 3.5 })).overall).toBe(3.5);
      expect((await api.setRatingExcluded(r.id, true, 'ill')).excluded).toBe(true);
      await api.deleteRating(r.id);
      expect(await api.listRatings()).toEqual([]);
      await api.restoreRating(r.id);
      expect(await api.listRatings()).toHaveLength(1);
    });

    it('settings and pinning', async () => {
      const api = await make();
      expect((await api.getSettings()).defaultLevel).toBe('stars');
      expect((await api.updateSettings({ defaultLevel: 'swipe' })).defaultLevel).toBe('swipe');
      expect((await api.setPresetPinned('home:x:v60', true)).pinnedPresets).toEqual(['home:x:v60']);
    });

    it('notifies subscribers after commands only', async () => {
      const api = await make();
      const seen: string[] = [];
      const off = api.subscribe('products', () => seen.push('products'));
      api.subscribe('ratings', () => seen.push('ratings'));
      await api.listProducts();
      const p = await api.addProduct({ roaster: 'R', name: 'N' });
      off();
      await api.updateProduct(p.id, { name: 'M' });
      expect(seen).toEqual(['products']);
    });
  });
}
