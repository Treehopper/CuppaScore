import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SCHEMA_PATH, schemaText } from './schema';

it('catalog.schema.json is up to date (run `pnpm --filter @cuplog/catalog-builder run schema`)', () => {
  expect(readFileSync(SCHEMA_PATH, 'utf8')).toBe(schemaText());
});
