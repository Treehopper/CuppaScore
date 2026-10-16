import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describeRepositoryContract } from '@cuplog/contract-tests';
import { createDexieRepos } from './repos';

let n = 0;
describeRepositoryContract('dexie', () =>
  createDexieRepos({ name: `test-${++n}`, indexedDB: new IDBFactory(), IDBKeyRange }),
);
