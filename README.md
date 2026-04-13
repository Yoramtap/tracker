# Tracker

This repo has one job: regenerate committed dashboard snapshots and publish a static site from them.

## Repo Story

- `data/`: committed public snapshot contract
- `app/`: dashboard UI that reads only from `data/`
- `app/dashboard-app/`: feature modules and browser/runtime dependency bridge for the dashboard app
- `scripts/`: core fetch, derive, validate, and build pipeline
- `scripts/dev/`: optional operator and debugging helpers
- `dev/`: local preview-only runtime support
- `.cache/`: disposable local state and analysis output
- `dist/`: generated GitHub Pages artifact

## Which doc to use

- Use this file for setup, security, and the main commands.
- Use `docs/release.md` for manual refresh + live publish steps.

## Security

- The repo can be public.
- The Jira API token must never be committed.
- NEP GitHub access must stay local and read-only.
- Keep Jira credentials only in `.env.backlog` or `.env.local`.
- Keep NEP GitHub access in local `gh` auth for `yoram-tap_nepgroup`; do not commit tokens and do not rely on GitHub Actions secrets for PR refreshes.
- `.env*`, `node_modules/`, `.cache/`, and `dist/` are ignored locally.

## Local Setup

```bash
npm install
npm run auth:setup -- --email "you@company.com"
```

Run commands from the repo root. The repo is pinned to Node 22 via `.nvmrc` / `.node-version`, so switch your shell to Node 22 before installing. The setup helper prompts for the Jira API token securely and writes a local `.env.backlog` file that stays ignored.

Optional Jira site override:

```bash
npm run auth:setup -- --email "you@company.com" --site "your-site.atlassian.net"
```

## Core Commands

```bash
npm run data:refresh
npm run data:validate
npm run build
```

What they do:

- `data:refresh`: refreshes Jira-backed backlog/UAT/stage data and GitHub-backed PR activity
- `data:validate`: enforces the committed snapshot contract
- `build`: builds the public Pages artifact into `dist/`

Operator helpers:

- `npm run data:refresh:clean`
- `npm run dev:refresh:pr-cycle`
- `npm run dev:refresh:pr-activity`
- `npm run dev:refresh:product-cycle`
- `npm run dev:refresh:uat`
- `npm run dev:analyze`
- `npm run dev:publish -- --refresh yes --message "Refresh dashboard data" --push`
- `npm run automation:bootstrap`
- `npm run automation:preflight`
- `npm run automation:weekly-refresh`

Use `dev:publish` only as a convenience helper when the repo is already clean. The canonical release instructions live in `docs/release.md`.

## Cache Behavior

- Local refresh caches live under `.cache/`.
- Default refreshes may reuse local PR activity cache, archived snapshot history, and Business Unit done-cache state.
- `npm run data:refresh:clean` bypasses those local caches for the current run and rebuilds fresh cache artifacts afterward.
- Use clean refreshes for debugging, CI, or whenever you want a reproducible run that is less dependent on local state.

## Optional Analysis

```bash
npm run dev:analyze
```

- Writes a local operator note to `.cache/analysis/latest-analysis.md`
- Archives older copies under `.cache/analysis/history/`
- Does not affect the product contract or GitHub Pages publish

## Local Preview

```bash
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Release Flow

Read [docs/release.md](docs/release.md) before shipping.

- Manual release steps are in [docs/release.md](docs/release.md).
- Dashboard data refresh is local-only.
- Weekly local automation is the recommended way to keep snapshots fresh.
- Run automation from a dedicated local checkout, not from an ephemeral Codex worktree.

## GitHub Pages

- GitHub Pages deploys from this repo via [.github/workflows/pages.yml](.github/workflows/pages.yml).
- The workflow runs `npm ci` and `npm run build`, then publishes `dist/`.
- There is no GitHub-hosted data refresh workflow anymore.
- The live site stays publicly accessible for Confluence embedding.

## Notes

- `index.html` in the repo is the source entrypoint.
- `app/dashboard-app.js` is now the app bootstrap/composition entry; feature slices live under `app/dashboard-app/`.
- The public Pages artifact is built from source; `dist/` is not committed.
- Current published snapshots remain in-repo under `data/`, and local caches plus snapshot archives stay under `.cache/`.
- Analysis output is disposable and stays under `.cache/analysis/`.
- Hand-authored release/docs material live under `docs/`.
