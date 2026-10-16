/// <reference lib="webworker" />
// Web Worker entry: LocalApi → services → core → storage-dexie (README §8.4).
import { createDexieRepos } from '@cuplog/storage-dexie';
import { createService } from './local';
import { exposeService } from './worker-host';

exposeService(createService({ repos: createDexieRepos() }), self as unknown as Worker);
