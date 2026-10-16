import { createBrowserApi, type CupLogApi } from '@cuplog/api';

/** The single backend handle of the UI (README §8.1). Lazily started so tests can swap it. */
let instance: CupLogApi | null = null;

export function api(): CupLogApi {
  instance ??= createBrowserApi();
  return instance;
}

export function setApi(a: CupLogApi): void {
  instance = a;
}
