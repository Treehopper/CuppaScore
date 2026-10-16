import { DEFAULT_THEME_PREFS, THEMES, type ThemeChoice, type ThemeId } from '../themes/themes';

/**
 * UI preferences (README §4.6): stored locally by the UI only, never in the domain.
 * Key and shape are also read by the pre-paint script in index.html.
 */
export const PREFS_KEY = 'cuplog:prefs';

export type LogMode = 'home' | 'cafe';

export interface UiPrefs {
  theme: ThemeChoice;
  systemLight: ThemeId;
  systemDark: ThemeId;
  /** null = follow the device (navigator.languages) */
  language: string | null;
  lastMode: LogMode;
}

const DEFAULTS: UiPrefs = { ...DEFAULT_THEME_PREFS, language: null, lastMode: 'home' };

function load(): UiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<UiPrefs>;
    const theme = raw.theme === 'system' || THEMES.includes(raw.theme as ThemeId) ? raw.theme! : DEFAULTS.theme;
    return {
      ...DEFAULTS,
      ...raw,
      theme,
      systemLight: THEMES.includes(raw.systemLight as ThemeId) ? raw.systemLight! : DEFAULTS.systemLight,
      systemDark: THEMES.includes(raw.systemDark as ThemeId) ? raw.systemDark! : DEFAULTS.systemDark,
      lastMode: raw.lastMode === 'cafe' ? 'cafe' : 'home',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

class Prefs {
  value = $state<UiPrefs>(typeof localStorage === 'undefined' ? { ...DEFAULTS } : load());

  set<K extends keyof UiPrefs>(key: K, v: UiPrefs[K]): void {
    this.value[key] = v;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.value));
    } catch {
      // storage full or disabled: keep the in-memory value
    }
  }
}

export const prefs = new Prefs();
