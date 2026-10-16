import { Dexie, type Table } from 'dexie';
import type { Bag, DomainSettings, Product, Rating, Venue } from '@cuplog/core';

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
export const DB_VERSION = 1;

export type CupLogDb = Dexie & {
  products: Table<Product, string>;
  bags: Table<Bag, string>;
  ratings: Table<Rating, string>;
  venues: Table<Venue, string>;
  settings: Table<SettingsRow, string>;
  device: Table<DeviceRow, string>;
  media: Table<MediaRow, [string, string]>;
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
  return db;
}
