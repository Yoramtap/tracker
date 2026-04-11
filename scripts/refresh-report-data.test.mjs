import assert from "node:assert/strict";
import test from "node:test";

import {
  attachPrCycleAvgInflow,
  buildPrCycleFetchRequest,
  buildPrCycleSnapshotState,
  buildPrActivitySnapshotState,
  buildTrendRefreshDateState,
  fetchPrCycleIssueBreakdown,
  fetchGitHubPrActivity,
  loadPrActivityRepoTeamMapConfig,
  normalizeGitHubPullRequestRecord,
  normalizeGitHubReviewToMergeRecord,
  resolveTrendDates,
  resolveGitHubAccessToken,
  resolvePrActivityHistoryPlan,
  resolvePrCycleRefreshPlan,
  selectPrCycleScrumScopeSprints
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
      key: "14d",
      windowDays: 14,
      windowLabel: "Last 14 days",
      windowStartDate: "2026-03-23",
      windowStartIso: "2026-03-23T00:00:00.000Z",
      windowEndIso: "2026-04-05T00:00:00.000Z",
      activeBoardScope: true
    },
    {
      key: "30d",
      windowDays: 30,
      windowLabel: "Last 30 days",
      windowStartDate: "2026-03-07",
      windowStartIso: "2026-03-07T00:00:00.000Z",
      windowEndIso: "2026-04-05T00:00:00.000Z"
    },
    {
      key: "90d",
      windowDays: 90,
      windowLabel: "Last 90 days",
      windowStartDate: "2026-01-07",
      windowStartIso: "2026-01-07T00:00:00.000Z",
      windowEndIso: "2026-04-05T00:00:00.000Z"
    },
    {
      key: "6m",
      windowDays: 183,
      windowLabel: "Last 6 months",
      windowStartDate: "2025-10-05",
      windowStartIso: "2025-10-05T00:00:00.000Z",
      windowEndIso: "2026-04-05T00:00:00.000Z"
    },
    {
      key: "1y",
      windowDays: 365,
      windowLabel: "Last year",
      windowStartDate: "2025-04-05",
      windowStartIso: "2025-04-05T00:00:00.000Z",
      windowEndIso: "2026-04-05T00:00:00.000Z"
    }
  ];
}

function makePrCycleFetchConfig() {
  return {
    projectKeys: ["TFC"],
    windowLabel: "Last 90 days",
    windowStartDate: "2026-01-07",
    windowStartIso: "2026-01-07T00:00:00.000Z",
    windowEndIso: "2026-04-06T00:00:00.000Z",
    codingStatuses: ["Coding"],
    reviewStatuses: ["In Review"],
    mergeStatuses: ["Merged"]
  };
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

test("resolveTrendDates reuses cached sprint dates across days until the active sprint rolls over", async () => {
  let cachedValue = null;
  let fetchBoardsCallCount = 0;
  let fetchSprintsCallCount = 0;
  const buildOptions = (todayIso) => ({
    fallbackDates: ["2026-03-16"],
    projectKey: "TFC",
    boardId: "",
    lookbackCount: 0,
    pointMode: "end",
    includeActive: true,
    mondayAnchor: true,
    todayIso,
    readCache: async () => cachedValue,
    writeCache: async (_outputPath, _tmpPath, value) => {
      cachedValue = value;
    },
    fetchBoards: async () => {
      fetchBoardsCallCount += 1;
      return [{ id: 42 }];
    },
    fetchSprints: async () => {
      fetchSprintsCallCount += 1;
      return [
        {
          id: 1001,
          state: "closed",
          endDate: "2026-03-16T10:00:00.000Z"
        },
        {
          id: 1002,
          state: "active",
          endDate: "2026-04-13T10:00:00.000Z"
        }
      ];
    }
  });

  const firstRun = await resolveTrendDates(
    "jira.example.com",
    "user",
    "token",
    buildOptions("2026-04-06")
  );
  const secondRun = await resolveTrendDates(
    "jira.example.com",
    "user",
    "token",
    buildOptions("2026-04-08")
  );
  const thirdRun = await resolveTrendDates(
    "jira.example.com",
    "user",
    "token",
    buildOptions("2026-04-14")
  );

  assert.deepEqual(firstRun.dates, ["2026-03-16", "2026-04-06"]);
  assert.deepEqual(firstRun.closedDates, ["2026-03-16"]);
  assert.deepEqual(secondRun.dates, ["2026-03-16", "2026-04-08"]);
  assert.deepEqual(secondRun.closedDates, ["2026-03-16"]);
  assert.deepEqual(thirdRun.dates, ["2026-03-16", "2026-04-13"]);
  assert.deepEqual(thirdRun.closedDates, ["2026-03-16"]);
  assert.equal(fetchBoardsCallCount, 2);
  assert.equal(fetchSprintsCallCount, 2);
  assert.ok(cachedValue?.entries && Object.keys(cachedValue.entries).length === 1);
});

test("loadPrActivityRepoTeamMapConfig reads the committed repo ownership map", async () => {
  const repoTeamMap = await loadPrActivityRepoTeamMapConfig();
  assert.equal(repoTeamMap["nepgpe/tfc-functionality-usvc"], "api");
  assert.equal(repoTeamMap["nepgpe/tfc-app"], "legacy");
  assert.equal(repoTeamMap["nepgpe/tfc-ui"], "react");
});

test("resolveGitHubAccessToken prefers the explicit override before gh auth", async () => {
  let execCallCount = 0;
  const token = await resolveGitHubAccessToken({
    githubToken: "explicit-token",
    execAuthToken: async () => {
      execCallCount += 1;
      return "cli-token";
    }
  });

  assert.equal(token, "explicit-token");
  assert.equal(execCallCount, 0);
});

test("normalizeGitHubPullRequestRecord excludes drafts and maps non-draft GitHub PRs", () => {
  assert.equal(
    normalizeGitHubPullRequestRecord("nepgpe/tfc-functionality-usvc", "api", {
      number: 153,
      draft: true,
      state: "open",
      created_at: "2026-03-24T02:26:46Z",
      merged_at: null,
      html_url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/153"
    }),
    null
  );

  assert.deepEqual(
    normalizeGitHubPullRequestRecord("nepgpe/tfc-functionality-usvc", "api", {
      number: 152,
      draft: false,
      state: "closed",
      created_at: "2026-03-13T12:24:00Z",
      merged_at: "2026-03-19T08:27:29Z",
      html_url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/152"
    }),
    {
      uniqueKey: "nepgpe/tfc-functionality-usvc#152",
      team: "api",
      offeredProxyDate: "2026-03-13",
      mergedProxyDate: "2026-03-19",
      status: "MERGED",
      url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/152",
      repositoryId: "nepgpe/tfc-functionality-usvc",
      pullRequestId: "152",
      issueKey: ""
    }
  );
});

test("fetchGitHubPrActivity builds non-draft PR activity rows from repo mappings", async () => {
  const prActivity = await fetchGitHubPrActivity("2026-03-01", {
    repoTeamMap: {
      "nepgpe/tfc-functionality-usvc": "api",
      "nepgpe/tfc-ui": "react"
    },
    githubToken: "test-token",
    fetchRepoPage: async (repo, page) => {
      if (page !== 1) return [];
      if (repo === "nepgpe/tfc-functionality-usvc") {
        return [
          {
            number: 152,
            draft: false,
            state: "closed",
            created_at: "2026-03-13T12:24:00Z",
            merged_at: "2026-03-19T08:27:29Z",
            updated_at: "2026-03-19T08:27:29Z",
            html_url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/152",
            user: { login: "author_nepgroup" }
          },
          {
            number: 151,
            draft: true,
            state: "closed",
            created_at: "2026-03-06T09:56:34Z",
            merged_at: "2026-03-11T11:01:19Z",
            updated_at: "2026-03-11T11:01:19Z",
            html_url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/151",
            user: { login: "author_nepgroup" }
          }
        ];
      }
      return [
        {
          number: 901,
          draft: false,
          state: "open",
          created_at: "2026-03-20T10:00:00Z",
          merged_at: null,
          updated_at: "2026-03-20T10:00:00Z",
          html_url: "https://github.com/nepgpe/tfc-ui/pull/901",
          user: { login: "ui_author_nepgroup" }
        }
      ];
    },
    fetchReviewsPage: async (repo, pullNumber, page) => {
      assert.equal(page, 1);
      if (repo === "nepgpe/tfc-functionality-usvc" && pullNumber === 152) {
        return [
          {
            state: "COMMENTED",
            submitted_at: "2026-03-13T13:03:28Z",
            user: { login: "reviewer_nepgroup" }
          },
          {
            state: "APPROVED",
            submitted_at: "2026-03-18T10:28:03Z",
            user: { login: "another-reviewer_nepgroup" }
          }
        ];
      }
      return [];
    }
  });

  assert.equal(prActivity.source, "github_pull_requests");
  assert.equal(prActivity.candidateIssueCount, 2);
  assert.equal(prActivity.detailIssueCount, 2);
  assert.equal(prActivity.uniquePrCount, 2);
  assert.equal(prActivity.reviewChangelogIssueCount, 1);
  assert.deepEqual(prActivity.ticketReviewToMergeRecords, [
    {
      issueKey: "nepgpe/tfc-functionality-usvc#152",
      team: "api",
      reviewStartedAt: "2026-03-18",
      mergedProxyDate: "2026-03-19",
      reviewToMergeDays: 1
    }
  ]);
  assert.deepEqual(
    prActivity.records.map((record) => ({
      uniqueKey: record.uniqueKey,
      team: record.team,
      offeredProxyDate: record.offeredProxyDate,
      mergedProxyDate: record.mergedProxyDate,
      status: record.status
    })),
    [
      {
        uniqueKey: "nepgpe/tfc-functionality-usvc#152",
        team: "api",
        offeredProxyDate: "2026-03-13",
        mergedProxyDate: "2026-03-19",
        status: "MERGED"
      },
      {
        uniqueKey: "nepgpe/tfc-ui#901",
        team: "react",
        offeredProxyDate: "2026-03-20",
        mergedProxyDate: "",
        status: "OPEN"
      }
    ]
  );
});

test("normalizeGitHubReviewToMergeRecord uses the latest submitted non-author review", () => {
  assert.deepEqual(
    normalizeGitHubReviewToMergeRecord(
      "nepgpe/tfc-functionality-usvc",
      "api",
      {
        number: 152,
        draft: false,
        state: "closed",
        created_at: "2026-03-13T12:24:00Z",
        merged_at: "2026-03-19T08:27:29Z",
        html_url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/152",
        user: { login: "author_nepgroup" }
      },
      [
        {
          state: "COMMENTED",
          submitted_at: "2026-03-13T12:30:00Z",
          user: { login: "author_nepgroup" }
        },
        {
          state: "COMMENTED",
          submitted_at: "2026-03-13T13:03:28Z",
          user: { login: "reviewer_nepgroup" }
        },
        {
          state: "APPROVED",
          submitted_at: "2026-03-18T10:28:03Z",
          user: { login: "another-reviewer_nepgroup" }
        }
      ]
    ),
    {
      issueKey: "nepgpe/tfc-functionality-usvc#152",
      team: "api",
      reviewStartedAt: "2026-03-18",
      mergedProxyDate: "2026-03-19",
      reviewToMergeDays: 1
    }
  );

  assert.equal(
    normalizeGitHubReviewToMergeRecord(
      "nepgpe/tfc-functionality-usvc",
      "api",
      {
        number: 153,
        draft: false,
        state: "closed",
        created_at: "2026-03-13T12:24:00Z",
        merged_at: "2026-03-19T08:27:29Z",
        html_url: "https://github.com/nepgpe/tfc-functionality-usvc/pull/153",
        user: { login: "author_nepgroup" }
      },
      [{ state: "PENDING", submitted_at: null, user: { login: "reviewer_nepgroup" } }]
    ),
    null
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

test("buildPrActivitySnapshotState excludes the current in-progress sprint from sprint points", () => {
  const prActivityState = buildPrActivitySnapshotState(
    "2026-04-05",
    {
      dates: ["2026-03-16", "2026-03-30", "2026-04-13"],
      closedDates: ["2026-03-16", "2026-03-30"],
      usedFallback: false
    },
    {
      candidateIssueCount: 1,
      detailIssueCount: 1,
      uniquePrCount: 1,
      reviewChangelogIssueCount: 0,
      cacheHitCount: 0,
      cacheWriteCount: 0,
      records: [
        {
          team: "api",
          status: "OPEN",
          offeredProxyDate: "2026-04-05",
          mergedProxyDate: ""
        }
      ],
      ticketReviewToMergeRecords: []
    }
  );

  assert.deepEqual(prActivityState.prActivitySprintDates, ["2026-03-16", "2026-03-30"]);
  assert.deepEqual(
    prActivityState.refreshedPrActivity.points.map((point) => point.date),
    ["2026-03-16", "2026-03-30"]
  );
  assert.equal(prActivityState.refreshedPrActivity.points[0].api.offered, 0);
  assert.equal(prActivityState.refreshedPrActivity.points[1].api.offered, 0);
});

test("buildPrActivitySnapshotState excludes pre-window opens from sprint offered counts but keeps merged counts", () => {
  const prActivityState = buildPrActivitySnapshotState(
    "2026-04-05",
    {
      dates: ["2026-03-16", "2026-03-30"],
      closedDates: ["2026-03-16", "2026-03-30"],
      usedFallback: false
    },
    {
      candidateIssueCount: 2,
      detailIssueCount: 2,
      uniquePrCount: 2,
      reviewChangelogIssueCount: 1,
      cacheHitCount: 0,
      cacheWriteCount: 0,
      records: [
        {
          team: "bc",
          status: "MERGED",
          offeredProxyDate: "2025-02-25",
          mergedProxyDate: "2026-03-20"
        },
        {
          team: "bc",
          status: "MERGED",
          offeredProxyDate: "2026-03-10",
          mergedProxyDate: "2026-03-20"
        }
      ],
      ticketReviewToMergeRecords: [
        {
          team: "bc",
          mergedProxyDate: "2026-03-20",
          reviewToMergeDays: 4
        }
      ]
    }
  );

  assert.equal(prActivityState.refreshedPrActivity.points[0].bc.offered, 1);
  assert.equal(prActivityState.refreshedPrActivity.points[1].bc.offered, 0);
  assert.equal(prActivityState.refreshedPrActivity.points[1].bc.merged, 2);
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

test("buildPrActivitySnapshotState includes the current month in monthly points before the next sprint closes", () => {
  const prActivityState = buildPrActivitySnapshotState(
    "2026-04-05",
    {
      dates: ["2025-02-02", "2025-04-07", "2026-03-16", "2026-03-30"],
      closedDates: ["2026-03-16", "2026-03-30"],
      usedFallback: false
    },
    {
      candidateIssueCount: 1,
      detailIssueCount: 1,
      uniquePrCount: 1,
      reviewChangelogIssueCount: 1,
      cacheHitCount: 0,
      cacheWriteCount: 0,
      records: [
        {
          team: "api",
          status: "MERGED",
          offeredProxyDate: "2026-04-05",
          mergedProxyDate: "2026-04-05"
        }
      ],
      ticketReviewToMergeRecords: [
        {
          team: "api",
          mergedProxyDate: "2026-04-05",
          reviewToMergeDays: 1
        }
      ]
    }
  );

  assert.equal(prActivityState.latestClosedSprintDate, "2026-03-30");
  assert.equal(prActivityState.refreshedPrActivity.monthlySince, "2026-04-01");
  assert.deepEqual(
    prActivityState.refreshedPrActivity.monthlyPoints.map((point) => point.date),
    ["2026-04-01"]
  );
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].api.offered, 1);
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].api.merged, 1);
});

test("buildPrActivitySnapshotState counts monthly merges even when the PR was opened before the refresh floor", () => {
  const prActivityState = buildPrActivitySnapshotState(
    "2026-04-05",
    {
      dates: ["2026-03-16", "2026-03-30"],
      closedDates: ["2026-03-16", "2026-03-30"],
      usedFallback: false
    },
    {
      candidateIssueCount: 2,
      detailIssueCount: 2,
      uniquePrCount: 2,
      reviewChangelogIssueCount: 2,
      cacheHitCount: 0,
      cacheWriteCount: 0,
      records: [
        {
          team: "bc",
          status: "MERGED",
          offeredProxyDate: "2025-02-25",
          mergedProxyDate: "2026-04-05"
        },
        {
          team: "bc",
          status: "MERGED",
          offeredProxyDate: "2026-04-01",
          mergedProxyDate: "2026-04-01"
        }
      ],
      ticketReviewToMergeRecords: [
        {
          team: "bc",
          mergedProxyDate: "2026-04-05",
          reviewToMergeDays: 404
        },
        {
          team: "bc",
          mergedProxyDate: "2026-04-01",
          reviewToMergeDays: 0
        }
      ]
    }
  );

  assert.equal(prActivityState.refreshedPrActivity.monthlySince, "2026-04-01");
  assert.deepEqual(
    prActivityState.refreshedPrActivity.monthlyPoints.map((point) => point.date),
    ["2026-04-01"]
  );
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].bc.offered, 1);
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].bc.merged, 2);
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].bc.avgReviewToMergeSampleCount, 2);
  assert.equal(prActivityState.refreshedPrActivity.monthlyPoints[0].bc.avgReviewToMergeDays, 202);
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
  const freshUpdatedAt = new Date().toISOString();
  const refreshPlan = resolvePrCycleRefreshPlan(
    makePrCycleWindows(),
    {
      updatedAt: freshUpdatedAt,
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
    ["14d", "30d", "90d"]
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
    ["14d", "30d", "90d", "6m", "1y"]
  );
  assert.equal(refreshPlan.prCycleRangeStartDate, "2025-04-05");
});

test("selectPrCycleScrumScopeSprints prefers active sprints and otherwise falls back to latest closed sprint", () => {
  assert.deepEqual(
    selectPrCycleScrumScopeSprints([
      { id: 1, state: "closed", completeDate: "2026-04-05T09:00:00.000Z" },
      { id: 2, state: "active", startDate: "2026-04-06T09:00:00.000Z" },
      { id: 3, state: "future", startDate: "2026-04-20T09:00:00.000Z" }
    ]).map((sprint) => sprint.id),
    [2]
  );

  assert.deepEqual(
    selectPrCycleScrumScopeSprints([
      { id: 10, state: "closed", completeDate: "2026-04-01T09:00:00.000Z" },
      { id: 11, state: "closed", completeDate: "2026-04-08T09:00:00.000Z" },
      { id: 12, state: "future", startDate: "2026-04-15T09:00:00.000Z" }
    ]).map((sprint) => sprint.id),
    [11]
  );
});

test("buildPrCycleFetchRequest uses the widest window selected by the refresh plan", () => {
  const fetchRequest = buildPrCycleFetchRequest(
    {
      prCycleProjectKeys: ["TFC", "MESO"],
      prCycleCodingStatuses: ["Coding"],
      prCycleReviewStatuses: ["In Review"],
      prCycleMergeStatuses: ["Merged"]
    },
    {
      prCycleWindowsToRefresh: makePrCycleWindows().slice(0, 3),
      prCycleRangeStartDate: "2026-01-07"
    }
  );

  assert.deepEqual(fetchRequest.projectKeys, ["TFC", "MESO"]);
  assert.equal(fetchRequest.windowDays, 90);
  assert.equal(fetchRequest.windowLabel, "Last 90 days");
  assert.equal(fetchRequest.windowStartDate, "2026-01-07");
  assert.equal(fetchRequest.windowStartIso, "2026-01-07T00:00:00.000Z");
  assert.deepEqual(fetchRequest.codingStatuses, ["Coding"]);
  assert.deepEqual(fetchRequest.reviewStatuses, ["In Review"]);
  assert.deepEqual(fetchRequest.mergeStatuses, ["Merged"]);
  assert.match(fetchRequest.windowEndIso, /^\d{4}-\d{2}-\d{2}T/);
});

test("fetchPrCycleIssueBreakdown reuses cached changelogs for unchanged issues", async () => {
  let cachedValue = null;
  let fetchChangelogCallCount = 0;
  const config = makePrCycleFetchConfig();
  const issues = [
    {
      key: "TFC-1",
      fields: {
        labels: ["API"],
        status: { name: "Coding" },
        created: "2026-03-01T10:00:00.000Z",
        updated: "2026-04-05T12:00:00.000Z",
        resolutiondate: null,
        statuscategorychangedate: "2026-04-05T12:00:00.000Z"
      }
    },
    {
      key: "TFC-2",
      fields: {
        labels: ["Broadcast"],
        status: { name: "In Review" },
        created: "2026-03-10T10:00:00.000Z",
        updated: "2026-04-04T12:00:00.000Z",
        resolutiondate: null,
        statuscategorychangedate: "2026-04-04T12:00:00.000Z"
      }
    }
  ];

  const firstRun = await fetchPrCycleIssueBreakdown("jira.example.com", "user", "token", config, {
    readCache: async () => cachedValue,
    writeCache: async (_outputPath, _tmpPath, value) => {
      cachedValue = value;
    },
    searchIssues: async () => issues,
    fetchChangelog: async () => {
      fetchChangelogCallCount += 1;
      return { histories: [] };
    }
  });
  const secondRun = await fetchPrCycleIssueBreakdown(
    "jira.example.com",
    "user",
    "token",
    config,
    {
      readCache: async () => cachedValue,
      writeCache: async (_outputPath, _tmpPath, value) => {
        cachedValue = value;
      },
      searchIssues: async () => issues,
      fetchChangelog: async () => {
        fetchChangelogCallCount += 1;
        return { histories: [] };
      }
    }
  );

  assert.equal(firstRun.rows.length, 2);
  assert.equal(firstRun.changelogCacheHitCount, 0);
  assert.equal(firstRun.changelogCacheWriteCount, 2);
  assert.equal(secondRun.rows.length, 2);
  assert.equal(secondRun.changelogCacheHitCount, 2);
  assert.equal(secondRun.changelogCacheWriteCount, 0);
  assert.equal(fetchChangelogCallCount, 2);
  assert.ok(cachedValue?.issues?.["TFC-1"]);
  assert.ok(cachedValue?.issues?.["TFC-2"]);
});

test("buildPrCycleSnapshotState preserves cached long windows when reuse is enabled", () => {
  const snapshotState = buildPrCycleSnapshotState(
    {
      prCycleCodingStatuses: ["Coding"],
      prCycleReviewStatuses: ["In Review"],
      prCycleMergeStatuses: ["Merged"]
    },
    {
      defaultWindow: "6m",
      windows: {
        "6m": { windowLabel: "Last 6 months", teams: [{ key: "api", marker: "cached-6m" }] },
        "1y": { windowLabel: "Last year", teams: [{ key: "api", marker: "cached-1y" }] }
      }
    },
    {
      reuseHistoricalPrCycleWindows: true,
      prCycleWindowsToRefresh: makePrCycleWindows().slice(0, 3)
    },
    []
  );

  assert.equal(snapshotState.prCycleSnapshot.defaultWindow, "6m");
  assert.deepEqual(Object.keys(snapshotState.prCycleSnapshot.windows), ["6m", "1y", "14d", "30d", "90d"]);
  assert.equal(snapshotState.prCycleSnapshot.windows["6m"].teams[0].marker, "cached-6m");
  assert.equal(snapshotState.prCycleSnapshot.windows["1y"].teams[0].marker, "cached-1y");
  assert.equal(snapshotState.prCycleSnapshot.windows["14d"].windowLabel, "Last 14 days");
  assert.equal(snapshotState.prCycleSnapshot.windows["30d"].windowLabel, "Last 30 days");
  assert.equal(snapshotState.prCycleSnapshot.windows["90d"].windowLabel, "Last 90 days");
});

test("buildPrCycleSnapshotState filters active-board windows to board-scoped issue keys", () => {
  const snapshotState = buildPrCycleSnapshotState(
    {
      prCycleCodingStatuses: ["Coding"],
      prCycleReviewStatuses: ["In Review"],
      prCycleMergeStatuses: ["Merged"]
    },
    null,
    {
      reuseHistoricalPrCycleWindows: false,
      prCycleWindowsToRefresh: [
        {
          key: "14d",
          windowDays: 14,
          windowLabel: "Last 14 days",
          windowStartDate: "2026-03-23",
          windowStartIso: "2026-03-23T00:00:00.000Z",
          windowEndIso: "2026-04-05T00:00:00.000Z",
          activeBoardScope: true,
          activeIssueKeysByTeam: {
            api: new Set(["TFC-2"])
          }
        }
      ]
    },
    [
      {
        issueKey: "TFC-1",
        team: "api",
        intervals: [
          {
            status: "In Review",
            start: "2026-03-28T00:00:00.000Z",
            end: "2026-04-02T00:00:00.000Z"
          }
        ]
      },
      {
        issueKey: "TFC-2",
        team: "api",
        intervals: [
          {
            status: "In Review",
            start: "2026-03-29T00:00:00.000Z",
            end: "2026-04-01T00:00:00.000Z"
          }
        ]
      }
    ]
  );

  const apiTeam = snapshotState.prCycleSnapshot.windows["14d"].teams.find((team) => team.key === "api");
  assert.equal(apiTeam.issueCount, 1);
  assert.equal(apiTeam.totalCycleDays, 3);
  assert.equal(apiTeam.stages.find((stage) => stage.key === "review").sampleCount, 1);
});

test("attachPrCycleAvgInflow persists avg PR inflow into PR cycle windows from PR activity points", () => {
  const snapshot = {
    windows: {
      "14d": {
        windowLabel: "Last 14 days",
        teams: [
          { key: "api", label: "API", avgPrInflow: null },
          { key: "bc", label: "BC", avgPrInflow: null }
        ]
      },
      "30d": {
        windowLabel: "Last 30 days",
        teams: [
          { key: "api", label: "API", avgPrInflow: null },
          { key: "bc", label: "BC", avgPrInflow: null }
        ]
      }
    }
  };
  const prActivity = {
    points: [
      {
        date: "2026-03-02",
        api: { offered: 10 },
        bc: { offered: 4 }
      },
      {
        date: "2026-03-16",
        api: { offered: 20 },
        bc: { offered: 6 }
      },
      {
        date: "2026-03-30",
        api: { offered: 30 },
        bc: { offered: 8 }
      }
    ]
  };

  const result = attachPrCycleAvgInflow(snapshot, prActivity);
  const apiTeam14d = result.windows["14d"].teams.find((team) => team.key === "api");
  const bcTeam14d = result.windows["14d"].teams.find((team) => team.key === "bc");
  const apiTeam = result.windows["30d"].teams.find((team) => team.key === "api");
  const bcTeam = result.windows["30d"].teams.find((team) => team.key === "bc");

  assert.equal(apiTeam14d.avgPrInflow, 30);
  assert.equal(bcTeam14d.avgPrInflow, 8);
  assert.equal(apiTeam.avgPrInflow, 20);
  assert.equal(bcTeam.avgPrInflow, 6);
});
