import type { Bag, CatalogProduct, DomainSettings, Rating, RecordMeta } from '@cuplog/core';
import type {
  BagRepo,
  CatalogRepo,
  DeviceStateRepo,
  ListOptions,
  RatingFilter,
  RatingRepo,
  Repo,
  Repositories,
  SettingsRepo,
} from './ports';

const clone = <T>(v: T): T => structuredClone(v);

class MemoryRepo<T extends RecordMeta> implements Repo<T> {
  protected rows = new Map<string, T>();

  async get(ownerId: string, id: string): Promise<T | undefined> {
    const r = this.rows.get(id);
    return r && r.ownerId === ownerId ? clone(r) : undefined;
  }

  async list(ownerId: string, opts: ListOptions = {}): Promise<T[]> {
    return [...this.rows.values()]
      .filter((r) => r.ownerId === ownerId && (opts.includeDeleted || !r.deletedAt))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(clone);
  }

  async put(record: T): Promise<void> {
    this.rows.set(record.id, clone(record));
  }

  async clear(ownerId: string): Promise<void> {
    for (const [id, r] of this.rows) if (r.ownerId === ownerId) this.rows.delete(id);
  }
}

class MemoryRatingRepo extends MemoryRepo<Rating> implements RatingRepo {
  async find(ownerId: string, f: RatingFilter): Promise<Rating[]> {
    const since = f.since ? Date.parse(f.since) : null;
    return (await this.list(ownerId, f)).filter(
      (r) =>
        (!f.bagId || r.bagId === f.bagId) &&
        (!f.productId || r.productId === f.productId) &&
        (!f.venueId || r.venueId === f.venueId) &&
        (since === null || Date.parse(r.ratedAt) >= since),
    );
  }
}

class MemoryBagRepo extends MemoryRepo<Bag> implements BagRepo {
  async listByProduct(ownerId: string, productId: string): Promise<Bag[]> {
    return (await this.list(ownerId)).filter((b) => b.productId === productId);
  }
}

class MemorySettingsRepo implements SettingsRepo {
  #rows = new Map<string, DomainSettings>();
  async get(ownerId: string) {
    const s = this.#rows.get(ownerId);
    return s ? clone(s) : undefined;
  }
  async put(ownerId: string, s: DomainSettings) {
    this.#rows.set(ownerId, clone(s));
  }
  async clear(ownerId: string) {
    this.#rows.delete(ownerId);
  }
}

class MemoryDeviceRepo implements DeviceStateRepo {
  #rows = new Map<string, unknown>();
  async get<T>(key: string) {
    return clone(this.#rows.get(key)) as T | undefined;
  }
  async set<T>(key: string, value: T) {
    this.#rows.set(key, clone(value));
  }
}

class MemoryCatalogRepo implements CatalogRepo {
  #rows = new Map<string, CatalogProduct>();
  async get(id: string) {
    return clone(this.#rows.get(id));
  }
  async list() {
    return [...this.#rows.values()].map(clone);
  }
  async putMany(rows: CatalogProduct[]) {
    for (const r of rows) this.#rows.set(r.id, clone(r));
  }
  async count() {
    return this.#rows.size;
  }
}

/** In-memory adapter: used by tests and as the reference implementation of the repo contract. */
export function createMemoryRepos(): Repositories {
  return {
    ratings: new MemoryRatingRepo(),
    products: new MemoryRepo(),
    bags: new MemoryBagRepo(),
    venues: new MemoryRepo(),
    settings: new MemorySettingsRepo(),
    device: new MemoryDeviceRepo(),
    catalog: new MemoryCatalogRepo(),
    uow: { run: (fn) => fn() },
  };
}
