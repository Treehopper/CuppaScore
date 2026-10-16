import type { ErrorCode } from '@cuplog/services';

export type ApiErrorCode = ErrorCode | 'INTERNAL';

/** Error crossing the API boundary: a code plus structured details, never UI text. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: unknown;
  constructor(code: ApiErrorCode, details?: unknown) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ApiError');
}

export type Result<T> = { ok: true; value: T } | { ok: false, error: { code: ApiErrorCode; details: unknown } };
