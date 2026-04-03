# Tracker

This repo is now the single source of truth for the dashboard, the refresh scripts, and the GitHub Pages deployment.

## Which doc to use

- Use this file for setup, security, and the main commands.
- Use `RELEASE.md` for manual refresh + live publish steps.

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
npm run refresh:full
npm run analyze:brief
npm run build:site
```

What they do:

- `refresh:full`: refreshes the Jira-backed dashboard data
- `analyze:brief`: writes `reports/latest-analysis.md`
- `build:site`: builds the public Pages artifact into `dist/`

Useful variants:

- `npm run refresh:product-cycle`
- `npm run refresh:pr-cycle`
- `npm run refresh:pr-activity`
- `npm run refresh:uat-flow`
- `npm run publish:site -- --refresh yes --message "Refresh dashboard data" --push`

Use `publish:site` only as a convenience helper when the repo is already clean. The canonical release instructions live in `RELEASE.md`.

## Local Preview

```bash
cd /Users/yoramtap/Documents/AI/tracker
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Release Flow

Read [RELEASE.md](/Users/yoramtap/Documents/AI/tracker/RELEASE.md) before shipping.

- Manual release steps are in [RELEASE.md](/Users/yoramtap/Documents/AI/tracker/RELEASE.md).
- The Friday 09:00 weekly run is handled by Codex automation rather than a repo doc.

## GitHub Pages

- GitHub Pages deploys from this repo via [.github/workflows/pages.yml](/Users/yoramtap/Documents/AI/tracker/.github/workflows/pages.yml).
- The workflow runs `npm ci` and `npm run build:site`, then publishes `dist/`.
- The live site stays publicly accessible for Confluence embedding.

## Notes

- `index.html` in the repo is the source entrypoint.
- The public Pages artifact is built from source; `dist/` is not committed.
- Current published snapshots and analysis reports remain in-repo. Local snapshot-history folders stay ignored unless you intentionally track them.
