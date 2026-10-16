import type { Bag, DomainSettings, Rating, RecordMeta } from '@cuplog/core';
import type {
  BagRepo,
  DeviceStateRepo,
  ListOptions,
  MediaStore,
  RatingFilter,
  RatingRepo,
  Repo,
  Repositories,
  SettingsRepo,
} from '@cuplog/services';
import type { Table } from 'dexie';
import { openDb, type CupLogDb, type DbOptions } from './db';

const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

class DexieRepo<T extends RecordMeta> implements Repo<T> {
  protected readonly table: Table<T, string>;

  constructor(table: Table<T, string>) {
    this.table = table;
  }

  async get(ownerId: string, id: string): Promise<T | undefined> {
    const r = await this.table.get(id);
    return r && r.ownerId === ownerId ? r : undefined;
  }

  async list(ownerId: string, opts: ListOptions = {}): Promise<T[]> {
    const rows = await this.table.where('ownerId').equals(ownerId).toArray();
    return rows.filter((r) => opts.includeDeleted || !r.deletedAt).sort(byId);
  }

  async put(record: T): Promise<void> {
    await this.table.put(record);
  }

  async clear(ownerId: string): Promise<void> {
    await this.table.where('ownerId').equals(ownerId).delete();
  }
}

class DexieRatingRepo extends DexieRepo<Rating> implements RatingRepo {
  async find(ownerId: string, f: RatingFilter): Promise<Rating[]> {
    let rows: Rating[];
    if (f.bagId) rows = await this.table.where('[ownerId+bagId]').equals([ownerId, f.bagId]).toArray();
    else if (f.productId) rows = await this.table.where('[ownerId+productId]').equals([ownerId, f.productId]).toArray();
    else if (f.venueId) rows = await this.table.where('[ownerId+venueId]').equals([ownerId, f.venueId]).toArray();
    else rows = await this.table.where('ownerId').equals(ownerId).toArray();
    const since = f.since ? Date.parse(f.since) : null;
    return rows
      .filter(
        (r) =>
          (f.includeDeleted || !r.deletedAt) &&
          (!f.bagId || r.bagId === f.bagId) &&
          (!f.productId || r.productId === f.productId) &&
          (!f.venueId || r.venueId === f.venueId) &&
          (since === null || Date.parse(r.ratedAt) >= since),
      )
      .sort(byId);
  }
}

class DexieBagRepo extends DexieRepo<Bag> implements BagRepo {
  async listByProduct(ownerId: string, productId: string): Promise<Bag[]> {
    const rows = await this.table.where('[ownerId+productId]').equals([ownerId, productId]).toArray();
    return rows.filter((r) => !r.deletedAt).sort(byId);
  }
}

class DexieSettingsRepo implements SettingsRepo {
  readonly #db: CupLogDb;
  constructor(db: CupLogDb) {
    this.#db = db;
  }
  async get(ownerId: string): Promise<DomainSettings | undefined> {
    return (await this.#db.settings.get(ownerId))?.settings;
  }
  async put(ownerId: string, settings: DomainSettings): Promise<void> {
    await this.#db.settings.put({ ownerId, settings });
  }
  async clear(ownerId: string): Promise<void> {
    await this.#db.settings.delete(ownerId);
  }
}

class DexieDeviceRepo implements DeviceStateRepo {
  readonly #db: CupLogDb;
  constructor(db: CupLogDb) {
    this.#db = db;
  }
  async get<T>(key: string): Promise<T | undefined> {
    return (await this.#db.device.get(key))?.value as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await this.#db.device.put({ key, value });
  }
}

export class DexieMediaStore implements MediaStore {
  readonly #db: CupLogDb;
  constructor(db: CupLogDb) {
    this.#db = db;
  }
  async put(ownerId: string, id: string, blob: Blob): Promise<void> {
    await this.#db.media.put({ ownerId, id, blob });
  }
  async get(ownerId: string, id: string): Promise<Blob | undefined> {
    return (await this.#db.media.get([ownerId, id]))?.blob;
  }
  async delete(ownerId: string, id: string): Promise<void> {
    await this.#db.media.delete([ownerId, id]);
  }
}

export interface DexieRepositories extends Repositories {
  db: CupLogDb;
  media: MediaStore;
}

/** IndexedDB adapter for all repositories (README §8.1 "storage-dexie"). */
export function createDexieRepos(opts: DbOptions = {}): DexieRepositories {
  const db = openDb(opts);
  return {
    db,
    ratings: new DexieRatingRepo(db.ratings),
    products: new DexieRepo(db.products),
    bags: new DexieBagRepo(db.bags),
    venues: new DexieRepo(db.venues),
    settings: new DexieSettingsRepo(db),
    device: new DexieDeviceRepo(db),
    media: new DexieMediaStore(db),
    uow: {
      run: (fn) => db.transaction('rw', [db.products, db.bags, db.ratings, db.venues, db.settings, db.device], fn),
    },
  };
}
