import type { Bag, Clock, DomainSettings, IdGenerator, Product, Rating, RecordMeta, Rng, Venue } from '@cuplog/core';

/**
 * Port interfaces (README §8.1). Implemented by adapters (storage-dexie now, Postgres later).
 * Repositories always filter by `ownerId`. Soft-deleted records are only returned when
 * `includeDeleted` is set.
 */
export interface ListOptions {
  includeDeleted?: boolean;
}

export interface Repo<T extends RecordMeta> {
  get(ownerId: string, id: string): Promise<T | undefined>;
  list(ownerId: string, opts?: ListOptions): Promise<T[]>;
  /** Insert or replace. Implementations must not alter the record. */
  put(record: T): Promise<void>;
  /** Hard delete; only used by import "replace" and tests. */
  clear(ownerId: string): Promise<void>;
}

export interface RatingFilter extends ListOptions {
  bagId?: string;
  productId?: string;
  venueId?: string;
  /** inclusive lower bound on ratedAt (ISO, compared as instants) */
  since?: string;
}

export interface RatingRepo extends Repo<Rating> {
  find(ownerId: string, filter: RatingFilter): Promise<Rating[]>;
}

export type ProductRepo = Repo<Product>;

export interface BagRepo extends Repo<Bag> {
  listByProduct(ownerId: string, productId: string): Promise<Bag[]>;
}

export type VenueRepo = Repo<Venue>;

export interface SettingsRepo {
  get(ownerId: string): Promise<DomainSettings | undefined>;
  put(ownerId: string, settings: DomainSettings): Promise<void>;
  clear(ownerId: string): Promise<void>;
}

/** Device-local key/value state (reminder bookkeeping, catalog version …), README §4.6. */
export interface DeviceStateRepo {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface MediaStore {
  put(ownerId: string, id: string, blob: Blob): Promise<void>;
  get(ownerId: string, id: string): Promise<Blob | undefined>;
  delete(ownerId: string, id: string): Promise<void>;
}

export interface UnitOfWork {
  /** Runs `fn` atomically across repositories. */
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Repositories {
  ratings: RatingRepo;
  products: ProductRepo;
  bags: BagRepo;
  venues: VenueRepo;
  settings: SettingsRepo;
  device: DeviceStateRepo;
  uow: UnitOfWork;
}

/** Per-call context (README §8.1): who is acting, and injected time / ids / randomness. */
export interface Ctx {
  ownerId: string;
  clock: Clock;
  ids: IdGenerator;
  rng: Rng;
}
