import { IntlMessageFormat } from 'intl-messageformat';

/** Pure i18n helpers (no Svelte state), unit-testable in Node. */

export const LOCALES = ['de', 'en', 'it', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const PSEUDO_LOCALE = 'en-XA';
export type UiLocale = Locale | typeof PSEUDO_LOCALE;
export const SOURCE_LOCALE: Locale = 'en';

export type Messages = { [k: string]: string | Messages };
export type Values = Record<string, string | number | Date>;

export function flatten(tree: Messages, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

/** First supported language in the device list (matching on the primary subtag), else English. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const l of languages) {
    if (l === PSEUDO_LOCALE) continue;
    const primary = l.toLowerCase().split('-')[0];
    const hit = LOCALES.find((x) => x === primary);
    if (hit) return hit;
  }
  return SOURCE_LOCALE;
}

const ACCENTS: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', c: 'ç', n: 'ñ', y: 'ý',
  A: 'Å', E: 'É', I: 'Î', O: 'Ø', U: 'Ü', C: 'Ç', N: 'Ñ', Y: 'Ý',
};

/** en-XA: accented and ~30 % longer (German strings are ~30 % longer), bracketed to spot clipping. */
export function pseudoize(s: string): string {
  const accented = s.replace(/[a-zA-Z]/g, (ch) => ACCENTS[ch] ?? ch);
  const pad = '~'.repeat(Math.max(1, Math.round(s.length * 0.3)));
  return `⟦${accented}${pad}⟧`;
}

/** Translator over flattened catalogs with English fallback; missing keys render as the key. */
export class Translator {
  readonly #catalogs: Record<Locale, Map<string, string>>;
  readonly #cache = new Map<string, IntlMessageFormat>();

  constructor(catalogs: Record<Locale, Messages>) {
    this.#catalogs = Object.fromEntries(LOCALES.map((l) => [l, flatten(catalogs[l])])) as Record<Locale, Map<string, string>>;
  }

  has(key: string): boolean {
    return this.#catalogs[SOURCE_LOCALE].has(key);
  }

  t(locale: UiLocale, key: string, values?: Values): string {
    const base: Locale = locale === PSEUDO_LOCALE ? SOURCE_LOCALE : locale;
    const msg = this.#catalogs[base].get(key) ?? this.#catalogs[SOURCE_LOCALE].get(key);
    if (msg === undefined) return key;
    const cacheKey = `${base}\u0000${key}`;
    let fmt = this.#cache.get(cacheKey);
    if (!fmt) {
      fmt = new IntlMessageFormat(msg, base);
      this.#cache.set(cacheKey, fmt);
    }
    const out = String(fmt.format(values));
    return locale === PSEUDO_LOCALE ? pseudoize(out) : out;
  }
}

/** BCP 47 tag for Intl formatting. */
export const intlLocale = (l: UiLocale): string => (l === PSEUDO_LOCALE ? 'en' : l);
