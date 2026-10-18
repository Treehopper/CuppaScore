import type { CatalogRegion } from '@cuplog/core';
import type { CatalogSource } from '@cuplog/services';

/**
 * Region catalogs as static CSV files next to the app (`<base>catalog/<region>.csv` on GitHub
 * Pages); the service worker precaches them, so this also works offline after the first load.
 */
export function staticCatalogSource(baseUrl: string, fetchFn: typeof fetch = (...a) => fetch(...a)): CatalogSource {
  return {
    async fetchRegion(region: CatalogRegion): Promise<string> {
      const res = await fetchFn(new URL(`catalog/${region}.csv`, baseUrl).href, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  };
}
