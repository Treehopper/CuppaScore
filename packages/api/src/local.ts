import { LOCAL_OWNER, uuidv7Generator, type Clock, type Rng } from '@cuplog/core';
import { CupLogService, isDomainError, type Repositories } from '@cuplog/services';
import { API_METHODS, type ApiMethod, type CupLogApi } from './api';
import { apiFromTransport } from './transport';
import { ApiError, type Result } from './errors';

export const systemClock: Clock = { now: () => Date.now() };

/**
 * The worker's clock follows the UI's: each call carries the caller's `Date.now()`, so "now" is
 * the same on both sides (offset ≈ 0 in practice; it also lets e2e tests fake the time).
 */
export function followerClock(): Clock & { sync(callerNow: number): void } {
  let offset = 0;
  return {
    now: () => Date.now() + offset,
    sync: (callerNow) => {
      offset = callerNow - Date.now();
    },
  };
}

/** Cryptographically strong rng where available (ids must not collide across devices). */
export const systemRng: Rng = () => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
  return Math.random();
};

export interface LocalApiOptions {
  repos: Repositories;
  clock?: Clock;
  rng?: Rng;
  ownerId?: string;
}

function toApiError(e: unknown): ApiError {
  if (isDomainError(e)) return new ApiError(e.code, e.details);
  if (e instanceof ApiError) return e;
  return new ApiError('INTERNAL', { message: e instanceof Error ? e.message : String(e) });
}

/** Calls a service method by name and wraps the outcome; used by the worker host. */
export async function dispatch(svc: CupLogService, method: ApiMethod, args: unknown[]): Promise<Result<unknown>> {
  if (!API_METHODS.includes(method)) return { ok: false, error: { code: 'INTERNAL', details: { unknownMethod: method } } };
  try {
    const fn = (svc as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    return { ok: true, value: await fn.apply(svc, args) };
  } catch (e) {
    const err = toApiError(e);
    return { ok: false, error: { code: err.code, details: err.details } };
  }
}

export function createService(opts: LocalApiOptions): CupLogService {
  const clock = opts.clock ?? systemClock;
  const rng = opts.rng ?? systemRng;
  return new CupLogService(opts.repos, {
    ownerId: opts.ownerId ?? LOCAL_OWNER,
    clock,
    rng,
    ids: uuidv7Generator(clock, rng),
  });
}

/** In-process API (tests, UI mocks). Results are structured-cloned like over a worker. */
export function createLocalApi(opts: LocalApiOptions): CupLogApi {
  const svc = createService(opts);
  return apiFromTransport(async (m, args) => structuredClone(await dispatch(svc, m, structuredClone(args))));
}
