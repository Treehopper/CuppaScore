import { Dexie, type Table } from 'dexie';
import { roastLevelFrom5, type Bag, type CatalogProduct, type DomainSettings, type Product, type Rating, type Venue } from '@cuplog/core';

export interface SettingsRow {
  ownerId: string;
  settings: DomainSettings;
}

export interface DeviceRow {
  key: string;
  value: unknown;
}

export interface MediaRow {
  ownerId: string;
  id: string;
  blob: Blob;
}

/** Current IndexedDB schema version. Migrations are forward-only (README §14.3). */
export const DB_VERSION = 3;

export type CupLogDb = Dexie & {
  products: Table<Product, string>;
  bags: Table<Bag, string>;
  ratings: Table<Rating, string>;
  venues: Table<Venue, string>;
  settings: Table<SettingsRow, string>;
  device: Table<DeviceRow, string>;
  media: Table<MediaRow, [string, string]>;
  catalog: Table<CatalogProduct, string>;
};

export interface DbOptions {
  name?: string;
  /** For tests / non-browser runtimes (fake-indexeddb). */
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
}

export function openDb(opts: DbOptions = {}): CupLogDb {
  const db = new Dexie(opts.name ?? 'cuplog', {
    ...(opts.indexedDB ? { indexedDB: opts.indexedDB } : {}),
    ...(opts.IDBKeyRange ? { IDBKeyRange: opts.IDBKeyRange } : {}),
  }) as CupLogDb;
  db.version(1).stores({
    products: 'id, ownerId',
    bags: 'id, ownerId, [ownerId+productId]',
    ratings: 'id, ownerId, [ownerId+bagId], [ownerId+productId], [ownerId+venueId]',
    venues: 'id, ownerId',
    settings: 'ownerId',
    device: 'key',
    media: '[ownerId+id]',
  });
  // v2: roast level 1–5 → 1–3 (owner feedback F3)
  db.version(2).upgrade((tx) =>
    tx
      .table<Product, string>('products')
      .toCollection()
      .modify((p) => {
        p.roastLevel = roastLevelFrom5(p.roastLevel);
      }),
  );
  // v3: catalog products from the region CSV (F4)
  db.version(3).stores({ catalog: 'id' });
  return db;
}
