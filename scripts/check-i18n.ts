// i18n QA (README §11): every locale has exactly the keys of en.json, every message is valid
// ICU, and every literal key used in the source (t('…')) exists.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@formatjs/icu-messageformat-parser';

const root = join(import.meta.dirname, '..', 'apps', 'pwa', 'src');
const dir = join(root, 'i18n');
const SOURCE = 'en';
const REQUIRED = ['de', 'en', 'it', 'es'];

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out.set(`${prefix}${k}`, v);
    else flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

const load = (loc: string): Map<string, string> =>
  flatten(JSON.parse(readFileSync(join(dir, `${loc}.json`), 'utf8')) as Tree);

const problems: string[] = [];
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
for (const loc of REQUIRED) if (!files.includes(loc)) problems.push(`missing locale file ${loc}.json`);

const source = load(SOURCE);
for (const loc of REQUIRED.filter((f) => files.includes(f))) {
  const msgs = load(loc);
  if (loc !== SOURCE) {
    for (const k of source.keys()) if (!msgs.has(k)) problems.push(`${loc}: missing ${k}`);
    for (const k of msgs.keys()) if (!source.has(k)) problems.push(`${loc}: extra key ${k}`);
  }
  for (const [k, m] of msgs) {
    try {
      parse(m);
    } catch (e) {
      problems.push(`${loc}: ${k} is not valid ICU (${(e as Error).message})`);
    }
  }
}

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(svelte|ts)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}
const used = new Set<string>();
for (const file of walk(root)) {
  for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) used.add(m[1]!);
}
for (const k of used) if (!source.has(k)) problems.push(`source uses unknown key ${k}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n: ${source.size} keys in ${REQUIRED.length} locales OK, ${used.size} literal keys used`);
