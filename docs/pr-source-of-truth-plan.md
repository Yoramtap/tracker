# Implementation Plan: PR Source Of Truth Migration

## Overview

Move PR count semantics from Jira proxies to GitHub pull request events while
keeping the dashboard contract stable where possible. The migration should first
establish a trustworthy GitHub ingestion path and explicit repo ownership map,
then swap downstream snapshots and UI panels to consume that data.

## Architecture Decisions

- Use GitHub non-draft PR events as the truth for PR counts:
  opened counts come from `createdAt`, merged counts come from `mergedAt`, and
  draft PRs are excluded from PR-count metrics.
- Use an explicit `repo -> team` map for attribution, seeded from historical PR
  data and resolved by majority vote.
- Keep Jira for non-PR concerns only.
- Preserve existing snapshot file names unless a schema change becomes strictly
  necessary.
- Keep closed sprint buckets as the primary reporting unit for line charts.
- Use month labels on the line-chart x-axis when that improves readability,
  even though the points themselves are sprint-level.
- Compute summary averages over trailing windows such as last 30 days, months,
  or year from the same GitHub-backed PR events.
- Store the committed repo ownership config at `scripts/config/repo-team-map.json`.
- Treat `yoram-tap_nepgroup` as read-only for all implementation and refresh
  work.

## Phase 1: Foundation

### Task 1: Define GitHub PR source module

**Description:** Create a dedicated GitHub ingestion seam that can fetch PRs
read-only from `nepgpe` repos and normalize them into the internal PR record
shape.

**Acceptance criteria:**
- [ ] A clear GitHub PR normalization shape exists in code
- [ ] PR identity is deduped as `owner/repo#number`
- [ ] Draft PR filtering is explicit and deterministic
- [ ] The fetch path can be stubbed in tests

**Verification:**
- [ ] Tests pass: `node --test scripts/refresh-report-data.test.mjs`

**Dependencies:** None

**Files likely touched:**
- `scripts/refresh-report-data.mjs`
- `scripts/refresh-report-data.test.mjs`
- optional new helper under `scripts/`

**Estimated scope:** Medium

### Task 2: Promote repo-to-team mapping into a real config input

**Description:** Turn the current draft map into a maintained runtime config
with majority-vote defaults and explicit override support.

**Acceptance criteria:**
- [ ] A stable config file exists at `scripts/config/repo-team-map.json`
- [ ] Majority-vote defaults are represented explicitly
- [ ] Overrides can be applied for shared repos without code edits

**Verification:**
- [ ] Manual check: generated map and runtime config agree for sampled repos
- [ ] Tests pass: `node --test scripts/refresh-report-data.test.mjs`

**Dependencies:** Task 1 can proceed in parallel; config is needed before full
GitHub ingestion is trusted

**Files likely touched:**
- `scripts/config/repo-team-map.json`
- `scripts/dev/derive-team-repo-map.mjs`
- `scripts/refresh-report-data.test.mjs`

**Estimated scope:** Medium

### Checkpoint: Foundation

- [ ] GitHub PR source shape is defined
- [ ] Repo ownership mapping exists in a maintained form
- [ ] No remote write capability is introduced

## Phase 2: Replace PR Activity Counts

### Task 3: Swap `fetchPrActivity()` from Jira dev-status to GitHub PR events

**Description:** Replace the current Jira dev-status PR detail flow with a
GitHub-backed fetch that returns normalized PR records by repo and team while
excluding drafts from PR-count metrics.

**Acceptance criteria:**
- [ ] `fetchPrActivity()` no longer requires Jira dev-status PR detail endpoints
  for count metrics
- [ ] `records` are built from GitHub PR `createdAt` / `mergedAt`
- [ ] draft PRs are excluded from opened and inflow counts
- [ ] Candidate counts and cache behavior are updated to reflect GitHub sourcing

**Verification:**
- [ ] Tests pass: `node --test scripts/refresh-report-data.test.mjs scripts/refresh-runner.test.mjs`
- [ ] Manual check: sampled PRs from `tfc-functionality-usvc`, `tfc-app`,
  `tfc-ui`, and `tfo-worker-*` appear with the expected team attribution

**Dependencies:** Tasks 1-2

**Files likely touched:**
- `scripts/refresh-report-data.mjs`
- `scripts/dashboard-paths.mjs`
- `scripts/refresh-report-data.test.mjs`
- `scripts/refresh-runner.test.mjs`

**Estimated scope:** Medium

### Task 4: Rebuild monthly and sprint PR activity bucketing from GitHub dates

**Description:** Keep the snapshot structure but change bucket generation to use
GitHub event timestamps instead of Jira proxy dates.

**Acceptance criteria:**
- [ ] `offered` uses `createdAt` for non-draft PRs
- [ ] `merged` uses `mergedAt`
- [ ] sprint points include only closed sprints
- [ ] sprint points remain the authoritative source for sprint line charts
- [ ] sprint line charts can render month-based x-axis labels without changing
  the underlying sprint point data
- [ ] any retained monthly points are derived from the same GitHub events

**Verification:**
- [ ] Tests pass: `node --test scripts/refresh-report-data.test.mjs`
- [ ] Snapshot validation passes: `npm run data:validate`

**Dependencies:** Task 3

**Files likely touched:**
- `scripts/refresh-report-data.mjs`
- `scripts/refresh-pr-activity-history.mjs`
- `scripts/refresh-report-data.test.mjs`

**Estimated scope:** Medium

### Checkpoint: PR Activity

- [ ] `pr-activity-snapshot.json` is GitHub-backed for counts
- [ ] Sprint output matches expected sampled PRs
- [ ] Historical merge logic still behaves cleanly

## Phase 3: Replace Downstream Inflow Consumers

### Task 5: Recompute `avgPrInflow` for `pr-cycle` from GitHub-backed PR activity

**Description:** Keep `avgPrInflow` as a derived metric but ensure it is built
from GitHub-backed `prActivity.points` rather than Jira proxy points.

**Acceptance criteria:**
- [ ] `buildPrCycleAvgInflowByTeam()` consumes GitHub-backed PR activity points
- [ ] `attachPrCycleAvgInflow()` remains compatible with the current snapshot
  shape
- [ ] Workflow breakdown `PR / sprint` reflects GitHub truth
- [ ] Aggregate PR summary views can compute trailing-window averages from the
  same source data

**Verification:**
- [ ] Tests pass: `node --test scripts/refresh-report-data.test.mjs scripts/refresh-runner.test.mjs`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Task 4

**Files likely touched:**
- `scripts/refresh-report-data.mjs`
- `app/dashboard-app/workflow-panels.js`
- `scripts/refresh-report-data.test.mjs`

**Estimated scope:** Small

### Task 6: Update dashboard copy and caveats

**Description:** Remove Jira-proxy language anywhere the UI or snapshot caveats
describe PR counts.

**Acceptance criteria:**
- [ ] PR count panels no longer describe Jira as the PR count source
- [ ] caveat text matches GitHub-backed semantics
- [ ] line-chart wording is consistent with closed-sprint reporting
- [ ] line-chart axis wording is consistent with month-labeled sprint points
- [ ] aggregate-chart wording is consistent with trailing-window averages

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: development workflow panels read correctly

**Dependencies:** Tasks 4-5

**Files likely touched:**
- `app/dashboard-app.js`
- `app/dashboard-heavy-panels.html`
- `scripts/refresh-report-data.mjs`

**Estimated scope:** Small

### Checkpoint: Product Surface

- [ ] Development workflow trends uses GitHub-backed counts
- [ ] Development workflow breakdown inflow uses GitHub-backed counts
- [ ] Copy matches reality

## Phase 4: Operator Hardening

### Task 7: Add side-by-side comparison tooling for cutover confidence

**Description:** Provide a local operator path to compare Jira-derived and
GitHub-derived outputs during rollout, then remove or retire it after confidence
is established.

**Acceptance criteria:**
- [ ] A local comparison path exists for sampled windows and teams
- [ ] Differences can be explained in operator notes
- [ ] Cutover decision can be made with evidence

**Verification:**
- [ ] Manual check: sampled repos and teams compare cleanly

**Dependencies:** Tasks 3-6

**Files likely touched:**
- `scripts/dev/`
- optional docs under `docs/`

**Estimated scope:** Small

### Task 8: Update release/operator docs

**Description:** Document GitHub auth requirements, read-only NEP usage, and
the new PR count semantics.

**Acceptance criteria:**
- [ ] Operator docs explain the GitHub auth requirement
- [ ] Docs state that NEP account access is read-only
- [ ] Docs describe where repo ownership mapping lives

**Verification:**
- [ ] Manual doc review

**Dependencies:** Tasks 3-7

**Files likely touched:**
- `README.md`
- `docs/release.md`
- optional new operator note

**Estimated scope:** Small

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub auth expires or loses org visibility | High | keep `gh auth status` as an explicit preflight and treat NEP auth as read-only |
| Repo ownership is wrong for shared repos | High | persist explicit overrides and keep majority-vote evidence in the draft map |
| GitHub query volume is large across many repos | Medium | fetch incrementally by updated/created windows and add local cache artifacts |
| Historical Jira and GitHub counts differ materially | Medium | run side-by-side comparison before cutover and explain expected semantic differences |
| Teams expect draft work to appear in PR counts | Medium | document explicitly that draft PRs are excluded from PR-count metrics |
| Users read partial current sprint points as final | Medium | exclude the in-progress sprint from line-chart outputs until rollover |

## Settled Decisions

- Draft PRs are excluded from PR-count metrics.
- Sprint buckets remain the primary reporting unit for PR-count metrics.
- Sprint line charts show only closed sprints.
- Sprint line charts may use month labels on the x-axis while keeping
  sprint-level points.
- Aggregate PR views may show trailing-window averages such as last 30 days,
  months, or year.
- The committed `repo -> team` config lives at
  `scripts/config/repo-team-map.json`.
