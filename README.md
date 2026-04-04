# Tracker

This repo has one job: regenerate committed dashboard snapshots and publish a static site from them.

## Repo Story

- `data/`: committed public snapshot contract
- `app/`: dashboard UI that reads only from `data/`
- `scripts/`: fetch, derive, validate, and publish pipeline
- `.cache/`: disposable local state and analysis output
- `dist/`: generated GitHub Pages artifact

## Which doc to use

- Use this file for setup, security, and the main commands.
- Use `docs/release.md` for manual refresh + live publish steps.

## Security

- The repo can be public.
- The Jira API token must never be committed.
- Keep credentials only in `.env.backlog` or `.env.local`, or in GitHub Actions secrets if you later automate refreshes in GitHub.
- Start from `.env.example` if you want a template instead of using the setup script.
- `.env*`, `node_modules/`, `.cache/`, and `dist/` are ignored locally.

## Local Setup

```bash
cd /Users/yoramtap/Documents/AI/tracker
npm install
npm run backlog:setup-auth -- --email "you@company.com"
```

The setup helper prompts for the Jira API token securely and writes a local `.env.backlog` file that stays ignored.

Optional Jira site override:

```bash
npm run backlog:setup-auth -- --email "you@company.com" --site "your-site.atlassian.net"
```

## Core Commands

```bash
cd /Users/yoramtap/Documents/AI/tracker
npm run data:refresh
npm run data:validate
npm run site:build
```

What they do:

- `data:refresh`: refreshes the Jira-backed dashboard data
- `data:validate`: enforces the committed snapshot contract
- `site:build`: builds the public Pages artifact into `dist/`

Useful variants:

- `npm run data:refresh:product-cycle`
- `npm run data:refresh:pr-cycle`
- `npm run data:refresh:pr-activity`
- `npm run data:refresh:uat`
- `npm run data:refresh:clean`
- `npm run report:analyze`
- `npm run site:publish -- --refresh yes --message "Refresh dashboard data" --push`

Use `site:publish` only as a convenience helper when the repo is already clean. The canonical release instructions live in `docs/release.md`.

## Cache Behavior

- Local refresh caches live under `.cache/`.
- Default refreshes may reuse local PR activity cache, archived snapshot history, and Business Unit done-cache state.
- `npm run data:refresh:clean` bypasses those local caches for the current run and rebuilds fresh cache artifacts afterward.
- Use clean refreshes for debugging, CI, or whenever you want a reproducible run that is less dependent on local state.

## Optional Analysis

```bash
cd /Users/yoramtap/Documents/AI/tracker
npm run report:analyze
```

- Writes a local operator note to `.cache/analysis/latest-analysis.md`
- Archives older copies under `.cache/analysis/history/`
- Does not affect the product contract or GitHub Pages publish

## Local Preview

```bash
cd /Users/yoramtap/Documents/AI/tracker
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Release Flow

Read [docs/release.md](/Users/yoramtap/Documents/AI/tracker/docs/release.md) before shipping.

- Manual release steps are in [docs/release.md](/Users/yoramtap/Documents/AI/tracker/docs/release.md).
- Scheduled GitHub refresh automation lives in [.github/workflows/refresh-data.yml](/Users/yoramtap/Documents/AI/tracker/.github/workflows/refresh-data.yml).

## GitHub Pages

- GitHub Pages deploys from this repo via [.github/workflows/pages.yml](/Users/yoramtap/Documents/AI/tracker/.github/workflows/pages.yml).
- The workflow runs `npm ci` and `npm run site:build`, then publishes `dist/`.
- Scheduled or manual data refresh automation lives in [.github/workflows/refresh-data.yml](/Users/yoramtap/Documents/AI/tracker/.github/workflows/refresh-data.yml).
- The live site stays publicly accessible for Confluence embedding.

## Notes

- `index.html` in the repo is the source entrypoint.
- The public Pages artifact is built from source; `dist/` is not committed.
- Current published snapshots remain in-repo under `data/`, and local caches plus snapshot archives stay under `.cache/`.
- Analysis output is disposable and stays under `.cache/analysis/`.
- Hand-authored release/docs material live under `docs/`.
