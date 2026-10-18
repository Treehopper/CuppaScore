import { CATALOG_FLAVOURS, SENSORY_AXES } from './catalog';
import type { CatalogProduct } from './catalogCsv';
import { flavourFromNotes, originRegion, ORIGIN_REGIONS, sensoryPrior, TAG_FLAVOUR, type FlavourVector, type OriginRegion, type Sensory } from './flavour';
import type { Product } from './product';
import type { ProfileAttr, Wish } from './enums';
import { PROCESSES, ROAST_FOR, type FLAVOUR_TAGS } from './vocab';

/**
 * Feature vectors (README §7.1) and the taste profile (§7.2). Each block is scaled to unit length
 * times √weight, so the cosine of two vectors weighs blocks as in the table and a block without
 * information (no notes, unknown origin) simply doesn't take part.
 */
export const FEATURE_WEIGHTS = { flavour: 0.35, sensory: 0.25, roast: 0.15, process: 0.1, origin: 0.1, roastFor: 0.05 } as const;
export type FeatureBlock = keyof typeof FEATURE_WEIGHTS;

/** Dimension names, e.g. `flavour.fruity`, `sensory.acidity`, `roast`, `process.natural` (used by explanations). */
export const FEATURE_DIMS: readonly string[] = [
  ...CATALOG_FLAVOURS.map((f) => `flavour.${f}`),
  ...SENSORY_AXES.map((a) => `sensory.${a}`),
  'roast',
  ...PROCESSES.map((p) => `process.${p}`),
  ...ORIGIN_REGIONS.map((r) => `origin.${r}`),
  ...ROAST_FOR.map((r) => `roastFor.${r}`),
];

const BLOCK_OF: FeatureBlock[] = FEATURE_DIMS.map((d) => d.split('.')[0] as FeatureBlock);

export interface Features {
  flavour: FlavourVector;
  /** 0–1 per axis; 0.5 = neutral */
  sensory: Sensory;
  roastLevel: number | null;
  process: (typeof PROCESSES)[number] | null;
  originRegion: OriginRegion | null;
  roastFor: readonly (typeof ROAST_FOR)[number][];
}

export type FeatureVector = number[];

function scaleBlocks(raw: number[]): FeatureVector {
  const out = raw.slice();
  for (const block of Object.keys(FEATURE_WEIGHTS) as FeatureBlock[]) {
    const idx = BLOCK_OF.flatMap((b, i) => (b === block ? [i] : []));
    const norm = Math.hypot(...idx.map((i) => raw[i]!));
    const k = norm > 1e-9 ? Math.sqrt(FEATURE_WEIGHTS[block]) / norm : 0;
    for (const i of idx) out[i] = raw[i]! * k;
  }
  return out;
}

export function featureVector(f: Features): FeatureVector {
  return scaleBlocks([
    ...CATALOG_FLAVOURS.map((k) => f.flavour[k]),
    ...SENSORY_AXES.map((a) => (f.sensory[a] - 0.5) * 2),
    f.roastLevel ? f.roastLevel - 2 : 0,
    ...PROCESSES.map((p) => (f.process === p ? 1 : 0)),
    ...ORIGIN_REGIONS.map((r) => (f.originRegion === r ? 1 : 0)),
    ...ROAST_FOR.map((r) => (f.roastFor.includes(r) ? 1 : 0)),
  ]);
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * (b[i] ?? 0);
    na += a[i]! ** 2;
    nb += (b[i] ?? 0) ** 2;
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

// ---------- catalog and user products ----------

export function catalogProductFeatures(c: CatalogProduct): Features {
  const flavour = flavourFromNotes(c.tastingNotes).vector;
  return {
    flavour,
    sensory: sensoryPrior(c, flavour),
    roastLevel: c.roastLevel,
    process: c.process,
    originRegion: originRegion(c.originCountries),
    roastFor: c.roastFor,
  };
}

/** Country names as people type them on a bag (en/de/it/es, `|`-separated) → ISO code, for coffee origins. */
const COUNTRY_NAMES: [string, string][] = Object.entries({
  ET: 'ethiopia|athiopien|etiopia', KE: 'kenya|kenia', RW: 'rwanda|ruanda', BI: 'burundi', UG: 'uganda', TZ: 'tanzania|tansania',
  MW: 'malawi', ZM: 'zambia|sambia', CD: 'congo|kongo', YE: 'yemen|jemen', BR: 'brazil|brasilien|brasile|brasil', CO: 'colombia|kolumbien',
  PE: 'peru', BO: 'bolivia|bolivien', EC: 'ecuador', VE: 'venezuela', GT: 'guatemala', HN: 'honduras', SV: 'el salvador',
  NI: 'nicaragua', CR: 'costa rica', PA: 'panama', MX: 'mexico|mexiko|messico', CU: 'cuba|kuba', JM: 'jamaica|jamaika|giamaica',
  DO: 'dominican republic|dominikanische republik|repubblica dominicana|republica dominicana', HT: 'haiti',
  ID: 'indonesia|indonesien|sumatra|java|sulawesi|bali|flores', IN: 'india|indien', VN: 'vietnam', PG: 'papua new guinea|papua-neuguinea|papua neuguinea',
  CN: 'china|cina|yunnan', LA: 'laos', MM: 'myanmar', TH: 'thailand|tailandia', TL: 'timor', PH: 'philippines|philippinen|filippine|filipinas',
}).flatMap(([code, names]) => names.split('|').map((n) => [n, code] as [string, string]));

/** "Äthiopien" → ["ET"], "Brasilien, Kolumbien" → ["BR", "CO"], "BR;CO" → ["BR", "CO"]; unknown words are ignored. */
export function countryCodes(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  if (/^[A-Z]{2}([;,\s]+[A-Z]{2})*$/.test(text.trim())) return [...new Set(text.trim().split(/[;,\s]+/))];
  const folded = ` ${text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z-]+/g, ' ')} `;
  const hits: [number, string][] = [];
  for (const [name, code] of COUNTRY_NAMES) {
    const at = folded.indexOf(` ${name} `);
    if (at >= 0) hits.push([at, code]);
  }
  return [...new Set(hits.sort((x, y) => x[0] - y[0]).map(([, c]) => c))];
}

export interface ProductEvidence {
  /** the catalog row the product came from, if any */
  catalog?: CatalogProduct | undefined;
  /** flavour tags of the product's ratings (repeats count) */
  flavourTags?: readonly (typeof FLAVOUR_TAGS)[number][];
  /** mean 1–5 profile sliders and how many advanced ratings they come from */
  profile?: Partial<Record<ProfileAttr, number>> | null;
  advancedCount?: number;
}

/** Your own product (README §7.1): label/catalog notes + your flavour tags; your sliders beat the label from 3 detailed cups. */
export function userProductFeatures(p: Product, e: ProductEvidence = {}): Features {
  const notes = p.labelNotes.length ? p.labelNotes : (e.catalog?.tastingNotes ?? []);
  const fromNotes = flavourFromNotes(notes).vector;
  const sum: FlavourVector = { ...fromNotes };
  const tags = e.flavourTags ?? [];
  if (tags.length) {
    // tags weigh like the label as a whole, however many cups carried them
    const tagSum = Object.fromEntries(CATALOG_FLAVOURS.map((f) => [f, 0])) as FlavourVector;
    for (const tag of tags) for (const [f, v] of Object.entries(TAG_FLAVOUR[tag]) as [keyof FlavourVector, number][]) tagSum[f] += v;
    const max = Math.max(...Object.values(tagSum));
    for (const f of CATALOG_FLAVOURS) sum[f] += tagSum[f] / max;
  }
  const max = Math.max(...Object.values(sum));
  const flavour = Object.fromEntries(CATALOG_FLAVOURS.map((f) => [f, max > 0 ? sum[f] / max : 0])) as FlavourVector;

  const countries = e.catalog?.originCountries ?? countryCodes(p.origin.country);
  const region = p.isBlend && countries.length !== 1 ? 'blend' : originRegion(countries);
  let sensory = sensoryPrior({ process: p.process, roastLevel: p.roastLevel, originCountries: countries, roastFor: p.roastFor, tastingNotes: notes }, flavour);
  if ((e.advancedCount ?? 0) >= 3 && e.profile) {
    const mine = { ...sensory };
    for (const a of SENSORY_AXES) {
      const v = e.profile[a];
      if (typeof v === 'number') mine[a] = (v - 1) / 4;
    }
    sensory = mine;
  }
  return { flavour, sensory, roastLevel: p.roastLevel, process: p.process, originRegion: region, roastFor: p.roastFor };
}

// ---------- taste profile ----------

export const WISH_LAMBDA = 0.2;

/**
 * Direction of recent "wish" answers in the sensory block: (more − less) / answers per axis
 * (e.g. "sweetness: more" pushes the target sweeter). Null without wishes.
 */
export function wishShift(wishes: Partial<Record<ProfileAttr, Partial<Record<Wish, number>>>>): FeatureVector | null {
  const raw = FEATURE_DIMS.map(() => 0);
  let any = false;
  for (const a of SENSORY_AXES) {
    const w = wishes[a];
    const total = (w?.more ?? 0) + (w?.less ?? 0) + (w?.justRight ?? 0);
    if (!total) continue;
    raw[FEATURE_DIMS.indexOf(`sensory.${a}`)] = ((w?.more ?? 0) - (w?.less ?? 0)) / total;
    any = true;
  }
  return any ? scaleBlocks(raw) : null;
}

/**
 * userVector = normalise(Σ P_i · v_i + λ · wishShift) (README §7.2). `p` is the product's combined,
 * centred preference (−1 … +1): liked products pull, disliked ones push. Null when nothing is known.
 */
export function tasteProfile(items: readonly { vector: FeatureVector; p: number }[], shift: FeatureVector | null = null): FeatureVector | null {
  const acc = FEATURE_DIMS.map(() => 0);
  for (const { vector, p } of items) for (let i = 0; i < acc.length; i++) acc[i]! += p * vector[i]!;
  if (shift) for (let i = 0; i < acc.length; i++) acc[i]! += WISH_LAMBDA * shift[i]!;
  const norm = Math.hypot(...acc);
  return norm > 1e-9 ? acc.map((x) => x / norm) : null;
}

/** The block contributions of a·b, largest first: what two coffees share (for explanations, §7.4). */
export function sharedDims(a: readonly number[], b: readonly number[], limit = 2): string[] {
  return FEATURE_DIMS.map((d, i) => [d, a[i]! * b[i]!] as const)
    .filter(([, v]) => v > 1e-6)
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([d]) => d);
}
