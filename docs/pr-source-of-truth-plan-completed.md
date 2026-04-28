# Implementation Plan: PR Source Of Truth Migration

## Overview

Move PR count semantics from Jira proxies to GitHub pull request events while
keeping the dashboard contract stable where possible. The migration should first
establish a trustworthy GitHub ingestion path and explicit repo ownership map,
then swap downstream snapshots and UI panels to consume that data.

## Status Update

- Tasks 1-6 are complete in the shipped implementation.
- Task 7 is retired as a required deliverable; Jira-vs-GitHub comparison is now
  an ad hoc debugging technique, not part of the normal operating model.
- Task 8 is complete once the local-only refresh docs are in place.

## Architecture Decisions

- Use GitHub non-draft PR events as the truth for PR counts:
  opened counts come from `createdAt`, merged counts come from `mergedAt`, and
  draft PRs are excluded from PR-count metrics.
- Use the first submitted non-author GitHub review to `mergedAt` for
  review-to-merge timing.
- Use an explicit `repo -> team` map for attribution, seeded from historical PR
  data and resolved by majority vote.
- Keep Jira for non-PR concerns only.
- Preserve existing snapshot file names unless a schema change becomes strictly
  necessary.
- Use monthly buckets as the primary reporting unit for the workflow trends line
  chart.
- Hide the current in-progress month from the workflow trends line chart until
  the month closes.
- Keep sprint buckets for `PR / sprint` inflow and trailing-window averages in
  workflow breakdown views.
- Compute summary averages over trailing windows such as last 30 days, months,
  or year from the same GitHub-backed PR events.
- Store the committed repo ownership config at `scripts/config/repo-team-map.json`.
- Treat `yoram-tap_nepgroup` as read-only for all implementation and refresh
  work.
- Use local-only refresh automation; do not rely on GitHub-hosted PR refresh
  credentials.

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
- [ ] monthly trend points are derived from the same GitHub events
- [ ] the current in-progress month is hidden from workflow trends until close
- [ ] sprint points remain available for `PR / sprint` inflow and trailing
  averages

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
- [ ] line-chart wording is consistent with monthly reporting
- [ ] line-chart wording hides the current in-progress month
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

### Task 7: Retired from required scope

**Description:** Jira-vs-GitHub comparison is now an ad hoc debugging technique,
not a required committed tool.

**Acceptance criteria:**
- [ ] No product or operator flow depends on a committed comparison helper

**Verification:**
- [ ] Manual comparison can still be done when investigating suspicious deltas

**Dependencies:** Tasks 3-6

**Files likely touched:**
- none required

**Estimated scope:** Small

### Task 8: Update release/operator docs

**Description:** Document GitHub auth requirements, read-only NEP usage, and
the new PR count semantics plus the local weekly refresh path.

**Acceptance criteria:**
- [ ] Operator docs explain the GitHub auth requirement
- [ ] Docs state that NEP account access is read-only
- [ ] Docs describe where repo ownership mapping lives
- [ ] Docs explain that PR refreshes run locally, not in GitHub Actions
- [ ] Docs describe the recommended weekly Monday 09:00 local automation

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
| Historical Jira and GitHub counts differ materially | Medium | investigate ad hoc when suspicious deltas appear; GitHub remains the source of truth |
| Teams expect draft work to appear in PR counts | Medium | document explicitly that draft PRs are excluded from PR-count metrics |
| Users read partial current month points as final | Medium | exclude the in-progress month from workflow trend outputs until month close |

## Settled Decisions

- Draft PRs are excluded from PR-count metrics.
- Workflow trends use monthly points and hide the current in-progress month.
- Workflow breakdown inflow uses sprint buckets and trailing-window averages.
- Aggregate PR views may show trailing-window averages such as last 30 days,
  months, or year.
- Review-to-merge uses first submitted non-author GitHub review to merge.
- PR refreshes run locally, not from GitHub Actions.
- The committed `repo -> team` config lives at
  `scripts/config/repo-team-map.json`.
