# Bugtracker Workshop

This is the private/local workshop repo for building and validating tracker graphs.

The live UI is the dashboard bundle rooted at `index.html`, with `dashboard-*.js`, `dashboard-styles.css`, vendored browser dependencies, and three published data snapshots. Jira credentials and refresh scripts stay only here.

## Included

- `index.html`
- `dashboard-app.js` plus `dashboard-*.js` helpers
- `dashboard-styles.css`
- `backlog-snapshot.json` (live backlog dashboard data)
- `product-cycle-snapshot.json` (product cycle dashboard data)
- `contributors-snapshot.json` (contributors dashboard data)
- `pr-cycle-snapshot.json` (PR cycle stage breakdown experiment data)
- `snapshot.json` (refresh output mirror used for analysis/archive flows)
- `scripts/refresh-report-data.mjs` (Jira -> backlog snapshot pipeline)
- `scripts/export-public.mjs` (safe export to the `tracker` repo)

## Security Model

- Keep this repository private/local.
- Credentials are loaded from `.env.backlog` or `.env.local`.
- Never publish `.env.*` files.
- Publish only the approved dashboard bundle and aggregate snapshot files to the `tracker` repo.

## Setup

```bash
cd /Users/yoramtap/Documents/AI/workshop
npm run backlog:setup-auth -- --email "you@company.com" --token "<jira_api_token>"
```

Optional Jira site override:

```bash
npm run backlog:setup-auth -- --email "you@company.com" --token "<jira_api_token>" --site "your-site.atlassian.net"
```

## Refresh Snapshot

```bash
cd /Users/yoramtap/Documents/AI/workshop
npm run refresh:full
```

This regenerates `snapshot.json` in the repo root.
It also writes `backlog-snapshot.json` for the live dashboard and archives a timestamped copy to `snapshots/` on each successful run.

Trend dates are resolved automatically from Jira sprints (Agile API), then used as historical "as-of" dates for backlog snapshots.
Jira Development PR activity is also included, derived from the Jira Development summary field on issues and grouped per sprint across the rolling last-year lookback used by the dashboard.

Default sprint-date behavior:

- Uses scrum boards from `SPRINT_PROJECT` (default: `TFC`)
- Uses sprint **end dates** as chart points (`SPRINT_POINT=end`)
- Includes `closed` and `active` sprints
- Normalizes sprint points to Monday (`SPRINT_MONDAY_ANCHOR=true`) to avoid timezone weekend drift
- Keeps only the most recent `SPRINT_LOOKBACK_COUNT` points (default: `14`)

Optional overrides in `.env.backlog`:

- `SPRINT_PROJECT` (default: `TFC`)
- `SPRINT_BOARD_ID` (optional: force one board instead of auto-discovering scrum boards)
- `SPRINT_LOOKBACK_COUNT` (default: `14`)
- `SPRINT_POINT` (`end` or `start`, default: `end`)
- `SPRINT_INCLUDE_ACTIVE` (`true`/`false`, default: `true`)
- `SPRINT_MONDAY_ANCHOR` (`true`/`false`, default: `true`)

If sprint discovery fails (permissions, API error, no boards), the script falls back to the internal static date list so refresh still completes.

## Export To Public Repo

```bash
cd /Users/yoramtap/Documents/AI/workshop
npm run export:public
```

Default target is `/Users/yoramtap/Documents/AI/tracker`.

Optional explicit target:

```bash
npm run export:public -- --target /Users/yoramtap/Documents/AI/tracker
```

The export command only copies:

- `backlog-snapshot.json`
- `contributors-snapshot.json`
- `product-cycle-snapshot.json`
- `product-cycle-shipments-snapshot.json`
- `pr-cycle-snapshot.json`
- `index.html`
- `dashboard-styles.css`
- `dashboard-preload.js`
- `dashboard-view-utils.js`
- `dashboard-data-utils.js`
- `dashboard-chart-core.js`
- `dashboard-svg-core.js`
- `dashboard-charts-backlog.js`
- `dashboard-charts-delivery.js`
- `dashboard-charts-product.js`
- `dashboard-app.js`
- `agentation-local-loader.js`
- `vendor/react.production.min.js`
- `vendor/react-dom.production.min.js`
- `vendor/prop-types.min.js`
- `vendor/recharts.umd.js`

## Analysis Brief

Generate a concise analysis memo from `snapshot.json`:

```bash
cd /Users/yoramtap/Documents/AI/workshop
npm run analyze:brief
```

This writes:

- `reports/latest-analysis.md`
- `reports/history/analysis-<timestamp>.md`

The report includes:

- bug trend deltas over time
- UAT aging concentration/risk
- UAT aging trend over archived snapshots (when `snapshots/` has at least 2 entries)
- a short perspective section
- concrete "move forward" actions

## Snapshot History Archive

Each `npm run refresh:full` run writes:

- latest dashboard snapshot: `backlog-snapshot.json`
- latest analysis/input mirror: `snapshot.json`
- historical copy: `snapshots/snapshot-<timestamp>.json`

This archive enables longitudinal UAT analysis across runs without exposing private Jira credentials.

A similar archive is kept for analysis output in `reports/history/` so each run is preserved for historical comparison.

## UAT Aging (Third Chart)

The third chart shows anonymized aging for UAT work (default label filter: `Broadcast`), split by priority.
No issue-level keys, links, assignees, or per-ticket labels are written to `snapshot.json` or the top-level UAT aging payload in `backlog-snapshot.json`.

Default Jira filter:

- `project = TFC`
- `status = UAT`
- `labels = Broadcast`

Optional overrides in `.env.backlog`:

- `UAT_PROJECT` (default: `TFC`)
- `UAT_ISSUE_TYPE` (default: empty / any issue type)
- `UAT_STATUS` (default: `UAT`)
- `UAT_LABEL` (default: `Broadcast`)

## PR Cycle Experiment

The PR cycle experiment reads Jira status-history aggregates from `pr-cycle-snapshot.json`.
The tracked stages are:

- `In Progress`
- `In Review`
- `QA`

Default refresh behavior:

- projects: `TFC,TFO,MESO`
- windows: `Last 90 days`, `Last 6 months`, `Last year`

Optional overrides in `.env.backlog`:

- `PR_CYCLE_PROJECT_KEYS` (comma-separated, default: `TFC,TFO,MESO`)
- `PR_CYCLE_CODING_STATUS` (default: `In Progress`)
- `PR_CYCLE_REVIEW_STATUS` (default: `In Review`)
- `PR_CYCLE_MERGE_STATUS` (default: `QA`)

## Local Preview

Serve the workshop files locally:

```bash
cd /Users/yoramtap/Documents/AI/workshop
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

If you want an explicit workshop alias, this still works:

```bash
npm run dev:workshop
```

If you explicitly need to preview the public `tracker` repo instead, use:

```bash
npm run dev:tracker
```

## Publish Flow

Read [RELEASE.md](/Users/yoramtap/Documents/AI/workshop/RELEASE.md) before any publish or release action.

This is the standard full refresh + live release flow we use:

1. In `/Users/yoramtap/Documents/AI/workshop`, run `npm run refresh:full`.
2. Run `npm run analyze:brief`.
3. Run `npm run export:public -- --target /Users/yoramtap/Documents/AI/tracker`.
4. In `/Users/yoramtap/Documents/AI/tracker`, commit and push any changed files.
5. Confirm the latest Pages deploy succeeds and [the live dashboard](https://yoramtap.github.io/tracker/) responds.

Important:

- Do not treat `git push` from the workshop repo as the release step.
- `workshop` is the private source repo; `tracker` is the public publish target.
- If you intentionally want an export-only publish with no fresh data, call that out explicitly before skipping `refresh:full`.

## Live Dashboard Files

- `index.html` loads `dashboard-preload.js`, the vendored React/Recharts files, the `dashboard-*.js` modules, and `agentation-local-loader.js`.
- The live dashboard reads:
  - `backlog-snapshot.json`
  - `product-cycle-snapshot.json`
  - `contributors-snapshot.json`
  - `pr-cycle-snapshot.json`
- The old `app.js` / `styles.css` path has been removed; `index.html` is the only supported UI entrypoint.

## Data Contract (`backlog-snapshot.json`)

`backlog-snapshot.json` is the slim, app-facing payload. The richer analysis/archive data still lives in `snapshot.json`.

Top-level shape:

- `updatedAt`: ISO datetime string
- `uatAging.scope.label`: string
- `prActivity`: object (Jira Development PR activity summary)
- `combinedPoints`: array of dated snapshots
- `chartData.managementBusinessUnit.byScope`: optional preserved chart payload used by the UAT business-unit card
- `chartDataUpdatedAt`: optional ISO datetime string when preserved chart data is older than the latest refresh

Each `combinedPoints[]` item:

- `date`: `YYYY-MM-DD`
- `api`, `legacy`, `react`, `bc`, `workers`, `titanium`: team objects

Each team object:

- `highest`, `high`, `medium`, `low`, `lowest`: numeric counts

`prActivity` shape:

- `since`: `YYYY-MM-DD`
- `interval`: currently `sprint`
- `caveat`: explanation of Jira-based limitations
- `points`: array of sprint buckets

Each `prActivity.points[]` item:

- `date`: sprint point date, `YYYY-MM-DD`
- `api`, `legacy`, `react`, `bc`, `workers`, `titanium`: objects with `offered`, `merged`, `avgReviewToMergeDays`, and `avgReviewToMergeSampleCount`

## Analysis Contract (`snapshot.json`)

`snapshot.json` is still written by refresh for archive and analysis tooling. It keeps the fuller backlog/UAT/PR metadata that is intentionally omitted from the lighter dashboard payloads.
