import {
  aggregate,
  Bag,
  BagFields,
  bagFreshness,
  bagStatus,
  bagWarnings,
  computeDerived,
  derivePresets,
  DomainSettings,
  isoLocalDate,
  Product,
  ProductFields,
  Rating,
  RatingFields,
  stripForLevel,
  timeOfDayOf,
  toZonedIso,
  validateRatingShape,
  Venue,
  VenueFields,
  type AggregateOptions,
  type BagFreshness,
  type BagInput,
  type BagStatus,
  type BagWarning,
  type BrewMethod,
  type Drink,
  type MealType,
  type Preset,
  type ProductInput,
  type RatingInput,
  type RatingSource,
  type RecordMeta,
  type StatsSummary,
  type TimeOfDay,
  type VenueInput,
} from '@cuplog/core';
import type { z } from 'zod';
import { DomainError } from './errors';
import type { Ctx, Repositories } from './ports';

// ---------- commands ----------

export type AddProductCmd = ProductInput;
export type ProductPatch = Partial<ProductInput>;
export type AddBagCmd = BagInput;
export type BagPatch = Partial<Omit<BagInput, 'productId'>>;
export type AddVenueCmd = VenueInput;
export type VenuePatch = Partial<VenueInput>;

/** A cup to log. `ratedAt` defaults to now, `timeOfDay` to the bucket of `ratedAt` (B5). */
export type LogRatingCmd = Omit<RatingInput, 'timeOfDay' | 'ratedAt' | 'derived' | 'presetKey' | 'productId'> & {
  ratedAt?: string;
  timeOfDay?: TimeOfDay;
};
export type RatingPatch = Partial<LogRatingCmd>;

export interface BagQuery {
  status?: BagStatus[];
  productId?: string;
}

export interface StatsOptions {
  includeOutliers?: boolean;
}

// ---------- views (plain JSON) ----------

export interface BagView {
  bag: Bag;
  product: Product | null;
  status: BagStatus;
  freshness: BagFreshness;
  warnings: BagWarning[];
  cups: number;
  /** estimated cups left from weight and average dose (A6); null without a weight */
  cupsLeft: number | null;
  /** recency-weighted combined score −1 … +1 */
  score: number | null;
  lastRatedAt: string | null;
}

export interface ProductView {
  product: Product;
  bags: number;
  cups: number;
  score: number | null;
  lastRatedAt: string | null;
}

export interface VenueView {
  venue: Venue;
  visits: number;
  score: number | null;
  lastVisitAt: string | null;
}

export interface PresetView {
  preset: Preset;
  bag: Bag | null;
  product: Product | null;
  venue: Venue | null;
}

export interface GroupScore {
  key: string;
  n: number;
  score: number | null;
  starMean: number | null;
}

export interface StatsView {
  summary: StatsSummary;
  /** by brew method (home) or drink (café) — C5 */
  byMethod: GroupScore[];
  byMeal: GroupScore[];
  byTimeOfDay: GroupScore[];
  /** café-made cups counted (C10) */
  cafeCups: number;
}

export interface ProductStatsView extends StatsView {
  /** bag-to-bag comparison */
  byBag: GroupScore[];
}

export interface MethodUsage {
  method: BrewMethod;
  uses: number;
}

const DEFAULT_DOSE_G = 15;

function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const res = schema.safeParse(input);
  if (!res.success) {
    throw new DomainError(
      'VALIDATION',
      res.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
    );
  }
  return res.data;
}

/** Use cases behind the API (README §8.1). Knows ports only, never a concrete adapter. */
export class CupLogService {
  readonly repos: Repositories;
  readonly ctx: Ctx;

  constructor(repos: Repositories, ctx: Ctx) {
    this.repos = repos;
    this.ctx = ctx;
  }

  // ---------- helpers ----------

  private get owner(): string {
    return this.ctx.ownerId;
  }

  async nowIso(): Promise<string> {
    const s = await this.getSettings();
    return toZonedIso(this.ctx.clock.now(), s.timeZone);
  }

  private async meta(): Promise<RecordMeta> {
    const now = await this.nowIso();
    return { id: this.ctx.ids.next(), ownerId: this.owner, createdAt: now, updatedAt: now, deletedAt: null, rev: 1 };
  }

  private async bump<T extends RecordMeta>(rec: T): Promise<T> {
    return { ...rec, updatedAt: await this.nowIso(), rev: rec.rev + 1 };
  }

  private async mustGet<T extends RecordMeta>(
    repo: { get(o: string, id: string): Promise<T | undefined> },
    id: string,
    kind: string,
  ): Promise<T> {
    const r = await repo.get(this.owner, id);
    if (!r || r.deletedAt) throw new DomainError('NOT_FOUND', { kind, id });
    return r;
  }

  private async aggOpts(extra: StatsOptions = {}): Promise<AggregateOptions> {
    const s = await this.getSettings();
    return {
      nowMs: this.ctx.clock.now(),
      halfLifeDays: s.halfLifeDays,
      outlierMethod: s.outlierMethod,
      confidence: s.confidence,
      includeOutliers: extra.includeOutliers ?? false,
    };
  }

  // ---------- settings ----------

  async getSettings(): Promise<DomainSettings> {
    return (await this.repos.settings.get(this.owner)) ?? DomainSettings.parse({});
  }

  async updateSettings(patch: Partial<DomainSettings>): Promise<DomainSettings> {
    const cur = await this.getSettings();
    const next = parseOrThrow(DomainSettings, {
      ...cur,
      ...patch,
      updatedAt: toZonedIso(this.ctx.clock.now(), patch.timeZone ?? cur.timeZone),
      rev: cur.rev + 1,
    });
    await this.repos.settings.put(this.owner, next);
    return next;
  }

  async setPresetPinned(key: string, pinned: boolean): Promise<DomainSettings> {
    const s = await this.getSettings();
    const set = new Set(s.pinnedPresets);
    if (pinned) set.add(key);
    else set.delete(key);
    return this.updateSettings({ pinnedPresets: [...set] });
  }

  // ---------- products ----------

  async addProduct(cmd: AddProductCmd): Promise<Product> {
    const fields = parseOrThrow(ProductFields, cmd);
    const rec = Product.parse({ ...(await this.meta()), ...fields });
    await this.repos.products.put(rec);
    return rec;
  }

  async updateProduct(id: string, patch: ProductPatch): Promise<Product> {
    const cur = await this.mustGet(this.repos.products, id, 'product');
    const fields = parseOrThrow(ProductFields, { ...cur, ...patch });
    const rec = await this.bump({ ...cur, ...fields });
    await this.repos.products.put(rec);
    return rec;
  }

  async getProduct(id: string): Promise<Product> {
    return this.mustGet(this.repos.products, id, 'product');
  }

  async listProducts(): Promise<ProductView[]> {
    const [products, bags, ratings, opts] = await Promise.all([
      this.repos.products.list(this.owner),
      this.repos.bags.list(this.owner),
      this.repos.ratings.list(this.owner),
      this.aggOpts(),
    ]);
    return products.map((product) => {
      const rs = ratings.filter((r) => r.productId === product.id);
      const sum = aggregate(rs, opts);
      return {
        product,
        bags: bags.filter((b) => b.productId === product.id).length,
        cups: rs.length,
        score: sum.currentScore,
        lastRatedAt: latest(rs),
      };
    });
  }

  // ---------- bags ----------

  async addBag(cmd: AddBagCmd): Promise<Bag> {
    const fields = parseOrThrow(BagFields, cmd);
    await this.mustGet(this.repos.products, fields.productId, 'product');
    const rec = Bag.parse({ ...(await this.meta()), ...fields });
    await this.repos.bags.put(rec);
    return rec;
  }

  async updateBag(id: string, patch: BagPatch): Promise<Bag> {
    const cur = await this.mustGet(this.repos.bags, id, 'bag');
    const fields = parseOrThrow(BagFields, { ...cur, ...patch, productId: cur.productId });
    const rec = await this.bump({ ...cur, ...fields });
    await this.repos.bags.put(rec);
    return rec;
  }

  async getBag(id: string): Promise<BagView> {
    const bag = await this.mustGet(this.repos.bags, id, 'bag');
    const [views] = await this.bagViews([bag]);
    return views!;
  }

  /** Open bags first (by last use), then unopened, then finished (B1b). */
  async listBags(q: BagQuery = {}): Promise<BagView[]> {
    let bags = await this.repos.bags.list(this.owner);
    if (q.productId) bags = bags.filter((b) => b.productId === q.productId);
    if (q.status) bags = bags.filter((b) => q.status!.includes(bagStatus(b)));
    const views = await this.bagViews(bags);
    const rank: Record<BagStatus, number> = { open: 0, unopened: 1, finished: 2 };
    return views.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (b.lastRatedAt ? Date.parse(b.lastRatedAt) : 0) - (a.lastRatedAt ? Date.parse(a.lastRatedAt) : 0) ||
        b.bag.createdAt.localeCompare(a.bag.createdAt),
    );
  }

  private async bagViews(bags: Bag[]): Promise<BagView[]> {
    const [ratings, opts, settings] = await Promise.all([
      this.repos.ratings.list(this.owner),
      this.aggOpts(),
      this.getSettings(),
    ]);
    const today = isoLocalDate(toZonedIso(this.ctx.clock.now(), settings.timeZone));
    const products = new Map<string, Product | null>();
    const out: BagView[] = [];
    for (const bag of bags) {
      if (!products.has(bag.productId)) products.set(bag.productId, (await this.repos.products.get(this.owner, bag.productId)) ?? null);
      const rs = ratings.filter((r) => r.bagId === bag.id);
      const doses = rs.map((r) => r.brew?.doseG).filter((d): d is number => typeof d === 'number' && d > 0);
      const avgDose = doses.length ? doses.reduce((a, b) => a + b, 0) / doses.length : DEFAULT_DOSE_G;
      const cupsLeft =
        bag.weightG === null || bagStatus(bag) === 'finished'
          ? bagStatus(bag) === 'finished'
            ? 0
            : null
          : Math.max(0, Math.floor((bag.weightG - rs.length * avgDose) / avgDose));
      out.push({
        bag,
        product: products.get(bag.productId) ?? null,
        status: bagStatus(bag),
        freshness: bagFreshness(bag, today),
        warnings: bagStatus(bag) === 'finished' ? [] : bagWarnings(bag, today),
        cups: rs.length,
        cupsLeft,
        score: aggregate(rs, opts).currentScore,
        lastRatedAt: latest(rs),
      });
    }
    return out;
  }

  // ---------- venues ----------

  async addVenue(cmd: AddVenueCmd): Promise<Venue> {
    const fields = parseOrThrow(VenueFields, cmd);
    const rec = Venue.parse({ ...(await this.meta()), ...fields });
    await this.repos.venues.put(rec);
    return rec;
  }

  async updateVenue(id: string, patch: VenuePatch): Promise<Venue> {
    const cur = await this.mustGet(this.repos.venues, id, 'venue');
    const fields = parseOrThrow(VenueFields, { ...cur, ...patch });
    const rec = await this.bump({ ...cur, ...fields });
    await this.repos.venues.put(rec);
    return rec;
  }

  /** Most recently visited first. */
  async listVenues(): Promise<VenueView[]> {
    const [venues, ratings, opts] = await Promise.all([
      this.repos.venues.list(this.owner),
      this.repos.ratings.list(this.owner),
      this.aggOpts(),
    ]);
    return venues
      .map((venue) => {
        const rs = ratings.filter((r) => r.venueId === venue.id);
        return { venue, visits: rs.length, score: aggregate(rs, opts).currentScore, lastVisitAt: latest(rs) };
      })
      .sort(
        (a, b) =>
          (b.lastVisitAt ? Date.parse(b.lastVisitAt) : 0) - (a.lastVisitAt ? Date.parse(a.lastVisitAt) : 0) ||
          a.venue.name.localeCompare(b.venue.name),
      );
  }

  // ---------- ratings ----------

  private async buildRating(input: LogRatingCmd, base?: Rating): Promise<z.infer<typeof RatingFields>> {
    const ratedAt = input.ratedAt ?? base?.ratedAt ?? (await this.nowIso());
    const level = input.level ?? base?.level;
    const draft: Record<string, unknown> = { ...input, ratedAt, level };
    // the time of day follows ratedAt unless overridden (B5)
    draft.timeOfDay =
      input.timeOfDay ?? (base && !input.ratedAt ? base.timeOfDay : undefined) ?? timeOfDayOf(ratedAt);
    delete draft.derived;
    delete draft.productId;
    delete draft.presetKey;

    if (input.source === 'home') {
      const bag = input.bagId ? await this.mustGet(this.repos.bags, input.bagId, 'bag') : null;
      if (bag) {
        if (bagStatus(bag) === 'finished' && base?.bagId !== bag.id) throw new DomainError('BAG_FINISHED', { bagId: bag.id });
        draft.productId = bag.productId;
        // the first cup from an unopened bag opens it that day (see logRating)
        draft.derived = computeDerived({ ...bag, openedAt: bag.openedAt ?? isoLocalDate(ratedAt) }, ratedAt);
        draft.presetKey = input.brew ? `home:${bag.id}:${input.brew.method}` : null;
      }
    } else if (input.source === 'cafe') {
      if (input.venueId) await this.mustGet(this.repos.venues, input.venueId, 'venue');
      const bean = input.beanKnown;
      // a café cup counts towards a product only when the bean is one of ours (C10)
      if (bean && bean !== 'unknown' && bean !== 'house') {
        const p = await this.repos.products.get(this.owner, bean);
        draft.productId = p && !p.deletedAt ? p.id : null;
      }
      const c = input.cafe;
      draft.presetKey =
        input.venueId && c
          ? `cafe:${input.venueId}:${c.drink}:${c.milk ?? 'unknown'}:${c.size ?? 'regular'}`
          : null;
    }

    const fields = parseOrThrow(RatingFields, stripForLevel(draft as { level: Rating['level'] }));
    const issues = validateRatingShape(fields);
    if (issues.length) throw new DomainError('INVALID_RATING_SHAPE', issues);
    return fields;
  }

  async logRating(cmd: LogRatingCmd): Promise<Rating> {
    const fields = await this.buildRating(cmd);
    const rec = Rating.parse({ ...(await this.meta()), ...fields });
    await this.repos.uow.run(async () => {
      await this.repos.ratings.put(rec);
      if (rec.bagId) {
        const bag = await this.repos.bags.get(this.owner, rec.bagId);
        // logging from an unopened bag opens it (A5)
        if (bag && !bag.openedAt) {
          await this.repos.bags.put(await this.bump({ ...bag, openedAt: isoLocalDate(rec.ratedAt) }));
        }
      }
      if (rec.venueId && rec.cafe) {
        const v = await this.repos.venues.get(this.owner, rec.venueId);
        if (v && v.lastDrink !== rec.cafe.drink) await this.repos.venues.put(await this.bump({ ...v, lastDrink: rec.cafe.drink }));
      }
    });
    return rec;
  }

  async getRating(id: string): Promise<Rating> {
    return this.mustGet(this.repos.ratings, id, 'rating');
  }

  async updateRating(id: string, patch: RatingPatch): Promise<Rating> {
    const cur = await this.mustGet(this.repos.ratings, id, 'rating');
    const { id: _i, ownerId: _o, createdAt: _c, updatedAt: _u, deletedAt: _d, rev: _r, ...curFields } = cur;
    const merged = { ...curFields, ...patch } as LogRatingCmd;
    if (patch.ratedAt && !patch.timeOfDay) delete merged.timeOfDay;
    const fields = await this.buildRating(merged, cur);
    const meta: RecordMeta = { id: cur.id, ownerId: cur.ownerId, createdAt: cur.createdAt, updatedAt: cur.updatedAt, deletedAt: cur.deletedAt, rev: cur.rev };
    const rec = Rating.parse(await this.bump({ ...meta, ...fields }));
    await this.repos.ratings.put(rec);
    return rec;
  }

  /** "Not representative" flag (B9): kept, but excluded from stats. */
  async setRatingExcluded(id: string, excluded: boolean, reason?: string): Promise<Rating> {
    const cur = await this.mustGet(this.repos.ratings, id, 'rating');
    const rec = await this.bump({ ...cur, excluded, excludeReason: excluded ? (reason ?? null) : null });
    await this.repos.ratings.put(rec);
    return rec;
  }

  /** Soft delete (README §8.3). */
  async deleteRating(id: string): Promise<void> {
    const cur = await this.mustGet(this.repos.ratings, id, 'rating');
    const now = await this.nowIso();
    await this.repos.ratings.put({ ...cur, deletedAt: now, updatedAt: now, rev: cur.rev + 1 });
  }

  /** Restores a soft-deleted rating (Undo after save/delete). */
  async restoreRating(id: string): Promise<Rating> {
    const cur = await this.repos.ratings.get(this.owner, id);
    if (!cur) throw new DomainError('NOT_FOUND', { kind: 'rating', id });
    const rec = await this.bump({ ...cur, deletedAt: null });
    await this.repos.ratings.put(rec);
    return rec;
  }

  /** Newest first. */
  async listRatings(q: { bagId?: string; productId?: string; venueId?: string; limit?: number } = {}): Promise<Rating[]> {
    const rs = await this.repos.ratings.find(this.owner, q);
    rs.sort((a, b) => Date.parse(b.ratedAt) - Date.parse(a.ratedAt) || b.id.localeCompare(a.id));
    return q.limit ? rs.slice(0, q.limit) : rs;
  }

  // ---------- presets & log options ----------

  async listPresets(q: { source: RatingSource; at?: string }): Promise<PresetView[]> {
    const [ratings, bags, settings] = await Promise.all([
      this.repos.ratings.list(this.owner),
      this.repos.bags.list(this.owner),
      this.getSettings(),
    ]);
    const presets = derivePresets(ratings, {
      nowMs: q.at ? Date.parse(q.at) : this.ctx.clock.now(),
      timeZone: settings.timeZone,
      bags: new Map(bags.map((b) => [b.id, b])),
      pinned: new Set(settings.pinnedPresets),
      source: q.source,
    });
    const out: PresetView[] = [];
    for (const preset of presets) {
      const bag = preset.bagId ? (bags.find((b) => b.id === preset.bagId) ?? null) : null;
      const product = preset.productId ? ((await this.repos.products.get(this.owner, preset.productId)) ?? null) : null;
      const venue = preset.venueId ? ((await this.repos.venues.get(this.owner, preset.venueId)) ?? null) : null;
      if (preset.source === 'cafe' && (!venue || venue.deletedAt)) continue;
      out.push({ preset, bag, product, venue });
    }
    return out;
  }

  /** Owned methods, most used first (B1b "Method ▾"). */
  async methodUsage(): Promise<MethodUsage[]> {
    const [ratings, settings] = await Promise.all([this.repos.ratings.list(this.owner), this.getSettings()]);
    const counts = new Map<BrewMethod, number>(settings.ownedMethods.map((m) => [m, 0]));
    for (const r of ratings) if (r.brew && counts.has(r.brew.method)) counts.set(r.brew.method, counts.get(r.brew.method)! + 1);
    return [...counts].map(([method, uses]) => ({ method, uses })).sort((a, b) => b.uses - a.uses);
  }

  // ---------- stats ----------

  async getBagStats(bagId: string, opts: StatsOptions = {}): Promise<StatsView> {
    const bag = await this.mustGet(this.repos.bags, bagId, 'bag');
    const rs = await this.repos.ratings.find(this.owner, { bagId });
    const aopts = await this.aggOpts(opts);
    // fewer than 5 cups in the bag: judge outliers against the whole product (README §5.2)
    if (rs.filter((r) => !r.excluded).length < 5) {
      aopts.outlierReference = await this.repos.ratings.find(this.owner, { productId: bag.productId });
    }
    return this.statsView(rs, aopts);
  }

  async getProductStats(productId: string, opts: StatsOptions = {}): Promise<ProductStatsView> {
    await this.mustGet(this.repos.products, productId, 'product');
    const rs = await this.repos.ratings.find(this.owner, { productId });
    const aopts = await this.aggOpts(opts);
    const view = this.statsView(rs, aopts);
    const counted = countedRatings(rs, view.summary);
    return { ...view, byBag: groupScores(counted.filter((r) => r.bagId), (r) => r.bagId!, aopts) };
  }

  private statsView(rs: Rating[], aopts: AggregateOptions): StatsView {
    const summary = aggregate(rs, aopts);
    const counted = countedRatings(rs, summary);
    return {
      summary,
      byMethod: groupScores(counted, (r) => (r.brew?.method ?? r.cafe?.drink ?? 'other') as BrewMethod | Drink, aopts),
      byMeal: groupScores(counted, (r) => r.meal.type as MealType, aopts),
      byTimeOfDay: groupScores(counted, (r) => r.timeOfDay, aopts),
      cafeCups: counted.filter((r) => r.source === 'cafe').length,
    };
  }
}

function latest(rs: Rating[]): string | null {
  let best: string | null = null;
  for (const r of rs) if (!r.deletedAt && (!best || Date.parse(r.ratedAt) > Date.parse(best))) best = r.ratedAt;
  return best;
}

function countedRatings(rs: Rating[], s: StatsSummary): Rating[] {
  const ids = new Set(s.series.map((x) => x.ratingId));
  return rs.filter((r) => ids.has(r.id));
}

function groupScores(rs: Rating[], key: (r: Rating) => string, aopts: AggregateOptions): GroupScore[] {
  const groups = new Map<string, Rating[]>();
  for (const r of rs) {
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups]
    .map(([k, g]) => {
      const s = aggregate(g, { ...aopts, outlierMethod: 'off', outlierReference: undefined });
      return { key: k, n: g.length, score: s.currentScore, starMean: s.stars?.mean ?? null };
    })
    .sort((a, b) => (b.score ?? -2) - (a.score ?? -2));
}
