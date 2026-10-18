import type { CupLogApi } from './api';
import { connectApi } from './client';

/**
 * Starts the backend in a module Web Worker and returns a client for it. `baseUrl` is the app's
 * absolute base (where `catalog/<region>.csv` lives).
 */
export function createBrowserApi(baseUrl: string = new URL('./', location.href).href): CupLogApi {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: `cuplog-api|${baseUrl}` });
  return connectApi(worker);
}
