/// <reference lib="webworker" />
// Web Worker entry: LocalApi → services → core → storage-dexie (README §8.4).
import { staticCatalogSource } from '@cuplog/catalog-static';
import { createDexieRepos } from '@cuplog/storage-dexie';
import { createService, followerClock } from './local';
import { exposeService } from './worker-host';

const clock = followerClock();
// the page passes its absolute base URL as the worker name (see createBrowserApi)
const base = (self as unknown as { name: string }).name.split('|')[1] || new URL('/', self.location.href).href;
exposeService(
  createService({ repos: createDexieRepos(), clock, catalogSource: staticCatalogSource(base) }),
  self as unknown as Worker,
  clock,
);
