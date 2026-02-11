# Bugtracker Workshop

This is the private/local workshop repo for building and validating bugtracker graphs.

The UI should stay aligned with the public `bugtracker` repo (`index.html`, `app.js`, `styles.css`), while Jira credentials and refresh scripts stay only here.

## Included

- `index.html`
- `app.js`
- `styles.css`
- `snapshot.json` (generated aggregate counts only)
- `scripts/refresh-backlog-trends.mjs` (Jira -> snapshot pipeline)
- `scripts/export-public.mjs` (safe export to public repo)

## Security Model

- Keep this repository private/local.
- Credentials are loaded from `.env.backlog` or `.env.local`.
- Never publish `.env.*` files.
- Publish only aggregate `snapshot.json` and approved static UI files to the public repo.

## Setup

```bash
cd /Users/yoramtap/Documents/AI/bugtracker-workshop
npm run backlog:setup-auth -- --email "you@company.com" --token "<jira_api_token>"
```

Optional Jira site override:

```bash
npm run backlog:setup-auth -- --email "you@company.com" --token "<jira_api_token>" --site "your-site.atlassian.net"
```

## Refresh Snapshot

```bash
cd /Users/yoramtap/Documents/AI/bugtracker-workshop
npm run refresh:full
```

This regenerates `snapshot.json` in the repo root.

Trend dates are resolved automatically from Jira sprints (Agile API), then used as historical "as-of" dates for backlog snapshots.

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
cd /Users/yoramtap/Documents/AI/bugtracker-workshop
npm run export:public
```

Default target is `/Users/yoramtap/Documents/AI/bugtracker`.

Optional explicit target:

```bash
npm run export:public -- --target /Users/yoramtap/Documents/AI/bugtracker
```

The export command only copies:

- `snapshot.json`
- `index.html`
- `app.js`
- `styles.css`

## UAT Aging (Third Chart)

The third chart shows anonymized aging for UAT work (default label filter: `Broadcast`), split by priority.
No issue-level keys, links, assignees, or per-ticket labels are written to `snapshot.json`.

Default Jira filter:

- `project = TFC`
- `status = UAT`
- `labels = Broadcast`

Optional overrides in `.env.backlog`:

- `UAT_PROJECT` (default: `TFC`)
- `UAT_ISSUE_TYPE` (default: empty / any issue type)
- `UAT_STATUS` (default: `UAT`)
- `UAT_LABEL` (default: `Broadcast`)

## Local Preview

Serve this directory with any static server, for example:

```bash
cd /Users/yoramtap/Documents/AI/bugtracker-workshop
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Publish Flow

1. Iterate charts and data in `bugtracker-workshop`.
2. Run `npm run refresh:full`.
3. Run `npm run export:public`.
4. Commit/push from `/Users/yoramtap/Documents/AI/bugtracker`.

## Data Contract (`snapshot.json`)

Top-level shape:

- `schemaVersion`: number
- `updatedAt`: ISO datetime string
- `source`: object (metadata)
- `combinedPoints`: array of dated snapshots

Each `combinedPoints[]` item:

- `date`: `YYYY-MM-DD`
- `api`, `legacy`, `react`, `bc`: team objects

Each team object:

- `date`: `YYYY-MM-DD`
- `highest`, `high`, `medium`, `low`, `lowest`: numeric counts
