# Release Guide

## Default Local Refresh

```bash
npm run data:refresh
npm run data:validate
npm run site:build
```

Use this when you want the normal incremental refresh path.

## Clean Refresh

```bash
npm run data:refresh:clean
npm run data:validate
npm run site:build
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
npm run report:analyze
```

This writes a local operator note to `.cache/analysis/latest-analysis.md` and archives older copies under `.cache/analysis/history/`. It is not part of the product publish path.

## Cache Locations

- `.cache/pr-activity-issue-cache.json`: PR detail cache
- `.cache/business-unit-uat-done-cache.json`: Business Unit done-flow cache
- `.cache/snapshots/`: archived canonical snapshot history

## Publish Helper

```bash
npm run site:publish -- --refresh yes --clean --message "Refresh dashboard data" --push
```

Use `--clean` when you want the publish helper to refresh from Jira without depending on old local caches.

## GitHub Automation

- `.github/workflows/pages.yml` deploys GitHub Pages from `dist/` on pushes to `main`
- `.github/workflows/refresh-data.yml` refreshes data on a schedule or manual trigger, validates snapshots, and commits updated `data/` back to `main`

Required GitHub secrets for refresh automation:

- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`
- optional `ATLASSIAN_SITE`
