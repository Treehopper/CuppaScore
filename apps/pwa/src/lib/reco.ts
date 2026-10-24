import type { CatalogProductDto, RecommendationView } from '@cuplog/api';
import { i18n, t } from '../i18n/i18n.svelte';

/** Feature dim key (core `FEATURE_DIMS`) → words; roast depends on the coffee (light vs dark). */
export function dimLabel(dim: string, item: Pick<CatalogProductDto, 'roastLevel'>): string {
  if (dim === 'roast') return item.roastLevel ? t(`dim.roast.${item.roastLevel}`) : t('dim.roast.2');
  const [block, key] = dim.split('.');
  if (block === 'process') return t(`process.${key}`);
  if (block === 'roastFor') return t('dim.roastFor', { use: t(`roastFor.${key}`) });
  return t(`dim.${block}.${key}`);
}

const list = (xs: string[]): string => new Intl.ListFormat(i18n.intl, { type: 'conjunction' }).format(xs);

/** "Like Vits – Guji: natural, fruity" (README D2) */
export function whyText(r: RecommendationView): string {
  const e = r.explanation;
  switch (e.kind) {
    case 'similarTo':
      return t('discover.why.similar', {
        product: r.similarProduct ? `${r.similarProduct.roaster} – ${r.similarProduct.name}` : '…',
        features: list(e.shared.map((d) => dimLabel(d, r.item))),
      });
    case 'profile':
      return e.shared.length ? t('discover.why.profile', { features: list(e.shared.map((d) => dimLabel(d, r.item))) }) : t('discover.why.profileShort');
    case 'explore':
      return t('discover.why.explore', { feature: dimLabel(e.dim, r.item) });
    case 'coldStart':
      return e.shared.length ? t('discover.why.coldStart', { features: list(e.shared.map((d) => dimLabel(d, r.item))) }) : t('discover.why.coldStartShort');
  }
}

export const eur = (x: number): string => new Intl.NumberFormat(i18n.intl, { style: 'currency', currency: 'EUR' }).format(x);

/** Map search for the roaster (README D6): no API key, opens the user's maps app. */
export const mapUrl = (c: Pick<CatalogProductDto, 'roaster' | 'roasterCity'>): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.roaster, c.roasterCity ?? 'München'].join(' '))}`;
