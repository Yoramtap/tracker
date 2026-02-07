# Project Agent Notes

## Scope

This repo is centered on the `web/` Next.js app and Jira backlog reporting.

## Core Paths

- `web/src/app/backlog` - backlog UI and snapshot consumers
- `web/src/app/api/backlog/read/route.ts` - snapshot read endpoint
- `web/src/app/api/backlog/refresh/route.ts` - snapshot refresh endpoint
- `web/scripts/refresh-backlog-trends.mjs` - full Jira snapshot rebuild
- `web/src/app/backlog/snapshot.json` - generated snapshot data

## Commands

```bash
cd web
npm run dev
npm run build
npm run refresh:full
```

## Environment

Backlog refresh requires:

- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`
- Optional `ATLASSIAN_SITE`

Put values in `web/.env.backlog` or `web/.env.local`.
