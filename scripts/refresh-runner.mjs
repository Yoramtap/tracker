export function createRefreshRunner(deps) {
  const {
    allowEmpty,
    constants: {
      FALLBACK_DATES,
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
    helpers: {
      buildCombinedSnapshot,
      buildPrActivityRefreshState,
      buildPrCycleRefreshSnapshot,
      buildTrendAndPrActivityState,
      buildUatRefreshArtifacts,
      maybeRefreshSnapshot,
      resolveTrendDates,
      updateExistingSnapshotPrActivity,
      updateExistingSnapshotUat,
      validateRefreshConfig,
      withTiming
    },
    jira: {
      env,
      fetchIssueChangelog,
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
    return await buildPrActivityRefreshState(config, todayIso, resolvedDates);
  }

  function shouldSkipRefreshWrite(noWrite, logMessage) {
    if (!noWrite) return false;
    console.log(logMessage);
    return true;
  }

  async function commitPrimarySnapshotModeRefresh(config, summaryMessage, buildSnapshot) {
    const syncedAt = new Date().toISOString();
    await commitSnapshotRefresh({
      snapshot: await buildSnapshot(syncedAt),
      preparePrimarySnapshotArtifacts,
      syncedAt,
      snapshotRetentionCount: config.snapshotRetentionCount,
      summaryMessage
    });
  }

  async function refreshContributorsSnapshotWithTiming(config, label = "Contributors snapshot") {
    return await withTiming(
      label,
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
    );
  }

  const FULL_REFRESH_SUMMARY_MESSAGE =
    "Updated snapshot.json for BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, BOARD_40_TREND, BOARD_333_TREND, and BOARD_399_TREND.";

  async function refreshProductCycleSnapshotWithTiming(config, label = "Product cycle refresh") {
    return await withTiming(
      label,
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
  }

  async function runUatOnlyRefresh(config) {
    const { uatAging, businessUnitChartData } = await buildUatRefreshArtifacts(config);
    if (
      shouldSkipRefreshWrite(
        config.noWrite,
        "NO_WRITE=true: skipped snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json write (UAT_ONLY mode)."
      )
    )
      return;
    const existingSnapshot = await readJsonFile(PRIMARY_SNAPSHOT_PATH);
    await commitPrimarySnapshotModeRefresh(
      config,
      "Wrote snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json (UAT_ONLY mode).",
      (syncedAt) =>
        updateExistingSnapshotUat(existingSnapshot, {
          uatAging,
          chartData: businessUnitChartData,
          syncedAt
        })
    );
  }

  async function runPrCycleOnlyRefresh(config, todayIso) {
    const prCycleSnapshot = await buildPrCycleRefreshSnapshot(config, todayIso);
    if (!prCycleSnapshot) {
      throw new Error("PR_CYCLE_ONLY cannot be used when SKIP_PR_CYCLE=true.");
    }
    if (
      shouldSkipRefreshWrite(
        config.noWrite,
        "NO_WRITE=true: skipped pr-cycle-snapshot.json write (PR_CYCLE_ONLY mode)."
      )
    )
      return;
    await writePrCycleSnapshotAtomic(prCycleSnapshot);
    console.log("Wrote pr-cycle-snapshot.json (PR_CYCLE_ONLY mode).");
  }

  async function runProductCycleOnlyRefresh(config) {
    const productCycleSnapshot = await refreshProductCycleSnapshotWithTiming(config);
    if (
      shouldSkipRefreshWrite(
        config.noWrite,
        "NO_WRITE=true: skipped product-cycle-snapshot.json and product-cycle-shipments-snapshot.json write (PRODUCT_CYCLE_ONLY mode)."
      )
    )
      return;
    await writeProductCycleSnapshotAtomic(productCycleSnapshot);
    await writeProductCycleShipmentsSnapshotAtomic(productCycleSnapshot);
    console.log(
      "Wrote product-cycle-snapshot.json and product-cycle-shipments-snapshot.json (PRODUCT_CYCLE_ONLY mode)."
    );
  }

  async function runPrActivityOnlyRefresh(config, sharedState) {
    if (
      shouldSkipRefreshWrite(
        config.noWrite,
        "NO_WRITE=true: skipped snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json write (PR_ACTIVITY_ONLY mode)."
      )
    )
      return;
    const existingSnapshot =
      sharedState.existingSnapshotForPrActivity || (await readJsonFile(PRIMARY_SNAPSHOT_PATH));
    await commitPrimarySnapshotModeRefresh(
      config,
      "Wrote snapshot.json, backlog-snapshot.json, pr-activity-snapshot.json, and management-facility-snapshot.json (PR_ACTIVITY_ONLY mode).",
      (syncedAt) =>
        updateExistingSnapshotPrActivity(
          existingSnapshot,
          sharedState.mergedPrActivity,
          syncedAt
        )
    );
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

  async function fetchFullRefreshSupplementalSnapshots(config) {
    const [contributorsSnapshot, productCycleSnapshot] = await Promise.all([
      maybeRefreshSnapshot(
        config.skipContributors,
        "Skipping contributors snapshot refresh (SKIP_CONTRIBUTORS=true).",
        () => refreshContributorsSnapshotWithTiming(config)
      ),
      maybeRefreshSnapshot(
        config.skipProductCycle,
        "Skipping product-cycle snapshot refresh (SKIP_PRODUCT_CYCLE=true).",
        () => refreshProductCycleSnapshotWithTiming(config, "Product cycle snapshot")
      )
    ]);

    return {
      contributorsSnapshot,
      productCycleSnapshot
    };
  }

  function buildFullRefreshFetchedState(
    todayIso,
    sharedState,
    { uatAging, businessUnitChartData },
    supplementalSnapshots
  ) {
    return {
      todayIso,
      sharedState,
      uatAging,
      businessUnitChartData,
      ...supplementalSnapshots
    };
  }

  async function runFullRefreshFetchStage(config, todayIso) {
    const sharedState = await buildTrendAndPrActivityState(config, todayIso);
    const uatRefreshState = await withTiming(
      "UAT refresh artifacts",
      () => buildUatRefreshArtifacts(config),
      console
    );
    const supplementalSnapshots = await fetchFullRefreshSupplementalSnapshots(config);

    return buildFullRefreshFetchedState(
      todayIso,
      sharedState,
      uatRefreshState,
      supplementalSnapshots
    );
  }

  function runFullRefreshNormalizeStage(fetchedState) {
    return {
      ...fetchedState,
      grandTotal: calculateGrandTotal(fetchedState.sharedState?.computed),
      syncedAt: new Date().toISOString()
    };
  }

  function buildFullRefreshSupplementalArtifacts(normalizedState) {
    return buildSupplementalWriteArtifacts({
      contributorsSnapshot: normalizedState.contributorsSnapshot,
      productCycleSnapshot: normalizedState.productCycleSnapshot,
      prCycleSnapshot: normalizedState.sharedState.prCycleSnapshot
    });
  }

  function buildFullRefreshDerivedState(config, normalizedState) {
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
      summaryMessage: FULL_REFRESH_SUMMARY_MESSAGE,
      supplementalArtifacts: buildFullRefreshSupplementalArtifacts(normalizedState),
      snapshotRetentionCount: config.snapshotRetentionCount
    };
  }

  function runFullRefreshDeriveStage(config, normalizedState) {
    return buildFullRefreshDerivedState(config, normalizedState);
  }

  async function prepareFullRefreshValidationState(derivedState) {
    const primaryArtifacts = await preparePrimarySnapshotArtifacts(derivedState.snapshot);
    validateFullRefreshSupplementalArtifacts(derivedState.supplementalArtifacts);

    return {
      ...derivedState,
      primaryArtifacts
    };
  }

  function validateFullRefreshGrandTotal(grandTotal) {
    if (grandTotal !== 0 || allowEmpty) return;
    throw new Error(
      [
        "Refusing to write snapshot.json because every board/date returned 0 issues.",
        "Likely causes: wrong Jira credentials, no Browse Project permission on TFC, or JQL label filters no longer matching.",
        "If this is intentionally empty, rerun with --allow-empty."
      ].join(" ")
    );
  }

  function validateFullRefreshSupplementalArtifacts(supplementalArtifacts) {
    for (const artifact of supplementalArtifacts) {
      validateDashboardSnapshot(artifact.fileName, artifact.outputSnapshot);
    }
  }

  async function runFullRefreshValidateStage(derivedState) {
    validateFullRefreshGrandTotal(derivedState.grandTotal);
    return await prepareFullRefreshValidationState(derivedState);
  }

  async function runFullRefreshWriteStage(config, validatedState) {
    if (
      shouldSkipRefreshWrite(
        config.noWrite,
        "NO_WRITE=true: skipped snapshot and derived snapshot writes (full refresh)."
      )
    )
      return validatedState;

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

  function hasModeSpecificRefresh(config) {
    return [
      config.uatOnly,
      config.productCycleOnly,
      config.prCycleOnly,
      config.prActivityOnly
    ].some(Boolean);
  }

  async function runModeSpecificRefresh(config, todayIso) {
    if (config.uatOnly) {
      await runUatOnlyRefresh(config);
      return true;
    }

    if (config.productCycleOnly) {
      await runProductCycleOnlyRefresh(config);
      return true;
    }

    if (config.prCycleOnly) {
      await runPrCycleOnlyRefresh(config, todayIso);
      return true;
    }

    if (config.prActivityOnly) {
      const sharedState = await buildPrActivityOnlyState(config, todayIso);
      await runPrActivityOnlyRefresh(config, sharedState);
      return true;
    }

    return false;
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
    hasModeSpecificRefresh,
    runFullRefreshPipeline,
    runModeSpecificRefresh,
    runPrActivityOnlyRefresh,
    runPrCycleOnlyRefresh,
    runProductCycleOnlyRefresh,
    runUatOnlyRefresh
  };
}
