// Pure helpers behind the Quick Log form: text inputs ↔ Brew, detail state → rating fields.
import type { RatingDto } from '@cuplog/api';
import type { BrewMethod, RatingLevel } from './domain';

type Brew = NonNullable<RatingDto['brew']>;
export type HomeMilk = NonNullable<Brew['milk']>;
type ProfileAttr = keyof NonNullable<RatingDto['profile']>;
type Wish = NonNullable<NonNullable<RatingDto['wish']>[ProfileAttr]>;
type FlavourTag = NonNullable<RatingDto['flavourTags']>[number];

/** Brew details as the form edits them: every number is a string, '' = not set. */
export interface BrewForm {
  doseG: string;
  waterG: string;
  yieldG: string;
  grind: string;
  tempC: string;
  timeS: string;
  milk: HomeMilk | '';
  orientation: 'standard' | 'inverted' | '';
  steepS: string;
  filter: 'paper' | 'metal' | '';
  bypassG: string;
  basket: 'flowControl' | 'standard' | '';
  preheat: 'yes' | 'no' | '';
  preinfusionS: string;
  pressure: 'low' | 'medium' | 'high' | '';
}

const str = (v: number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

/** Accepts "15", "15,5" and "15.5"; '' or garbage → undefined. */
export function parseNum(s: string, int = false): number | undefined {
  const t = s.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return int ? Math.round(n) : n;
}

export function brewToForm(b: Brew | null | undefined): BrewForm {
  const ap = b?.methodParams?.kind === 'aeropress' ? b.methodParams : undefined;
  const fl = b?.methodParams?.kind === 'flairNeo' ? b.methodParams : undefined;
  return {
    doseG: str(b?.doseG),
    waterG: str(b?.waterG),
    yieldG: str(b?.yieldG),
    grind: b?.grind ?? '',
    tempC: str(b?.tempC),
    timeS: str(b?.timeS),
    milk: b?.milk ?? '',
    orientation: ap?.orientation ?? '',
    steepS: str(ap?.steepS),
    filter: ap?.filter ?? '',
    bypassG: str(ap?.bypassG),
    basket: fl?.basket ?? '',
    preheat: fl?.preheat === undefined ? '' : fl.preheat ? 'yes' : 'no',
    preinfusionS: str(fl?.preinfusionS),
    pressure: fl?.pressure ?? '',
  };
}

/** Drops undefined values so absent fields stay absent (README §4.3). */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Form → Brew for `method`; method-specific params are kept only for that method. */
export function formToBrew(method: BrewMethod, f: BrewForm): Brew {
  const brew: Brew = compact({
    method,
    doseG: parseNum(f.doseG),
    waterG: parseNum(f.waterG),
    yieldG: parseNum(f.yieldG),
    grind: f.grind.trim() || undefined,
    tempC: parseNum(f.tempC),
    timeS: parseNum(f.timeS, true),
    milk: f.milk || undefined,
  });
  if (method === 'aeropress') {
    const p = compact({
      orientation: f.orientation || undefined,
      steepS: parseNum(f.steepS, true),
      filter: f.filter || undefined,
      bypassG: parseNum(f.bypassG),
    });
    if (Object.keys(p).length) brew.methodParams = { kind: 'aeropress', ...p };
  } else if (method === 'flairNeo') {
    const p = compact({
      basket: f.basket || undefined,
      preheat: f.preheat === '' ? undefined : f.preheat === 'yes',
      preinfusionS: parseNum(f.preinfusionS, true),
      pressure: f.pressure || undefined,
    });
    if (Object.keys(p).length) brew.methodParams = { kind: 'flairNeo', ...p };
  }
  return brew;
}

/** Ratings at the Stars and Detail levels (Swipe has its own fields). */
export interface DetailState {
  stars: number | null;
  wouldBuyAgain: boolean | null;
  strength: number | null;
  profile: Partial<Record<ProfileAttr, number>>;
  wish: Partial<Record<ProfileAttr, Wish>>;
  tags: FlavourTag[];
}

export const emptyDetail = (): DetailState => ({
  stars: null,
  wouldBuyAgain: null,
  strength: null,
  profile: {},
  wish: {},
  tags: [],
});

/** Only the fields that belong to `level` and were actually set. */
export function detailFields(level: Exclude<RatingLevel, 'swipe'>, d: DetailState): Partial<RatingDto> {
  const out: Partial<RatingDto> = compact({
    overall: d.stars ?? undefined,
    wouldBuyAgain: d.wouldBuyAgain ?? undefined,
  });
  if (level === 'advanced') {
    if (d.strength !== null) out.strength = d.strength;
    if (Object.keys(d.profile).length) out.profile = { ...d.profile };
    if (Object.keys(d.wish).length) out.wish = { ...d.wish };
    if (d.tags.length) out.flavourTags = [...d.tags];
  }
  return out;
}
