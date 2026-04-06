# Release Guide

## Local Auth Preflight

Before any refresh that touches PR activity:

```bash
gh auth status -h github.com
```

Expected operating model:

- Jira credentials live only in ignored local env files
- `private-github-account` stays read-only and is used only through local `gh` auth
- PR refreshes are run locally, not from GitHub Actions

## Default Local Refresh

```bash
npm run data:refresh
npm run data:validate
npm run build
```

Use this when you want the normal incremental refresh path.

This command refreshes:

- Jira-backed backlog, UAT, and PR cycle stage timing
- GitHub-backed PR activity, using local `gh` auth for `example-org`

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

## Weekly Local Automation

Recommended schedule:

- Monday 09:00 in your local timezone (`Europe/Amsterdam`)
- Run `npm run data:refresh`, `npm run data:validate`, and `npm run build`
- Review changed files, then commit and push from your normal `Yoramtap` repo context

## GitHub Automation

- `.github/workflows/pages.yml` deploys GitHub Pages from `dist/` on pushes to `main`
- There is no GitHub-hosted snapshot refresh workflow
- No NEP GitHub token is stored in repo secrets for PR refreshes
