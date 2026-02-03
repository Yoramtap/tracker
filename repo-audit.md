# Repo Audit (Quick Pass)

Date: 2026-02-03

## Snapshot
- Top level is a Ralph/Codex automation repo plus a Next.js app in `web/`.
- Core workflow files: `prd.json`, `progress.txt`, `tasks/`, `archive/`, `scripts/`, `workflows/`, `AGENTS.md`.
- App code is small: 19 files under `web/src/`, using the App Router.

## Build/Run Pipeline
- `web/` uses Next.js `16.1.6`, React `19.2.3`, TypeScript `^5`.
- Dev/build/lint are in `web/package.json` (`dev`, `build`, `start`, `lint`).
- Typecheck is centralized at root: `scripts/typecheck.sh` runs `web/node_modules/.bin/tsc --noEmit`.
- No tests configured at repo level.

## Structure Observations
- Content/data is centralized in `web/src/app/blog/posts.ts` and `web/src/app/prds/data.ts` (PRDs parsed from `../tasks`).
- `tasks/` drives PRD cards; moving a PRD out of `tasks/` hides it from the site.
- There are `.DS_Store` files inside `web/src/` and `web/src/app/`.
- `.gitignore` does not include `web/node_modules` or `web/.next`.

## Documentation Drift
- Skills now live in `~/.codex/skills`; repo docs should point there (updated).

## Simplification Candidates (Low risk first)
1. Ignore build artifacts and local OS files
   - Add `web/node_modules/`, `web/.next/`, `web/src/.DS_Store`, `web/src/app/.DS_Store` to `.gitignore`.
   - Delete current `.DS_Store` files from `web/src/`.
2. Align README with reality
   - Point skills guidance to `~/.codex/skills` (updated).
3. Unify entrypoints
   - Add `web` scripts in root `package.json` (or a root `make`/`just` file) so “dev/build/lint/typecheck” live in one place.
4. Data/content organization
   - Move `posts.ts` and PRD parsing utilities into a `web/src/data/` or `web/src/content/` folder for clearer separation from route components.
5. Repo boundaries
   - Optionally move Ralph tooling (`scripts/`, `workflows/`, `tasks/`, `archive/`) into a `ralph/` subdir if you want the app to stand alone.
