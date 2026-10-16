import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { fixedClock, seededRng } from '@cuplog/core';
import { connectApi } from '@cuplog/api';
import { createDexieRepos, createLocalApi, createMemoryRepos, createService, exposeService } from '@cuplog/api/local';
import { describeApiContract } from './api';

const NOW = '2026-10-16T08:00:00+02:00';

describeApiContract('LocalApi (in-process, memory)', () =>
  createLocalApi({ repos: createMemoryRepos(), clock: fixedClock(NOW), rng: seededRng(1) }),
);

let n = 0;
describeApiContract('worker transport (Comlink over MessageChannel, Dexie)', () => {
  const { port1, port2 } = new MessageChannel();
  const repos = createDexieRepos({ name: `api-${++n}`, indexedDB: new IDBFactory(), IDBKeyRange });
  exposeService(createService({ repos, clock: fixedClock(NOW), rng: seededRng(2) }), port1);
  return connectApi(port2);
});
