import {
  aggregate,
  bagCostPerCup,
  DEFAULT_DOSE_G,
  fitContextModel,
  PROFILE_ATTRS,
  type AggregateOptions,
  type Bag,
  type Drink,
  type Effect,
  type FlavourTag,
  type Product,
  type ProfileAttr,
  type Rating,
  type RatingLevel,
  type Venue,
  type Wish,
} from '@cuplog/core';
import { MIN_CONTEXT_CUPS } from '@cuplog/core/vocab';

export { MIN_CONTEXT_CUPS };


export interface ProductInsight {
  productId: string;
  /** context-neutral bean score μ + product_i (null below MIN_CONTEXT_CUPS) */
  beanScore: number | null;
  /** recency-weighted raw score */
  score: number | null;
  cups: number;
  /** mean cost per cup over its bags with a price */
  costPerCup: number | null;
}

export interface VenueRanking {
  drink: Drink;
  venues: { venueId: string; score: number | null; n: number }[];
}

export interface InsightsView {
  cups: number;
  byLevel: Record<RatingLevel, number>;
  /** star histogram (0.5 … 5) and swipe counts — C6/§9.3 rating distribution */
  distribution: { stars: { value: number; n: number }[]; swipe: { more: number; less: number } };
  /** context model (README §5.4): effects, freshness curve; null with too few cups */
  context: { mu: number; n: number; effects: Effect[]; freshness: { day: number; effect: number }[] | null } | null;
  products: ProductInsight[];
  /** taste profile summary (C7) from advanced ratings and liked cups */
  profile: {
    attrs: Partial<Record<ProfileAttr, number>>;
    /** "you often want it sweeter": wish counts per attribute */
    wishes: { attr: ProfileAttr; more: number; justRight: number; less: number }[];
    /** flavour tags of cups you liked (p > 0), most frequent first */
    likedTags: { tag: FlavourTag; n: number }[];
    n: number;
  };
  /** café: venue ranking per drink (C9) and the average price paid */
  cafe: { ranking: VenueRanking[]; avgPriceEur: number | null; cups: number };
}

export interface InsightsInput {
  ratings: Rating[];
  bags: Bag[];
  products: Product[];
  venues: Venue[];
  aopts: AggregateOptions;
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function buildInsights({ ratings, bags, products, venues, aopts }: InsightsInput): InsightsView {
  const live = ratings.filter((r) => !r.deletedAt);
  const counted = live.filter((r) => !r.excluded);
  const all = aggregate(live, aopts);

  // distribution
  const starBins = new Map<number, number>();
  for (let v = 0.5; v <= 5; v += 0.5) starBins.set(v, 0);
  const swipe = { more: 0, less: 0 };
  for (const r of counted) {
    if (r.level === 'swipe' && r.swipe) swipe[r.swipe]++;
    else if (r.overall !== undefined) starBins.set(r.overall, (starBins.get(r.overall) ?? 0) + 1);
  }

  // context model
  const model =
    counted.length >= MIN_CONTEXT_CUPS
      ? fitContextModel(counted, {
          nowMs: aopts.nowMs,
          halfLifeDays: aopts.halfLifeDays,
          calibration: aopts.calibration,
          confidence: aopts.confidence,
        })
      : null;

  // products: bean score, raw score, cost per cup
  const productInsights: ProductInsight[] = products.map((p) => {
    const rs = counted.filter((r) => r.productId === p.id);
    const costs: number[] = [];
    for (const b of bags.filter((x) => x.productId === p.id)) {
      const cups = rs.filter((r) => r.bagId === b.id);
      const doses = cups.map((r) => r.brew?.doseG).filter((d): d is number => typeof d === 'number');
      const c = bagCostPerCup(b, cups.length, mean(doses) ?? DEFAULT_DOSE_G);
      if (c !== null) costs.push(c);
    }
    return {
      productId: p.id,
      beanScore: model?.beanScores[p.id] ?? null,
      score: rs.length ? aggregate(rs, aopts).currentScore : null,
      cups: rs.length,
      costPerCup: mean(costs),
    };
  });
  productInsights.sort((a, b) => (b.beanScore ?? b.score ?? -2) - (a.beanScore ?? a.score ?? -2));

  // taste profile (C7)
  const series = new Map(all.series.map((s) => [s.ratingId, s.p]));
  const tagCounts = new Map<FlavourTag, number>();
  for (const r of counted) {
    if ((series.get(r.id) ?? 0) <= 0) continue;
    for (const tag of r.flavourTags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const wishes = PROFILE_ATTRS.map((attr) => {
    const w = all.wishes[attr] ?? ({} as Partial<Record<Wish, number>>);
    return { attr, more: w.more ?? 0, justRight: w.justRight ?? 0, less: w.less ?? 0 };
  }).filter((w) => w.more + w.justRight + w.less > 0);

  // café: venue ranking per drink
  const cafeCups = counted.filter((r) => r.source === 'cafe' && r.cafe && r.venueId);
  const drinks = [...new Set(cafeCups.map((r) => r.cafe!.drink))];
  const known = new Set(venues.map((v) => v.id));
  const ranking: VenueRanking[] = drinks
    .map((drink) => {
      const byVenue = new Map<string, Rating[]>();
      for (const r of cafeCups) {
        if (r.cafe!.drink !== drink || !known.has(r.venueId!)) continue;
        byVenue.set(r.venueId!, [...(byVenue.get(r.venueId!) ?? []), r]);
      }
      const list = [...byVenue].map(([venueId, rs]) => ({
        venueId,
        n: rs.length,
        score: aggregate(rs, { ...aopts, outlierMethod: 'off', outlierReference: undefined }).currentScore,
      }));
      list.sort((a, b) => (b.score ?? -2) - (a.score ?? -2) || b.n - a.n);
      return { drink, venues: list };
    })
    .sort((a, b) => b.venues.reduce((s, v) => s + v.n, 0) - a.venues.reduce((s, v) => s + v.n, 0));

  return {
    cups: live.length,
    byLevel: all.byLevel,
    distribution: { stars: [...starBins].map(([value, n]) => ({ value, n })), swipe },
    context: model ? { mu: model.mu, n: model.n, effects: model.effects, freshness: model.freshness } : null,
    products: productInsights,
    profile: {
      attrs: all.profile ?? {},
      wishes,
      likedTags: [...tagCounts].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)),
      n: all.byLevel.advanced,
    },
    cafe: {
      ranking,
      avgPriceEur: mean(cafeCups.map((r) => r.cafe!.priceEur).filter((p): p is number => typeof p === 'number')),
      cups: cafeCups.length,
    },
  };
}
