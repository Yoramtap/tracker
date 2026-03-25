const PRODUCT_CYCLE_SCOPE_KEY = "inception";

function sanitizeText(value) {
  return String(value || "").trim();
}

function sanitizeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function sanitizeBacklogTeamPoint(point, { includeLongstanding = false } = {}) {
  return {
    highest: sanitizeNumber(point?.highest),
    high: sanitizeNumber(point?.high),
    medium: sanitizeNumber(point?.medium),
    low: sanitizeNumber(point?.low),
    lowest: sanitizeNumber(point?.lowest),
    ...(includeLongstanding
      ? {
          longstanding_30d_plus: sanitizeNumber(point?.longstanding_30d_plus),
          longstanding_60d_plus: sanitizeNumber(point?.longstanding_60d_plus)
        }
      : {})
  };
}

function sanitizeBacklogCombinedPoint(point) {
  return {
    date: sanitizeText(point?.date),
    api: sanitizeBacklogTeamPoint(point?.api),
    legacy: sanitizeBacklogTeamPoint(point?.legacy),
    react: sanitizeBacklogTeamPoint(point?.react),
    bc: sanitizeBacklogTeamPoint(point?.bc, { includeLongstanding: true }),
    workers: sanitizeBacklogTeamPoint(point?.workers),
    titanium: sanitizeBacklogTeamPoint(point?.titanium)
  };
}

function sanitizeBusinessUnitRow(row) {
  return {
    label: sanitizeText(row?.label),
    devAvg: sanitizeNumber(row?.devAvg),
    sampleCount: sanitizeNumber(row?.sampleCount),
    devCount: sanitizeNumber(row?.devCount),
    uatCount: sanitizeNumber(row?.uatCount),
    uatAvg: sanitizeNumber(row?.uatAvg),
    issueItems: Array.isArray(row?.issueItems)
      ? row.issueItems
          .map((item) => ({
            issueId: sanitizeText(item?.issueId || item),
            facilityLabel: sanitizeText(item?.facilityLabel)
          }))
          .filter((item) => item.issueId)
      : [],
    facilities: Array.isArray(row?.facilities)
      ? row.facilities
          .map((facility) => ({
            label: sanitizeText(facility?.label),
            devAvg: sanitizeNumber(facility?.devAvg),
            uatAvg: sanitizeNumber(facility?.uatAvg),
            devCount: sanitizeNumber(facility?.devCount),
            uatCount: sanitizeNumber(facility?.uatCount),
            sampleCount: sanitizeNumber(facility?.sampleCount),
            issueIds: Array.isArray(facility?.issueIds)
              ? facility.issueIds.map((issueId) => sanitizeText(issueId)).filter(Boolean)
              : []
          }))
          .filter((facility) => facility.label)
      : []
  };
}

function sanitizeBusinessUnitScope(scopeSnapshot) {
  return {
    rows: Array.isArray(scopeSnapshot?.rows) ? scopeSnapshot.rows.map(sanitizeBusinessUnitRow) : []
  };
}

function sanitizePrActivityTeamPoint(point) {
  return {
    offered: sanitizeNumber(point?.offered),
    merged: sanitizeNumber(point?.merged),
    avgReviewToMergeDays: sanitizeNumber(point?.avgReviewToMergeDays),
    avgReviewToMergeSampleCount: sanitizeNumber(point?.avgReviewToMergeSampleCount)
  };
}

function sanitizePrActivityPoint(point) {
  const safePoint = point && typeof point === "object" ? point : {};
  return {
    date: sanitizeText(safePoint.date),
    api: sanitizePrActivityTeamPoint(safePoint.api),
    legacy: sanitizePrActivityTeamPoint(safePoint.legacy),
    react: sanitizePrActivityTeamPoint(safePoint.react),
    bc: sanitizePrActivityTeamPoint(safePoint.bc),
    workers: sanitizePrActivityTeamPoint(safePoint.workers),
    titanium: sanitizePrActivityTeamPoint(safePoint.titanium)
  };
}

function sanitizeLeadCycleRow(row) {
  return {
    team: sanitizeText(row?.team),
    cycle: sanitizeNumber(row?.cycle),
    cycleDoneCount: sanitizeNumber(row?.cycleDoneCount),
    cycleOngoingCount: sanitizeNumber(row?.cycleOngoingCount),
    meta_cycle: {
      n: sanitizeNumber(row?.meta_cycle?.n)
    }
  };
}

function sanitizeLeadCycleScope(scopeSnapshot) {
  return {
    scopeLabel: sanitizeText(scopeSnapshot?.scopeLabel),
    sampleCount: sanitizeNumber(scopeSnapshot?.sampleCount),
    cycleSampleCount: sanitizeNumber(scopeSnapshot?.cycleSampleCount),
    rows: Array.isArray(scopeSnapshot?.rows) ? scopeSnapshot.rows.map(sanitizeLeadCycleRow) : []
  };
}

function sanitizeLifecycleMeta(meta) {
  return {
    team: sanitizeText(meta?.team),
    n: sanitizeNumber(meta?.n),
    average: sanitizeNumber(meta?.average)
  };
}

function sanitizeLifecycleRow(row) {
  const safeRow = {
    phaseKey: sanitizeText(row?.phaseKey),
    phaseLabel: sanitizeText(row?.phaseLabel)
  };
  for (const [key, value] of Object.entries(row || {})) {
    if (/^slot_\d+$/.test(key)) {
      safeRow[key] = sanitizeNumber(value);
      continue;
    }
    if (/^meta_slot_\d+$/.test(key)) {
      safeRow[key] = sanitizeLifecycleMeta(value);
    }
  }
  return safeRow;
}

function sanitizeCurrentStageSnapshot(snapshot) {
  return {
    yUpper: sanitizeNumber(snapshot?.yUpper),
    categorySecondaryLabels:
      snapshot?.categorySecondaryLabels && typeof snapshot.categorySecondaryLabels === "object"
        ? Object.fromEntries(
            Object.entries(snapshot.categorySecondaryLabels).map(([key, value]) => [
              sanitizeText(key),
              sanitizeText(value)
            ])
          )
        : {},
    teamDefs: Array.isArray(snapshot?.teamDefs)
      ? snapshot.teamDefs.map((teamDef) => ({
          slot: sanitizeText(teamDef?.slot),
          name: sanitizeText(teamDef?.name),
          team: sanitizeText(teamDef?.team)
        }))
      : [],
    rows: Array.isArray(snapshot?.rows) ? snapshot.rows.map(sanitizeLifecycleRow) : []
  };
}

function sanitizeContributorRow(row) {
  return {
    contributor: sanitizeText(row?.contributor),
    totalIssues: sanitizeNumber(row?.totalIssues),
    doneIssues: sanitizeNumber(row?.doneIssues),
    activeIssues: sanitizeNumber(row?.activeIssues)
  };
}

function sanitizePrCycleStage(stage) {
  return {
    key: sanitizeText(stage?.key),
    label: sanitizeText(stage?.label),
    days: sanitizeNumber(stage?.days),
    sampleCount: sanitizeNumber(stage?.sampleCount)
  };
}

function sanitizePrCycleTeam(team) {
  return {
    key: sanitizeText(team?.key),
    label: sanitizeText(team?.label),
    issueCount: sanitizeNumber(team?.issueCount),
    totalCycleDays: sanitizeNumber(team?.totalCycleDays),
    bottleneckLabel: sanitizeText(team?.bottleneckLabel),
    stages: Array.isArray(team?.stages) ? team.stages.map(sanitizePrCycleStage) : []
  };
}

function sanitizePrCycleWindow(windowSnapshot) {
  return {
    windowLabel: sanitizeText(windowSnapshot?.windowLabel),
    teams: Array.isArray(windowSnapshot?.teams) ? windowSnapshot.teams.map(sanitizePrCycleTeam) : []
  };
}

export function sanitizeBacklogSnapshot(snapshot) {
  const managementBusinessUnit = snapshot?.chartData?.managementBusinessUnit;
  const byScope = managementBusinessUnit?.byScope;
  const chartData =
    byScope && typeof byScope === "object"
      ? {
          managementBusinessUnit: {
            scopeLabel: sanitizeText(managementBusinessUnit?.scopeLabel),
            byScope: {
              ongoing: sanitizeBusinessUnitScope(byScope.ongoing),
              done: sanitizeBusinessUnitScope(byScope.done)
            }
          }
        }
      : undefined;

  return {
    updatedAt: sanitizeText(snapshot?.updatedAt),
    ...(sanitizeText(snapshot?.chartDataUpdatedAt)
      ? { chartDataUpdatedAt: sanitizeText(snapshot?.chartDataUpdatedAt) }
      : {}),
    ...(chartData ? { chartData } : {}),
    ...(snapshot?.uatAging && typeof snapshot.uatAging === "object"
      ? {
          uatAging: {
            scope: {
              label: sanitizeText(snapshot?.uatAging?.scope?.label)
            }
          }
        }
      : {}),
    ...(snapshot?.prActivity && typeof snapshot.prActivity === "object"
      ? {
          prActivity: {
            since: sanitizeText(snapshot?.prActivity?.since),
            interval: sanitizeText(snapshot?.prActivity?.interval),
            monthlySince: sanitizeText(snapshot?.prActivity?.monthlySince),
            monthlyInterval: sanitizeText(snapshot?.prActivity?.monthlyInterval),
            caveat: sanitizeText(snapshot?.prActivity?.caveat),
            points: Array.isArray(snapshot?.prActivity?.points)
              ? snapshot.prActivity.points.map(sanitizePrActivityPoint)
              : [],
            monthlyPoints: Array.isArray(snapshot?.prActivity?.monthlyPoints)
              ? snapshot.prActivity.monthlyPoints.map(sanitizePrActivityPoint)
              : []
          }
        }
      : {}),
    combinedPoints: Array.isArray(snapshot?.combinedPoints)
      ? snapshot.combinedPoints.map(sanitizeBacklogCombinedPoint)
      : []
  };
}

export function sanitizePrCycleSnapshot(snapshot) {
  const windows =
    snapshot?.windows && typeof snapshot.windows === "object"
      ? Object.fromEntries(
          Object.entries(snapshot.windows).map(([key, windowSnapshot]) => [
            key,
            sanitizePrCycleWindow(windowSnapshot)
          ])
        )
      : undefined;

  return {
    updatedAt: sanitizeText(snapshot?.updatedAt),
    defaultTeam: sanitizeText(snapshot?.defaultTeam),
    defaultWindow: sanitizeText(snapshot?.defaultWindow),
    ...(windows ? { windows } : {})
  };
}

export function sanitizeProductCycleSnapshot(snapshot) {
  const chartData =
    snapshot?.chartData && typeof snapshot.chartData === "object" ? snapshot.chartData : {};
  const leadCycleScopes =
    chartData.leadCycleByScope && typeof chartData.leadCycleByScope === "object"
      ? chartData.leadCycleByScope
      : {};

  return {
    generatedAt: sanitizeText(snapshot?.generatedAt),
    chartData: {
      fetchedCount: sanitizeNumber(chartData?.fetchedCount),
      leadCycleByScope: {
        [PRODUCT_CYCLE_SCOPE_KEY]: sanitizeLeadCycleScope(leadCycleScopes[PRODUCT_CYCLE_SCOPE_KEY])
      },
      currentStageSnapshot: sanitizeCurrentStageSnapshot(chartData?.currentStageSnapshot)
    }
  };
}

export function sanitizeProductCycleShipmentsSnapshot(snapshot) {
  const shippedTimeline =
    snapshot?.chartData?.shippedTimeline && typeof snapshot.chartData.shippedTimeline === "object"
      ? snapshot.chartData.shippedTimeline
      : {};

  return {
    generatedAt: sanitizeText(snapshot?.generatedAt),
    chartData: {
      shippedTimeline: {
        timelineStart: sanitizeText(shippedTimeline?.timelineStart),
        timelineEnd: sanitizeText(shippedTimeline?.timelineEnd),
        totalShipped: sanitizeNumber(shippedTimeline?.totalShipped),
        months: Array.isArray(shippedTimeline?.months)
          ? shippedTimeline.months.map((month) => ({
              monthStart: sanitizeText(month?.monthStart),
              monthKey: sanitizeText(month?.monthKey),
              totalShipped: sanitizeNumber(month?.totalShipped),
              teamCount: sanitizeNumber(month?.teamCount),
              teams: Array.isArray(month?.teams)
                ? month.teams.map((team) => ({
                    team: sanitizeText(team?.team),
                    shippedCount: sanitizeNumber(team?.shippedCount),
                    ideas: Array.isArray(team?.ideas)
                      ? team.ideas.map((idea) => ({
                          issueKey: sanitizeText(idea?.issueKey),
                          productAreaLabel: sanitizeText(idea?.productAreaLabel),
                          summary: sanitizeText(idea?.summary),
                          shippedAt: sanitizeText(idea?.shippedAt)
                        }))
                      : []
                  }))
                : []
            }))
          : []
      }
    }
  };
}

export function sanitizeContributorsSnapshot(snapshot) {
  const summary = snapshot?.summary && typeof snapshot.summary === "object" ? snapshot.summary : {};
  return {
    updatedAt: sanitizeText(snapshot?.updatedAt),
    summary: {
      total_issues: sanitizeNumber(summary?.total_issues),
      active_issues: sanitizeNumber(summary?.active_issues),
      done_issues: sanitizeNumber(summary?.done_issues),
      total_contributors: sanitizeNumber(summary?.total_contributors),
      linked_issues: sanitizeNumber(summary?.linked_issues)
    },
    chartData: {
      rows: Array.isArray(snapshot?.chartData?.rows)
        ? snapshot.chartData.rows.map(sanitizeContributorRow)
        : []
    }
  };
}

export const SNAPSHOT_SANITIZERS = {
  "backlog-snapshot.json": sanitizeBacklogSnapshot,
  "product-cycle-snapshot.json": sanitizeProductCycleSnapshot,
  "product-cycle-shipments-snapshot.json": sanitizeProductCycleShipmentsSnapshot,
  "contributors-snapshot.json": sanitizeContributorsSnapshot,
  "pr-cycle-snapshot.json": sanitizePrCycleSnapshot
};
