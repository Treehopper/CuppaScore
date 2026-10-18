import type {
  Bag,
  CatalogProduct,
  CatalogRegion,
  CatalogRowIssue,
  CatalogSearch,
  DomainSettings,
  DueReminder,
  ExportBundle,
  Product,
  Rating,
  RatingSource,
  ReminderAction,
  ReminderConfig,
  ReminderRule,
  RuleKind,
  Venue,
} from '@cuplog/core';
import type {
  AddBagCmd,
  AddProductCmd,
  AddVenueCmd,
  BagPatch,
  BagQuery,
  BagView,
  CatalogImportReport,
  CatalogInfo,
  ImportMode,
  ImportReport,
  InsightsView,
  LogRatingCmd,
  MethodUsage,
  NextReminder,
  PresetView,
  ProductPatch,
  ProductStatsView,
  ProductView,
  RatingPatch,
  ReminderCheck,
  StatsOptions,
  StatsView,
  VenuePatch,
  VenueView,
} from '@cuplog/services';

// DTOs are the plain-JSON domain records and views (validated by zod schemas in core/services).
export type ProductDto = Product;
export type { ExportBundle };
export type BagDto = Bag;
export type VenueDto = Venue;
export type RatingDto = Rating;
export type DomainSettingsDto = DomainSettings;
export type CatalogProductDto = CatalogProduct;
export type { CatalogImportReport, CatalogInfo, CatalogRegion, CatalogRowIssue, CatalogSearch };
export type { DueReminder, ReminderAction, ReminderConfig, ReminderRule, RuleKind };
export type {
  AddBagCmd,
  AddProductCmd,
  AddVenueCmd,
  BagPatch,
  BagQuery,
  BagView,
  ImportMode,
  ImportReport,
  InsightsView,
  LogRatingCmd,
  MethodUsage,
  NextReminder,
  PresetView,
  ProductPatch,
  ProductStatsView,
  ProductView,
  RatingPatch,
  ReminderCheck,
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

export type Topic = 'ratings' | 'bags' | 'products' | 'venues' | 'settings' | 'catalog';
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
  /** Reminder banner action (README §12.3). */
  ackReminder(ruleId: string, action: ReminderAction): Promise<ReminderCheck>;

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
  /** Due reminders + next due time; call on start, foreground and timer (README §12.1). */
  checkReminders(): Promise<ReminderCheck>;
  getNextReminders(): Promise<NextReminder[]>;
  /** Stats screen: context effects, distribution, taste profile, cost, venue ranking. */
  getInsights(): Promise<InsightsView>;
  /** Calendar file for one fixed-time rule (F8). */
  exportReminderIcs(ruleId: string, text: { title: string; description?: string }): Promise<string>;

  // catalog (F4)
  /** Fetches the region CSV (default: settings.catalogRegion) in the backend and imports it. */
  loadRegionCatalog(region?: CatalogRegion): Promise<CatalogImportReport>;
  /** A catalog CSV the user picked; `text` is untrusted and validated in the backend. */
  importCatalogCsv(text: string, fileName?: string): Promise<CatalogImportReport>;
  getCatalogInfo(): Promise<CatalogInfo>;
  /** `originNames`: localised country names by ISO code for matching ("Äthiopien" → ET). */
  searchCatalog(q?: CatalogSearch & { originNames?: Record<string, string> }): Promise<CatalogProductDto[]>;
  getCatalogProduct(id: string): Promise<CatalogProductDto>;

  // data
  exportAll(): Promise<ExportBundle>;
  /** `bundle` is untrusted JSON; it is validated and migrated in the backend. */
  importAll(bundle: unknown, mode: ImportMode): Promise<ImportReport>;
  exportRatingsCsv(): Promise<string>;

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
  // logging acks due reminders, whose state lives in settings
  logRating: ['ratings', 'bags', 'venues', 'settings'],
  updateRating: ['ratings'],
  setRatingExcluded: ['ratings'],
  deleteRating: ['ratings'],
  restoreRating: ['ratings'],
  updateSettings: ['settings'],
  setPresetPinned: ['settings'],
  ackReminder: ['settings'],
  importAll: ['ratings', 'bags', 'products', 'venues', 'settings'],
  loadRegionCatalog: ['catalog'],
  importCatalogCsv: ['catalog'],
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
  'ackReminder',
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
  'checkReminders',
  'getNextReminders',
  'getInsights',
  'exportReminderIcs',
  'exportAll',
  'importAll',
  'exportRatingsCsv',
  'loadRegionCatalog',
  'importCatalogCsv',
  'getCatalogInfo',
  'searchCatalog',
  'getCatalogProduct',
];
