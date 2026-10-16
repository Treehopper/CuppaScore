# CupLog — progress

Autopilot memory between sessions. The spec is `README.md`, the working rules are in `CLAUDE.md`.
Tick a task only after the full verification (CLAUDE.md) is green.

## Next up
- Task 9 (export/import).

## M1 — MVP
- [x] 1. Monorepo scaffold: pnpm workspace, TS strict base config, empty packages (core, services, api, storage-dexie, catalog-static, contract-tests), Vite + Svelte 5 PWA shell with hash routing, root scripts (`check`, `test`, `build`, `test:e2e`, `catalog:build`), ESLint, dependency-cruiser layer rules, i18n key check stub, Playwright smoke test, `BASE_PATH` support
  - note: TypeScript pinned to 6.0.3 (typescript-eslint/svelte-check don't support TS 7 yet); pnpm 12 uses `allowBuilds` in pnpm-workspace.yaml; workspace packages export `src/index.ts` directly (no package build step); in-place `sed -i` fails on this mount, use python/Edit
- [x] 2. PWA plumbing: vite-plugin-pwa (manifest from BASE_PATH, icons incl. maskable + apple-touch, `registerType: "prompt"` + update banner), iOS meta, safe areas, version stamp, offline e2e
  - note: icons rendered from `public/icons/icon.svg` by `node scripts/gen-icons.ts` (Chromium); iOS splash screens deferred to task 38; update banner not e2e-tested (needs two builds)
- [x] 3. Core entities: zod schemas for Product, Bag, Rating (3 levels, home/café), Venue, settings; sync fields; `Clock`/`IdGenerator`/`rng` ports; UUIDv7; timeOfDay buckets; `derived` fields
  - note: ids are plain UUIDv7 (no `prod_` prefixes); preset link stored as deterministic `presetKey`; DST-gap times shift forward (Temporal "compatible"); method params are a discriminated union (`kind: aeropress|flairNeo`)
- [x] 4. Core stats: preference mapping `(p, c)` (§5.1 fixed mapping), mean/median/trimmed mean/spread, MAD outlier exclusion (§5.2), with fast-check property tests
  - note: `aggregate()` already includes recency weighting (§5.3) and accepts a `Calibration` (personal centring/swipe calibration computed in task 23); core exports `@cuplog/core/testing` fixtures
- [x] 5. Core presets: derive presets from rating history, ranking (§4.5), hide finished/expired bags, pinned first
  - note: recency half-life 3 days; frequency = uses in 30 d normalised to the top preset; pins stored in `DomainSettings.pinnedPresets`
- [x] 6. Services: port interfaces + use cases (products, bags, venues, ratings CRUD + exclude, presets, bag/product stats), in-memory repos for tests
  - note: `CupLogService` class; logging from an unopened bag sets `openedAt`; finished bags reject new cups (`BAG_FINISHED`); café cups get `productId` only when `beanKnown` is one of our product ids (C10); soft delete + `restoreRating` for Undo
- [x] 7. storage-dexie adapter + repository contract tests (fake-indexeddb); in-memory adapter passes the same suite
  - note: contract suite in `@cuplog/contract-tests` (`describeRepositoryContract`); memory adapter is non-atomic (flagged); `typecheck` runs with `--no-sort` because of a dev-only workspace cycle (contract-tests ↔ storage-dexie/api)
- [x] 8. `@cuplog/api`: DTO zod schemas, `CupLogApi`, `LocalApi` (in-process + Web Worker via Comlink), `subscribe`, API contract tests
  - note: transport is one generic `call(method,args) → Result` (Comlink now, HTTP later); errors cross as `ApiError{code,details}`; `subscribe` is client-side (topics emitted after successful commands, `COMMAND_TOPICS`); `@cuplog/api` = UI entry (no storage code), `@cuplog/api/local` = in-process backend; worker bundle ~224 kB
- [ ] 9. Export/import (JSON bundle with `schemaVersion`, merge/replace) + ratings CSV
- [ ] 10. Themes: 4 themes + System (light/dark pairing), semantic tokens, runtime `theme-color`, WCAG AA contrast test in `check`
- [ ] 11. i18n: de/en/it/es + `en-XA` pseudo-locale, detection, ICU plurals, Intl formatting, missing-key check in `check`
- [ ] 12. App shell: nav, hash routes, Settings screen (theme, language, owned methods, default rating level, about/version)
- [ ] 13. Products & bags UI: add product, add bag, bag list by status, bag detail (stats, timeline, excluded outliers), freshness/expiry badges, open/finish bag
- [ ] 14. Quick Log (home): preset chips, Bag ▾ / Method ▾, Stars level, meal, Save + Undo toast
- [ ] 15. Quick Log levels: Swipe card (drag + 👎/👍 buttons + Undo), Detail level (strength, profile + wish, tags, would-buy-again), brew details incl. AeroPress & Flair NEO params, level remembered per preset
- [ ] 16. Café mode: venues, drink/milk/size/bean/price, "Same as last time here", venue list
- [ ] 17. Ratings history: edit/delete, "not representative" flag; export/import UI
- [ ] 18. M1 wrap-up: installability/offline check, `navigator.storage.persist()`, products ranking screen, a11y pass

## M1b — Reminders & install
- [ ] 19. Core reminders: `dueReminders`, `nextDueAt`, `applyAction` with table-driven tests (TZ, DST, quiet hours, pause, snooze)
- [ ] 20. Services/API reminders: rules config, activity, state, `checkReminders`, `ackReminder`, `getNextReminders`
- [ ] 21. Welcome flow (hello, install guidance Android/iOS, gear & rating style, reminders, skip) + `onboardingCompletedAt`
- [ ] 22. Reminder banner (merge, Log now / Later / Not today), timer + foreground checks, reminders in Settings, `.ics` export

## M2 — Insights
- [ ] 23. Core: time-weighted score (§5.3), personal star centring + swipe calibration (§5.1)
- [ ] 24. Core: context model (weighted ridge, §5.4) + freshness curve
- [ ] 25. Services/API: `getInsights`, richer stats DTOs (per method, sparkline data, best meal pairing)
- [ ] 26. Stats screen + bag trend chart, meal & time-of-day analysis, cost per cup, venue ranking

## M3 — Catalog
- [ ] 27. Catalog schema (zod + JSON Schema), `catalog-static` adapter, `searchCatalog`, service-worker caching of `catalog.json`
- [ ] 28. Catalog builder: sellers.yml, Shopify/Woo/JSON-LD adapters (fixture-tested), normalisation, flavour lexicon, sensory priors, dedupe, validation, diff summary
- [ ] 29. Add bag from catalog (prefill) + barcode scanning
- [ ] 30. Catalog update detection (E3)

## M4 — Recommendations
- [ ] 31. Core: feature vectors (§7.1) + taste profile (§7.2)
- [ ] 32. Core: recommender scoring, explanations, exploration slot (§7.3–7.4)
- [ ] 33. Services/API: `getRecommendations`, wishlist, dismiss, filters
- [ ] 34. Discover screen

## M5 — Polish
- [ ] 35. Context-specific recommendations (D4) in core + UI
- [ ] 36. Reminder polish: pause until, quiet hours UI, one-time later prompt, monthly export reminder, optional badge
- [ ] 37. Onboarding taste quiz (cold start, §7.4)
- [ ] 38. Final polish: Lighthouse config, pseudo-locale overflow pass, a11y

## Decisions (README §17 and other gaps)
_(none yet)_

## Blocked / needs owner
_(none yet)_
