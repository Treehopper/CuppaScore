import { prefs } from '../lib/prefs.svelte';
import { resolveTheme, THEME_BG, type ThemeId } from './themes';

const darkQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');

class SystemScheme {
  dark = $state(darkQuery?.matches ?? false);
  constructor() {
    darkQuery?.addEventListener('change', (e) => (this.dark = e.matches));
  }
}

const scheme = new SystemScheme();

export const activeTheme = {
  get id(): ThemeId {
    return resolveTheme(prefs.value, scheme.dark);
  },
};

/** Keeps `<html data-theme>` and the `theme-color` meta tags in sync (README §10, §13). */
export function applyThemeEffect(): void {
  $effect(() => {
    const id = activeTheme.id;
    document.documentElement.dataset.theme = id;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = THEME_BG[id];
    }
  });
}
