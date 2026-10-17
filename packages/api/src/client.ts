import * as Comlink from 'comlink';
import type { CupLogApi } from './api';
import { apiFromTransport } from './transport';
import type { ApiEndpoint } from './worker-host';

/** `CupLogApi` talking to a worker (or any Comlink endpoint, e.g. a MessagePort in tests). */
export function connectApi(endpoint: Comlink.Endpoint): CupLogApi {
  const remote = Comlink.wrap<ApiEndpoint>(endpoint);
  return apiFromTransport((m, args) => remote.call(m, args, Date.now()));
}
