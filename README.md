# Bugtracker Snapshot Site

This repository hosts a public, static backlog snapshot viewer.

## Included

- `index.html`
- `app.js`
- `snapshot.json` (aggregate counts only)

## Security

- No Jira credentials or private data-fetching instructions are stored in this repository.
- Snapshot data should remain aggregate-only.

## Embed

Use GitHub Pages URLs for iframe embeds (for example in Confluence):

- Full dashboard: `https://yoramtap.github.io/bugtracker/`
- Trend chart only: `https://yoramtap.github.io/bugtracker/?chart=trend`
- Composition chart only: `https://yoramtap.github.io/bugtracker/?chart=composition`

Recommended iframe settings:

- Width: `100%`
- Height: `700px` for trend-only, `900-1000px` for full dashboard
- Scrolling: `Auto`

## Data Contract (`snapshot.json`)

The app expects a local `snapshot.json` file served from the site root.

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

Notes:

- Missing or non-numeric counts are treated as `0` by `app.js`.
- Keep values aggregate-only (no ticket-level or sensitive content).
