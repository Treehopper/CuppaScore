import type { Bag, DomainSettings, Product, Rating, RatingSource, Venue } from '@cuplog/core';
import type {
  AddBagCmd,
  AddProductCmd,
  AddVenueCmd,
  BagPatch,
  BagQuery,
  BagView,
  LogRatingCmd,
  MethodUsage,
  PresetView,
  ProductPatch,
  ProductStatsView,
  ProductView,
  RatingPatch,
  StatsOptions,
  StatsView,
  VenuePatch,
  VenueView,
} from '@cuplog/services';

// DTOs are the plain-JSON domain records and views (validated by zod schemas in core/services).
export type ProductDto = Product;
export type BagDto = Bag;
export type VenueDto = Venue;
export type RatingDto = Rating;
export type DomainSettingsDto = DomainSettings;
export type {
  AddBagCmd,
  AddProductCmd,
  AddVenueCmd,
  BagPatch,
  BagQuery,
  BagView,
  LogRatingCmd,
  MethodUsage,
  PresetView,
  ProductPatch,
  ProductStatsView,
  ProductView,
  RatingPatch,
  StatsOptions,
  StatsView,
  VenuePatch,
  VenueView,
};

export interface RatingQuery {
  bagId?: string;
  productId?: string;
  venueId?: string;
  limit?: number;
}

export type Topic = 'ratings' | 'bags' | 'products' | 'venues' | 'settings';
export type Unsubscribe = () => void;

/**
 * The only thing the UI talks to (README §8.1/8.2). Every method is async and DTO-only, so the
 * same calls can cross a worker boundary today and HTTP later.
 */
export interface CupLogApi {
  // commands
  addProduct(cmd: AddProductCmd): Promise<ProductDto>;
  updateProduct(id: string, patch: ProductPatch): Promise<ProductDto>;
  addBag(cmd: AddBagCmd): Promise<BagDto>;
  updateBag(id: string, patch: BagPatch): Promise<BagDto>;
  addVenue(cmd: AddVenueCmd): Promise<VenueDto>;
  updateVenue(id: string, patch: VenuePatch): Promise<VenueDto>;
  logRating(cmd: LogRatingCmd): Promise<RatingDto>;
  updateRating(id: string, patch: RatingPatch): Promise<RatingDto>;
  setRatingExcluded(id: string, excluded: boolean, reason?: string): Promise<RatingDto>;
  deleteRating(id: string): Promise<void>;
  restoreRating(id: string): Promise<RatingDto>;
  updateSettings(patch: Partial<DomainSettingsDto>): Promise<DomainSettingsDto>;
  setPresetPinned(key: string, pinned: boolean): Promise<DomainSettingsDto>;

  // queries
  getSettings(): Promise<DomainSettingsDto>;
  getProduct(id: string): Promise<ProductDto>;
  listProducts(): Promise<ProductView[]>;
  getBag(id: string): Promise<BagView>;
  listBags(q?: BagQuery): Promise<BagView[]>;
  listVenues(): Promise<VenueView[]>;
  getRating(id: string): Promise<RatingDto>;
  listRatings(q?: RatingQuery): Promise<RatingDto[]>;
  listPresets(q: { source: RatingSource; at?: string }): Promise<PresetView[]>;
  methodUsage(): Promise<MethodUsage[]>;
  getBagStats(bagId: string, opts?: StatsOptions): Promise<StatsView>;
  getProductStats(productId: string, opts?: StatsOptions): Promise<ProductStatsView>;

  // events
  subscribe(topic: Topic, cb: () => void): Unsubscribe;
}

export type ApiMethod = Exclude<keyof CupLogApi, 'subscribe'>;

/** Which topics a successful command changes. Queries are absent. */
export const COMMAND_TOPICS: Partial<Record<ApiMethod, Topic[]>> = {
  addProduct: ['products'],
  updateProduct: ['products'],
  addBag: ['bags'],
  updateBag: ['bags'],
  addVenue: ['venues'],
  updateVenue: ['venues'],
  logRating: ['ratings', 'bags', 'venues'],
  updateRating: ['ratings'],
  setRatingExcluded: ['ratings'],
  deleteRating: ['ratings'],
  restoreRating: ['ratings'],
  updateSettings: ['settings'],
  setPresetPinned: ['settings'],
};

export const API_METHODS: readonly ApiMethod[] = [
  'addProduct',
  'updateProduct',
  'addBag',
  'updateBag',
  'addVenue',
  'updateVenue',
  'logRating',
  'updateRating',
  'setRatingExcluded',
  'deleteRating',
  'restoreRating',
  'updateSettings',
  'setPresetPinned',
  'getSettings',
  'getProduct',
  'listProducts',
  'getBag',
  'listBags',
  'listVenues',
  'getRating',
  'listRatings',
  'listPresets',
  'methodUsage',
  'getBagStats',
  'getProductStats',
];
