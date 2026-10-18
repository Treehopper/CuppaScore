import { z } from 'zod';
import { Process, RoastFor } from './enums';
import { IsoDate } from './record';
export { CATALOG_REGIONS, type CatalogRegion } from './vocab';

/**
 * Catalog products from a CSV file (owner feedback F4; replaces README §6's catalog.json for v1).
 * Header: id,roaster,roaster_city,name,origin_countries,region,process,varieties,roast_level,
 * roast_for,tasting_notes,weight_g,price_eur,url,available,updated_at — list cells use `;`.
 */
export const CATALOG_CSV_COLUMNS = [
  'id',
  'roaster',
  'roaster_city',
  'name',
  'origin_countries',
  'region',
  'process',
  'varieties',
  'roast_level',
  'roast_for',
  'tasting_notes',
  'weight_g',
  'price_eur',
  'url',
  'available',
  'updated_at',
] as const;
export type CatalogCsvColumn = (typeof CATALOG_CSV_COLUMNS)[number];

export const CatalogProduct = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(200),
  roaster: z.string().min(1).max(120),
  roasterCity: z.string().max(120).nullable(),
  name: z.string().min(1).max(200),
  /** ISO 3166 alpha-2, upper case; a blend lists all known origins */
  originCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(30),
  region: z.string().max(120).nullable(),
  process: Process.nullable(),
  varietals: z.array(z.string().max(60)).max(30),
  roastLevel: z.number().int().min(1).max(3).nullable(),
  roastFor: z.array(RoastFor).max(3),
  /** the roaster's own wording, untranslated (E7) */
  tastingNotes: z.array(z.string().max(80)).max(30),
  /** of the smallest whole-bean bag */
  weightG: z.number().positive().max(100_000).nullable(),
  priceEur: z.number().nonnegative().max(10_000).nullable(),
  url: z.url().max(500).nullable(),
  /** sold-out lots stay so older bags can still be picked */
  available: z.boolean(),
  updatedAt: IsoDate,
  /** where the row came from: a region file (`munich`) or `file` for a custom import */
  source: z.string().min(1).max(40),
});
export type CatalogProduct = z.infer<typeof CatalogProduct>;

/** A blend is a product listing more than one origin. */
export const isCatalogBlend = (p: Pick<CatalogProduct, 'originCountries'>): boolean => p.originCountries.length > 1;

// ---------- CSV ----------

/** RFC 4180: quoted cells may contain commas, quotes ("") and line breaks; CRLF or LF; a leading BOM is ignored. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // blank lines are not records
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

export type CatalogRowIssue = { line: number; id?: string; field: CatalogCsvColumn | 'row'; code: string };

export type CatalogCsvResult =
  | { ok: true; products: CatalogProduct[]; skipped: CatalogRowIssue[] }
  | { ok: false; problem: { code: 'CATALOG_CSV_HEADER'; missing: string[] } | { code: 'CATALOG_CSV_EMPTY' } };

const list = (s: string): string[] =>
  s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
const orNull = (s: string): string | null => s.trim() || null;
const num = (s: string): number | null | typeof NaN => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));

const FIELD_OF: Record<string, CatalogCsvColumn> = {
  id: 'id',
  roaster: 'roaster',
  roasterCity: 'roaster_city',
  name: 'name',
  originCountries: 'origin_countries',
  region: 'region',
  process: 'process',
  varietals: 'varieties',
  roastLevel: 'roast_level',
  roastFor: 'roast_for',
  tastingNotes: 'tasting_notes',
  weightG: 'weight_g',
  priceEur: 'price_eur',
  url: 'url',
  available: 'available',
  updatedAt: 'updated_at',
};

/**
 * Parses and validates a catalog CSV. Invalid rows are skipped with one issue per bad field
 * (`line` is the 1-based line of the record in the file, header = 1); a later duplicate id is skipped.
 */
export function parseCatalogCsv(text: string, source: string): CatalogCsvResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, problem: { code: 'CATALOG_CSV_EMPTY' } };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const missing = CATALOG_CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, problem: { code: 'CATALOG_CSV_HEADER', missing } };
  const col = Object.fromEntries(CATALOG_CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<CatalogCsvColumn, number>;

  const products: CatalogProduct[] = [];
  const skipped: CatalogRowIssue[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const line = r + 1;
    const get = (c: CatalogCsvColumn): string => (cells[col[c]] ?? '').trim();
    const available = get('available').toLowerCase();
    const candidate = {
      id: get('id'),
      roaster: get('roaster'),
      roasterCity: orNull(get('roaster_city')),
      name: get('name'),
      originCountries: list(get('origin_countries')).map((c) => c.toUpperCase()),
      region: orNull(get('region')),
      process: orNull(get('process')),
      varietals: list(get('varieties')),
      roastLevel: num(get('roast_level')),
      roastFor: list(get('roast_for')),
      tastingNotes: list(get('tasting_notes')),
      weightG: num(get('weight_g')),
      priceEur: num(get('price_eur')),
      url: orNull(get('url')),
      available: available === '' ? true : available === 'true' ? true : available === 'false' ? false : available,
      updatedAt: get('updated_at'),
      source,
    };
    const res = CatalogProduct.safeParse(candidate);
    if (!res.success) {
      const fields = new Set(res.error.issues.map((i) => FIELD_OF[String(i.path[0])] ?? 'row'));
      for (const field of fields) {
        const issue = res.error.issues.find((i) => (FIELD_OF[String(i.path[0])] ?? 'row') === field)!;
        skipped.push({ line, ...(candidate.id ? { id: candidate.id } : {}), field, code: field !== 'row' && get(field) === '' ? 'required' : issue.code });
      }
      continue;
    }
    if (seen.has(res.data.id)) {
      skipped.push({ line, id: res.data.id, field: 'id', code: 'duplicate' });
      continue;
    }
    seen.add(res.data.id);
    products.push(res.data);
  }
  return { ok: true, products, skipped };
}

/** Newest `updatedAt` of a catalog (ISO dates compare as strings), or null when empty. */
export function catalogUpdatedAt(products: readonly Pick<CatalogProduct, 'updatedAt'>[]): string | null {
  let max: string | null = null;
  for (const p of products) if (max === null || p.updatedAt > max) max = p.updatedAt;
  return max;
}

// ---------- search ----------

export interface CatalogSearch {
  text?: string;
  /** include sold-out lots (default true: they are listed after available ones) */
  includeUnavailable?: boolean;
  limit?: number;
}

/** Lower-case, accents and umlauts folded ("Kolumbien" ≈ "kolumbien", "Café" ≈ "cafe"). */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const FIELD_WEIGHTS: [(c: CatalogProduct) => string, number][] = [
  [(c) => c.name, 5],
  [(c) => c.roaster, 4],
  [(c) => `${c.originCountries.join(' ')} ${c.region ?? ''}`, 3],
  [(c) => [...c.varietals, c.process ?? ''].join(' '), 2],
  [(c) => c.tastingNotes.join(' '), 1],
];

/**
 * Every query word must prefix-match a word of roaster, name, origin (ISO codes and region),
 * variety/process or notes; name hits count most. `extraOrigin` lets the caller add localised
 * country names (the UI knows "Äthiopien" = ET, core doesn't). Ties: available first, then
 * roaster and name.
 */
export function searchCatalog(
  products: readonly CatalogProduct[],
  q: CatalogSearch = {},
  extraOrigin: (p: CatalogProduct) => string = () => '',
): CatalogProduct[] {
  const words = foldText(q.text ?? '').split(' ').filter(Boolean);
  const scored: { c: CatalogProduct; score: number }[] = [];
  for (const c of products) {
    if (q.includeUnavailable === false && !c.available) continue;
    let score = 0;
    let all = true;
    if (words.length) {
      const fields = FIELD_WEIGHTS.map(([get, w]) => [foldText(get(c)).split(' '), w] as const);
      fields.push([foldText(extraOrigin(c)).split(' '), 3]);
      for (const word of words) {
        let best = 0;
        for (const [tokens, w] of fields) {
          for (const tok of tokens) {
            if (tok === word) best = Math.max(best, w * 2);
            else if (tok.startsWith(word)) best = Math.max(best, w);
          }
        }
        if (best === 0) {
          all = false;
          break;
        }
        score += best;
      }
    }
    if (all) scored.push({ c, score });
  }
  scored.sort(
    (a, b) =>
      Number(b.c.available) - Number(a.c.available) ||
      b.score - a.score ||
      a.c.roaster.localeCompare(b.c.roaster) ||
      a.c.name.localeCompare(b.c.name),
  );
  return scored.slice(0, q.limit ?? 50).map((s) => s.c);
}
