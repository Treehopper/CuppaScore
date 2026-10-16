import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_THEME_PREFS, resolveTheme, THEME_BG, THEMES } from './themes';
import { parseThemeCss } from './contrast';

describe('themes', () => {
  it('system pairs one light and one dark theme', () => {
    expect(resolveTheme(DEFAULT_THEME_PREFS, false)).toBe('crema');
    expect(resolveTheme(DEFAULT_THEME_PREFS, true)).toBe('espresso');
    expect(resolveTheme({ ...DEFAULT_THEME_PREFS, systemDark: 'solarized-dark' }, true)).toBe('solarized-dark');
    expect(resolveTheme({ ...DEFAULT_THEME_PREFS, theme: 'solarized-light' }, true)).toBe('solarized-light');
  });

  it('THEME_BG mirrors themes.css', () => {
    const parsed = parseThemeCss(readFileSync(join(import.meta.dirname, 'themes.css'), 'utf8'));
    for (const t of THEMES) expect(parsed[t]?.['--bg']).toBe(THEME_BG[t]);
  });
});
