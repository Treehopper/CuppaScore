// WCAG contrast check of all theme token pairs (README §10). Part of `pnpm run check`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastProblems, parseThemeCss } from '../apps/pwa/src/themes/contrast.ts';

const css = readFileSync(join(import.meta.dirname, '..', 'apps', 'pwa', 'src', 'themes', 'themes.css'), 'utf8');
const themes = parseThemeCss(css);
const problems = contrastProblems(themes);
if (Object.keys(themes).length < 4) problems.push(`expected 4 themes, found ${Object.keys(themes).join(', ')}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`contrast: ${Object.keys(themes).length} themes pass WCAG AA`);
