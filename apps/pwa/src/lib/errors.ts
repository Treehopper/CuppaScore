import { isApiError } from '@cuplog/api';
import { t } from '../i18n/i18n.svelte';
import { toasts } from './toast.svelte';

/** Translated message for any error from the API (codes only cross the boundary). */
export function errorText(e: unknown): string {
  return t(`error.${isApiError(e) ? e.code : 'INTERNAL'}`);
}

export function showError(e: unknown): void {
  console.error(e);
  toasts.show(errorText(e), { kind: 'error' });
}
