# Review Implementation Plan

## PR 1 — Snapshot Contract Enforcement

Status: completed in this working tree

- add one validator for each snapshot file in `data/`
- fail refresh writes when snapshot shapes drift
- fail static export when checked-in snapshot files are invalid
- provide a dedicated `npm run validate:snapshots` command

## PR 2 — Refresh Pipeline Boundaries

Status: completed first pass in this working tree

- split `scripts/refresh-report-data.mjs` into explicit stages:
  - fetch
  - normalize
  - derive
  - validate
  - write
- make the full-refresh stages runnable via `npm run refresh:stage -- --stage <name>`
- keep default `refresh:full` behavior unchanged while clarifying orchestration boundaries

## PR 3 — Cache And Release Reliability

Status: completed first pass in this working tree

- define cache behavior and invalidation rules in docs
- add a clean-run mode that bypasses cached artifacts for the current refresh run
- add a separate GitHub refresh workflow that commits new snapshot data and lets Pages deploy on push

## PR 4 — Repo Surface Simplification

Status: completed in this working tree

- centralize the snapshot contract and repo path constants in `scripts/dashboard-contract.mjs`
- simplify the primary npm vocabulary around `data:*`, `report:*`, and `site:*`
- demote generated analysis output into `.cache/analysis/` so the product surface stays focused on `data/`
- remove stale duplicate planning material and keep one implementation plan
