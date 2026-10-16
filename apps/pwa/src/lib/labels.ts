import type { BagView, ProductDto } from '@cuplog/api';
import { hasKey, t } from '../i18n/i18n.svelte';

/** "Vits der Kaffee – Ethiopia Guji Natural" */
export function productTitle(p: Pick<ProductDto, 'roaster' | 'name'> | null | undefined): string {
  return p ? `${p.roaster} – ${p.name}` : t('product.unknown');
}

/** "Guji Natural · Bag #3" */
export function bagTitle(v: Pick<BagView, 'bag' | 'product'>): string {
  const name = v.product ? v.product.name : t('product.unknown');
  return `${name} · ${v.bag.label || t('bags.unnamed')}`;
}

/** Comma-separated text ⇄ string list (varietals, label notes). */
export const splitList = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Group key from stats `byMethod`: a brew method (home) or a drink (café). */
export const methodLabel = (k: string): string => (hasKey(`brew.${k}`) ? t(`brew.${k}`) : t(`drink.${k}`));
