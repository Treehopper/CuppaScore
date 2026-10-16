/** Theme ids and "System" pairing (README §10). Pure helpers; DOM wiring lives in apply.ts. */

export const THEMES = ['crema', 'espresso', 'solarized-light', 'solarized-dark'] as const;
export type ThemeId = (typeof THEMES)[number];
export type ThemeChoice = ThemeId | 'system';

export const LIGHT_THEMES: readonly ThemeId[] = ['crema', 'solarized-light'];
export const DARK_THEMES: readonly ThemeId[] = ['espresso', 'solarized-dark'];

/** Background colours, mirrored from themes.css for the `theme-color` meta tag. */
export const THEME_BG: Record<ThemeId, string> = {
  crema: '#f7efe4',
  espresso: '#1e1410',
  'solarized-light': '#fdf6e3',
  'solarized-dark': '#002b36',
};

export interface ThemePrefs {
  theme: ThemeChoice;
  /** pair used by "System" */
  systemLight: ThemeId;
  systemDark: ThemeId;
}

export const DEFAULT_THEME_PREFS: ThemePrefs = { theme: 'system', systemLight: 'crema', systemDark: 'espresso' };

export function resolveTheme(p: ThemePrefs, prefersDark: boolean): ThemeId {
  if (p.theme !== 'system') return p.theme;
  return prefersDark ? p.systemDark : p.systemLight;
}

export function isDarkTheme(t: ThemeId): boolean {
  return DARK_THEMES.includes(t);
}
