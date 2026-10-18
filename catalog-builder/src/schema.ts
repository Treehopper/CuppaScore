// Writes the catalog JSON Schema (README §6.3 step 7) next to the builder:
//   pnpm --filter @cuplog/catalog-builder run schema
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalogJsonSchema } from '@cuplog/core';

export const SCHEMA_PATH = fileURLToPath(new URL('../catalog.schema.json', import.meta.url));

export function schemaText(): string {
  return `${JSON.stringify(catalogJsonSchema(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(SCHEMA_PATH, schemaText());
  console.log(`wrote ${SCHEMA_PATH}`);
}
