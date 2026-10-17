import * as Comlink from 'comlink';
import type { CupLogService } from '@cuplog/services';
import type { ApiMethod } from './api';
import { dispatch } from './local';
import type { Result } from './errors';

/** The object exposed over Comlink: one generic call, so the transport stays tiny and HTTP-like. */
export interface ApiEndpoint {
  /** `callerNow`: the caller's clock (see `followerClock`) */
  call(method: ApiMethod, args: unknown[], callerNow?: number): Promise<Result<unknown>>;
}

export function exposeService(
  svc: CupLogService | Promise<CupLogService>,
  endpoint: Comlink.Endpoint,
  clock?: { sync(callerNow: number): void },
): void {
  const host: ApiEndpoint = {
    call: async (method, args, callerNow) => {
      if (clock && typeof callerNow === 'number') clock.sync(callerNow);
      return dispatch(await svc, method, args);
    },
  };
  Comlink.expose(host, endpoint);
}
