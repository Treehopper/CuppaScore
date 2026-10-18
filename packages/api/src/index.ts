// UI-facing entry: types, errors and the browser factory. No storage code is pulled in here;
// the worker bundle contains the backend.
export * from './api';
export * from './errors';
export { connectApi } from './client';
export { createBrowserApi } from './browser';
// zod-free vocabularies for the UI (enum keys; the UI translates them)
export * from '@cuplog/core/vocab';
export { normaliseGtin, sameGtin } from '@cuplog/core/barcode';
