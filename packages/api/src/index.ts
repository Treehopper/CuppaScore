// UI-facing entry: types, errors and the browser factory. No storage code is pulled in here;
// the worker bundle contains the backend.
export * from './api';
export * from './errors';
export { connectApi } from './client';
export { createBrowserApi } from './browser';
