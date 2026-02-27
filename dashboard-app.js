"use strict";

const UAT_PRIORITY_KEYS = ["medium", "high", "highest"];

const PRODUCT_CYCLE_COMPARE_YEARS = ["2025", "2026"];
const PRODUCT_CYCLE_YEAR_SCOPE_OPTIONS = ["2025", "2026"];
const PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS = ["all", "single", "combined"];
const PRODUCT_CYCLE_WINDOW_SCOPE_OPTIONS = ["lead", "cycle"];
const LIFECYCLE_YEAR_OPTIONS = ["2025", "2026"];
const PRODUCT_CYCLE_PHASES = [
  { key: "parking_lot", label: "Parking lot" },
  { key: "design", label: "Design" },
  { key: "ready_for_development", label: "Ready" },
  { key: "in_development", label: "In Development" },
  { key: "feedback", label: "Feedback" }
];
const MODE_PANEL_IDS = {
  trend: "trend-panel",
  composition: "composition-panel",
  uat: "uat-panel",
  management: "management-panel",
  "product-cycle": "product-cycle-panel",
  "done-work": "done-work-panel",
  "lifecycle-days": "lifecycle-days-panel"
};
const CHART_STATUS_IDS = ["composition-status", "trend-status", "uat-status", "management-status", "product-cycle-status", "done-work-status", "lifecycle-days-status"];
const LAST_UPDATED_IDS = ["trend-updated", "composition-updated", "uat-updated", "management-updated", "product-cycle-updated", "done-work-updated", "lifecycle-days-updated"];
const PRODUCT_CYCLE_UPDATED_IDS = ["product-cycle-updated", "done-work-updated", "lifecycle-days-updated"];
const PUBLIC_AGGREGATE_CHART_CONFIG = {
  productCycle: {
    windowRadioName: "product-cycle-window-scope",
    statusId: "product-cycle-status",
    contextId: "product-cycle-context",
    containerId: "cycle-time-parking-lot-to-done-chart",
    missingMessage: "No product cycle aggregates found in product-cycle-snapshot.json."
  },
  lifecycleDays: {
    yearRadioName: "lifecycle-days-year-scope",
    statusId: "lifecycle-days-status",
    contextId: "lifecycle-days-context",
    containerId: "lifecycle-time-spent-per-phase-chart",
    missingMessage: "No lifecycle aggregates found in product-cycle-snapshot.json."
  }
};

const state = { snapshot: null, productCycle: null, mode: "all", managementUatScope: "all", compositionTeamScope: "bc", productCycleWindowScope: "cycle", productCycleYearScope: "2026", doneWorkYearScope: "2026", lifecycleDaysYearScope: "2026" };

const dashboardUiUtils = window.DashboardViewUtils;
if (!dashboardUiUtils) {
  throw new Error("Dashboard UI helpers not loaded.");
}
const {
  toNumber,
  formatUpdatedAt,
  setTextForIds,
  setStatusMessage,
  setStatusMessageForIds,
  readThemeColor,
  getThemeColors,
  clearChartContainer,
  getModeFromUrl
} = dashboardUiUtils;

function normalizeOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function getRenderer(statusId, rendererName, missingMessage) {
  const renderer = window.DashboardCharts?.[rendererName];
  if (renderer) return renderer;
  setStatusMessage(statusId, missingMessage);
  return null;
}

function renderSnapshotChart({ statusId, rendererName, missingMessage, containerId, extra = {} }) {
  setStatusMessage(statusId);
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  const renderChart = getRenderer(statusId, rendererName, missingMessage);
  if (!renderChart) return;
  renderChart({ containerId, snapshot: state.snapshot, colors: getThemeColors(), ...extra });
}

function applyModeVisibility() {
  const validModes = new Set(Object.keys(MODE_PANEL_IDS));
  const selectedMode = validModes.has(state.mode) ? state.mode : "all";
  const showAll = selectedMode === "all";
  for (const [mode, panelId] of Object.entries(MODE_PANEL_IDS)) {
    const panel = document.getElementById(panelId);
    if (!panel) continue;
    panel.hidden = showAll ? false : mode !== selectedMode;
  }
}

function renderBugCompositionByPriorityChart() {
  const scope = state.compositionTeamScope || "bc";
  syncRadioValue("composition-team-scope", scope);
  renderSnapshotChart({
    statusId: "composition-status",
    rendererName: "renderBugCompositionByPriorityChart",
    missingMessage: "Composition chart unavailable: Recharts did not load. Check local script paths.",
    containerId: "bug-composition-chart",
    extra: { scope }
  });
}

function renderUatOpenByPriorityChart() {
  const status = document.getElementById("uat-status");
  const context = document.getElementById("uat-context");
  if (!status) return;

  status.hidden = true;
  if (!state.snapshot || !state.snapshot.uatAging) {
    status.hidden = false;
    status.textContent = "No UAT aging data found in backlog-snapshot.json.";
    return;
  }

  const uat = state.snapshot.uatAging;
  const scopeLabel = String(uat?.scope?.label || "Broadcast");
  const buckets = Array.isArray(uat.buckets) ? uat.buckets : [];

  if (buckets.length === 0) {
    status.hidden = false;
    status.textContent = "UAT aging buckets are missing from backlog-snapshot.json.";
    return;
  }

  const groupedByLabel = new Map();
  for (const bucket of buckets) {
    const label = uatBucketWeekLabel(bucket);
    if (!groupedByLabel.has(label)) {
      groupedByLabel.set(label, {
        bucketId: label,
        bucketLabel: label,
        total: 0,
        medium: 0,
        high: 0,
        highest: 0
      });
    }
    const row = groupedByLabel.get(label);
    for (const priorityKey of UAT_PRIORITY_KEYS) {
      const value = toNumber(uat?.priorities?.[priorityKey]?.buckets?.[bucket.id]);
      row[priorityKey] += value;
      row.total += value;
    }
    row.bucketWithSample = `${row.bucketLabel} (n=${row.total})`;
  }
  const bucketOrder = ["1-2 weeks", "1 month", "2 months", "more than two months"];
  const chartRows = bucketOrder
    .map((label) => groupedByLabel.get(label))
    .filter(Boolean);

  if (context) context.textContent = `${scopeLabel}, ${toNumber(uat.totalIssues)} currently in UAT`;

  const renderChart = window.DashboardCharts?.renderUatPriorityAgingChart;
  if (!renderChart) return;
  renderChart({
    containerId: "uat-open-by-priority-chart",
    rows: chartRows,
    buckets: chartRows,
    colors: getThemeColors()
  });
}

function uatBucketWeekLabel(bucket) {
  const id = String(bucket?.id || "").trim();
  if (id === "d0_7" || id === "d8_14") return "1-2 weeks";
  if (id === "d15_30") return "1 month";
  if (id === "d31_60") return "2 months";
  if (id === "d61_plus") return "more than two months";
  return String(bucket?.label || id || "Unknown");
}

function toFiniteMetric(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(2));
}

function toCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.trunc(number);
}

function metricLabel(metric) {
  return metric === "average" ? "Average" : "Median";
}

function normalizeProductCycleWindow(value) {
  return PRODUCT_CYCLE_WINDOW_SCOPE_OPTIONS.includes(value) ? value : "cycle";
}

function normalizeProductCycleYearScope(value) {
  return PRODUCT_CYCLE_YEAR_SCOPE_OPTIONS.includes(value) ? value : "2026";
}

function productCycleIdeaScopeMeta(ideaScope) {
  if (ideaScope === "full_backlog") {
    return {
      key: "full_backlog",
      label: "Full backlog"
    };
  }
  return {
    key: "finished_work",
    label: "Finished work"
  };
}

function productCycleWindowMeta(windowScope) {
  if (windowScope === "lead") {
    return {
      key: "lead",
      title: "Lead time: parking lot, design, ready for delivery, delivery, feedback",
      contextLabel: "Lead time per team in days",
      sampleLabel: "lead sample"
    };
  }
  if (windowScope === "cycle") {
    return {
      key: "cycle",
      title: "Cycle time: delivery and feedback to done",
      contextLabel: "Cycle time per team in days",
      sampleLabel: "cycle sample"
    };
  }
  return {
    key: "cycle",
    title: "Cycle time: delivery and feedback to done",
    contextLabel: "Cycle time per team in days",
    sampleLabel: "cycle sample"
  };
}

function effortScopeLabel(effortScope) {
  if (effortScope === "single") return "Single-team";
  if (effortScope === "combined") return "Combined";
  return "All";
}

function readCycleWindowStats(teamNode, windowScope, ideaScope) {
  if (!teamNode || typeof teamNode !== "object") return {};
  const byIdeaScope = teamNode?.idea_scopes?.[ideaScope];
  if (byIdeaScope && typeof byIdeaScope === "object") {
    return byIdeaScope[windowScope] || {};
  }
  if (teamNode.lead || teamNode.cycle) {
    return teamNode[windowScope] || {};
  }
  return {};
}

function getLifecycleWindowStats(publicAggregates, year, team, windowScope) {
  const phasesNode = publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.teams?.[team] || {};
  const phaseKeys =
    windowScope === "lead"
      ? ["parking_lot", "design", "ready_for_development", "in_development", "feedback"]
      : ["in_development", "feedback"];
  const stats = phaseKeys.map((key) => phasesNode?.[key] || {});
  const medians = stats.map((item) => Number(item?.median)).filter(Number.isFinite);
  const averages = stats.map((item) => Number(item?.average)).filter(Number.isFinite);
  const counts = stats.map((item) => Number(item?.n)).filter(Number.isFinite);
  if (medians.length === 0 && averages.length === 0) return {};
  return {
    n: counts.length ? Math.min(...counts) : 0,
    median: medians.length ? Number(medians.reduce((sum, value) => sum + value, 0).toFixed(2)) : null,
    average: averages.length ? Number(averages.reduce((sum, value) => sum + value, 0).toFixed(2)) : null
  };
}

function readDoneCountForTeam(publicAggregates, year, team) {
  const teamNode = publicAggregates?.cycleTime?.byYear?.[year]?.all?.teams?.[team] || {};
  const leadN = toCount(teamNode?.idea_scopes?.finished_work?.lead?.n);
  const cycleN = toCount(teamNode?.idea_scopes?.finished_work?.cycle?.n);
  return Math.max(leadN, cycleN);
}

function buildDoneWorkRowsForYear(publicAggregates, year, teams) {
  return teams
    .map((team) => {
      const doneCount = readDoneCountForTeam(publicAggregates, year, team);
      return {
        team,
        teamWithSample: `${team} (n=${doneCount})`,
        doneCount,
        value: doneCount
      };
    })
    .sort((left, right) => toNumber(right.value) - toNumber(left.value));
}

function buildDoneWorkAxisLockedAcrossYears(publicAggregates, teams) {
  const values = PRODUCT_CYCLE_COMPARE_YEARS.flatMap((year) =>
    buildDoneWorkRowsForYear(publicAggregates, year, teams).map((row) => toNumber(row.value))
  );
  const maxValue = Math.max(0, ...values);
  const roughStep = maxValue <= 20 ? 5 : maxValue <= 60 ? 10 : maxValue <= 150 ? 25 : 50;
  const upper = Math.max(roughStep, Math.ceil(maxValue / roughStep) * roughStep);
  const ticks = [];
  for (let value = 0; value <= upper; value += roughStep) ticks.push(value);
  return { upper, ticks };
}

function readMetricStats(source, metric) {
  const median = toFiniteMetric(source?.median);
  const average = toFiniteMetric(source?.average);
  const count = toCount(source?.n);
  return {
    value: toNumber(metric === "average" ? average : median),
    n: count,
    median: toNumber(median),
    average: toNumber(average)
  };
}

function buildMetricRowsByDefs({ teams, defs, metric, readSource }) {
  return teams.map((team) => {
    const row = { team };
    for (const def of defs) {
      const stats = readMetricStats(readSource(team, def.key), metric);
      row[def.key] = stats.value;
      row[`meta_${def.key}`] = { n: stats.n, median: stats.median, average: stats.average };
    }
    return row;
  });
}

function computeMaxFromRows(rows, defs) {
  const keys = (Array.isArray(defs) ? defs : []).map((def) => def?.key).filter(Boolean);
  let maxValue = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const key of keys) {
      const value = Number(row?.[key]);
      if (Number.isFinite(value)) maxValue = Math.max(maxValue, value);
    }
  }
  return maxValue;
}

function buildCycleRowsForYLock({ publicAggregates, teams, years, effortScope, windowScope, metric, ideaScope }) {
  const defs = (Array.isArray(years) ? years : []).map((year) => ({
    key: `year_${year}`
  }));
  return buildMetricRowsByDefs({
    teams,
    defs,
    metric,
    readSource: (team, key) => {
      const year = key.slice(5);
      const teamNode = publicAggregates?.cycleTime?.byYear?.[year]?.[effortScope]?.teams?.[team] || {};
      const stats = readCycleWindowStats(teamNode, windowScope, ideaScope);
      if (stats && Object.keys(stats).length > 0) return stats;
      return getLifecycleWindowStats(publicAggregates, year, team, windowScope);
    }
  });
}

function lifecycleSelectedYears(yearScope) {
  if (PRODUCT_CYCLE_COMPARE_YEARS.includes(yearScope)) return [yearScope];
  return ["2026"];
}

function combineLifecycleStats(nodes) {
  const valid = (Array.isArray(nodes) ? nodes : []).filter((node) => node && typeof node === "object");
  if (valid.length === 0) return {};
  const weighted = valid
    .map((node) => ({
      n: toCount(node?.n),
      median: Number(node?.median),
      average: Number(node?.average)
    }))
    .filter((item) => item.n > 0);
  if (weighted.length === 0) return {};
  const totalN = weighted.reduce((sum, item) => sum + item.n, 0);
  const weightedMedian = weighted
    .filter((item) => Number.isFinite(item.median))
    .reduce((sum, item) => sum + item.median * item.n, 0);
  const weightedAverage = weighted
    .filter((item) => Number.isFinite(item.average))
    .reduce((sum, item) => sum + item.average * item.n, 0);
  return {
    n: totalN,
    median: Number.isFinite(weightedMedian) ? Number((weightedMedian / totalN).toFixed(2)) : null,
    average: Number.isFinite(weightedAverage) ? Number((weightedAverage / totalN).toFixed(2)) : null
  };
}

function readLifecycleStatsForScope(publicAggregates, yearScope, ideaScope, effortScope, team, key) {
  const selectedYears = lifecycleSelectedYears(yearScope);
  if (selectedYears.length === 1) {
    const selectedYear = selectedYears[0];
    return (
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.idea_scopes?.[ideaScope]?.byEffort?.[effortScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.idea_scopes?.[ideaScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.byEffort?.[effortScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.teams?.[team]?.[key] ||
      {}
    );
  }
  return combineLifecycleStats(
    selectedYears.map((selectedYear) =>
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.idea_scopes?.[ideaScope]?.byEffort?.[effortScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.idea_scopes?.[ideaScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.byEffort?.[effortScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.teams?.[team]?.[key] ||
      null
    )
  );
}

function computeLockedProductCycleYUpper(
  publicAggregates,
  teams,
  years,
  effortScope,
  metric,
  ideaScope
) {
  let maxValue = 0;
  for (const windowScope of PRODUCT_CYCLE_WINDOW_SCOPE_OPTIONS) {
    const rows = buildCycleRowsForYLock({
      publicAggregates,
      teams,
      years,
      effortScope,
      windowScope,
      metric,
      ideaScope
    });
    const defs = (Array.isArray(years) ? years : []).map((year) => ({ key: `year_${year}` }));
    maxValue = Math.max(maxValue, computeMaxFromRows(rows, defs));
  }
  return Math.max(1, Math.ceil(maxValue * 1.15));
}

function computeLockedLifecycleYUpper(publicAggregates, teams, phaseDefs) {
  let maxValue = 0;
  for (const year of LIFECYCLE_YEAR_OPTIONS) {
    for (const effortScope of PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS) {
      for (const metric of ["median", "average"]) {
        const rows = buildMetricRowsByDefs({
          teams,
          defs: phaseDefs,
          metric,
          readSource: (team, key) =>
            readLifecycleStatsForScope(publicAggregates, year, "full_backlog", effortScope, team, key)
        });
        maxValue = Math.max(maxValue, computeMaxFromRows(rows, phaseDefs));
      }
    }
  }
  return Math.max(1, Math.ceil(maxValue * 1.15));
}

function readFlowMetricByBands(flow, bands, key) {
  return bands.map((band) => {
    const value = flow?.[band]?.[key];
    return Number.isFinite(value) ? value : null;
  });
}

function getProductCycleTeamsFromAggregates(publicAggregates) {
  const configured = Array.isArray(state.productCycle?.teams)
    ? state.productCycle.teams.filter((team) => typeof team === "string" && team.trim())
    : [];
  if (configured.length > 0) {
    return configured.filter((team) => team !== "UNMAPPED");
  }

  const found = new Set();
  for (const yearNode of Object.values(publicAggregates?.cycleTime?.byYear || {})) {
    for (const effortNode of Object.values(yearNode || {})) {
      for (const team of Object.keys(effortNode?.teams || {})) found.add(team);
    }
  }
  for (const yearNode of Object.values(publicAggregates?.lifecyclePhaseDays?.byYear || {})) {
    for (const team of Object.keys(yearNode?.teams || {})) found.add(team);
  }

  const ordered = Array.from(found).sort((a, b) => a.localeCompare(b));
  return ordered.filter((team) => team !== "UNMAPPED");
}

function renderCycleTimeParkingLotToDoneChartFromPublicAggregates(
  publicAggregates,
  effortScope,
  metric,
  windowScope,
  yearScope
) {
  const status = document.getElementById("product-cycle-status");
  const context = document.getElementById("product-cycle-context");
  const titleNode = document.getElementById("product-cycle-title");
  if (!status || !context) return;
  const windowMeta = productCycleWindowMeta(windowScope);
  const ideaScopeMeta = productCycleIdeaScopeMeta("full_backlog");
  if (titleNode) titleNode.textContent = windowMeta.title;

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No product cycle aggregates found in product-cycle-snapshot.json.";
    return;
  }

  const metricLabelValue = metricLabel(metric);
  const selectedYear = yearScope;
  const totalsNode = publicAggregates?.cycleTime?.totalsByYear?.[selectedYear]?.[effortScope] || {};
  const samplesNode = totalsNode?.samples && typeof totalsNode.samples === "object" ? totalsNode.samples : {};
  const sampleCount = toCount(
    samplesNode?.[ideaScopeMeta.key]?.[windowMeta.key] ??
      samplesNode?.[windowMeta.key] ??
      (windowMeta.key === "cycle"
        ? totalsNode.cycle_sample
        : publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[selectedYear]?.cycle_sample || 0)
  );

  context.textContent = `${windowMeta.contextLabel} • ${ideaScopeMeta.label} • ${selectedYear}. Total ideas: ${toCount(
    totalsNode.total
  )} • ${windowMeta.sampleLabel}: ${sampleCount} • unmapped excluded`;

  if (sampleCount === 0) {
    status.hidden = false;
    status.textContent = `No completed ${windowMeta.contextLabel.toLowerCase()} items found for ${selectedYear}.`;
    clearChartContainer("cycle-time-parking-lot-to-done-chart");
    return;
  }

  const themeColors = getThemeColors();
  const seriesDefs = [
    {
      key: `year_${selectedYear}`,
      name: String(selectedYear),
      color: themeColors.teams.api,
      showValueLabel: true
    }
  ];
  const rows = buildMetricRowsByDefs({
    teams,
    defs: seriesDefs,
    metric,
    readSource: (team, key) => {
      const year = key.slice(5);
      const teamNode = publicAggregates?.cycleTime?.byYear?.[year]?.[effortScope]?.teams?.[team] || {};
      const stats = readCycleWindowStats(teamNode, windowMeta.key, ideaScopeMeta.key);
      if (stats && Object.keys(stats).length > 0) return stats;
      return getLifecycleWindowStats(publicAggregates, year, team, windowMeta.key);
    }
  });
  const sortKey = seriesDefs[0]?.key;
  const sortedRows = [...rows].sort((left, right) => {
    const a = Number(left?.[sortKey]);
    const b = Number(right?.[sortKey]);
    const av = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY;
    const bv = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY;
    return av - bv;
  }).map((row) => {
    const sampleCount = toCount(row?.[`meta_${sortKey}`]?.n);
    return {
      ...row,
      teamWithSample: `${row.team} (n=${sampleCount})`
    };
  });
  const yUpper = computeLockedProductCycleYUpper(
    publicAggregates,
    teams,
    PRODUCT_CYCLE_COMPARE_YEARS,
    effortScope,
    metric,
    ideaScopeMeta.key
  );

  const renderChart = getRenderer(
    "product-cycle-status",
    "renderCycleTimeParkingLotToDoneChart",
    "Product cycle chart unavailable: Recharts renderer missing."
  );
  if (!renderChart) return;
  renderChart({
    containerId: "cycle-time-parking-lot-to-done-chart",
    rows: sortedRows,
    seriesDefs,
    colors: themeColors,
    metricLabel: metricLabelValue,
    yUpperOverride: yUpper,
    showLegend: false,
    timeWindowLabel: windowMeta.key === "lead" ? "Lead time" : "Cycle time",
    orientation: "horizontal",
    categoryKey: "teamWithSample",
    categoryTickTwoLine: true
  });
}

function withPublicAggregates({ statusId, contextId, containerId, missingMessage, onReady }) {
  const status = document.getElementById(statusId);
  const context = contextId ? document.getElementById(contextId) : null;
  if (!status || (contextId && !context)) return;

  status.hidden = true;
  const value = state.productCycle?.publicAggregates;
  const publicAggregates = value && typeof value === "object" ? value : null;
  if (!publicAggregates) {
    status.hidden = false;
    status.textContent = missingMessage;
    clearChartContainer(containerId);
    return;
  }
  onReady({ status, context, publicAggregates });
}

function renderLifecycleTimeSpentPerPhaseChartFromPublicAggregates(publicAggregates, year, effortScope, metric) {
  const status = document.getElementById("lifecycle-days-status");
  const context = document.getElementById("lifecycle-days-context");
  if (!status || !context) return;

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No lifecycle aggregates found in product-cycle-snapshot.json.";
    return;
  }

  const metricLabelValue = metricLabel(metric);
  const chartTitleText = `Lifecycle time spent per phase (${metricLabelValue})`;
  const selectedYears = lifecycleSelectedYears(year);
  const yearLabel = selectedYears[0];

  const themeColors = getThemeColors();
  const phaseColors = [
    themeColors.uatBuckets.d0_7,
    themeColors.uatBuckets.d8_14,
    themeColors.uatBuckets.d15_30,
    themeColors.uatBuckets.d31_60,
    themeColors.uatBuckets.d61_plus
  ];
  const phaseDefs = PRODUCT_CYCLE_PHASES.map((phase, phaseIndex) => ({
    key: phase.key,
    label: phase.label,
    color: phaseColors[phaseIndex] || themeColors.teams.legacy
  }));
  const rows = buildMetricRowsByDefs({
    teams,
    defs: phaseDefs,
    metric,
    readSource: (team, key) =>
      readLifecycleStatsForScope(publicAggregates, year, "full_backlog", effortScope, team, key)
  });
  const plottedValues = phaseDefs
    .flatMap((phase) => rows.map((row) => row[phase.key]))
    .filter((value) => Number.isFinite(value) && value > 0);

  const totalsNodes = selectedYears.map((selectedYear) => {
    const node = publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[selectedYear] || {};
    return node?.byEffort?.[effortScope] || node;
  });
  const doneCount = totalsNodes.reduce((sum, node) => sum + toCount(node.done), 0);
  const ongoingCount = totalsNodes.reduce((sum, node) => sum + toCount(node.ongoing), 0);
  const totalCount = totalsNodes.reduce((sum, node) => sum + toCount(node.total), 0);
  const sampleCount = totalsNodes.reduce(
    (sum, node) =>
      sum +
      toCount(
        node?.samples?.full_backlog?.cycle_sample ??
          node?.cycle_sample
      ),
    0
  );
  const ideaScopeMeta = productCycleIdeaScopeMeta("full_backlog");

  if (plottedValues.length === 0) {
    status.hidden = false;
    status.textContent = `No lifecycle phase time data found for ${yearLabel}.`;
    clearChartContainer("lifecycle-time-spent-per-phase-chart");
    return;
  }
  const renderChart = getRenderer(
    "lifecycle-days-status",
    "renderLifecycleTimeSpentPerPhaseChart",
    "Lifecycle chart unavailable: Recharts renderer missing."
  );
  if (!renderChart) return;
  const yUpper = computeLockedLifecycleYUpper(publicAggregates, teams, phaseDefs);
  renderChart({
    containerId: "lifecycle-time-spent-per-phase-chart",
    rows,
    phaseDefs,
    colors: themeColors,
    metricLabel: metricLabelValue,
    yUpperOverride: yUpper
  });
  context.textContent = `${chartTitleText} • ${yearLabel} • ${ideaScopeMeta.label} • ${effortScopeLabel(effortScope)}: total ${totalCount} • done ${doneCount} • ongoing ${ongoingCount} • cycle sample ${sampleCount} • unmapped excluded`;
}

function renderDoneWorkByTeamChart() {
  const status = document.getElementById("done-work-status");
  const context = document.getElementById("done-work-context");
  if (!status || !context) return;

  const year = normalizeProductCycleYearScope(state.doneWorkYearScope);
  syncRadioValue("done-work-year-scope", year);

  withPublicAggregates({
    statusId: "done-work-status",
    contextId: "done-work-context",
    containerId: "done-work-by-team-chart",
    missingMessage: "No done-work aggregates found in product-cycle-snapshot.json.",
    onReady: ({ publicAggregates }) => {
      const teams = getProductCycleTeamsFromAggregates(publicAggregates);
      if (teams.length === 0) {
        status.hidden = false;
        status.textContent = "No teams available for done-work chart.";
        clearChartContainer("done-work-by-team-chart");
        return;
      }

      const rows = buildDoneWorkRowsForYear(publicAggregates, year, teams);

      const axis = buildDoneWorkAxisLockedAcrossYears(publicAggregates, teams);
      const measureLabel = "Done ideas";
      const sampleSize = rows.reduce((sum, row) => sum + toCount(row.doneCount), 0);
      context.textContent = `Done work by team • ${year} • ${measureLabel} • sample size: ${sampleSize} • unmapped excluded`;

      const renderChart = getRenderer(
        "done-work-status",
        "renderDoneWorkByTeamChart",
        "Done-work chart unavailable: Recharts renderer missing."
      );
      if (!renderChart) return;
      renderChart({
        containerId: "done-work-by-team-chart",
        rows,
        colors: getThemeColors(),
        yUpper: axis.upper,
        yTicks: axis.ticks,
        measureLabel
      });
    }
  });
}

function renderCycleTimeParkingLotToDoneChart() {
  const config = PUBLIC_AGGREGATE_CHART_CONFIG.productCycle;
  const windowScope = normalizeProductCycleWindow(state.productCycleWindowScope);
  const yearScope = normalizeProductCycleYearScope(state.productCycleYearScope);
  const effortScope = "all";
  const metric = "median";

  syncRadioValue(config.windowRadioName, windowScope);
  syncRadioValue("product-cycle-year-scope", yearScope);

  withPublicAggregates({
    statusId: config.statusId,
    contextId: config.contextId,
    containerId: config.containerId,
    missingMessage: config.missingMessage,
    onReady: ({ publicAggregates }) =>
      renderCycleTimeParkingLotToDoneChartFromPublicAggregates(
        publicAggregates,
        effortScope,
        metric,
        windowScope,
        yearScope
      )
  });
}

function syncRadioValue(name, value) {
  const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
  radios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function bindRadioState(name, stateKey, normalizeValue, onChangeRender) {
  const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
  if (radios.length === 0) return;
  radios.forEach((radio) => {
    if (radio.dataset.bound === "1") return;
    radio.dataset.bound = "1";
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state[stateKey] = normalizeValue(radio.value);
      onChangeRender();
    });
  });
}

function renderLifecycleTimeSpentPerPhaseChart() {
  const config = PUBLIC_AGGREGATE_CHART_CONFIG.lifecycleDays;
  const year = normalizeOption(state.lifecycleDaysYearScope, LIFECYCLE_YEAR_OPTIONS, "2026");
  const effortScope = "all";
  const metric = "median";
  syncRadioValue(config.yearRadioName, year);
  withPublicAggregates({
    statusId: config.statusId,
    contextId: config.contextId,
    containerId: config.containerId,
    missingMessage: config.missingMessage,
    onReady: ({ publicAggregates }) =>
      renderLifecycleTimeSpentPerPhaseChartFromPublicAggregates(publicAggregates, year, effortScope, metric)
  });
}

function renderDevelopmentTimeVsUatTimeChart() {
  const status = document.getElementById("management-status");
  const context = document.getElementById("management-context");
  if (!status || !context) return;

  status.hidden = true;

  const scope = state.managementUatScope === "bugs_only" ? "bugs_only" : "all";
  syncRadioValue("management-uat-scope", scope);
  const flowVariants = state.snapshot?.kpis?.broadcast?.flow_by_priority_variants;
  const scopedFlow = flowVariants && typeof flowVariants === "object" ? flowVariants[scope] : null;
  const flow = scopedFlow || state.snapshot?.kpis?.broadcast?.flow_by_priority;
  if (!flow || typeof flow !== "object") {
    status.hidden = false;
    status.textContent = "No Broadcast flow_by_priority data found in backlog-snapshot.json.";
    return;
  }

  const bands = ["highest", "high", "medium"];
  const labels = ["Highest", "High", "Medium"];
  const themeColors = getThemeColors();
  const devMedian = readFlowMetricByBands(flow, bands, "median_dev_days");
  const uatMedian = readFlowMetricByBands(flow, bands, "median_uat_days");
  const devAvg = readFlowMetricByBands(flow, bands, "avg_dev_days");
  const uatAvg = readFlowMetricByBands(flow, bands, "avg_uat_days");
  const devCounts = bands.map((band) => toNumber(flow?.[band]?.n_dev));
  const uatCounts = bands.map((band) => toNumber(flow?.[band]?.n_uat));
  const totalFlowTickets = bands.reduce(
    (sum, band, idx) => sum + Math.max(devCounts[idx], uatCounts[idx]),
    0
  );
  const uat = state.snapshot?.uatAging;
  const uatScopeLabel = String(uat?.scope?.label || "Broadcast");
  const uatCurrentCount = toNumber(uat?.totalIssues);
  context.textContent = `${uatScopeLabel}, ${uatCurrentCount} currently in UAT • ${totalFlowTickets} historical flow tickets (sample)`;

  const rows = labels.map((label, idx) => ({
    label,
    devMedian: toNumber(devMedian[idx]),
    uatMedian: toNumber(uatMedian[idx]),
    devAvg: toNumber(devAvg[idx]),
    uatAvg: toNumber(uatAvg[idx]),
    devCount: devCounts[idx],
    uatCount: uatCounts[idx]
  }));

  const yValues = [...devMedian, ...uatMedian].filter(Number.isFinite);
  const variantCandidates = [
    flowVariants?.all,
    flowVariants?.bugs_only,
    state.snapshot?.kpis?.broadcast?.flow_by_priority
  ].filter((candidate) => candidate && typeof candidate === "object");
  const variantYValues = variantCandidates.flatMap((candidate) =>
    ["medium", "high", "highest"].flatMap((band) =>
      [candidate?.[band]?.median_dev_days, candidate?.[band]?.median_uat_days].filter(Number.isFinite)
    )
  );
  const maxY = [...yValues, ...variantYValues].length
    ? Math.max(...yValues, ...variantYValues)
    : 1;
  const paddedMaxY = Math.max(1, Math.ceil(maxY * 1.12));
  const yStep = paddedMaxY <= 40 ? 10 : paddedMaxY <= 100 ? 20 : 25;
  const yUpperNice = Math.ceil(paddedMaxY / yStep) * yStep;
  const yTicks = [];
  for (let value = 0; value <= yUpperNice; value += yStep) yTicks.push(value);

  const renderChart = getRenderer(
    "management-status",
    "renderDevelopmentTimeVsUatTimeChart",
    "Management chart unavailable: Recharts renderer missing."
  );
  if (!renderChart) return;
  renderChart({
    containerId: "development-time-vs-uat-time-chart",
    rows,
    colors: themeColors,
    devColor: readThemeColor("--mgmt-dev", "#98a3af"),
    uatColor: readThemeColor("--mgmt-uat", "#c0c8d1"),
    yUpper: yUpperNice,
    yTicks
  });

  if (scope === "bugs_only" && !scopedFlow) {
    status.hidden = false;
    status.textContent = "Bugs-only flow bars are unavailable in this snapshot; showing all-issues bars.";
  }
}

async function loadSnapshot() {
  setStatusMessageForIds(CHART_STATUS_IDS);
  state.mode = getModeFromUrl();
  applyModeVisibility();

  try {
    const [snapshotResponse, productCycleResponse] = await Promise.all([
      fetch("./backlog-snapshot.json", { cache: "no-store" }),
      fetch("./product-cycle-snapshot.json", { cache: "no-store" })
    ]);
    if (!snapshotResponse.ok) throw new Error(`backlog-snapshot.json HTTP ${snapshotResponse.status}`);
    state.snapshot = await snapshotResponse.json();
    if (productCycleResponse.ok) {
      state.productCycle = await productCycleResponse.json();
    } else {
      state.productCycle = null;
      const message = `Failed to load product-cycle-snapshot.json: HTTP ${productCycleResponse.status}`;
      setStatusMessageForIds(["product-cycle-status", "lifecycle-days-status"], message);
    }
    bindRadioState("composition-team-scope", "compositionTeamScope", (value) => value || "bc", renderBugCompositionByPriorityChart);
    bindRadioState("management-uat-scope", "managementUatScope", (value) => (value === "bugs_only" ? "bugs_only" : "all"), renderDevelopmentTimeVsUatTimeChart);
    bindRadioState("product-cycle-window-scope", "productCycleWindowScope", normalizeProductCycleWindow, renderCycleTimeParkingLotToDoneChart);
    bindRadioState("product-cycle-year-scope", "productCycleYearScope", normalizeProductCycleYearScope, renderCycleTimeParkingLotToDoneChart);
    bindRadioState("done-work-year-scope", "doneWorkYearScope", normalizeProductCycleYearScope, renderDoneWorkByTeamChart);
    bindRadioState("lifecycle-days-year-scope", "lifecycleDaysYearScope", (value) => normalizeOption(value, LIFECYCLE_YEAR_OPTIONS, "2026"), renderLifecycleTimeSpentPerPhaseChart);
    setTextForIds(LAST_UPDATED_IDS, `Last updated: ${formatUpdatedAt(state.snapshot?.updatedAt)}`);
    setTextForIds(
      PRODUCT_CYCLE_UPDATED_IDS,
      `Last updated: ${formatUpdatedAt(state.productCycle?.generatedAt || state.snapshot?.updatedAt)}`
    );
    [
      {
        skipMode: "composition",
        run: () =>
          renderSnapshotChart({
            statusId: "trend-status",
            rendererName: "renderBugTrendAcrossTeamsChart",
            missingMessage: "Trend chart unavailable: Recharts did not load. Check local script paths.",
            containerId: "bug-trend-chart"
          })
      },
      { skipMode: "trend", run: renderBugCompositionByPriorityChart },
      { run: renderUatOpenByPriorityChart },
      { run: renderDevelopmentTimeVsUatTimeChart },
      { run: renderCycleTimeParkingLotToDoneChart },
      { run: renderDoneWorkByTeamChart },
      { run: renderLifecycleTimeSpentPerPhaseChart }
    ].forEach(({ skipMode, run }) => {
      if (!skipMode || state.mode !== skipMode) run();
    });
  } catch (error) {
    const message = `Failed to load backlog-snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    setStatusMessageForIds(CHART_STATUS_IDS, message);
  }
}

loadSnapshot();
