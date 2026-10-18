/** Errors cross the API as codes only; the UI translates them (README §8.1). */
export type ErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_RATING_SHAPE'
  | 'BAG_FINISHED'
  | 'REV_CONFLICT'
  | 'IMPORT_INVALID'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'CATALOG_CSV_HEADER'
  | 'CATALOG_CSV_EMPTY'
  | 'CATALOG_NO_REGION'
  | 'CATALOG_UNAVAILABLE';

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, details?: unknown) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'DomainError');
}
