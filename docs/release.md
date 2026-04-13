# Release Guide

## Local Auth Preflight

Before any refresh that touches PR activity:

```bash
gh auth status -h github.com
```

Expected operating model:

- Jira credentials live only in ignored local env files
- `yoram-tap_nepgroup` stays read-only and is used only through local `gh` auth
- PR refreshes are run locally, not from GitHub Actions

## Runtime and Checkout

- Use Node 22 for local installs and CI. The repo pins this via `.nvmrc` / `.node-version`.
- On this machine, the automation scripts invoke the Homebrew Node 22 binary directly from `/opt/homebrew/opt/node@22/bin/node`.
- Run the weekly automation from a dedicated local checkout, not from an ephemeral Codex worktree.
- Bootstrap that checkout once from your main repo:

```bash
npm run automation:bootstrap
```

- The default bootstrap target is a sibling checkout such as `../tracker-automation`.
- After bootstrapping, point the Codex automation at that persistent checkout and use `execution_environment = "local"`.
- Sanity-check the automation checkout at any time with:

```bash
npm run automation:preflight
```

## Default Local Refresh

```bash
npm run data:refresh
npm run data:validate
npm run build
```

Use this when you want the normal incremental refresh path.

This command refreshes:

- Jira-backed backlog, UAT, and PR cycle stage timing
- GitHub-backed PR activity, using local `gh` auth for `nepgpe`

## Clean Refresh

```bash
npm run data:refresh:clean
npm run data:validate
npm run build
```

Use this when you want a reproducible run that ignores existing local refresh caches for the current execution.

`data:refresh:clean` does all of the following for that run:

- bypasses `pr-activity-issue-cache.json` reads
- skips PR activity history reuse from archived snapshots
- skips PR cycle window reuse from prior snapshot data
- forces a rebuild of the Business Unit done cache

It still writes fresh cache artifacts afterward.

## Optional Analysis

```bash
npm run dev:analyze
```

This writes a local operator note to `.cache/analysis/latest-analysis.md` and archives older copies under `.cache/analysis/history/`. It is not part of the product publish path.

## Cache Locations

- `.cache/pr-activity-issue-cache.json`: PR detail cache
- `.cache/business-unit-uat-done-cache.json`: Business Unit done-flow cache
- `.cache/snapshots/`: archived canonical snapshot history

## Publish Helper

```bash
npm run dev:publish -- --refresh yes --clean --message "Refresh dashboard data" --push
```

Use `--clean` when you want the publish helper to refresh from Jira and GitHub without depending on old local caches.

The helper now:

- verifies you are in a full local checkout on `main`
- validates snapshots before building
- treats the build as a verification gate only
- commits only tracked dashboard snapshot files under `data/`

## Weekly Local Automation

Recommended schedule:

- Monday 09:00 in your local timezone (`Europe/Amsterdam`)
- Run `npm run automation:weekly-refresh`
- Keep the automation pinned to the dedicated local checkout created by `npm run automation:bootstrap`
- If preflight fails, fix the checkout first instead of letting the refresh run for several minutes and fail late

## GitHub Automation

- `.github/workflows/pages.yml` deploys GitHub Pages from `dist/` on pushes to `main`
- There is no GitHub-hosted snapshot refresh workflow
- No NEP GitHub credentials are stored in repo secrets for PR refreshes
