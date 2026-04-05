import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrActivitySnapshotState,
  buildTrendRefreshDateState,
  resolvePrActivityHistoryPlan,
  resolvePrCycleRefreshPlan
} from "./refresh-report-data.mjs";

function makePrActivityRows() {
  return {
    candidateIssueCount: 3,
    detailIssueCount: 2,
    uniquePrCount: 1,
    reviewChangelogIssueCount: 1,
    cacheHitCount: 0,
    cacheWriteCount: 0,
    records: [
      {
        team: "api",
        status: "MERGED",
        offeredProxyDate: "2026-03-15",
        mergedProxyDate: "2026-03-20"
      }
    ],
    ticketReviewToMergeRecords: [
      {
        team: "api",
        mergedProxyDate: "2026-03-20",
        reviewToMergeDays: 6
      }
    ]
  };
}

function makePrCycleWindows() {
  return [
    {
      key: "30d",
      windowDays: 30,
      windowLabel: "Last 30 days",
      windowStartDate: "2026-03-07"
    },
    {
      key: "90d",
      windowDays: 90,
      windowLabel: "Last 90 days",
      windowStartDate: "2026-01-07"
    },
    {
      key: "6m",
      windowDays: 183,
      windowLabel: "Last 6 months",
      windowStartDate: "2025-10-05"
    },
    {
      key: "1y",
      windowDays: 365,
      windowLabel: "Last year",
      windowStartDate: "2025-04-05"
    }
  ];
}

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

test("buildPrActivitySnapshotState reuses cached history but truncates later points in normal mode", () => {
  const prActivityState = buildPrActivitySnapshotState(
    "2026-04-05",
    {
      dates: ["2025-02-02", "2025-04-07", "2026-03-16", "2026-03-30"],
      closedDates: ["2026-03-16", "2026-03-30"],
      usedFallback: false
    },
    makePrActivityRows(),
    {
      reuseHistoricalPrActivity: true,
      existingPrActivityForMerge: {
        points: [{ date: "2025-04-07", marker: "old" }, { date: "2026-04-05", marker: "late" }],
        monthlyPoints: [
          { date: "2025-04-01", marker: "old-month" },
          { date: "2026-04-01", marker: "late-month" }
        ]
      }
    }
  );

  assert.equal(prActivityState.prActivityWindowKey, "30d");
  assert.equal(prActivityState.prActivityFetchSinceDate, "2026-03-01");
  assert.deepEqual(prActivityState.prActivitySprintDates, ["2026-03-16", "2026-03-30"]);
  assert.equal(prActivityState.latestClosedSprintDate, "2026-03-30");
  assert.equal(prActivityState.refreshedPrActivity.monthlySince, "2026-03-01");
  assert.deepEqual(
    prActivityState.refreshedPrActivity.monthlyPoints.map((point) => point.date),
    ["2026-03-01"]
  );
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].api.offered, 1);
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].api.merged, 1);
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].api.avgReviewToMergeDays, 6);
  assert.deepEqual(
    prActivityState.mergedPrActivity.points.map((point) => point.date),
    ["2025-04-07", "2026-03-16", "2026-03-30"]
  );
  assert.deepEqual(
    prActivityState.mergedPrActivity.monthlyPoints.map((point) => point.date),
    ["2025-04-01", "2026-03-01"]
  );
});

test("buildPrActivitySnapshotState preserves later cached history when using fallback dates", () => {
  const prActivityState = buildPrActivitySnapshotState(
    "2026-04-05",
    {
      dates: ["2025-02-02", "2025-04-07", "2026-03-16", "2026-03-30"],
      closedDates: ["2026-03-16", "2026-03-30"],
      usedFallback: true
    },
    makePrActivityRows(),
    {
      reuseHistoricalPrActivity: true,
      existingPrActivityForMerge: {
        points: [{ date: "2025-04-07" }, { date: "2026-04-05" }],
        monthlyPoints: [{ date: "2025-04-01" }, { date: "2026-04-01" }]
      }
    }
  );

  assert.deepEqual(
    prActivityState.mergedPrActivity.points.map((point) => point.date),
    ["2025-04-07", "2026-03-16", "2026-03-30", "2026-04-05"]
  );
  assert.deepEqual(
    prActivityState.mergedPrActivity.monthlyPoints.map((point) => point.date),
    ["2025-04-01", "2026-03-01", "2026-04-01"]
  );
});

test("resolvePrActivityHistoryPlan reuses archived history when sprint and monthly buckets exist", () => {
  const historyPlan = resolvePrActivityHistoryPlan(
    {
      currentSnapshot: { updatedAt: "2026-04-05T10:00:00.000Z" },
      bestPrActivity: {
        points: [{ date: "2026-03-16" }],
        monthlyPoints: [{ date: "2026-03-01" }]
      },
      bestSource: "/tmp/archive-snapshot.json",
      bestMetrics: { pointsCount: 1, monthlyPointsCount: 1 }
    },
    { shouldRebuildPrActivityHistory: false }
  );

  assert.equal(historyPlan.canReuseHistoricalPrActivity, true);
  assert.equal(historyPlan.reuseHistoricalPrActivity, true);
  assert.equal(historyPlan.existingSnapshotForPrActivity.updatedAt, "2026-04-05T10:00:00.000Z");
  assert.equal(
    historyPlan.archivedHistoryWarning,
    "Using archived PR activity history from /tmp/archive-snapshot.json (1 sprint buckets, 1 monthly buckets) because current snapshot.json is missing older monthly history."
  );
});

test("resolvePrActivityHistoryPlan disables reuse during rebuilds and for incomplete history", () => {
  const historyPlan = resolvePrActivityHistoryPlan(
    {
      currentSnapshot: null,
      bestPrActivity: {
        points: [{ date: "2026-03-16" }],
        monthlyPoints: []
      },
      bestSource: "/tmp/archive-snapshot.json",
      bestMetrics: { pointsCount: 1, monthlyPointsCount: 0 }
    },
    { shouldRebuildPrActivityHistory: true }
  );

  assert.equal(historyPlan.canReuseHistoricalPrActivity, false);
  assert.equal(historyPlan.reuseHistoricalPrActivity, false);
  assert.equal(historyPlan.archivedHistoryWarning, "");
});

test("resolvePrCycleRefreshPlan reuses older cached windows when history is fresh", () => {
  const refreshPlan = resolvePrCycleRefreshPlan(
    makePrCycleWindows(),
    {
      updatedAt: "2026-04-04T12:00:00.000Z",
      windows: {
        "30d": { id: "30d" },
        "90d": { id: "90d" },
        "6m": { id: "6m" },
        "1y": { id: "1y" }
      }
    },
    {
      shouldRebuildAllWindows: false,
      todayIso: "2026-04-05"
    }
  );

  assert.equal(refreshPlan.historicalPrCycleSnapshotFreshEnough, true);
  assert.equal(refreshPlan.canReuseHistoricalPrCycleWindows, true);
  assert.equal(refreshPlan.reuseHistoricalPrCycleWindows, true);
  assert.deepEqual(
    refreshPlan.prCycleWindowsToRefresh.map((windowConfig) => windowConfig.key),
    ["30d", "90d"]
  );
  assert.equal(refreshPlan.prCycleRangeStartDate, "2026-01-07");
});

test("resolvePrCycleRefreshPlan refreshes all windows when rebuilding or history is stale", () => {
  const refreshPlan = resolvePrCycleRefreshPlan(
    makePrCycleWindows(),
    {
      updatedAt: "2026-03-01T00:00:00.000Z",
      windows: {
        "30d": { id: "30d" },
        "90d": { id: "90d" },
        "6m": { id: "6m" },
        "1y": { id: "1y" }
      }
    },
    {
      shouldRebuildAllWindows: true,
      todayIso: "2026-04-05"
    }
  );

  assert.equal(refreshPlan.reuseHistoricalPrCycleWindows, false);
  assert.deepEqual(
    refreshPlan.prCycleWindowsToRefresh.map((windowConfig) => windowConfig.key),
    ["30d", "90d", "6m", "1y"]
  );
  assert.equal(refreshPlan.prCycleRangeStartDate, "2025-04-05");
});
