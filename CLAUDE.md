# CupLog — notes for Claude

`README.md` is the product spec and the source of truth (data model §4, aggregation §5,
architecture §8, CI/deploy §14, repo layout §15, milestones §16). Read the relevant section
before implementing a feature; don't re-read all 900 lines every time.

## Environment
- You run inside `.devcontainer` (Debian, Node 24, pnpm, user `node`), usually with
  permissions bypassed. Outbound network is **allowlisted** (`.devcontainer/allowed-domains.txt`).
  If a fetch/install fails with "connection refused"/"EHOSTUNREACH", the host is not
  allowlisted — don't work around it; note it in `PROGRESS.md` and continue with something else.
  You cannot change the firewall from inside the container.
- Playwright browsers are preinstalled in `/ms-playwright` for Playwright **1.64.1**. Pin
  `@playwright/test` to exactly `1.64.1` so no download is needed.
- Dev servers must listen on all interfaces so the host can reach them:
  `vite dev --host 0.0.0.0 --port 5173`, `vite preview --host 0.0.0.0 --port 4173`.
- Chromium in the container needs no sandbox flags for `@playwright/test`; `/dev/shm` is 2 GB.

## Docs
- Svelte / SvelteKit: use the `svelte` MCP server (`list-sections`, `get-documentation`,
  `svelte-autofixer`), or fetch `https://svelte.dev/llms-full.txt`. Write **Svelte 5 runes**
  (`$state`, `$derived`, `$effect`, `$props`), never Svelte 4 stores/`export let` syntax.
  Run `svelte-autofixer` on every new component until it reports no issues.
- Others: vite.dev, vitest.dev, playwright.dev, dexie.org, zod.dev, vite-pwa-org.netlify.app.

## Stack & conventions (from README §8, §15)
- pnpm workspaces, TypeScript strict, Vite + Svelte 5 (plain Vite SPA with **hash routing**,
  not SvelteKit server routes — GitHub Pages is static), zod, Dexie, Comlink, vite-plugin-pwa.
- Root `package.json` must set `"packageManager": "pnpm@<version>"` and expose these scripts,
  which CI calls (`.github/workflows/ci.yml`):
  - `check` — lint + typecheck + svelte-check + dependency-cruiser layer rules + i18n key check
  - `test` — Vitest unit/contract tests (all packages)
  - `build` — production build; honours `BASE_PATH` env (`/CuppaScore/` in production) for Vite `base`,
    manifest `start_url`/`scope`/`id` and `catalog.json` URL
  - `test:e2e` — Playwright against `vite preview` (use `webServer` in playwright.config)
  - `catalog:build` — catalog builder (§6.3)
- `packages/core` must stay pure: no DOM, no `fetch`, no `Date.now()`/`Math.random()`
  (inject `Clock`/`rng`). `apps/pwa` imports only `@cuplog/api`.

## Verification — do this before calling anything done
1. `pnpm run check && pnpm test`
2. `pnpm run build && pnpm run test:e2e`
3. For UI work, open the running preview with the `playwright` MCP server, click through the
   flow, and take a screenshot at phone width (390×844) in at least one dark and one light theme.

## Working style in autopilot
- Keep `PROGRESS.md` current: milestone checklist, what's done, what's next, blockers,
  open decisions you made (with the README §17 question they answer). It is your memory
  between sessions.
- `develop` is the only branch (single-user repo, no `main`, no feature branches). Make small
  commits directly on `develop` with conventional messages (`feat(core): …`). Never push,
  force-push or rewrite history unless explicitly asked — every push to `develop` deploys.
- When the spec leaves a question open (§17), pick the simplest option that keeps the other
  option possible, record it in `PROGRESS.md`, and move on.
