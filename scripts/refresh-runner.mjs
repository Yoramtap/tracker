export function createRefreshRunner(deps) {
  const {
    allowEmpty,
    constants: {
      FALLBACK_DATES,
      PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY,
      PRIMARY_SNAPSHOT_PATH
    },
    io: {
      buildSupplementalWriteArtifacts,
      commitSnapshotRefresh,
      preparePrimarySnapshotArtifacts,
      readJsonFile,
      writePrCycleSnapshotAtomic,
      writeProductCycleShipmentsSnapshotAtomic,
      writeProductCycleSnapshotAtomic
    },
    validators: {
      validateDashboardSnapshot
    },
    refreshers: {
      refreshContributorsSnapshot,
      refreshProductCycleSnapshot
    },
    history: {
      countPrActivitySeriesPoints,
      mergePrActivitySnapshots,
      readPrActivityHistoryState
    },
    helpers: {
      buildCombinedSnapshot,
      buildPrActivityMonthlySnapshot,
      buildPrActivitySprintSnapshot,
      buildPrCycleRefreshSnapshot,
      buildTrendAndPrActivityState,
      buildUatRefreshArtifacts,
      maybeRefreshSnapshot,
      resolvePrActivityFetchSinceDate,
      resolveTrendDates,
      updateExistingSnapshotPrActivity,
      updateExistingSnapshotUat,
      validateRefreshConfig,
      withTiming
    },
    jira: {
      env,
      fetchIssueChangelog,
      fetchPrActivity,
      jiraRequest,
      mapWithConcurrency,
      searchJiraIssues
    }
  } = deps;

  async function buildPrActivityOnlyState(config, todayIso) {
    const resolvedDates = await withTiming(
      "Resolve sprint dates",
      () =>
        resolveTrendDates(config.site, config.email, config.token, {
          fallbackDates: FALLBACK_DATES,
          projectKey: config.sprintProject,
          boardId: config.sprintBoardId,
          lookbackCount: 0,
          pointMode: config.sprintPoint,
          includeActive: config.sprintIncludeActive,
          mondayAnchor: config.sprintMondayAnchor,
          todayIso
        }),
      console
    );
    const allResolvedDates = resolvedDates.dates;

    const shouldRebuildPrActivityHistory = config.prActivityRebuildAll || config.cleanRun;
    const prActivityHistoryState = await readPrActivityHistoryState({
      skipHistoryReuse: shouldRebuildPrActivityHistory
    });
    const existingSnapshotForPrActivity = prActivityHistoryState.currentSnapshot;
    const existingPrActivityForMerge = prActivityHistoryState.bestPrActivity;
    const canReuseHistoricalPrActivity = Boolean(
      countPrActivitySeriesPoints(existingPrActivityForMerge, "points") > 0 &&
        countPrActivitySeriesPoints(existingPrActivityForMerge, "monthlyPoints") > 0
    );
    const reuseHistoricalPrActivity =
      !shouldRebuildPrActivityHistory && canReuseHistoricalPrActivity;
    if (
      reuseHistoricalPrActivity &&
      prActivityHistoryState.bestSource &&
      prActivityHistoryState.bestSource !== PRIMARY_SNAPSHOT_PATH
    ) {
      console.warn(
        `Using archived PR activity history from ${prActivityHistoryState.bestSource} (${prActivityHistoryState.bestMetrics.pointsCount} sprint buckets, ${prActivityHistoryState.bestMetrics.monthlyPointsCount} monthly buckets) because current snapshot.json is missing older monthly history.`
      );
    }

    const prActivityWindowKey = reuseHistoricalPrActivity
      ? PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY
      : "1y";
    const prActivityFetchSinceDate = resolvePrActivityFetchSinceDate(todayIso, prActivityWindowKey);
    const prRows = await withTiming(
      "PR activity fetch",
      () =>
        fetchPrActivity(config.site, config.email, config.token, prActivityFetchSinceDate, {
          useCache: !config.cleanRun
        }),
      console
    );
    const prActivitySprintDates = allResolvedDates.filter(
      (date) => String(date || "") >= prActivityFetchSinceDate
    );
    const latestClosedSprintDate = Array.isArray(resolvedDates.closedDates)
      ? String(resolvedDates.closedDates[resolvedDates.closedDates.length - 1] || "").trim()
      : "";
    const prActivity = buildPrActivitySprintSnapshot(
      prRows,
      prActivityFetchSinceDate,
      prActivitySprintDates
    );
    const prActivityMonthly = buildPrActivityMonthlySnapshot(prRows, prActivityFetchSinceDate, {
      ceilingDate: latestClosedSprintDate
    });
    prActivity.latestClosedSprintDate = latestClosedSprintDate;
    prActivity.monthlySince = prActivityMonthly.since;
    prActivity.monthlyPoints = prActivityMonthly.points;
    const mergedPrActivity = reuseHistoricalPrActivity
      ? mergePrActivitySnapshots(existingPrActivityForMerge, prActivity, {
          truncateAfterRefreshedLatest: !resolvedDates.usedFallback,
          ceilingDate: todayIso,
          monthlyFloorDate: resolvePrActivityFetchSinceDate(todayIso, "1y")
        })
      : prActivity;
    console.log(
      `Computed Jira Development PR inflow proxy (${prRows.uniquePrCount} unique PRs from ${prRows.candidateIssueCount} candidate issues, ${prRows.detailIssueCount} with recent PR summary activity, since ${prActivityFetchSinceDate} across ${prActivitySprintDates.length} sprint buckets and ${prActivity.monthlyPoints.length} monthly buckets; fetched ${prRows.reviewChangelogIssueCount} review changelogs, cache hits ${prRows.cacheHitCount}, cache writes ${prRows.cacheWriteCount}${reuseHistoricalPrActivity ? "; reused cached older PR activity buckets" : ""}).`
    );

    return {
      existingSnapshotForPrActivity,
      mergedPrActivity
    };
  }

  async function runUatOnlyRefresh(config) {
    const { uatAging, businessUnitChartData } = await buildUatRefreshArtifacts(config);
    if (config.noWrite) {
      console.log(
        "NO_WRITE=true: skipped snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json write (UAT_ONLY mode)."
      );
      return;
    }
    const existingSnapshot = await readJsonFile(PRIMARY_SNAPSHOT_PATH);
    const syncedAt = new Date().toISOString();
    await commitSnapshotRefresh({
      snapshot: updateExistingSnapshotUat(existingSnapshot, {
        uatAging,
        chartData: businessUnitChartData,
        syncedAt
      }),
      preparePrimarySnapshotArtifacts,
      syncedAt,
      snapshotRetentionCount: config.snapshotRetentionCount,
      summaryMessage:
        "Wrote snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json (UAT_ONLY mode)."
    });
  }

  async function runPrCycleOnlyRefresh(config, todayIso) {
    const prCycleSnapshot = await buildPrCycleRefreshSnapshot(config, todayIso);
    if (!prCycleSnapshot) {
      throw new Error("PR_CYCLE_ONLY cannot be used when SKIP_PR_CYCLE=true.");
    }
    if (config.noWrite) {
      console.log("NO_WRITE=true: skipped pr-cycle-snapshot.json write (PR_CYCLE_ONLY mode).");
      return;
    }
    await writePrCycleSnapshotAtomic(prCycleSnapshot);
    console.log("Wrote pr-cycle-snapshot.json (PR_CYCLE_ONLY mode).");
  }

  async function runProductCycleOnlyRefresh(config) {
    const productCycleSnapshot = await withTiming(
      "Product cycle refresh",
      () =>
        refreshProductCycleSnapshot({
          site: config.site,
          email: config.email,
          token: config.token,
          jiraRequest,
          searchJiraIssues,
          fetchIssueChangelog,
          mapWithConcurrency,
          envValue: env,
          logger: console
        }),
      console
    );
    if (config.noWrite) {
      console.log(
        "NO_WRITE=true: skipped product-cycle-snapshot.json and product-cycle-shipments-snapshot.json write (PRODUCT_CYCLE_ONLY mode)."
      );
      return;
    }
    await writeProductCycleSnapshotAtomic(productCycleSnapshot);
    await writeProductCycleShipmentsSnapshotAtomic(productCycleSnapshot);
    console.log(
      "Wrote product-cycle-snapshot.json and product-cycle-shipments-snapshot.json (PRODUCT_CYCLE_ONLY mode)."
    );
  }

  async function runPrActivityOnlyRefresh(config, sharedState) {
    if (config.noWrite) {
      console.log(
        "NO_WRITE=true: skipped snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json write (PR_ACTIVITY_ONLY mode)."
      );
      return;
    }
    const existingSnapshot =
      sharedState.existingSnapshotForPrActivity || (await readJsonFile(PRIMARY_SNAPSHOT_PATH));
    const syncedAt = new Date().toISOString();
    await commitSnapshotRefresh({
      snapshot: updateExistingSnapshotPrActivity(
        existingSnapshot,
        sharedState.mergedPrActivity,
        syncedAt
      ),
      preparePrimarySnapshotArtifacts,
      syncedAt,
      snapshotRetentionCount: config.snapshotRetentionCount,
      summaryMessage:
        "Wrote snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json (PR_ACTIVITY_ONLY mode)."
    });
  }

  function calculateGrandTotal(computed) {
    return Object.values(computed || {})
      .flat()
      .reduce(
        (acc, point) =>
          acc +
          Number(point?.highest || 0) +
          Number(point?.high || 0) +
          Number(point?.medium || 0) +
          Number(point?.low || 0) +
          Number(point?.lowest || 0),
        0
      );
  }

  async function runFullRefreshFetchStage(config, todayIso) {
    const sharedState = await buildTrendAndPrActivityState(config, todayIso);
    const { uatAging, businessUnitChartData } = await withTiming(
      "UAT refresh artifacts",
      () => buildUatRefreshArtifacts(config),
      console
    );

    const [contributorsSnapshot, productCycleSnapshot] = await Promise.all([
      maybeRefreshSnapshot(
        config.skipContributors,
        "Skipping contributors snapshot refresh (SKIP_CONTRIBUTORS=true).",
        () =>
          withTiming(
            "Contributors snapshot",
            () =>
              refreshContributorsSnapshot({
                site: config.site,
                email: config.email,
                token: config.token,
                searchJiraIssues,
                envValue: env,
                logger: console
              }),
            console
          )
      ),
      maybeRefreshSnapshot(
        config.skipProductCycle,
        "Skipping product-cycle snapshot refresh (SKIP_PRODUCT_CYCLE=true).",
        () =>
          withTiming(
            "Product cycle snapshot",
            () =>
              refreshProductCycleSnapshot({
                site: config.site,
                email: config.email,
                token: config.token,
                jiraRequest,
                searchJiraIssues,
                fetchIssueChangelog,
                mapWithConcurrency,
                envValue: env,
                logger: console
              }),
            console
          )
      )
    ]);

    return {
      todayIso,
      sharedState,
      uatAging,
      businessUnitChartData,
      contributorsSnapshot,
      productCycleSnapshot
    };
  }

  function runFullRefreshNormalizeStage(fetchedState) {
    return {
      ...fetchedState,
      grandTotal: calculateGrandTotal(fetchedState.sharedState?.computed),
      syncedAt: new Date().toISOString()
    };
  }

  function runFullRefreshDeriveStage(config, normalizedState) {
    const snapshot = buildCombinedSnapshot(
      normalizedState.sharedState.computed,
      normalizedState.syncedAt,
      normalizedState.uatAging,
      normalizedState.sharedState.mergedPrActivity,
      normalizedState.businessUnitChartData
    );

    return {
      ...normalizedState,
      snapshot,
      summaryMessage:
        "Updated snapshot.json for BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, BOARD_40_TREND, BOARD_333_TREND, and BOARD_399_TREND.",
      supplementalArtifacts: buildSupplementalWriteArtifacts({
        contributorsSnapshot: normalizedState.contributorsSnapshot,
        productCycleSnapshot: normalizedState.productCycleSnapshot,
        prCycleSnapshot: normalizedState.sharedState.prCycleSnapshot
      }),
      snapshotRetentionCount: config.snapshotRetentionCount
    };
  }

  async function runFullRefreshValidateStage(derivedState) {
    if (derivedState.grandTotal === 0 && !allowEmpty) {
      throw new Error(
        [
          "Refusing to write snapshot.json because every board/date returned 0 issues.",
          "Likely causes: wrong Jira credentials, no Browse Project permission on TFC, or JQL label filters no longer matching.",
          "If this is intentionally empty, rerun with --allow-empty."
        ].join(" ")
      );
    }

    const primaryArtifacts = await preparePrimarySnapshotArtifacts(derivedState.snapshot);
    for (const artifact of derivedState.supplementalArtifacts) {
      validateDashboardSnapshot(artifact.fileName, artifact.outputSnapshot);
    }

    return {
      ...derivedState,
      primaryArtifacts
    };
  }

  async function runFullRefreshWriteStage(config, validatedState) {
    if (config.noWrite) {
      console.log("NO_WRITE=true: skipped snapshot and derived snapshot writes (full refresh).");
      return validatedState;
    }

    await commitSnapshotRefresh({
      snapshot: validatedState.snapshot,
      primaryArtifacts: validatedState.primaryArtifacts,
      syncedAt: validatedState.syncedAt,
      snapshotRetentionCount: validatedState.snapshotRetentionCount,
      summaryMessage: validatedState.summaryMessage,
      extraWrites: validatedState.supplementalArtifacts.map((artifact) => artifact.write),
      extraLogs: validatedState.supplementalArtifacts
        .map((artifact) => artifact.logMessage)
        .filter(Boolean)
    });

    return validatedState;
  }

  async function runFullRefreshPipeline(config, options = {}) {
    validateRefreshConfig(config);
    const stopAfterStage = deps.resolveStopAfterStage(options.stopAfterStage);
    const todayIso = String(options.todayIso || new Date().toISOString().slice(0, 10)).trim();

    const fetchedState = await runFullRefreshFetchStage(config, todayIso);
    if (stopAfterStage === "fetch") return fetchedState;

    const normalizedState = runFullRefreshNormalizeStage(fetchedState);
    if (stopAfterStage === "normalize") return normalizedState;

    const derivedState = runFullRefreshDeriveStage(config, normalizedState);
    if (stopAfterStage === "derive") return derivedState;

    const validatedState = await runFullRefreshValidateStage(derivedState);
    if (stopAfterStage === "validate") return validatedState;

    return await runFullRefreshWriteStage(config, validatedState);
  }

  return {
    buildPrActivityOnlyState,
    runFullRefreshPipeline,
    runPrActivityOnlyRefresh,
    runPrCycleOnlyRefresh,
    runProductCycleOnlyRefresh,
    runUatOnlyRefresh
  };
}
