// In-process backend (tests, UI mocks, Node).
export { createLocalApi, createService, dispatch, followerClock, systemClock, systemRng, type LocalApiOptions } from './local';
export { exposeService } from './worker-host';
export { createMemoryRepos } from '@cuplog/services';
export { createDexieRepos } from '@cuplog/storage-dexie';
