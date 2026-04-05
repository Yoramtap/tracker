# Refresh Core Simplification

## Goal

Simplify the deeper refresh orchestration in `scripts/refresh-report-data.mjs`
without changing fetch semantics, output schema, or generated dashboard data.

## Scope

In scope:

- Extract small orchestration helpers around the full refresh pipeline where the
  control flow is repetitive or hard to scan.
- Isolate state assembly from logging and write preparation where that reduces
  branching.
- Add focused regression coverage for any new orchestration seam.

Out of scope:

- Changes to dashboard runtime files in `app/`
- Changes to JSON output structure or field names
- Query changes, Jira filter changes, or cache policy changes
- UI behavior, rendering, or styling changes

## Constraints

- Preserve behavior exactly.
- Keep each refactor slice reviewable on its own.
- Do not combine refactoring with feature work.
- Prefer extracting existing logic over introducing new abstractions.

## First Slice

Target the full-refresh state assembly around:

- `runFullRefreshFetchStage()`
- `runFullRefreshNormalizeStage()`
- `runFullRefreshDeriveStage()`
- `runFullRefreshValidateStage()`

Success criteria:

- Fewer inline branches in the full-refresh path
- Clearer boundaries between fetch, derive, validate, and write stages
- No change to output files beyond timestamp drift

## Verification

- `node --test scripts/refresh-runner.test.mjs scripts/dashboard-snapshot-store.test.mjs`
- `npm run lint`
- `npm run build`
- Compare refreshed JSON against a control refresh when the slice touches output
  orchestration

## Stop Conditions

Stop and split the work if:

- The diff grows beyond a small single-purpose slice
- Output changes cannot be explained as timestamp drift or live data drift
- A helper starts needing cross-module reuse that was not already present
