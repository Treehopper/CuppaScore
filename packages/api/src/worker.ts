/// <reference lib="webworker" />
// Web Worker entry: LocalApi → services → core → storage-dexie (README §8.4).
import { createDexieRepos } from '@cuplog/storage-dexie';
import { createService, followerClock } from './local';
import { exposeService } from './worker-host';

const clock = followerClock();
exposeService(createService({ repos: createDexieRepos(), clock }), self as unknown as Worker, clock);
