import { prefs } from '../lib/prefs.svelte';
import { detectLocale, intlLocale, LOCALES, PSEUDO_LOCALE, Translator, type UiLocale, type Values } from './core';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import it from './it.json';

const translator = new Translator({ de, en, es, it });

const device = (): readonly string[] => (typeof navigator === 'undefined' ? ['en'] : navigator.languages);

/** Active UI locale: user override from Settings, else detected from the device (README §11). */
function current(): UiLocale {
  const chosen = prefs.value.language;
  if (chosen === PSEUDO_LOCALE) return PSEUDO_LOCALE;
  if (chosen && (LOCALES as readonly string[]).includes(chosen)) return chosen as UiLocale;
  return detectLocale(device());
}

export const i18n = {
  get locale(): UiLocale {
    return current();
  },
  get intl(): string {
    return intlLocale(current());
  },
};

/** Translate a key; reactive because it reads `prefs.value.language`. */
export function t(key: string, values?: Values): string {
  return translator.t(current(), key, values);
}

export function hasKey(key: string): boolean {
  return translator.has(key);
}

/** Keeps `<html lang>` in sync. */
export function applyLangEffect(): void {
  $effect(() => {
    document.documentElement.lang = i18n.intl;
  });
}
