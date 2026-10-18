import type { AddProductCmd, CatalogProductDto, CatalogRowIssue } from '@cuplog/api';
import { i18n, t } from '../i18n/i18n.svelte';
import { api } from './api';
import { toasts } from './toast.svelte';

/** Coffee-growing countries (ISO 3166 alpha-2) whose localised names make the catalog searchable. */
const ORIGINS = [
  'BO', 'BR', 'BI', 'CM', 'CN', 'CO', 'CR', 'CU', 'CD', 'DO', 'EC', 'SV', 'ET', 'GT', 'HN', 'IN', 'ID', 'JM', 'KE', 'LA',
  'MW', 'MX', 'MM', 'NI', 'PA', 'PG', 'PE', 'PH', 'RW', 'TZ', 'TH', 'TL', 'UG', 'US', 'VE', 'VN', 'YE', 'ZM', 'ZW', 'HT',
];

const names = new Map<string, Intl.DisplayNames | null>();

/** Localised country name for an ISO code ("ET" → "Äthiopien"); falls back to the code. */
export function countryName(code: string, locale: string = i18n.intl): string {
  if (!names.has(locale)) {
    try {
      names.set(locale, new Intl.DisplayNames([locale, 'en'], { type: 'region' }));
    } catch {
      names.set(locale, null);
    }
  }
  try {
    return names.get(locale)?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** ISO code → localised name for the backend's catalog search. */
export function originNames(): Record<string, string> {
  return Object.fromEntries(ORIGINS.map((c) => [c, countryName(c)]));
}

/** "Äthiopien" / "Brasilien, Kolumbien" (blends list all origins). */
export function originText(p: Pick<CatalogProductDto, 'originCountries' | 'region'>): string {
  return [p.originCountries.map((c) => countryName(c)).join(', '), p.region].filter(Boolean).join(' · ');
}

/** "Line 5 · roast_level: not valid" */
export function issueText(i: CatalogRowIssue): string {
  const reason = i.code === 'required' || i.code === 'duplicate' ? i.code : 'invalid';
  return t('catalog.issue', { line: i.line, field: i.field, reason: t(`catalog.reason.${reason}`) });
}

/**
 * On start: refresh the region catalog in the background (upserts only newer rows) and say so
 * when that changed anything. Skipped before onboarding; the welcome flow loads it then.
 */
export async function syncRegionCatalog(): Promise<void> {
  try {
    const s = await api().getSettings();
    if (!s.catalogRegion || !s.onboardingCompletedAt) return;
    const before = await api().getCatalogInfo();
    const r = await api().loadRegionCatalog();
    // E3: tell the user when a newer published catalog brought changes (not on the first load)
    if (before.count > 0 && r.added + r.updated > 0) {
      toasts.show(t('catalog.updatedToast', { added: r.added, updated: r.updated }));
    }
  } catch (e) {
    // offline before the first load: try again next start
    console.warn('catalog sync failed', e);
  }
}

/** A user product (with `catalogId`) prefilled from a catalog entry. */
export function productFromCatalog(c: CatalogProductDto): AddProductCmd {
  return {
    catalogId: c.id,
    roaster: c.roaster,
    name: c.name,
    origin: { country: c.originCountries.map((x) => countryName(x)).join(', ') || null, region: c.region, farm: null, altitudeM: null },
    process: c.process,
    varietals: c.varietals,
    roastLevel: c.roastLevel,
    roastFor: c.roastFor,
    isBlend: c.originCountries.length > 1,
    labelNotes: c.tastingNotes,
  };
}

/** "Vits der Kaffee – Ethiopia Guji" */
export const catalogTitle = (c: Pick<CatalogProductDto, 'roaster' | 'name'>): string => `${c.roaster} – ${c.name}`;
