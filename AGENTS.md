# Tracker Agent Runbook

This repo is public because GitHub Pages is embedded in Confluence. Treat every tracked file as public.

## Public / Private Boundary

- Public repo and dashboard: `Yoramtap/tracker`.
- Private source systems: Jira plus the private GitHub organization read through credentials.
- Public data lives in `data/` and must contain aggregate dashboard metrics only.
- Private local data lives in ignored paths:
  - `.env.backlog`
  - `.env.local`
  - `.private/repo-team-map.json`
  - `.private/contributor-team-map.json`
  - `.cache/`
- Never commit GitHub logins, private repo names, PR URLs, tokens, or detailed unmapped audit rows.

## PR Activity Mapping

GitHub PR activity is attributed in this order:

1. `CONTRIBUTOR_TEAM_MAP_JSON` / `.private/contributor-team-map.json`
2. `REPO_TEAM_MAP_JSON` / `.private/repo-team-map.json`
3. `unmapped`

Local refreshes read the ignored `.private/*.json` files. GitHub Actions reads the matching repository secrets.

Public snapshots may contain:

- Team-level PR counts.
- Aggregate `unmappedRepoCount` and `unmappedContributorCount`.
- Community contributor display names from `data/contributors-snapshot.json`.

Public snapshots must not contain:

- `authorLogin`
- `unmappedContributors`
- `unmappedPrAudit`
- `samplePullRequests`
- private GitHub org/repo URLs
- private GitHub account markers

## Required Guardrails

Before committing or pushing any dashboard data or refresh code, run:

```bash
npm run data:validate
npm run security:scan-public
npm test
npm run build
```

`data:validate` enforces the public snapshot contract. `security:scan-public` searches tracked public files for private GitHub markers, token patterns, and private-key markers.

## Refresh Commands

Dry-run PR activity refresh:

```bash
PR_ACTIVITY_ONLY=true NO_WRITE=true SKIP_TREND_REFRESH=true npm run data:refresh
```

Write sanitized PR activity snapshots:

```bash
PR_ACTIVITY_ONLY=true SKIP_TREND_REFRESH=true npm run data:refresh
npm run data:validate
npm run security:scan-public
npm test
npm run build
```

Full refresh:

```bash
npm run data:refresh
npm run data:validate
npm run security:scan-public
npm test
npm run build
```

## Updating Private Maps

When resolving unmapped PR activity:

1. Use private/local audit data only.
2. Prefer repo mappings for mixed-team contributors and bots.
3. Add contributor mappings only when a login is clearly single-team.
4. Keep bots such as `dependabot[bot]`, `github-actions[bot]`, `renovate[bot]`, and `copilot` unmapped globally unless there is a deliberate reason.
5. Update both local ignored files and GitHub Actions secrets:
   - `REPO_TEAM_MAP_JSON`
   - `CONTRIBUTOR_TEAM_MAP_JSON`

If `gh secret set` fails with permissions, use the GitHub web UI:

- Repository Settings
- Secrets and variables
- Actions
- Edit `REPO_TEAM_MAP_JSON`
- Edit `CONTRIBUTOR_TEAM_MAP_JSON`

Paste the entire JSON contents of the corresponding `.private/*.json` file.

## Current Security Notes

- Historical GitHub identity audit details were purged from reachable git history.
- Old detailed workflow artifacts were deleted.
- The public repo intentionally keeps community contributor display names.
- The combined `data/snapshot.json` must be sanitized too; do not rely only on `data/pr-activity-snapshot.json`.
- Future scheduled refreshes will use the GitHub Actions secret maps, not local `.private` files.
