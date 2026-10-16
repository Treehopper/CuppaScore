import { describe, expect, it } from 'vitest';
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

describe('worker transport', () => {
  it('accepts proxied arguments (e.g. Svelte $state) by normalising them to JSON', async () => {
    const { port1, port2 } = new MessageChannel();
    exposeService(createService({ repos: createMemoryRepos(), clock: fixedClock(NOW), rng: seededRng(3) }), port1);
    const api = connectApi(port2);
    const roastFor = new Proxy(['filter'], {});
    const p = await api.addProduct({ roaster: 'R', name: 'N', roastFor: roastFor as ('filter' | 'espresso' | 'omni')[] });
    expect(p.roastFor).toEqual(['filter']);
  });
});
