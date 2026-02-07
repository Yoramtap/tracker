# Codex Loop

This repository now focuses on the web app and backlog reporting workflow.

## Main App

```bash
cd web
npm install
npm run dev
```

## Backlog Data Refresh

The backlog snapshot refresh pulls Jira data and rewrites:

- `web/src/app/backlog/snapshot.json`

Run:

```bash
cd web
npm run refresh:full
```

Required environment variables:

- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`
- Optional: `ATLASSIAN_SITE` (defaults to `nepgroup.atlassian.net`)

You can place these in:

- `web/.env.backlog`
- `web/.env.local`

## Build

```bash
cd web
npm run build
```
