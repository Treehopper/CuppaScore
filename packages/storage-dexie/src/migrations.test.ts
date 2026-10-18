import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { Dexie } from 'dexie';
import { makeProduct } from '@cuplog/core/testing';
import { expect, it } from 'vitest';
import { DB_VERSION, openDb } from './db';

it('v1 → v2 maps roast level 1–5 to 1–3 and leaves everything else alone', async () => {
  const indexedDB = new IDBFactory();
  const old = new Dexie('m', { indexedDB, IDBKeyRange });
  old.version(1).stores({ products: 'id, ownerId' });
  await old.open();
  const levels = [1, 2, 3, 4, 5, null];
  await old.table('products').bulkPut(levels.map((roastLevel, i) => ({ ...makeProduct({ id: `p${i}` }), roastLevel })));
  old.close();

  const db = openDb({ name: 'm', indexedDB, IDBKeyRange });
  await db.open();
  expect(db.verno).toBe(DB_VERSION);
  const rows = await db.products.orderBy('id').toArray();
  expect(rows.map((p) => p.roastLevel)).toEqual([1, 1, 2, 3, 3, null]);
  expect(rows[0]!.name).toBe('Ethiopia Guji Natural');
  db.close();
});
