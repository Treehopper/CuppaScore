// Fails if any locale misses a key that exists in en.json (the source locale), or has extras.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'apps', 'pwa', 'src', 'i18n');
const SOURCE = 'en';
const REQUIRED = ['de', 'en', 'it', 'es'];

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  );
}

if (!existsSync(dir)) {
  console.log('i18n: no locale directory yet, skipping');
  process.exit(0);
}

const load = (loc: string): Set<string> =>
  new Set(flatten(JSON.parse(readFileSync(join(dir, `${loc}.json`), 'utf8')) as Tree));

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const problems: string[] = [];
for (const loc of REQUIRED) if (!files.includes(loc)) problems.push(`missing locale file ${loc}.json`);

const source = load(SOURCE);
for (const loc of files.filter((f) => f !== SOURCE && REQUIRED.includes(f))) {
  const keys = load(loc);
  for (const k of source) if (!keys.has(k)) problems.push(`${loc}: missing ${k}`);
  for (const k of keys) if (!source.has(k)) problems.push(`${loc}: extra key ${k}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n: ${source.size} keys in ${files.length} locales OK`);
