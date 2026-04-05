import assert from "node:assert/strict";
import test from "node:test";

import { createRefreshRunner } from "./refresh-runner.mjs";

function createDeps(overrides = {}) {
  const base = {
    allowEmpty: false,
    constants: {
      FALLBACK_DATES: [],
      PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY: "1y",
      PRIMARY_SNAPSHOT_PATH: "reports/snapshot.json"
    },
    io: {
      buildSupplementalWriteArtifacts: () => [],
      commitSnapshotRefresh: async () => {},
      preparePrimarySnapshotArtifacts: async () => [],
      readJsonFile: async () => ({}),
      writePrCycleSnapshotAtomic: async () => {},
      writeProductCycleShipmentsSnapshotAtomic: async () => {},
      writeProductCycleSnapshotAtomic: async () => {}
    },
    validators: {
      validateDashboardSnapshot: () => {}
    },
    refreshers: {
      refreshContributorsSnapshot: async () => ({}),
      refreshProductCycleSnapshot: async () => ({})
    },
    history: {
      countPrActivitySeriesPoints: () => 0,
      mergePrActivitySnapshots: (existing, refreshed) => refreshed || existing || {},
      readPrActivityHistoryState: async () => ({
        currentSnapshot: null,
        bestPrActivity: null,
        bestSource: null,
        bestMetrics: {
          pointsCount: 0,
          monthlyPointsCount: 0
        }
      })
    },
    helpers: {
      buildCombinedSnapshot: () => ({}),
      buildPrActivityRefreshState: async () => ({
        existingSnapshotForPrActivity: null,
        mergedPrActivity: {}
      }),
      buildPrActivityMonthlySnapshot: () => ({ since: "2024-01-01", points: [] }),
      buildPrActivitySprintSnapshot: () => ({ since: "2024-01-01", points: [] }),
      buildPrCycleRefreshSnapshot: async () => ({ id: "pr-cycle" }),
      buildTrendAndPrActivityState: async () => ({
        computed: {},
        mergedPrActivity: {},
        prCycleSnapshot: null
      }),
      buildUatRefreshArtifacts: async () => ({
        uatAging: { total: 3 },
        businessUnitChartData: { series: [1, 2, 3] }
      }),
      maybeRefreshSnapshot: async (skip, _message, buildSnapshot) =>
        skip ? null : buildSnapshot(),
      resolvePrActivityFetchSinceDate: () => "2024-01-01",
      resolveTrendDates: async () => ({ dates: [], closedDates: [], usedFallback: false }),
      updateExistingSnapshotPrActivity: (existingSnapshot, mergedPrActivity, syncedAt) => ({
        kind: "pr-activity",
        existingSnapshot,
        mergedPrActivity,
        syncedAt
      }),
      updateExistingSnapshotUat: (existingSnapshot, payload) => ({
        kind: "uat",
        existingSnapshot,
        payload
      }),
      validateRefreshConfig: () => {},
      withTiming: async (_label, work) => work()
    },
    jira: {
      env: "",
      fetchIssueChangelog: async () => [],
      fetchPrActivity: async () => ({
        uniquePrCount: 0,
        candidateIssueCount: 0,
        detailIssueCount: 0,
        reviewChangelogIssueCount: 0,
        cacheHitCount: 0,
        cacheWriteCount: 0
      }),
      jiraRequest: async () => ({}),
      mapWithConcurrency: async () => [],
      searchJiraIssues: async () => []
    },
    resolveStopAfterStage: (stage) => stage
  };

  return {
    ...base,
    ...overrides,
    constants: { ...base.constants, ...overrides.constants },
    io: { ...base.io, ...overrides.io },
    validators: { ...base.validators, ...overrides.validators },
    refreshers: { ...base.refreshers, ...overrides.refreshers },
    history: { ...base.history, ...overrides.history },
    helpers: { ...base.helpers, ...overrides.helpers },
    jira: { ...base.jira, ...overrides.jira }
  };
}

async function captureConsoleLogs(run) {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => {
    logs.push(args.join(" "));
  };

  try {
    await run(logs);
  } finally {
    console.log = originalLog;
  }
}

test("runUatOnlyRefresh skips reads and writes when noWrite is enabled", { concurrency: false }, async () => {
  const commitCalls = [];
  let readCount = 0;
  const runner = createRefreshRunner(
    createDeps({
      io: {
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        readJsonFile: async () => {
          readCount += 1;
          return {};
        }
      }
    })
  );

  await captureConsoleLogs(async (logs) => {
    await runner.runUatOnlyRefresh({
      noWrite: true,
      snapshotRetentionCount: 9
    });

    assert.deepEqual(logs, [
      "NO_WRITE=true: skipped snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json write (UAT_ONLY mode)."
    ]);
  });

  assert.equal(readCount, 0);
  assert.equal(commitCalls.length, 0);
});

test("runUatOnlyRefresh commits the updated primary snapshot with a shared syncedAt", async () => {
  const commitCalls = [];
  const existingSnapshot = { id: "existing-snapshot" };
  const runner = createRefreshRunner(
    createDeps({
      io: {
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        readJsonFile: async () => existingSnapshot
      }
    })
  );

  await runner.runUatOnlyRefresh({
    noWrite: false,
    snapshotRetentionCount: 7
  });

  assert.equal(commitCalls.length, 1);
  assert.equal(
    commitCalls[0].summaryMessage,
    "Wrote snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json (UAT_ONLY mode)."
  );
  assert.equal(commitCalls[0].snapshotRetentionCount, 7);
  assert.equal(commitCalls[0].snapshot.kind, "uat");
  assert.deepEqual(commitCalls[0].snapshot.existingSnapshot, existingSnapshot);
  assert.equal(commitCalls[0].snapshot.payload.syncedAt, commitCalls[0].syncedAt);
});

test("runPrActivityOnlyRefresh reuses the provided snapshot and commits with a shared syncedAt", async () => {
  const commitCalls = [];
  const sharedState = {
    existingSnapshotForPrActivity: { id: "shared-existing-snapshot" },
    mergedPrActivity: { points: [{ date: "2024-01-01", count: 2 }] }
  };
  const runner = createRefreshRunner(
    createDeps({
      io: {
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        readJsonFile: async () => {
          throw new Error("readJsonFile should not run when sharedState already has a snapshot.");
        }
      }
    })
  );

  await runner.runPrActivityOnlyRefresh(
    {
      noWrite: false,
      snapshotRetentionCount: 5
    },
    sharedState
  );

  assert.equal(commitCalls.length, 1);
  assert.equal(
    commitCalls[0].summaryMessage,
    "Wrote snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json (PR_ACTIVITY_ONLY mode)."
  );
  assert.equal(commitCalls[0].snapshot.kind, "pr-activity");
  assert.deepEqual(commitCalls[0].snapshot.existingSnapshot, sharedState.existingSnapshotForPrActivity);
  assert.deepEqual(commitCalls[0].snapshot.mergedPrActivity, sharedState.mergedPrActivity);
  assert.equal(commitCalls[0].snapshot.syncedAt, commitCalls[0].syncedAt);
});

test("hasModeSpecificRefresh reports whether a mode-specific refresh is enabled", () => {
  const runner = createRefreshRunner(createDeps());

  assert.equal(
    runner.hasModeSpecificRefresh({
      uatOnly: false,
      productCycleOnly: false,
      prCycleOnly: false,
      prActivityOnly: false
    }),
    false
  );
  assert.equal(
    runner.hasModeSpecificRefresh({
      uatOnly: false,
      productCycleOnly: false,
      prCycleOnly: true,
      prActivityOnly: false
    }),
    true
  );
});

test("runModeSpecificRefresh returns false when no mode is enabled", async () => {
  let buildPrCycleCalls = 0;
  const runner = createRefreshRunner(
    createDeps({
      helpers: {
        buildPrCycleRefreshSnapshot: async () => {
          buildPrCycleCalls += 1;
          return { id: "pr-cycle" };
        }
      }
    })
  );

  const handled = await runner.runModeSpecificRefresh(
    {
      uatOnly: false,
      productCycleOnly: false,
      prCycleOnly: false,
      prActivityOnly: false
    },
    "2026-04-05"
  );

  assert.equal(handled, false);
  assert.equal(buildPrCycleCalls, 0);
});

test("runModeSpecificRefresh dispatches PR_CYCLE_ONLY with the provided todayIso", async () => {
  let capturedTodayIso = "";
  const writes = [];
  const runner = createRefreshRunner(
    createDeps({
      io: {
        writePrCycleSnapshotAtomic: async (snapshot) => {
          writes.push(snapshot);
        }
      },
      helpers: {
        buildPrCycleRefreshSnapshot: async (_config, todayIso) => {
          capturedTodayIso = todayIso;
          return { id: "pr-cycle", todayIso };
        }
      }
    })
  );

  let handled = false;
  await captureConsoleLogs(async () => {
    handled = await runner.runModeSpecificRefresh(
      {
        uatOnly: false,
        productCycleOnly: false,
        prCycleOnly: true,
        prActivityOnly: false,
        noWrite: false
      },
      "2026-04-05"
    );
  });

  assert.equal(handled, true);
  assert.equal(capturedTodayIso, "2026-04-05");
  assert.deepEqual(writes, [{ id: "pr-cycle", todayIso: "2026-04-05" }]);
});

test("runModeSpecificRefresh dispatches PR_ACTIVITY_ONLY through the shared PR activity state helper", async () => {
  let capturedTodayIso = "";
  let readCount = 0;
  const commitCalls = [];
  const sharedState = {
    existingSnapshotForPrActivity: { id: "shared-existing-snapshot" },
    mergedPrActivity: { points: [{ date: "2024-01-01", count: 4 }] }
  };
  const runner = createRefreshRunner(
    createDeps({
      io: {
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        readJsonFile: async () => {
          readCount += 1;
          return {};
        }
      },
      helpers: {
        buildPrActivityRefreshState: async (_config, todayIso) => {
          capturedTodayIso = todayIso;
          return sharedState;
        }
      }
    })
  );

  const handled = await runner.runModeSpecificRefresh(
    {
      uatOnly: false,
      productCycleOnly: false,
      prCycleOnly: false,
      prActivityOnly: true,
      noWrite: false,
      snapshotRetentionCount: 3,
      site: "jira.example.test",
      email: "dev@example.test",
      token: "token",
      sprintProject: "TFC",
      sprintBoardId: "42",
      sprintPoint: "end",
      sprintIncludeActive: true,
      sprintMondayAnchor: true
    },
    "2026-04-05"
  );

  assert.equal(handled, true);
  assert.equal(capturedTodayIso, "2026-04-05");
  assert.equal(readCount, 0);
  assert.equal(commitCalls.length, 1);
  assert.deepEqual(
    commitCalls[0].snapshot.existingSnapshot,
    sharedState.existingSnapshotForPrActivity
  );
  assert.deepEqual(commitCalls[0].snapshot.mergedPrActivity, sharedState.mergedPrActivity);
});

test("runFullRefreshPipeline assembles derive-stage state from fetched snapshots", async () => {
  const contributorsSnapshot = { id: "contributors" };
  const productCycleSnapshot = { id: "product-cycle" };
  const prCycleSnapshot = { id: "pr-cycle" };
  const mergedPrActivity = { id: "pr-activity" };
  const snapshot = { id: "combined-snapshot" };
  const supplementalArtifacts = [
    {
      fileName: "contributors-snapshot.json",
      outputSnapshot: { id: "contributors-output" },
      logMessage: "",
      write: async () => {}
    }
  ];
  const buildCombinedCalls = [];
  const supplementalArtifactCalls = [];
  const runner = createRefreshRunner(
    createDeps({
      io: {
        buildSupplementalWriteArtifacts: (payload) => {
          supplementalArtifactCalls.push(payload);
          return supplementalArtifacts;
        }
      },
      helpers: {
        buildCombinedSnapshot: (...args) => {
          buildCombinedCalls.push(args);
          return snapshot;
        },
        buildTrendAndPrActivityState: async () => ({
          computed: {
            BOARD_38_TREND: [{ highest: 1, high: 2, medium: 3, low: 4, lowest: 5 }]
          },
          mergedPrActivity,
          prCycleSnapshot
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 3 },
          businessUnitChartData: { series: [1, 2, 3] }
        })
      },
      refreshers: {
        refreshContributorsSnapshot: async () => contributorsSnapshot,
        refreshProductCycleSnapshot: async () => productCycleSnapshot
      }
    })
  );

  const derivedState = await runner.runFullRefreshPipeline(
    {
      noWrite: false,
      skipContributors: false,
      skipProductCycle: false,
      snapshotRetentionCount: 11
    },
    {
      stopAfterStage: "derive",
      todayIso: "2026-04-05"
    }
  );

  assert.equal(derivedState.todayIso, "2026-04-05");
  assert.equal(derivedState.grandTotal, 15);
  assert.equal(typeof derivedState.syncedAt, "string");
  assert.deepEqual(derivedState.snapshot, snapshot);
  assert.equal(
    derivedState.summaryMessage,
    "Updated snapshot.json for BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, BOARD_40_TREND, BOARD_333_TREND, and BOARD_399_TREND."
  );
  assert.equal(derivedState.snapshotRetentionCount, 11);
  assert.equal(derivedState.supplementalArtifacts, supplementalArtifacts);
  assert.deepEqual(buildCombinedCalls, [
    [
      { BOARD_38_TREND: [{ highest: 1, high: 2, medium: 3, low: 4, lowest: 5 }] },
      derivedState.syncedAt,
      { total: 3 },
      mergedPrActivity,
      { series: [1, 2, 3] }
    ]
  ]);
  assert.deepEqual(supplementalArtifactCalls, [
    {
      contributorsSnapshot,
      productCycleSnapshot,
      prCycleSnapshot
    }
  ]);
});

test("runFullRefreshPipeline validate stage prepares primary artifacts and validates supplemental snapshots", async () => {
  const primaryArtifacts = { snapshot: { id: "primary-artifact" } };
  const validatedSnapshots = [];
  const commitCalls = [];
  const runner = createRefreshRunner(
    createDeps({
      io: {
        buildSupplementalWriteArtifacts: () => [
          {
            fileName: "contributors-snapshot.json",
            outputSnapshot: { id: "contributors-output" },
            logMessage: "",
            write: async () => {}
          },
          {
            fileName: "product-cycle-snapshot.json",
            outputSnapshot: { id: "product-output" },
            logMessage: "",
            write: async () => {}
          }
        ],
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        preparePrimarySnapshotArtifacts: async (snapshot) => {
          assert.deepEqual(snapshot, { id: "combined-snapshot" });
          return primaryArtifacts;
        }
      },
      validators: {
        validateDashboardSnapshot: (fileName, outputSnapshot) => {
          validatedSnapshots.push({ fileName, outputSnapshot });
        }
      },
      helpers: {
        buildCombinedSnapshot: () => ({ id: "combined-snapshot" }),
        buildTrendAndPrActivityState: async () => ({
          computed: {
            BOARD_38_TREND: [{ highest: 1, high: 0, medium: 0, low: 0, lowest: 0 }]
          },
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot: { id: "pr-cycle" }
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 1 },
          businessUnitChartData: { series: [1] }
        })
      }
    })
  );

  const validatedState = await runner.runFullRefreshPipeline(
    {
      noWrite: false,
      skipContributors: true,
      skipProductCycle: true,
      snapshotRetentionCount: 4
    },
    {
      stopAfterStage: "validate",
      todayIso: "2026-04-05"
    }
  );

  assert.equal(commitCalls.length, 0);
  assert.deepEqual(validatedState.primaryArtifacts, primaryArtifacts);
  assert.deepEqual(validatedSnapshots, [
    {
      fileName: "contributors-snapshot.json",
      outputSnapshot: { id: "contributors-output" }
    },
    {
      fileName: "product-cycle-snapshot.json",
      outputSnapshot: { id: "product-output" }
    }
  ]);
});

test("runFullRefreshPipeline commits the validated full refresh payload in write stage", async () => {
  const primaryArtifacts = { id: "primary-artifacts" };
  const supplementalArtifacts = [
    {
      fileName: "contributors-snapshot.json",
      outputSnapshot: { id: "contributors-output" },
      logMessage: "Wrote contributors-snapshot.json.",
      write: async () => {}
    },
    {
      fileName: "product-cycle-snapshot.json",
      outputSnapshot: { id: "product-output" },
      logMessage: "",
      write: async () => {}
    }
  ];
  const commitCalls = [];
  const runner = createRefreshRunner(
    createDeps({
      io: {
        buildSupplementalWriteArtifacts: () => supplementalArtifacts,
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        preparePrimarySnapshotArtifacts: async () => primaryArtifacts
      },
      helpers: {
        buildCombinedSnapshot: () => ({ id: "combined-snapshot" }),
        buildTrendAndPrActivityState: async () => ({
          computed: {
            BOARD_38_TREND: [{ highest: 1, high: 0, medium: 0, low: 0, lowest: 0 }]
          },
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot: { id: "pr-cycle" }
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 1 },
          businessUnitChartData: { series: [1] }
        })
      }
    })
  );

  const result = await runner.runFullRefreshPipeline({
    noWrite: false,
    skipContributors: true,
    skipProductCycle: true,
    snapshotRetentionCount: 6
  });

  assert.equal(commitCalls.length, 1);
  assert.deepEqual(commitCalls[0], {
    snapshot: { id: "combined-snapshot" },
    primaryArtifacts,
    syncedAt: result.syncedAt,
    snapshotRetentionCount: 6,
    summaryMessage:
      "Updated snapshot.json for BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, BOARD_40_TREND, BOARD_333_TREND, and BOARD_399_TREND.",
    extraWrites: supplementalArtifacts.map((artifact) => artifact.write),
    extraLogs: ["Wrote contributors-snapshot.json."]
  });
  assert.deepEqual(result.primaryArtifacts, primaryArtifacts);
});

test("runFullRefreshPipeline returns validated state without committing when noWrite is enabled", async () => {
  const primaryArtifacts = { id: "primary-artifacts" };
  const validatedSnapshots = [];
  const commitCalls = [];
  const runner = createRefreshRunner(
    createDeps({
      io: {
        buildSupplementalWriteArtifacts: () => [
          {
            fileName: "contributors-snapshot.json",
            outputSnapshot: { id: "contributors-output" },
            logMessage: "Wrote contributors-snapshot.json.",
            write: async () => {}
          }
        ],
        commitSnapshotRefresh: async (args) => {
          commitCalls.push(args);
        },
        preparePrimarySnapshotArtifacts: async () => primaryArtifacts
      },
      validators: {
        validateDashboardSnapshot: (fileName, outputSnapshot) => {
          validatedSnapshots.push({ fileName, outputSnapshot });
        }
      },
      helpers: {
        buildCombinedSnapshot: () => ({ id: "combined-snapshot" }),
        buildTrendAndPrActivityState: async () => ({
          computed: {
            BOARD_38_TREND: [{ highest: 1, high: 0, medium: 0, low: 0, lowest: 0 }]
          },
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot: { id: "pr-cycle" }
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 1 },
          businessUnitChartData: { series: [1] }
        })
      }
    })
  );

  await captureConsoleLogs(async (logs) => {
    const result = await runner.runFullRefreshPipeline({
      noWrite: true,
      skipContributors: true,
      skipProductCycle: true,
      snapshotRetentionCount: 6
    });

    assert.deepEqual(result.primaryArtifacts, primaryArtifacts);
    assert.deepEqual(validatedSnapshots, [
      {
        fileName: "contributors-snapshot.json",
        outputSnapshot: { id: "contributors-output" }
      }
    ]);
    assert.deepEqual(logs, [
      "NO_WRITE=true: skipped snapshot and derived snapshot writes (full refresh)."
    ]);
  });

  assert.equal(commitCalls.length, 0);
});

test("runFullRefreshPipeline returns the assembled fetch-stage state without deriving or writing", async () => {
  const contributorsSnapshot = { id: "contributors" };
  const productCycleSnapshot = { id: "product-cycle" };
  const prCycleSnapshot = { id: "pr-cycle" };
  let contributorsFetchCount = 0;
  let productCycleFetchCount = 0;
  const runner = createRefreshRunner(
    createDeps({
      helpers: {
        buildTrendAndPrActivityState: async () => ({
          computed: {
            BOARD_38_TREND: [{ highest: 1, high: 2, medium: 3, low: 4, lowest: 5 }]
          },
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 7 },
          businessUnitChartData: { series: [4, 5, 6] }
        })
      },
      refreshers: {
        refreshContributorsSnapshot: async () => {
          contributorsFetchCount += 1;
          return contributorsSnapshot;
        },
        refreshProductCycleSnapshot: async () => {
          productCycleFetchCount += 1;
          return productCycleSnapshot;
        }
      }
    })
  );

  const result = await runner.runFullRefreshPipeline(
    {
      noWrite: false,
      skipContributors: false,
      skipProductCycle: false,
      snapshotRetentionCount: 9
    },
    {
      stopAfterStage: "fetch",
      todayIso: "2026-04-05"
    }
  );

  assert.deepEqual(result, {
    todayIso: "2026-04-05",
    sharedState: {
      computed: {
        BOARD_38_TREND: [{ highest: 1, high: 2, medium: 3, low: 4, lowest: 5 }]
      },
      mergedPrActivity: { id: "pr-activity" },
      prCycleSnapshot
    },
    uatAging: { total: 7 },
    businessUnitChartData: { series: [4, 5, 6] },
    contributorsSnapshot,
    productCycleSnapshot
  });
  assert.equal(contributorsFetchCount, 1);
  assert.equal(productCycleFetchCount, 1);
});

test("runFullRefreshPipeline skips optional contributor and product-cycle fetches in fetch stage", async () => {
  const prCycleSnapshot = { id: "pr-cycle" };
  let contributorsFetchCount = 0;
  let productCycleFetchCount = 0;
  const runner = createRefreshRunner(
    createDeps({
      helpers: {
        buildTrendAndPrActivityState: async () => ({
          computed: {},
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 1 },
          businessUnitChartData: { series: [1] }
        }),
        maybeRefreshSnapshot: async (skip, _message, buildSnapshot) => {
          if (skip) return null;
          return buildSnapshot();
        }
      },
      refreshers: {
        refreshContributorsSnapshot: async () => {
          contributorsFetchCount += 1;
          return { id: "contributors" };
        },
        refreshProductCycleSnapshot: async () => {
          productCycleFetchCount += 1;
          return { id: "product-cycle" };
        }
      }
    })
  );

  const result = await runner.runFullRefreshPipeline(
    {
      noWrite: false,
      skipContributors: true,
      skipProductCycle: true,
      snapshotRetentionCount: 9
    },
    {
      stopAfterStage: "fetch",
      todayIso: "2026-04-05"
    }
  );

  assert.deepEqual(result, {
    todayIso: "2026-04-05",
    sharedState: {
      computed: {},
      mergedPrActivity: { id: "pr-activity" },
      prCycleSnapshot
    },
    uatAging: { total: 1 },
    businessUnitChartData: { series: [1] },
    contributorsSnapshot: null,
    productCycleSnapshot: null
  });
  assert.equal(contributorsFetchCount, 0);
  assert.equal(productCycleFetchCount, 0);
});

test("runFullRefreshPipeline returns normalized state before derive-stage assembly", async () => {
  let buildCombinedSnapshotCalls = 0;
  let buildSupplementalWriteArtifactsCalls = 0;
  const runner = createRefreshRunner(
    createDeps({
      io: {
        buildSupplementalWriteArtifacts: () => {
          buildSupplementalWriteArtifactsCalls += 1;
          return [];
        }
      },
      helpers: {
        buildCombinedSnapshot: () => {
          buildCombinedSnapshotCalls += 1;
          return { id: "combined-snapshot" };
        },
        buildTrendAndPrActivityState: async () => ({
          computed: {
            BOARD_38_TREND: [{ highest: 1, high: 2, medium: 3, low: 4, lowest: 5 }]
          },
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot: { id: "pr-cycle" }
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 7 },
          businessUnitChartData: { series: [4, 5, 6] }
        })
      },
      refreshers: {
        refreshContributorsSnapshot: async () => ({ id: "contributors" }),
        refreshProductCycleSnapshot: async () => ({ id: "product-cycle" })
      }
    })
  );

  const normalizedState = await runner.runFullRefreshPipeline(
    {
      noWrite: false,
      skipContributors: false,
      skipProductCycle: false,
      snapshotRetentionCount: 9
    },
    {
      stopAfterStage: "normalize",
      todayIso: "2026-04-05"
    }
  );

  assert.equal(normalizedState.todayIso, "2026-04-05");
  assert.equal(normalizedState.grandTotal, 15);
  assert.equal(typeof normalizedState.syncedAt, "string");
  assert.deepEqual(normalizedState.sharedState, {
    computed: {
      BOARD_38_TREND: [{ highest: 1, high: 2, medium: 3, low: 4, lowest: 5 }]
    },
    mergedPrActivity: { id: "pr-activity" },
    prCycleSnapshot: { id: "pr-cycle" }
  });
  assert.deepEqual(normalizedState.uatAging, { total: 7 });
  assert.deepEqual(normalizedState.businessUnitChartData, { series: [4, 5, 6] });
  assert.deepEqual(normalizedState.contributorsSnapshot, { id: "contributors" });
  assert.deepEqual(normalizedState.productCycleSnapshot, { id: "product-cycle" });
  assert.equal(buildCombinedSnapshotCalls, 0);
  assert.equal(buildSupplementalWriteArtifactsCalls, 0);
});

test("runFullRefreshPipeline preserves normalize-stage output even when grandTotal is zero", async () => {
  const buildCombinedSnapshotCalls = [];
  const preparePrimarySnapshotArtifactsCalls = [];
  const validateDashboardSnapshotCalls = [];
  const commitSnapshotRefreshCalls = [];
  const runner = createRefreshRunner(
    createDeps({
      helpers: {
        buildCombinedSnapshot: (...args) => {
          buildCombinedSnapshotCalls.push(args);
          return { kind: "combined-snapshot" };
        },
        buildTrendAndPrActivityState: async () => ({
          computed: {},
          mergedPrActivity: { id: "pr-activity" },
          prCycleSnapshot: { id: "pr-cycle" }
        }),
        buildUatRefreshArtifacts: async () => ({
          uatAging: { total: 0 },
          businessUnitChartData: { series: [] }
        })
      },
      io: {
        buildSupplementalWriteArtifacts: () => [],
        commitSnapshotRefresh: async (args) => {
          commitSnapshotRefreshCalls.push(args);
        },
        preparePrimarySnapshotArtifacts: async (snapshot) => {
          preparePrimarySnapshotArtifactsCalls.push(snapshot);
          return [{ id: "primary-artifact" }];
        }
      },
      validators: {
        validateDashboardSnapshot: (fileName, outputSnapshot) => {
          validateDashboardSnapshotCalls.push([fileName, outputSnapshot]);
        }
      }
    })
  );

  const result = await runner.runFullRefreshPipeline(
    {
      noWrite: false,
      skipContributors: true,
      skipProductCycle: true,
      snapshotRetentionCount: 0
    },
    {
      stopAfterStage: "normalize",
      todayIso: "2026-04-05"
    }
  );

  assert.equal(result.grandTotal, 0);
  assert.equal(typeof result.syncedAt, "string");
  assert.deepEqual(buildCombinedSnapshotCalls, []);
  assert.deepEqual(preparePrimarySnapshotArtifactsCalls, []);
  assert.deepEqual(validateDashboardSnapshotCalls, []);
  assert.deepEqual(commitSnapshotRefreshCalls, []);
});
