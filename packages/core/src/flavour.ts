import { CATALOG_FLAVOURS, type SENSORY_AXES } from './catalog';
import { foldText, type CatalogProduct } from './catalogCsv';
import type { FLAVOUR_TAGS } from './vocab';

/**
 * Catalog features for the recommender (README §7.1): tasting notes → flavour vector via a small
 * SCA-wheel lexicon (German + English), rule-based sensory priors, origin regions, decaf.
 */

export type Flavour = (typeof CATALOG_FLAVOURS)[number];
export type SensoryAxis = (typeof SENSORY_AXES)[number];
export type FlavourVector = Record<Flavour, number>;
export type Sensory = Record<SensoryAxis, number>;

type Hit = Partial<Record<Flavour, number>>;

/**
 * Folded word stems (prefix match on each word of a note, see `foldText`) → flavour weights.
 * Longer stems win over shorter ones ("schwarzer tee" is earthy, "bergamotte" citrus + floral).
 */
const LEXICON: [string, Hit][] = [
  // chocolate
  ['schoko', { chocolate: 1 }], ['chocolat', { chocolate: 1 }], ['kakao', { chocolate: 1 }], ['cacao', { chocolate: 1 }],
  ['cocoa', { chocolate: 1 }], ['brownie', { chocolate: 1 }], ['dunkelschoko', { chocolate: 1 }], ['zartbitter', { chocolate: 1 }],
  ['milchschoko', { chocolate: 1, caramel: 0.3 }], ['mocca', { chocolate: 1 }], ['mokka', { chocolate: 1 }],
  // nutty
  ['nuss', { nutty: 1 }], ['nusse', { nutty: 1 }], ['nussig', { nutty: 1 }], ['nut', { nutty: 1 }], ['nutty', { nutty: 1 }],
  ['haselnuss', { nutty: 1 }], ['hazel', { nutty: 1 }], ['walnuss', { nutty: 1 }], ['walnut', { nutty: 1 }], ['mandel', { nutty: 1 }],
  ['almond', { nutty: 1 }], ['pecan', { nutty: 1 }], ['peanut', { nutty: 1 }], ['erdnuss', { nutty: 1 }], ['pistaz', { nutty: 1 }],
  ['marzipan', { nutty: 1, caramel: 0.3 }], ['nougat', { nutty: 1, chocolate: 0.5 }], ['praline', { nutty: 0.7, chocolate: 0.7 }],
  ['geroestet', { nutty: 0.5 }], ['gerostet', { nutty: 0.5 }], ['roasted', { nutty: 0.5 }],
  // caramel / sweet
  ['karamel', { caramel: 1 }], ['caramel', { caramel: 1 }], ['toffee', { caramel: 1 }], ['honig', { caramel: 1 }], ['honey', { caramel: 1 }],
  ['zucker', { caramel: 1 }], ['sugar', { caramel: 1 }], ['rohrzucker', { caramel: 1 }], ['melasse', { caramel: 1 }], ['molasses', { caramel: 1 }],
  ['vanill', { caramel: 0.8 }], ['sirup', { caramel: 1 }], ['syrup', { caramel: 1 }], ['malz', { caramel: 0.7, nutty: 0.3 }], ['malt', { caramel: 0.7, nutty: 0.3 }],
  ['keks', { caramel: 0.7, nutty: 0.3 }], ['cookie', { caramel: 0.7, nutty: 0.3 }], ['biscuit', { caramel: 0.7, nutty: 0.3 }], ['popcorn', { caramel: 0.7, nutty: 0.3 }],
  ['butterscotch', { caramel: 1 }], ['ahorn', { caramel: 1 }], ['maple', { caramel: 1 }],
  // fruity
  ['frucht', { fruity: 1 }], ['fruchte', { fruity: 1 }], ['fruechte', { fruity: 1 }], ['fruit', { fruity: 1 }], ['fruity', { fruity: 1 }],
  ['beere', { fruity: 1 }], ['beeren', { fruity: 1 }], ['beerig', { fruity: 1 }], ['berry', { fruity: 1 }], ['berries', { fruity: 1 }],
  ['blaubeer', { fruity: 1 }], ['blueberr', { fruity: 1 }], ['brombeer', { fruity: 1 }], ['blackberr', { fruity: 1 }], ['himbeer', { fruity: 1 }],
  ['raspberr', { fruity: 1 }], ['erdbeer', { fruity: 1 }], ['strawberr', { fruity: 1 }], ['johannisbeer', { fruity: 1 }], ['currant', { fruity: 1 }],
  ['cranberr', { fruity: 1 }], ['kirsch', { fruity: 1 }], ['cherr', { fruity: 1 }], ['pflaum', { fruity: 1 }], ['plum', { fruity: 1 }],
  ['pfirsich', { fruity: 1 }], ['peach', { fruity: 1 }], ['aprikos', { fruity: 1 }], ['apricot', { fruity: 1 }], ['nektarin', { fruity: 1 }],
  ['mango', { fruity: 1 }], ['banan', { fruity: 1 }], ['ananas', { fruity: 1 }], ['pineapple', { fruity: 1 }], ['papaya', { fruity: 1 }],
  ['maracuja', { fruity: 1, citrus: 0.3 }], ['passion', { fruity: 1, citrus: 0.3 }], ['guav', { fruity: 1 }], ['lychee', { fruity: 1, floral: 0.3 }],
  ['litschi', { fruity: 1, floral: 0.3 }], ['tropi', { fruity: 1 }], ['melon', { fruity: 1 }], ['wassermelon', { fruity: 1 }], ['watermelon', { fruity: 1 }],
  ['apfel', { fruity: 1 }], ['apple', { fruity: 1 }], ['birne', { fruity: 1 }], ['pear', { fruity: 1 }], ['traube', { fruity: 1 }], ['grape', { fruity: 1 }],
  ['dattel', { fruity: 0.7, caramel: 0.5 }], ['date', { fruity: 0.7, caramel: 0.5 }], ['feige', { fruity: 0.7, caramel: 0.5 }], ['fig', { fruity: 0.7, caramel: 0.5 }],
  ['rosine', { fruity: 0.7, caramel: 0.5 }], ['raisin', { fruity: 0.7, caramel: 0.5 }], ['trockenfr', { fruity: 0.7, caramel: 0.5 }],
  ['getrocknet', { fruity: 0.5 }], ['dried', { fruity: 0.5 }], ['reif', { fruity: 0.5 }], ['ripe', { fruity: 0.5 }],
  ['wein', { fruity: 0.8 }], ['wine', { fruity: 0.8 }], ['winey', { fruity: 0.8 }], ['rum', { fruity: 0.5, caramel: 0.5 }], ['liquor', { fruity: 0.5 }],
  // citrus
  ['zitrus', { citrus: 1 }], ['zitrusfrucht', { citrus: 1 }], ['citrus', { citrus: 1 }], ['zitron', { citrus: 1 }], ['lemon', { citrus: 1 }],
  ['limett', { citrus: 1 }], ['lime', { citrus: 1 }], ['orange', { citrus: 1 }], ['mandarin', { citrus: 1 }], ['grapefruit', { citrus: 1 }],
  ['bergamott', { citrus: 0.7, floral: 0.7 }], ['bergamot', { citrus: 0.7, floral: 0.7 }], ['yuzu', { citrus: 1 }], ['clementin', { citrus: 1 }],
  // floral
  ['floral', { floral: 1 }], ['blum', { floral: 1 }], ['blute', { floral: 1 }], ['flower', { floral: 1 }], ['jasmin', { floral: 1 }],
  ['rose', { floral: 1 }], ['lavend', { floral: 1 }], ['hibisk', { floral: 0.7, fruity: 0.5 }], ['hibisc', { floral: 0.7, fruity: 0.5 }],
  ['holunder', { floral: 1 }], ['elderflower', { floral: 1 }], ['orangenblut', { floral: 1, citrus: 0.3 }],
  // spice
  ['wurz', { spice: 1 }], ['spic', { spice: 1 }], ['zimt', { spice: 1 }], ['cinnamon', { spice: 1 }], ['pfeffer', { spice: 1 }],
  ['pepper', { spice: 1 }], ['nelke', { spice: 1 }], ['clove', { spice: 1 }], ['kardamom', { spice: 1 }], ['cardamom', { spice: 1 }],
  ['ingwer', { spice: 1 }], ['ginger', { spice: 1 }], ['anis', { spice: 1 }], ['lakritz', { spice: 1 }], ['licorice', { spice: 1 }],
  ['sussholz', { spice: 1 }], ['muskat', { spice: 1 }], ['nutmeg', { spice: 1 }],
  // earthy
  ['erdig', { earthy: 1 }], ['earth', { earthy: 1 }], ['tabak', { earthy: 1 }], ['tobacco', { earthy: 1 }], ['holz', { earthy: 1 }],
  ['wood', { earthy: 1 }], ['leder', { earthy: 1 }], ['leather', { earthy: 1 }], ['krauter', { earthy: 0.8 }], ['herb', { earthy: 0.8 }],
  ['tee', { earthy: 0.5, floral: 0.3 }], ['tea', { earthy: 0.5, floral: 0.3 }], ['rauch', { earthy: 1 }], ['smok', { earthy: 1 }],
  ['zeder', { earthy: 1 }], ['cedar', { earthy: 1 }], ['wild', { earthy: 0.5 }], ['mineral', { earthy: 0.5 }],
];

/** Descriptor words that inform the sensory priors rather than flavour. */
const SENSORY_HINTS: [string, Partial<Sensory>][] = [
  ['vollmundig', { body: 0.15 }], ['full', { body: 0.15 }], ['body', { body: 0.1 }], ['fulle', { body: 0.1 }], ['cremig', { body: 0.1 }],
  ['creamy', { body: 0.1 }], ['crema', { body: 0.05 }], ['saure', { acidity: 0.1 }], ['acid', { acidity: 0.1 }], ['lebhaft', { acidity: 0.1 }],
  ['bright', { acidity: 0.1 }], ['juicy', { acidity: 0.1 }], ['saftig', { acidity: 0.1 }], ['suss', { sweetness: 0.1 }], ['sweet', { sweetness: 0.1 }],
  ['weich', { bitterness: -0.1 }], ['smooth', { bitterness: -0.1 }], ['mild', { bitterness: -0.1, acidity: -0.05 }], ['kraftig', { body: 0.1, bitterness: 0.1 }],
  ['strong', { body: 0.1, bitterness: 0.1 }], ['bitter', { bitterness: 0.15 }],
];

// longest stems first so specific entries win
LEXICON.sort((a, b) => b[0].length - a[0].length);

const empty = (): FlavourVector => Object.fromEntries(CATALOG_FLAVOURS.map((f) => [f, 0])) as FlavourVector;

/** Flavour weights of one note, or null when the lexicon doesn't know any of its words. */
export function noteFlavour(note: string): Hit | null {
  const words = foldText(note).split(' ').filter(Boolean);
  const hit: Hit = {};
  let any = false;
  for (const w of words) {
    const entry = LEXICON.find(([stem]) => w.startsWith(stem));
    if (!entry) continue;
    any = true;
    for (const [f, v] of Object.entries(entry[1]) as [Flavour, number][]) hit[f] = Math.max(hit[f] ?? 0, v);
  }
  return any ? hit : null;
}

/** Sensory hints of one note ("vollmundig" → +body). */
function noteSensory(note: string): Partial<Sensory> {
  const out: Partial<Sensory> = {};
  for (const w of foldText(note).split(' ')) {
    const entry = SENSORY_HINTS.find(([stem]) => w.startsWith(stem));
    if (entry) for (const [a, v] of Object.entries(entry[1]) as [SensoryAxis, number][]) out[a] = (out[a] ?? 0) + v;
  }
  return out;
}

/**
 * Notes → flavour vector in [0, 1], scaled so the strongest dimension is 1 (all zero when nothing
 * maps). `unmapped` lists notes without any flavour word (descriptors like "vollmundig" included).
 */
export function flavourFromNotes(notes: readonly string[]): { vector: FlavourVector; unmapped: string[] } {
  const sum = empty();
  const unmapped: string[] = [];
  for (const n of notes) {
    const hit = noteFlavour(n);
    if (!hit) {
      unmapped.push(n);
      continue;
    }
    for (const [f, v] of Object.entries(hit) as [Flavour, number][]) sum[f] += v;
  }
  const max = Math.max(...Object.values(sum));
  const vector = empty();
  if (max > 0) for (const f of CATALOG_FLAVOURS) vector[f] = round(sum[f] / max);
  return { vector, unmapped };
}

/** The user's flavour tags (rating detail level) on the same 8 dimensions (README §7.1). */
export const TAG_FLAVOUR: Record<(typeof FLAVOUR_TAGS)[number], Hit> = {
  chocolate: { chocolate: 1 },
  nutty: { nutty: 1 },
  caramel: { caramel: 1 },
  berry: { fruity: 1 },
  citrus: { citrus: 1 },
  stoneFruit: { fruity: 1 },
  tropical: { fruity: 1 },
  floral: { floral: 1 },
  spice: { spice: 1 },
  earthy: { earthy: 1 },
  herbal: { earthy: 0.7, floral: 0.3 },
  winey: { fruity: 0.8 },
};

// ---------- origin ----------

export const ORIGIN_REGIONS = ['eastAfrica', 'centralAmerica', 'southAmerica', 'asiaPacific', 'blend'] as const;
export type OriginRegion = (typeof ORIGIN_REGIONS)[number];

const REGION_OF: Record<string, Exclude<OriginRegion, 'blend'>> = {};
for (const [region, codes] of [
  ['eastAfrica', 'ET KE RW BI UG TZ MW ZM ZW CD CM YE'],
  ['centralAmerica', 'GT HN SV NI CR PA MX CU DO JM HT PR'],
  ['southAmerica', 'BR CO PE BO EC VE'],
  ['asiaPacific', 'ID PG IN VN CN LA MM TH TL PH US AU'],
] as const) {
  for (const c of codes.split(' ')) REGION_OF[c] = region;
}

/** Growing region of a product's origins; several countries make a blend; unknown → null. */
export function originRegion(countries: readonly string[]): OriginRegion | null {
  if (countries.length > 1) return 'blend';
  return countries[0] ? (REGION_OF[countries[0].toUpperCase()] ?? null) : null;
}

// ---------- sensory priors ----------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number) => Math.round(x * 1000) / 1000;

type SensoryInput = Pick<CatalogProduct, 'process' | 'roastLevel' | 'originCountries' | 'roastFor' | 'tastingNotes'>;

/**
 * Rule-based acidity / sweetness / body / bitterness in [0, 1] (README §6.3 step 5): light washed
 * East African → bright; dark Brazilian or Asian → heavy and bitter. 0.5 means "no information".
 */
export function sensoryPrior(p: SensoryInput, flavour: FlavourVector = flavourFromNotes(p.tastingNotes).vector): Sensory {
  const s: Sensory = { acidity: 0.5, sweetness: 0.5, body: 0.5, bitterness: 0.5 };
  const add = (d: Partial<Sensory>, k = 1) => {
    for (const [a, v] of Object.entries(d) as [SensoryAxis, number][]) s[a] += v * k;
  };
  if (p.roastLevel === 1) add({ acidity: 0.2, bitterness: -0.15, body: -0.1 });
  if (p.roastLevel === 3) add({ acidity: -0.2, bitterness: 0.2, body: 0.15 });
  const process: Record<string, Partial<Sensory>> = {
    washed: { acidity: 0.1, body: -0.05 },
    natural: { sweetness: 0.1, body: 0.1, acidity: -0.05 },
    honey: { sweetness: 0.1, body: 0.05 },
    anaerobic: { sweetness: 0.1, acidity: 0.05 },
  };
  if (p.process && process[p.process]) add(process[p.process]!);
  const region: Record<OriginRegion, Partial<Sensory>> = {
    eastAfrica: { acidity: 0.15 },
    centralAmerica: { acidity: 0.05, sweetness: 0.05 },
    southAmerica: { body: 0.1, acidity: -0.1, sweetness: 0.05 },
    asiaPacific: { body: 0.15, acidity: -0.1, bitterness: 0.05 },
    blend: { body: 0.05 },
  };
  const r = originRegion(p.originCountries);
  if (r) add(region[r]);
  if (p.roastFor.length === 1 && p.roastFor[0] === 'espresso') add({ body: 0.05, bitterness: 0.05 });
  if (p.roastFor.length === 1 && p.roastFor[0] === 'filter') add({ acidity: 0.05, body: -0.05 });
  add({ acidity: 0.1 }, Math.max(flavour.fruity, flavour.citrus));
  add({ sweetness: 0.1 }, Math.max(flavour.caramel, flavour.chocolate * 0.5));
  add({ body: 0.05, bitterness: 0.05 }, Math.max(flavour.chocolate, flavour.earthy));
  for (const n of p.tastingNotes) add(noteSensory(n));
  return { acidity: round(clamp01(s.acidity)), sweetness: round(clamp01(s.sweetness)), body: round(clamp01(s.body)), bitterness: round(clamp01(s.bitterness)) };
}

const DECAF = /\b(decaf|entkoffein|descafeinad|decaffein|sugarcane|zuckerrohr|swiss water|koffeinfrei)/;

/** Decaf from the name or notes ("Decaf de Caña", "entkoffeiniert"). */
export const isDecaf = (p: Pick<CatalogProduct, 'name' | 'tastingNotes'>): boolean =>
  DECAF.test(foldText([p.name, ...p.tastingNotes].join(' ')));

export interface CatalogFeatures {
  flavour: FlavourVector;
  sensory: Sensory;
  originRegion: OriginRegion | null;
  decaf: boolean;
}

/** Everything the recommender needs from one catalog row. */
export function catalogFeatures(p: CatalogProduct): CatalogFeatures {
  const flavour = flavourFromNotes(p.tastingNotes).vector;
  return { flavour, sensory: sensoryPrior(p, flavour), originRegion: originRegion(p.originCountries), decaf: isDecaf(p) };
}
