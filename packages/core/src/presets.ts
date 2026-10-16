import type { Bag } from './bag';
import { bagFreshness, bagStatus } from './bag';
import type { BrewMethod, CafeMilk, CupSize, Drink, RatingLevel, RatingSource } from './enums';
import type { Brew, CafeDetails, Meal, Rating } from './rating';
import { localParts, timeOfDayAt, type TimeOfDay } from './time';
import { timeOfDayOf } from './derive';

/**
 * A combination used before, derived from history (README §4.5). Never stored as the source
 * of truth; only `pinned` keys live in settings.
 */
export interface Preset {
  key: string;
  source: RatingSource;
  // home
  bagId: string | null;
  productId: string | null;
  method: BrewMethod | null;
  lastBrew: Brew | null;
  // café
  venueId: string | null;
  drink: Drink | null;
  milk: CafeMilk | null;
  size: CupSize | null;
  lastCafe: CafeDetails | null;
  lastBeanKnown: string | null;
  // shared
  lastLevel: RatingLevel;
  lastMeal: Meal | null;
  uses: number;
  uses30d: number;
  lastUsedAt: string;
  /** uses per time-of-day bucket */
  byTimeOfDay: Partial<Record<TimeOfDay, number>>;
  pinned: boolean;
  score: number;
}

export function homePresetKey(bagId: string, method: BrewMethod): string {
  return `home:${bagId}:${method}`;
}

export function cafePresetKey(venueId: string, c: Pick<CafeDetails, 'drink' | 'milk' | 'size'>): string {
  return `cafe:${venueId}:${c.drink}:${c.milk}:${c.size}`;
}

/** Key of the preset a rating belongs to, or null if it lacks the required fields. */
export function presetKeyOf(r: Pick<Rating, 'source' | 'bagId' | 'brew' | 'venueId' | 'cafe'>): string | null {
  if (r.source === 'home') return r.bagId && r.brew ? homePresetKey(r.bagId, r.brew.method) : null;
  return r.venueId && r.cafe ? cafePresetKey(r.venueId, r.cafe) : null;
}

const DAY_MS = 86_400_000;
/** Recency half-life for preset ranking, in days. */
export const PRESET_RECENCY_HALF_LIFE_DAYS = 3;

export interface PresetOptions {
  nowMs: number;
  timeZone: string;
  bags: ReadonlyMap<string, Pick<Bag, 'openedAt' | 'finishedAt' | 'roastDate' | 'expiryDate'>>;
  pinned?: ReadonlySet<string>;
  source?: RatingSource;
}

/**
 * Derives presets from ratings and ranks them:
 * score = 0.5·recency + 0.3·frequency + 0.2·timeOfDayMatch; pinned first;
 * presets whose bag is finished, past expiry or unknown are hidden.
 */
export function derivePresets(ratings: readonly Rating[], opts: PresetOptions): Preset[] {
  const sorted = ratings
    .filter((r) => !r.deletedAt && (!opts.source || r.source === opts.source))
    .sort((a, b) => Date.parse(a.ratedAt) - Date.parse(b.ratedAt));
  const map = new Map<string, Preset>();
  for (const r of sorted) {
    const key = presetKeyOf(r);
    if (!key) continue;
    const ageDays = (opts.nowMs - Date.parse(r.ratedAt)) / DAY_MS;
    const tod = timeOfDayOf(r.ratedAt);
    const prev = map.get(key);
    const p: Preset = prev ?? {
      key,
      source: r.source,
      bagId: null,
      productId: null,
      method: null,
      lastBrew: null,
      venueId: null,
      drink: null,
      milk: null,
      size: null,
      lastCafe: null,
      lastBeanKnown: null,
      lastLevel: r.level,
      lastMeal: null,
      uses: 0,
      uses30d: 0,
      lastUsedAt: r.ratedAt,
      byTimeOfDay: {},
      pinned: opts.pinned?.has(key) ?? false,
      score: 0,
    };
    p.uses++;
    if (ageDays <= 30) p.uses30d++;
    p.byTimeOfDay[tod] = (p.byTimeOfDay[tod] ?? 0) + 1;
    p.lastUsedAt = r.ratedAt;
    p.lastLevel = r.level;
    p.lastMeal = r.meal;
    if (r.source === 'home') {
      p.bagId = r.bagId;
      p.productId = r.productId;
      p.method = r.brew!.method;
      p.lastBrew = r.brew!;
    } else {
      p.venueId = r.venueId;
      p.drink = r.cafe!.drink;
      p.milk = r.cafe!.milk;
      p.size = r.cafe!.size;
      p.lastCafe = r.cafe!;
      p.lastBeanKnown = r.beanKnown ?? null;
    }
    map.set(key, p);
  }

  const nowParts = localParts(opts.nowMs, opts.timeZone);
  const nowTod = timeOfDayAt(nowParts.hour);
  const visible = [...map.values()].filter((p) => {
    if (p.source !== 'home') return true;
    const bag = p.bagId ? opts.bags.get(p.bagId) : undefined;
    if (!bag) return false;
    return bagStatus(bag) !== 'finished' && !bagFreshness(bag, nowParts.date).pastExpiry;
  });
  const maxUses = Math.max(1, ...visible.map((p) => p.uses30d));
  for (const p of visible) {
    const ageDays = Math.max(0, (opts.nowMs - Date.parse(p.lastUsedAt)) / DAY_MS);
    const recency = 0.5 ** (ageDays / PRESET_RECENCY_HALF_LIFE_DAYS);
    const frequency = p.uses30d / maxUses;
    const todMatch = (p.byTimeOfDay[nowTod] ?? 0) / p.uses;
    p.score = 0.5 * recency + 0.3 * frequency + 0.2 * todMatch;
  }
  return visible.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.score - a.score ||
      Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt) ||
      a.key.localeCompare(b.key),
  );
}
