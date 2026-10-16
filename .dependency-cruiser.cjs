/** Layer rules from README §8.1 / §15. */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      comment: 'core imports nothing outside itself except zod',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: {
        pathNot: ['^packages/core/src', 'node_modules/zod/', 'node_modules/\\.pnpm/zod@'],
      },
    },
    {
      name: 'services-only-core',
      comment: 'services depend on core and port interfaces only, never on adapters',
      severity: 'error',
      from: { path: '^packages/services/src' },
      to: {
        pathNot: ['^packages/(services|core)/src', 'node_modules/zod/', 'node_modules/\\.pnpm/zod@'],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'adapters-not-api-or-ui',
      severity: 'error',
      from: { path: '^packages/(storage-dexie|catalog-static)/src' },
      to: { path: '^(packages/api|apps)/' },
    },
    {
      name: 'pwa-only-api',
      comment: 'apps/pwa may only import @cuplog/api from the backend side',
      severity: 'error',
      from: { path: '^apps/pwa/src' },
      to: {
        path: ['^packages/(?!api/)', 'node_modules/(dexie|comlink)/', 'node_modules/\\.pnpm/(dexie|comlink)@'],
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.test\\.ts$|/e2e/|/dist/)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types', 'svelte'],
      mainFields: ['module', 'main', 'types', 'svelte'],
      extensions: ['.ts', '.js', '.svelte', '.json'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
