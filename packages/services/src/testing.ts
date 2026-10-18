import { fixedClock, LOCAL_OWNER, seededRng, uuidv7Generator } from '@cuplog/core';
import { createMemoryRepos } from './memory';
import type { CatalogSource, Repositories } from './ports';
import { CupLogService } from './service';

/** Service over in-memory repos with a controllable clock (tests only). */
export function makeTestService(now = '2026-10-16T08:00:00+02:00', repos: Repositories = createMemoryRepos(), catalogSource?: CatalogSource) {
  const clock = fixedClock(now);
  const rng = seededRng(42);
  const svc = new CupLogService(repos, { ownerId: LOCAL_OWNER, clock, ids: uuidv7Generator(clock, rng), rng }, catalogSource);
  return { svc, clock, repos };
}
