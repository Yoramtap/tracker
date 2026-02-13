# Report Refresh + Publish Cadence

## Purpose
Run private Jira-backed refreshes in `bugtracker-workshop`, then publish only aggregate/static output to the public `bugtracker` repo.

This keeps credentials and private access in the workshop repo while exposing only safe report artifacts publicly.

## Cadence
- Sprint length: 2 weeks
- Trigger moment: Sunday at 23:00 (local time), at the end of each sprint
- First scheduled run: Sunday, February 15, 2026 at 23:00 (local time)
- Recurrence: every 2 weeks from that first run

## End-to-End Flow
1. In `bugtracker-workshop`, run data refresh:
   - `npm run refresh:full`
   - Script: `scripts/refresh-report-data.mjs`
2. If refresh succeeds, generate analysis brief:
   - `npm run analyze:brief`
   - Outputs:
     - `reports/latest-analysis.md`
     - `reports/history/analysis-<timestamp>.md`
3. If analysis succeeds, export approved files for public consumption:
   - `npm run export:public -- --target /Users/yoramtap/Documents/AI/bugtracker`
4. In `bugtracker`, commit and push:
   - Commit includes updated aggregate report data/UI artifacts
   - Push to GitHub so reports are live

## Security Rationale
- Jira authentication stays in `bugtracker-workshop` via `.env.backlog` / `.env.local`.
- `bugtracker` receives only aggregate/static outputs (for example: `snapshot.json`, `index.html`, `app.js`, `styles.css`).
- No issue-level secrets or credentials are published.

## Automation Requirements
Automation should:
1. Run on the biweekly Sunday 23:00 cadence.
2. Stop immediately on refresh failure (do not publish partial/failed data).
3. Stop immediately on analysis failure.
4. Export only approved files to `bugtracker`.
5. Commit only when there are actual file changes.
6. Push to GitHub automatically.
7. Log run status and failure reason.
8. Notify on failure (at minimum via workflow logs; optional Slack notification).

## Suggested Implementation Notes
- Use GitHub Actions in `bugtracker-workshop` as the scheduler/orchestrator.
- Because GitHub cron is UTC, convert local 23:00 to UTC in workflow schedule.
- If needed for strict two-week cadence, add a guard in the workflow to skip off-weeks and run only on sprint-close weeks anchored to 2026-02-15.

## Codex Local Automation (Preferred)
Because this workflow runs locally, use Codex automation as the scheduler/orchestrator.

### Schedule
- Weekly trigger: Sunday at 23:00 local time
- Biweekly guard: proceed only on sprint-close weeks anchored to Sunday, 2026-02-15
- Off-weeks: skip safely and report "skipped (off-week)"

### Task Steps
1. In `/Users/yoramtap/Documents/AI/bugtracker-workshop`:
   - Run `npm run refresh:full`
   - If failed: stop and report failure
2. In `/Users/yoramtap/Documents/AI/bugtracker-workshop`:
   - Run `npm run analyze:brief`
   - If failed: stop and report failure
   - Verify `reports/latest-analysis.md` exists
   - Capture newest `reports/history/analysis-*.md` as `analysis_history_file`
3. In `/Users/yoramtap/Documents/AI/bugtracker-workshop`:
   - Run `npm run export:public -- --target /Users/yoramtap/Documents/AI/bugtracker`
4. In `/Users/yoramtap/Documents/AI/bugtracker`:
   - Check for file changes
   - If no changes: report "no changes"
   - If changes: commit and push to GitHub

### Output Required Per Run
- `refreshed`: yes/no
- `analyzed`: yes/no
- `exported`: yes/no
- `committed`: yes/no
- `pushed`: yes/no
- `analysis_latest_file`: path
- `analysis_history_file`: path
- `result`: success | failed | skipped
- `details`: error or skip reason when applicable

## Success Criteria
- Refresh and publish complete without manual steps every two weeks.
- Public repo updates are visible on GitHub after each successful run.
- Credentials remain only in the private workshop repo.
