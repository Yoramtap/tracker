"use strict";

const PRIORITY_CONFIG = [{ key: "highest", label: "Highest" }, { key: "high", label: "High" }, { key: "medium", label: "Medium" }, { key: "low", label: "Low" }, { key: "lowest", label: "Lowest" }];

const PRODUCT_CYCLE_COMPARE_YEARS = ["2025", "2026"];
const PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS = ["all", "single", "combined"];
const PRODUCT_CYCLE_WINDOW_SCOPE_OPTIONS = ["lead", "cycle"];
const PRODUCT_CYCLE_IDEA_SCOPE_OPTIONS = ["finished_work", "full_backlog"];
const LIFECYCLE_YEAR_OPTIONS = ["2025", "2026", "all_time"];
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
  "lifecycle-days": "lifecycle-days-panel"
};
const CHART_STATUS_IDS = ["composition-status", "trend-status", "uat-status", "management-status", "product-cycle-status", "lifecycle-days-status"];
const LAST_UPDATED_IDS = ["trend-updated", "composition-updated", "uat-updated", "management-updated", "product-cycle-updated", "lifecycle-days-updated"];
const PRODUCT_CYCLE_UPDATED_IDS = ["product-cycle-updated", "lifecycle-days-updated"];
const PUBLIC_AGGREGATE_CHART_CONFIG = {
  productCycle: {
    ideaRadioName: "product-cycle-idea-scope",
    windowRadioName: "product-cycle-window-scope",
    effortRadioName: "product-cycle-effort-scope",
    metricRadioName: "product-cycle-metric-scope",
    statusId: "product-cycle-status",
    contextId: "product-cycle-context",
    containerId: "cycle-time-parking-lot-to-done-chart",
    missingMessage: "No product cycle aggregates found in product-cycle-snapshot.json."
  },
  lifecycleDays: {
    ideaRadioName: "lifecycle-days-idea-scope",
    yearRadioName: "lifecycle-days-year-scope",
    metricRadioName: "lifecycle-days-metric-scope",
    statusId: "lifecycle-days-status",
    contextId: "lifecycle-days-context",
    containerId: "lifecycle-time-spent-per-phase-chart",
    missingMessage: "No lifecycle aggregates found in product-cycle-snapshot.json."
  }
};

const state = { snapshot: null, productCycle: null, mode: "all", managementUatScope: "all", compositionTeamScope: "bc", productCycleIdeaScope: "finished_work", productCycleWindowScope: "cycle", productCycleEffortScope: "all", productCycleMetricScope: "median", lifecycleDaysIdeaScope: "finished_work", lifecycleDaysYearScope: "2026", lifecycleDaysMetricScope: "median" };

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

function normalizeMetric(value) {
  if (value === "average") return "average";
  return "median";
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
  if (context) context.textContent = `${scopeLabel}, ${toNumber(uat.totalIssues)} currently in UAT`;
  const allPriorities = PRIORITY_CONFIG.map((priority) => priority.key);
  const buckets = Array.isArray(uat.buckets) ? uat.buckets : [];
  const priorities = allPriorities.filter((priority) =>
    buckets.some((bucket) => toNumber(uat?.priorities?.[priority]?.buckets?.[bucket.id]) > 0)
  );

  if (buckets.length === 0) {
    status.hidden = false;
    status.textContent = "UAT aging buckets are missing from backlog-snapshot.json.";
    return;
  }

  const chartRows = buckets.map((bucket) => {
    const row = { bucketLabel: bucket.label, total: 0 };
    for (const priority of priorities) {
      const value = toNumber(uat?.priorities?.[priority]?.buckets?.[bucket.id]);
      row[priority] = value;
      row.total += value;
    }
    return row;
  });

  const renderChart = window.DashboardCharts?.renderUatOpenByPriorityChart;
  if (!renderChart) return;
  renderChart({
    containerId: "uat-open-by-priority-chart",
    rows: chartRows,
    priorities,
    colors: getThemeColors()
  });
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

function normalizeProductCycleIdeaScope(value) {
  return PRODUCT_CYCLE_IDEA_SCOPE_OPTIONS.includes(value) ? value : "finished_work";
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
      contextLabel: "Lead time per team",
      sampleLabel: "lead sample"
    };
  }
  if (windowScope === "cycle") {
    return {
      key: "cycle",
      title: "Cycle time: delivery and feedback to done",
      contextLabel: "Cycle time per team",
      sampleLabel: "cycle sample"
    };
  }
  return {
    key: "cycle",
    title: "Cycle time: delivery and feedback to done",
    contextLabel: "Cycle time per team",
    sampleLabel: "cycle sample"
  };
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

function buildCycleRowsForYLock({
  publicAggregates,
  teams,
  seriesDefs,
  effortScope,
  windowScope,
  metric,
  ideaScope
}) {
  return buildMetricRowsByDefs({
    teams,
    defs: seriesDefs,
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
  if (yearScope === "all_time") return PRODUCT_CYCLE_COMPARE_YEARS;
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

function readLifecycleStatsForScope(publicAggregates, yearScope, ideaScope, team, key) {
  const selectedYears = lifecycleSelectedYears(yearScope);
  if (selectedYears.length === 1) {
    return (
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYears[0]]?.idea_scopes?.[ideaScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYears[0]]?.teams?.[team]?.[key] ||
      {}
    );
  }
  return combineLifecycleStats(
    selectedYears.map((selectedYear) =>
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.idea_scopes?.[ideaScope]?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[selectedYear]?.teams?.[team]?.[key] ||
      null
    )
  );
}

function computeLockedProductCycleYUpper(publicAggregates, teams, seriesDefs) {
  let maxValue = 0;
  for (const effortScope of PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS) {
    for (const ideaScope of PRODUCT_CYCLE_IDEA_SCOPE_OPTIONS) {
      for (const windowScope of PRODUCT_CYCLE_WINDOW_SCOPE_OPTIONS) {
        for (const metric of ["median", "average"]) {
          const rows = buildCycleRowsForYLock({
            publicAggregates,
            teams,
            seriesDefs,
            effortScope,
            windowScope,
            metric,
            ideaScope
          });
          maxValue = Math.max(maxValue, computeMaxFromRows(rows, seriesDefs));
        }
      }
    }
  }
  return Math.max(1, Math.ceil(maxValue * 1.15));
}

function computeLockedLifecycleYUpper(publicAggregates, teams, phaseDefs) {
  let maxValue = 0;
  for (const year of LIFECYCLE_YEAR_OPTIONS) {
    for (const ideaScope of PRODUCT_CYCLE_IDEA_SCOPE_OPTIONS) {
      for (const metric of ["median", "average"]) {
        const rows = buildMetricRowsByDefs({
          teams,
          defs: phaseDefs,
          metric,
          readSource: (team, key) => readLifecycleStatsForScope(publicAggregates, year, ideaScope, team, key)
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
  if (configured.length > 0) return configured;

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
  if (ordered.includes("UNMAPPED")) {
    return ordered.filter((team) => team !== "UNMAPPED").concat("UNMAPPED");
  }
  return ordered;
}

function renderCycleTimeParkingLotToDoneChartFromPublicAggregates(publicAggregates, effortScope, metric, windowScope) {
  const status = document.getElementById("product-cycle-status");
  const context = document.getElementById("product-cycle-context");
  const titleNode = document.getElementById("product-cycle-title");
  if (!status || !context) return;
  const windowMeta = productCycleWindowMeta(windowScope);
  const ideaScopeMeta = productCycleIdeaScopeMeta(state.productCycleIdeaScope);
  if (titleNode) titleNode.textContent = windowMeta.title;

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No product cycle aggregates found in product-cycle-snapshot.json.";
    return;
  }

  const metricLabelValue = metricLabel(metric);
  const perYear = PRODUCT_CYCLE_COMPARE_YEARS.map((year) => {
    const totalsNode = publicAggregates?.cycleTime?.totalsByYear?.[year]?.[effortScope] || {};
    const samplesNode = totalsNode?.samples && typeof totalsNode.samples === "object" ? totalsNode.samples : {};
    const sampleCount = toCount(
      samplesNode?.[ideaScopeMeta.key]?.[windowMeta.key] ??
        samplesNode?.[windowMeta.key] ??
        (windowMeta.key === "cycle"
          ? totalsNode.cycle_sample
          : publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[year]?.cycle_sample || 0)
    );
    return {
      year,
      ideasInYearCount: toCount(totalsNode.total),
      cycleRowsCount: sampleCount
    };
  });

  const totalIdeasCombined = perYear.reduce((sum, entry) => sum + entry.ideasInYearCount, 0);
  const totalCycleSample = perYear.reduce((sum, entry) => sum + entry.cycleRowsCount, 0);
  context.textContent = `${windowMeta.contextLabel} • ${ideaScopeMeta.label}. Total ideas (2025+2026): ${totalIdeasCombined} • ${windowMeta.sampleLabel}: ${totalCycleSample}`;

  if (perYear.every((entry) => entry.cycleRowsCount === 0)) {
    status.hidden = false;
    status.textContent = `No completed ${windowMeta.contextLabel.toLowerCase()} items found for ${PRODUCT_CYCLE_COMPARE_YEARS.join(", ")}.`;
    clearChartContainer("cycle-time-parking-lot-to-done-chart");
    return;
  }

  const themeColors = getThemeColors();
  const seriesDefs = perYear.map((entry, index) => ({
    key: `year_${entry.year}`,
    name: String(entry.year),
    color: index % 2 === 0 ? themeColors.teams.api : themeColors.teams.bc
  }));
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
  const yUpper = computeLockedProductCycleYUpper(publicAggregates, teams, seriesDefs);

  const renderChart = getRenderer(
    "product-cycle-status",
    "renderCycleTimeParkingLotToDoneChart",
    "Product cycle chart unavailable: Recharts renderer missing."
  );
  if (!renderChart) return;
  renderChart({
    containerId: "cycle-time-parking-lot-to-done-chart",
    rows,
    seriesDefs,
    colors: themeColors,
    metricLabel: metricLabelValue,
    yUpperOverride: yUpper
  });

  const yearsWithoutCycles = perYear
    .filter((entry) => entry.cycleRowsCount === 0)
    .map((entry) => entry.year);
  if (yearsWithoutCycles.length > 0) {
    status.hidden = false;
    status.textContent = `No completed ${windowMeta.contextLabel.toLowerCase()} items found for ${yearsWithoutCycles.join(", ")}; showing other year(s).`;
  }
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

function renderLifecycleTimeSpentPerPhaseChartFromPublicAggregates(publicAggregates, year, metric, ideaScope) {
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
  const yearLabel = year === "all_time" ? "All time" : selectedYears[0];

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
    readSource: (team, key) => readLifecycleStatsForScope(publicAggregates, year, ideaScope, team, key)
  });
  const plottedValues = phaseDefs
    .flatMap((phase) => rows.map((row) => row[phase.key]))
    .filter((value) => Number.isFinite(value) && value > 0);

  const totalsNodes = selectedYears.map((selectedYear) => publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[selectedYear] || {});
  const doneCount = totalsNodes.reduce((sum, node) => sum + toCount(node.done), 0);
  const ongoingCount = totalsNodes.reduce((sum, node) => sum + toCount(node.ongoing), 0);
  const totalCount = totalsNodes.reduce((sum, node) => sum + toCount(node.total), 0);
  const sampleCount = totalsNodes.reduce(
    (sum, node) =>
      sum +
      toCount(
        node?.samples?.[ideaScope]?.cycle_sample ??
          node?.cycle_sample
      ),
    0
  );
  const ideaScopeMeta = productCycleIdeaScopeMeta(ideaScope);

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
  context.textContent = `${chartTitleText} • ${yearLabel} • ${ideaScopeMeta.label}: total ${totalCount} • done ${doneCount} • ongoing ${ongoingCount} • cycle sample ${sampleCount}`;
}

function renderCycleTimeParkingLotToDoneChart() {
  const config = PUBLIC_AGGREGATE_CHART_CONFIG.productCycle;
  const ideaScope = normalizeProductCycleIdeaScope(state.productCycleIdeaScope);
  const windowScope = normalizeProductCycleWindow(state.productCycleWindowScope);
  const effortScope = normalizeOption(state.productCycleEffortScope, PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS, "all");
  const metric = normalizeMetric(state.productCycleMetricScope);

  syncRadioValue(config.ideaRadioName, ideaScope);
  syncRadioValue(config.windowRadioName, windowScope);
  syncRadioValue(config.effortRadioName, effortScope);
  syncRadioValue(config.metricRadioName, metric);

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
        windowScope
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
  const ideaScope = normalizeProductCycleIdeaScope(state.lifecycleDaysIdeaScope);
  const year = normalizeOption(state.lifecycleDaysYearScope, LIFECYCLE_YEAR_OPTIONS, "2026");
  const metric = normalizeMetric(state.lifecycleDaysMetricScope);
  syncRadioValue(config.ideaRadioName, ideaScope);
  syncRadioValue(config.yearRadioName, year);
  syncRadioValue(config.metricRadioName, metric);
  withPublicAggregates({
    statusId: config.statusId,
    contextId: config.contextId,
    containerId: config.containerId,
    missingMessage: config.missingMessage,
    onReady: ({ publicAggregates }) =>
      renderLifecycleTimeSpentPerPhaseChartFromPublicAggregates(publicAggregates, year, metric, ideaScope)
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
    yUpper: paddedMaxY
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
    bindRadioState("product-cycle-idea-scope", "productCycleIdeaScope", normalizeProductCycleIdeaScope, renderCycleTimeParkingLotToDoneChart);
    bindRadioState("product-cycle-effort-scope", "productCycleEffortScope", (value) => normalizeOption(value, PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS, "all"), renderCycleTimeParkingLotToDoneChart);
    bindRadioState("product-cycle-metric-scope", "productCycleMetricScope", normalizeMetric, renderCycleTimeParkingLotToDoneChart);
    bindRadioState("lifecycle-days-idea-scope", "lifecycleDaysIdeaScope", normalizeProductCycleIdeaScope, renderLifecycleTimeSpentPerPhaseChart);
    bindRadioState("lifecycle-days-year-scope", "lifecycleDaysYearScope", (value) => normalizeOption(value, LIFECYCLE_YEAR_OPTIONS, "2026"), renderLifecycleTimeSpentPerPhaseChart);
    bindRadioState("lifecycle-days-metric-scope", "lifecycleDaysMetricScope", normalizeMetric, renderLifecycleTimeSpentPerPhaseChart);
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
