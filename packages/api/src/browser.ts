import type { CupLogApi } from './api';
import { connectApi } from './client';

/** Starts the backend in a module Web Worker and returns a client for it. */
export function createBrowserApi(): CupLogApi {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'cuplog-api' });
  return connectApi(worker);
}
