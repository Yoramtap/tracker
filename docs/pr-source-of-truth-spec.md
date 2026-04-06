# PR Source Of Truth Migration Spec

## Objective

Replace Jira dev-status pull request proxies with GitHub pull requests as the
source of truth for every dashboard metric that represents PR counts or PR
inflow.

Success means:

- `PRs opened` is sourced from real GitHub non-draft PR `createdAt`
- `PRs merged` is sourced from real GitHub PR `mergedAt`
- `PRs / sprint` and equivalent inflow metrics in workflow views are derived
  from GitHub PR events rather than Jira-linked ticket proxies
- team attribution comes from a maintained `repo -> team` mapping, not Jira
  issue labels
- dashboard wording no longer implies Jira is the truth for PR counts

This migration is specifically about PR count semantics. It does not require us
to replace Jira for issue lifecycle, backlog, UAT, or other non-PR metrics.

## Current State

Today PR activity is derived from Jira dev-status and issue changelogs inside
`scripts/refresh-report-data.mjs`.

Primary current seams:

- `fetchPrActivity()` reads Jira issues, dev-status PR details, and Jira review
  changelogs: [refresh-report-data.mjs](/Users/yoramtap/Documents/AI/tracker/scripts/refresh-report-data.mjs#L1538)
- `buildPrActivitySprintSnapshot()` buckets `offered` and `merged` counts into
  sprint points: [refresh-report-data.mjs](/Users/yoramtap/Documents/AI/tracker/scripts/refresh-report-data.mjs#L1721)
- `buildPrActivityMonthlySnapshot()` buckets the same Jira-derived records into
  monthly points: [refresh-report-data.mjs](/Users/yoramtap/Documents/AI/tracker/scripts/refresh-report-data.mjs#L1768)
- `attachPrCycleAvgInflow()` injects `avgPrInflow` into `pr-cycle-snapshot.json`
  from PR activity points: [refresh-report-data.mjs](/Users/yoramtap/Documents/AI/tracker/scripts/refresh-report-data.mjs#L1283)

User-facing PR count surfaces:

- Development workflow trends panel reads `prActivity` for `PRs opened` and
  `PRs merged`: [dashboard-app.js](/Users/yoramtap/Documents/AI/tracker/app/dashboard-app.js#L1566)
- Development workflow breakdown uses `avgPrInflow` / `PRs per sprint`:
  [workflow-panels.js](/Users/yoramtap/Documents/AI/tracker/app/dashboard-app/workflow-panels.js#L601)

## In Scope

- Replace Jira-derived PR count sourcing in `pr-activity-snapshot.json`
- Replace Jira-derived PR inflow inputs used by `pr-cycle-snapshot.json`
- Introduce a GitHub-backed PR fetch path
- Introduce and persist a `repo -> team` mapping used for attribution
- Update product copy, caveats, and operator docs where they currently describe
  Jira PR proxies as the count source
- Add tests covering GitHub-sourced PR bucketing, deduping, team attribution,
  and inflow derivation

## Out Of Scope

- Replacing Jira backlog, UAT, or lifecycle metrics
- Replacing Jira-based review-to-merge timing in this slice
- Rebuilding all historical snapshot data beyond what is needed for the active
  refresh path
- Any write access or repo mutations in the `yoram-tap_nepgroup` account

## Source Of Truth Rules

### PR Identity

- The canonical PR key is `owner/repo#number`
- We dedupe by canonical PR key across all ingestion stages
- A PR belongs to exactly one repo and exactly one team after repo mapping

### PR Opened

- Non-draft PRs count at GitHub `createdAt`
- Draft PRs are excluded from opened-count and inflow metrics
- Counted when the PR is created and is already reviewable

### PR Merged

- Source field: GitHub `mergedAt`
- Count only non-draft PRs with non-null `mergedAt`
- Closed-unmerged PRs do not count as merged

### Team Attribution

- Primary mechanism: maintained `repo -> team` map
- Initial map source: historical PR-derived majority mapping from
  `.cache/pr-activity-issue-cache.json`
- Shared repos resolve to the dominant historical team unless explicitly
  overridden
- The committed runtime config will live at
  `scripts/config/repo-team-map.json`

### Time Bucketing

- Sprint buckets are the primary reporting unit for PR counts and PR inflow
- Sprint line charts show only closed sprints; the current in-progress sprint is
  not rendered until rollover
- Sprint line charts may label the x-axis by month even though the plotted
  points are individual sprints
- Aggregate views may report trailing-window averages such as last 30 days,
  last months, or last year, as long as they are derived from the same
  GitHub-backed PR events
- Any retained bucket type must use GitHub PR timestamps instead of Jira
  proxies

## GitHub Data Model

Minimum PR fields required from GitHub:

- repo name
- PR number
- URL
- state
- `createdAt`
- `mergedAt`
- base branch
- head branch
- author login
- title
- labels
- draft flag if available

Suggested internal normalized shape:

```js
{
  uniqueKey: "nepgpe/tfc-functionality-usvc#153",
  repo: "nepgpe/tfc-functionality-usvc",
  team: "api",
  createdAt: "2026-03-18T13:06:34Z",
  createdDate: "2026-03-18",
  mergedAt: "",
  mergedDate: "",
  isDraft: false,
  state: "OPEN",
  url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/153"
}
```

## Commands

Build: `npm run build`

Validate snapshots: `npm run data:validate`

PR activity tests: `node --test scripts/refresh-report-data.test.mjs scripts/refresh-runner.test.mjs`

Local map generation: `node scripts/dev/derive-team-repo-map.mjs`

Refresh PR activity only: `npm run dev:refresh:pr-activity`

Full refresh: `npm run data:refresh`

## Project Structure

- `scripts/refresh-report-data.mjs` -> current refresh and PR derivation pipeline
- `scripts/refresh-runner.mjs` -> mode-specific refresh orchestration
- `scripts/refresh-pr-activity-history.mjs` -> historical PR series merge logic
- `scripts/dashboard-paths.mjs` -> cache/data path definitions
- `scripts/config/repo-team-map.json` -> committed repo ownership mapping
- `scripts/dev/derive-team-repo-map.mjs` -> local generator for repo ownership mapping
- `data/pr-activity-snapshot.json` -> public PR activity snapshot contract
- `data/pr-cycle-snapshot.json` -> public workflow breakdown snapshot with
  `avgPrInflow`
- `app/dashboard-app.js` -> PR activity trend panel wiring
- `app/dashboard-app/workflow-panels.js` -> workflow breakdown PR inflow usage
- `docs/` -> specs and implementation plans

## Code Style

Prefer explicit data normalization and small pure transforms over clever
cross-cutting abstractions.

Example style:

```js
function normalizeGitHubPullRequest(pr, repo, team) {
  const createdAt = String(pr?.createdAt || "").trim();
  const mergedAt = String(pr?.mergedAt || "").trim();
  return {
    uniqueKey: `${repo}#${pr.number}`,
    repo,
    team,
    createdAt,
    createdDate: createdAt.slice(0, 10),
    mergedAt,
    mergedDate: mergedAt ? mergedAt.slice(0, 10) : "",
    isDraft: Boolean(pr?.isDraft),
    state: String(pr?.state || "").trim().toUpperCase(),
    url: String(pr?.url || "").trim()
  };
}
```

Conventions:

- keep normalization functions deterministic
- make time-source fields obvious by name
- prefer explicit snapshots and mappers over dynamic object mutation
- do not mix GitHub ingestion work with unrelated Jira refactors

## Testing Strategy

- Unit coverage in `scripts/refresh-report-data.test.mjs` for:
  - GitHub PR normalization
  - sprint bucket derivation from `createdAt` / `mergedAt`
  - exclusion of the current in-progress sprint from sprint trend outputs
  - exclusion of draft PRs from opened and inflow metrics
  - `repo -> team` attribution
  - `avgPrInflow` derivation for `pr-cycle`
- Runner coverage in `scripts/refresh-runner.test.mjs` for PR-activity-only flow
- Snapshot validation via `npm run data:validate`
- Build verification via `npm run build`
- Side-by-side comparison against current Jira-derived output during migration

## Boundaries

- Always:
  - keep NEP GitHub access read-only
  - preserve published snapshot contracts unless explicitly versioned
  - document source semantics in caveats and docs
  - verify `pr-activity` and `pr-cycle` outputs together

- Ask first:
  - changing public JSON field names
  - replacing the review-to-merge Jira proxy in the same migration

- Never:
  - write or mutate remote repos using `yoram-tap_nepgroup`
  - silently mix Jira proxy counts with GitHub counts in the same metric
  - infer teams from ad hoc title parsing when a repo map exists

## Success Criteria

- `pr-activity-snapshot.json` no longer depends on Jira dev-status PR details for
  opened/merged counts
- `pr-cycle-snapshot.json` inflow metrics no longer depend on Jira proxy counts
- the development workflow trends panel and workflow breakdown panel show
  GitHub-sourced PR counts
- repo ownership is resolved through an explicit map, with majority-vote defaults
  and override support
- tests cover GitHub normalization and bucketing rules
- docs explain the new count semantics clearly
