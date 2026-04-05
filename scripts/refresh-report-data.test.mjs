import assert from "node:assert/strict";
import test from "node:test";

import { buildTrendRefreshDateState } from "./refresh-report-data.mjs";

test("buildTrendRefreshDateState trims resolved dates to sprint lookback count", () => {
  const trendDateState = buildTrendRefreshDateState(
    {
      sprintLookbackCount: 3,
      sprintPoint: "end",
      sprintIncludeActive: true,
      sprintMondayAnchor: true
    },
    {
      dates: ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15"],
      usedFallback: false
    }
  );

  assert.deepEqual(trendDateState.allResolvedDates, [
    "2026-01-01",
    "2026-01-15",
    "2026-02-01",
    "2026-02-15"
  ]);
  assert.deepEqual(trendDateState.dates, ["2026-01-15", "2026-02-01", "2026-02-15"]);
  assert.equal(trendDateState.logMethod, "log");
  assert.equal(
    trendDateState.logMessage,
    "Resolved 4 trend dates from Jira sprints (point=end, includeActive=true, mondayAnchor=true); using latest 3 for backlog trend."
  );
});

test("buildTrendRefreshDateState preserves fallback messaging and full date history", () => {
  const trendDateState = buildTrendRefreshDateState(
    {
      sprintLookbackCount: 0,
      sprintPoint: "start",
      sprintIncludeActive: false,
      sprintMondayAnchor: false
    },
    {
      dates: ["2026-03-01", "2026-03-15"],
      usedFallback: true,
      fallbackReason: "Jira sprint lookup failed"
    }
  );

  assert.deepEqual(trendDateState.allResolvedDates, ["2026-03-01", "2026-03-15"]);
  assert.deepEqual(trendDateState.dates, ["2026-03-01", "2026-03-15"]);
  assert.equal(trendDateState.logMethod, "warn");
  assert.equal(
    trendDateState.logMessage,
    "Using fallback trend dates (2 points, latest 2 used for backlog trend). Reason: Jira sprint lookup failed"
  );
});
