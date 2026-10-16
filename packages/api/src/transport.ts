import { API_METHODS, COMMAND_TOPICS, type ApiMethod, type CupLogApi } from './api';
import { TopicEmitter } from './emitter';
import { ApiError, type Result } from './errors';

/** Builds a `CupLogApi` from a transport that executes one method call. */
export function apiFromTransport(call: (method: ApiMethod, args: unknown[]) => Promise<Result<unknown>>): CupLogApi {
  const emitter = new TopicEmitter();
  const api: Record<string, unknown> = {
    subscribe: emitter.subscribe.bind(emitter),
  };
  for (const m of API_METHODS) {
    api[m] = async (...args: unknown[]) => {
      // drop trailing undefined so optional params survive structured cloning identically
      while (args.length && args[args.length - 1] === undefined) args.pop();
      // DTOs are plain JSON by contract; normalising also unwraps UI reactivity proxies,
      // which structured cloning (postMessage) rejects
      const res = await call(m, JSON.parse(JSON.stringify(args)) as unknown[]);
      if (!res.ok) throw new ApiError(res.error.code, res.error.details);
      const topics = COMMAND_TOPICS[m];
      if (topics) emitter.emit(topics);
      return res.value;
    };
  }
  return api as unknown as CupLogApi;
}
