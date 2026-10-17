# CupLog — progress

Autopilot memory between sessions. The spec is `README.md`, the working rules are in `CLAUDE.md`.
Tick a task only after the full verification (CLAUDE.md) is green.

## Next up
- Task 26 (Stats screen: insights UI + bag trend chart, meal & time-of-day analysis, cost per cup, venue ranking). Read README §9.3 item 3 and use the dataviz skill for charts.

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
- [x] 9. Export/import (JSON bundle with `schemaVersion`, merge/replace) + ratings CSV
  - note: bundle includes soft-deleted records; merge keeps higher `rev` (then later `updatedAt`); photos/media not in the bundle yet; CSV guards against formula injection
- [x] 10. Themes: 4 themes + System (light/dark pairing), semantic tokens, runtime `theme-color`, WCAG AA contrast test in `check`
  - note: contrast rules: text/muted 4.5:1 on bg+surface, `--on-accent` 4.5:1 on accent, accent/accent-2/star/good/bad 3:1 (non-text, WCAG 1.4.11); several README colours nudged in lightness (see comments in `themes.css`); `scripts/svelte-autofix.sh` runs the svelte-autofixer CLI over all components; MCP previews via `scripts/mcp-preview.sh` (:4174)
- [x] 11. i18n: de/en/it/es + `en-XA` pseudo-locale, detection, ICU plurals, Intl formatting, missing-key check in `check`
  - note: own runes-based i18n on `intl-messageformat` (`src/i18n/`), not svelte-i18n (store-based, conflicts with the runes rule); pseudo-locale transforms the formatted output; `i18n:check` also validates ICU syntax and literal `t('…')` keys; add keys to all locales with `scripts/i18n-add.py` (`key | en | de | it | es` per line on stdin)
- [x] 12. App shell: nav, hash routes, Settings screen (theme, language, owned methods, default rating level, about/version)
  - note: `query(fn, topics)` re-fetches on reactive deps and API topics; vocab lists come from `@cuplog/core/vocab` (zod-free) re-exported by `@cuplog/api`; pseudo-locale option shown in dev or with `?pseudo`; MCP browser keeps the old SW → unregister SW + caches before visual checks
- [x] 13. Products & bags UI: add product, add bag, bag list by status, bag detail (stats, timeline, excluded outliers), freshness/expiry badges, open/finish bag
  - note: API transport JSON-normalises args (Svelte `$state` proxies can't be postMessage'd); edit forms get `initial` from an `{#await}` in App and copy it with `untrack`; `e2e/layout.spec.ts` guards against horizontal overflow at 360 px
- [x] 14. Quick Log (home): preset chips, Bag ▾ / Method ▾, Stars level, meal, Save + Undo toast
  - note: `StarInput` is a keyboard slider (half steps); tapping the left 40 % of a star gives a half star; coffee themes draw beans; swipe level has 👎/👍 buttons only so far (drag card is task 15); café mode shows a placeholder until task 16; `e2e/helpers.ts` `addBag()` for reuse
- [x] 15. Quick Log levels: Swipe card (drag + 👎/👍 buttons + Undo), Detail level (strength, profile + wish, tags, would-buy-again), brew details incl. AeroPress & Flair NEO params, level remembered per preset
  - note: form ↔ Brew/rating conversion is pure in `lib/logForm.ts` (unit-tested); brew edits are an overlay keyed by preset, otherwise the preset's `lastBrew` is shown; profile uses 1–5 tap scales (unset is possible) rather than range sliders; `main` reserves room for nav + toast so the last control is never stuck under a toast
- [x] 16. Café mode: venues, drink/milk/size/bean/price, "Same as last time here", venue list
  - note: Quick Log lives in `pages/log/` (LogPage → HomeLog / CafeLog on shared `RatingPanel` + `PresetChips`, saving via `lib/logCup.ts`); new venues are created inline on first save (name only); "Same as last time" uses `venue.lastDrink` (timestamps have second precision); venue list at `#/venues` (linked from café mode) — nearest-first venue sorting skipped (no location permission yet); only one "Cup saved" toast at a time
- [x] 17. Ratings history: edit/delete, "not representative" flag; export/import UI
  - note: `#/ratings` (History link in the Log header) and `#/ratings/:id` edit page incl. meal note (B6), time + time-of-day override (B5); `updateRating` patches clear optional level fields with `null` (undefined is dropped by the JSON transport); `ratedAt` may be sent as wall-clock `YYYY-MM-DDTHH:MM` and is stored zoned in the settings tz (`parseDateTimeInZone` in core); backup in Settings uses native `confirm()` for replace; toasts are single (newest replaces)
- [x] 18. M1 wrap-up: installability/offline check, `navigator.storage.persist()`, products ranking screen, a11y pass
  - note: `e2e/a11y.spec.ts` runs axe (WCAG 2.x A/AA) on every screen in all 4 themes; persistence is requested after the first saved cup (Firefox may prompt) and shown/requestable in Settings → Backup; products ranking + bag-to-bag comparison already came with task 13; Lighthouse in CI is still task 38. **M1 complete.**

## M1b — Reminders & install
- [x] 19. Core reminders: `dueReminders`, `nextDueAt`, `applyAction` with table-driven tests (TZ, DST, quiet hours, pause, snooze)
  - note: `core/reminders.ts`; instants are epoch ms, `applyAction(state, ruleId, action, nowMs, tz)`; per-rule state `{snoozedUntil, dismissedOn, handledAt}` (`handledAt` silences unconditional rules after logging; README's `shownOn` dropped); `nextDueAt` rounds up to whole seconds (timer would otherwise spin); `mergeDue` builds the one-banner view
- [x] 20. Services/API reminders: rules config, activity, state, `checkReminders`, `ackReminder`, `getNextReminders`
  - note: `DomainSettings.reminders` (+ `reminderState`), evaluated in `settings.timeZone` (the UI should keep it = device zone for travel, F7 — task 22); `logRating` acks every rule due at that moment (`logged`), so it also emits `settings`; `getNextReminders` = per-rule next time; a11y e2e blocks the SW (was flaky under load with `networkidle`)
- [x] 21. Welcome flow (hello, install guidance Android/iOS, gear & rating style, reminders, skip) + `onboardingCompletedAt`
  - note: `#/welcome` (nav hidden); redirect only when the app opens at the root route and onboarding isn't complete — deep links/shortcuts/e2e skip it; `lib/install.svelte.ts` captures `beforeinstallprompt` in main.ts; "Not now" on reminders sets `remindersDeclinedAt` (later prompt = task 36); the `.ics` link on the reminders card comes with task 22; taste quiz card = task 37
- [x] 22. Reminder banner (merge, Log now / Later / Not today), timer + foreground checks, reminders in Settings, `.ics` export
  - note: banner is global (above every page except welcome), not only on Quick Log, so F5b works anywhere; "Log now" hides the banner and opens Quick Log — saving acks; timer capped at 1 h; app syncs `settings.timeZone` to the device zone on start; the API worker's clock follows the page clock per call (`followerClock`), which lets e2e use `page.clock`; `.ics` uses floating local time; Settings edits the 6 suggested rules (no add/delete yet) — quiet hours/pause UI = task 36. **M1b complete.**

## M2 — Insights
- [x] 23. Core: time-weighted score (§5.3), personal star centring + swipe calibration (§5.1)
  - note: `computeCalibration` (core/calibration.ts); star sd floored at 0.5★ (decision); `aggOpts()` computes it over all ratings for every score; recency weighting already lived in `aggregate()`
- [x] 24. Core: context model (weighted ridge, §5.4) + freshness curve
  - note: `fitContextModel` (core/context.ts), Cholesky normal equations, λ = 2, only μ unpenalised; freshness = hat basis at knots 0/7/21/42/63 days (`freshnessAt` interpolates); effects are raw ridge coefficients (compare within a group); interaction terms (≥ 50 ratings) not implemented yet
- [x] 25. Services/API: `getInsights`, richer stats DTOs (per method, sparkline data, best meal pairing)
  - note: `services/insights.ts` (`buildInsights`, pure); context model only from 8 cups; `StatsView.best` = top method / food pairing with ≥ 2 cups (none/unspecified aren't pairings); `bagCostPerCup` in core (finished: price/cups, else weight/avg dose); sparkline data = existing `summary.series`
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
- Personal star spread is floored at 0.5★ so a very consistent rater's half star doesn't jump to the full ±1.
- Reminder banner sits above every screen (README says top of Quick Log) so a reminder that comes due while another screen is open still shows (F5b).
- Welcome flow appears only on a root launch (homescreen `start_url`, plain URL) without `onboardingCompletedAt`; deep links never redirect, so shortcuts and shared links open what they point to.
- Reminders: `pausedUntil` is the date reminders *resume* (exclusive); `bagExpiring` is due every day from N days before through the expiry date (soonest bag shown); `afterLastLog` fires at max(last+hours, window start) on the same local day and only inside its window; a rule pushed past midnight by quiet hours is dropped (today-only catch-up).
- Theme colours: README §10 demands both the official Solarized values and WCAG AA for all text pairs, which conflict; kept hues, nudged lightness of failing tokens (themes.css), added `--on-accent`.
- i18n library: README §11 suggests svelte-i18n; CLAUDE.md forbids Svelte 4 stores → small own runes wrapper over `intl-messageformat` (same ICU format, swappable).

## Blocked / needs owner
_(none yet)_
