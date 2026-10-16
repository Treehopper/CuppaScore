/** WCAG 2.x contrast for the theme check (README §10). */

export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Extracts `--token: #hex` per `[data-theme='id']` block. */
export function parseThemeCss(css: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const block = /([^{}]+)\{([^}]*)\}/g;
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(block)) {
    const ids = [...m[1]!.matchAll(/data-theme=['"]([^'"]+)['"]/g)].map((x) => x[1]!);
    for (const id of ids) {
      const vars = (out[id] ??= {});
      for (const v of m[2]!.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) vars[v[1]!] = v[2]!.toLowerCase();
    }
  }
  return out;
}

export interface ContrastRule {
  fg: string;
  bg: string;
  min: number;
}

export const CONTRAST_RULES: readonly ContrastRule[] = [
  ...['--text', '--muted'].flatMap((fg) => ['--bg', '--surface'].map((bg) => ({ fg, bg, min: 4.5 }))),
  { fg: '--on-accent', bg: '--accent', min: 4.5 },
  ...['--accent', '--accent-2', '--star', '--good', '--bad'].flatMap((fg) =>
    ['--bg', '--surface'].map((bg) => ({ fg, bg, min: 3 })),
  ),
];

export function contrastProblems(themes: Record<string, Record<string, string>>): string[] {
  const problems: string[] = [];
  for (const [id, vars] of Object.entries(themes)) {
    for (const r of CONTRAST_RULES) {
      const fg = vars[r.fg];
      const bg = vars[r.bg];
      if (!fg || !bg) {
        problems.push(`${id}: missing ${!fg ? r.fg : r.bg}`);
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio < r.min) problems.push(`${id}: ${r.fg} on ${r.bg} = ${ratio.toFixed(2)} < ${r.min}`);
    }
  }
  return problems;
}
