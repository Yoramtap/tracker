"use strict";

const PRIORITY_CONFIG = [
  { key: "highest", label: "Highest" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "lowest", label: "Lowest" }
];

const PRODUCT_CYCLE_COMPARE_YEARS = ["2025", "2026"];
const PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS = ["all", "single", "combined"];
const LIFECYCLE_YEAR_OPTIONS = ["2025", "2026"];
const PRODUCT_CYCLE_PHASES = [
  {
    key: "parking_lot",
    label: "Parking lot",
    color: "var(--uat-bucket-0-7)"
  },
  {
    key: "design",
    label: "Design",
    color: "var(--uat-bucket-8-14)"
  },
  {
    key: "ready_for_development",
    label: "Ready",
    color: "var(--uat-bucket-15-30)"
  },
  {
    key: "in_development",
    label: "In Development",
    color: "var(--uat-bucket-31-60)"
  },
  {
    key: "feedback",
    label: "Feedback",
    color: "var(--uat-bucket-61-plus)"
  }
];
const MODE_PANEL_IDS = {
  trend: "trend-panel",
  composition: "composition-panel",
  uat: "uat-panel",
  management: "management-panel",
  "product-cycle": "product-cycle-panel",
  "lifecycle-days": "lifecycle-days-panel"
};
const CHART_STATUS_IDS = [
  "status",
  "trend-status",
  "uat-status",
  "management-status",
  "product-cycle-status",
  "lifecycle-days-status"
];
const LAST_UPDATED_IDS = [
  "trend-updated",
  "composition-updated",
  "uat-updated",
  "management-updated",
  "product-cycle-updated",
  "lifecycle-days-updated"
];
const PRODUCT_CYCLE_UPDATED_IDS = ["product-cycle-updated", "lifecycle-days-updated"];

const state = {
  snapshot: null,
  productCycle: null,
  mode: "all",
  managementUatScope: "all",
  compositionTeamScope: "bc",
  productCycleEffortScope: "all",
  productCycleMetricScope: "median",
  lifecycleDaysYearScope: "2026",
  lifecycleDaysMetricScope: "median"
};

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

function setLastUpdatedSubtitles(snapshot) {
  const label = `Last updated: ${formatUpdatedAt(snapshot?.updatedAt)}`;
  setTextForIds(LAST_UPDATED_IDS, label);
}

function setProductCycleUpdatedSubtitles(productCycle, fallbackUpdatedAt = "") {
  const label = `Last updated: ${formatUpdatedAt(productCycle?.generatedAt || fallbackUpdatedAt)}`;
  setTextForIds(PRODUCT_CYCLE_UPDATED_IDS, label);
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

function renderLineChart() {
  setStatusMessage("trend-status");
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  if (!window.DashboardCharts?.renderTrendChart) {
    setStatusMessage(
      "trend-status",
      "Trend chart unavailable: Recharts did not load. Check local script paths."
    );
    return;
  }

  window.DashboardCharts.renderTrendChart({
    containerId: "chart",
    snapshot: state.snapshot,
    colors: getThemeColors()
  });
}

function renderStackedBarChart() {
  setStatusMessage("status");
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  if (!window.DashboardCharts?.renderCompositionChart) {
    setStatusMessage(
      "status",
      "Composition chart unavailable: Recharts did not load. Check local script paths."
    );
    return;
  }

  const scopeSelect = document.getElementById("composition-team-scope");
  const scope = state.compositionTeamScope || "bc";
  if (scopeSelect) scopeSelect.value = scope;

  window.DashboardCharts.renderCompositionChart({
    containerId: "stacked-chart",
    snapshot: state.snapshot,
    colors: getThemeColors(),
    scope
  });
}

function renderUatAgingChart() {
  const status = document.getElementById("uat-status");
  const root = document.getElementById("uat-chart");
  const context = document.getElementById("uat-context");
  if (!status || !root) return;

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

  if (!window.DashboardCharts?.renderUatAgingChart) return;
  window.DashboardCharts.renderUatAgingChart({
    containerId: "uat-chart",
    rows: chartRows,
    priorities,
    colors: getThemeColors()
  });
}

function bindCompositionTeamScopeToggle() {
  const scopeSelect = document.getElementById("composition-team-scope");
  if (!scopeSelect || scopeSelect.dataset.bound === "1") return;

  scopeSelect.dataset.bound = "1";
  scopeSelect.addEventListener("change", () => {
    state.compositionTeamScope = scopeSelect.value || "bc";
    renderStackedBarChart();
  });
}

function getProductCyclePublicAggregates() {
  const value = state.productCycle?.publicAggregates;
  return value && typeof value === "object" ? value : null;
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

function getProductCycleTeamsFromAggregates(publicAggregates) {
  const configured = Array.isArray(state.productCycle?.teams)
    ? state.productCycle.teams.filter((team) => typeof team === "string" && team.trim())
    : [];
  if (configured.length > 0) return configured;

  const found = new Set();
  const cycleByYear = publicAggregates?.cycleTime?.byYear;
  if (cycleByYear && typeof cycleByYear === "object") {
    for (const yearNode of Object.values(cycleByYear)) {
      if (!yearNode || typeof yearNode !== "object") continue;
      for (const effortNode of Object.values(yearNode)) {
        const teamsNode = effortNode?.teams;
        if (!teamsNode || typeof teamsNode !== "object") continue;
        for (const team of Object.keys(teamsNode)) found.add(team);
      }
    }
  }
  const lifecycleByYear = publicAggregates?.lifecyclePhaseDays?.byYear;
  if (lifecycleByYear && typeof lifecycleByYear === "object") {
    for (const yearNode of Object.values(lifecycleByYear)) {
      const teamsNode = yearNode?.teams;
      if (!teamsNode || typeof teamsNode !== "object") continue;
      for (const team of Object.keys(teamsNode)) found.add(team);
    }
  }

  const ordered = Array.from(found).sort((a, b) => a.localeCompare(b));
  if (ordered.includes("UNMAPPED")) {
    return ordered.filter((team) => team !== "UNMAPPED").concat("UNMAPPED");
  }
  return ordered;
}

function hexToRgb(color) {
  const raw = String(color || "").trim();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split("").map((ch) => Number.parseInt(ch + ch, 16));
    return { r, g, b };
  }
  const full = /^#([0-9a-f]{6})$/i.exec(raw);
  if (full) {
    const hex = full[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16)
    };
  }
  return null;
}

function shadeColor(color, amount) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp(Math.round(rgb.r + amount));
  const g = clamp(Math.round(rgb.g + amount));
  const b = clamp(Math.round(rgb.b + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function cycleTeamBaseColor(themeColors, teamName) {
  if (teamName === "API") return themeColors.teams.api;
  if (teamName === "Frontend") return themeColors.teams.react;
  if (teamName === "Broadcast") return themeColors.teams.bc;
  if (teamName === "UNMAPPED") return readThemeColor("--mgmt-dev", "#98a3af");
  return themeColors.teams.legacy;
}

function cycleYearTeamColor(themeColors, teamName, year) {
  const base = cycleTeamBaseColor(themeColors, teamName);
  if (year === "2026") return shadeColor(base, -20);
  return base;
}

function bindManagementUatScopeToggle() {
  const scopeSelect = document.getElementById("management-uat-scope");
  if (!scopeSelect || scopeSelect.dataset.bound === "1") return;

  scopeSelect.dataset.bound = "1";
  scopeSelect.addEventListener("change", () => {
    state.managementUatScope = scopeSelect.value === "bugs_only" ? "bugs_only" : "all";
    renderManagementChart();
  });
}

function bindProductCycleControls() {
  const effortSelect = document.getElementById("product-cycle-effort-scope");
  const metricSelect = document.getElementById("product-cycle-metric-scope");
  if (!effortSelect || !metricSelect || effortSelect.dataset.bound === "1") return;

  effortSelect.dataset.bound = "1";
  metricSelect.dataset.bound = "1";

  effortSelect.addEventListener("change", () => {
    state.productCycleEffortScope = PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS.includes(effortSelect.value)
      ? effortSelect.value
      : "all";
    renderProductCycleChart();
  });

  metricSelect.addEventListener("change", () => {
    state.productCycleMetricScope = metricSelect.value === "average" ? "average" : "median";
    renderProductCycleChart();
  });
}

function bindLifecycleDaysControls() {
  const yearSelect = document.getElementById("lifecycle-days-year-scope");
  const metricSelect = document.getElementById("lifecycle-days-metric-scope");
  if (!yearSelect || !metricSelect || yearSelect.dataset.bound === "1") return;

  yearSelect.dataset.bound = "1";
  metricSelect.dataset.bound = "1";

  yearSelect.addEventListener("change", () => {
    state.lifecycleDaysYearScope = LIFECYCLE_YEAR_OPTIONS.includes(yearSelect.value)
      ? yearSelect.value
      : "2026";
    renderLifecycleDaysChart();
  });

  metricSelect.addEventListener("change", () => {
    state.lifecycleDaysMetricScope = metricSelect.value === "average" ? "average" : "median";
    renderLifecycleDaysChart();
  });
}

function setProductCycleTotalsText(text) {
  const totals = document.getElementById("product-cycle-totals");
  if (!totals) return;
  const value = String(text || "").trim();
  if (!value) {
    totals.hidden = true;
    totals.textContent = "";
    return;
  }
  totals.hidden = false;
  totals.textContent = value;
}

function renderProductCycleChartFromPublicAggregates(publicAggregates, effortScope, metric) {
  const status = document.getElementById("product-cycle-status");
  const context = document.getElementById("product-cycle-context");
  if (!status || !context) return;
  setProductCycleTotalsText("");

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No product cycle aggregates found in product-cycle-snapshot.json.";
    return;
  }

  const metricLabel = metric === "average" ? "Average" : "Median";
  const yearsToShow = PRODUCT_CYCLE_COMPARE_YEARS;
  const perYear = yearsToShow.map((year) => {
    const teamNodes = publicAggregates?.cycleTime?.byYear?.[year]?.[effortScope]?.teams || {};
    const totalsNode = publicAggregates?.cycleTime?.totalsByYear?.[year]?.[effortScope] || {};
    const teamStats = teams.map((team) => {
      const row = teamNodes?.[team] || {};
      const median = toFiniteMetric(row.median);
      const average = toFiniteMetric(row.average);
      const metricValue = metric === "average" ? average : median;
      return {
        team,
        n: toCount(row.n),
        median,
        average,
        metric: metricValue
      };
    });
    return {
      year,
      ideasInYearCount: toCount(totalsNode.total),
      doneInYearCount: toCount(totalsNode.done),
      openAtYearEnd: toCount(totalsNode.ongoing_year_end),
      openNow: toCount(totalsNode.ongoing_now),
      cycleRowsCount: toCount(totalsNode.cycle_sample),
      teamStats
    };
  });

  const totalIdeasCombined = perYear.reduce((sum, entry) => sum + entry.ideasInYearCount, 0);
  const totalCycleSample = perYear.reduce((sum, entry) => sum + entry.cycleRowsCount, 0);
  const contextText = `Cycle time per team. Total ideas (2025+2026): ${totalIdeasCombined} • cycle sample: ${totalCycleSample}`;
  context.textContent = contextText;

  if (perYear.every((entry) => entry.cycleRowsCount === 0)) {
    status.hidden = false;
    status.textContent = `No completed Parking lot exit -> Done items found for ${yearsToShow.join(", ")}.`;
    clearChartContainer("product-cycle-chart");
    return;
  }

  const themeColors = getThemeColors();
  const seriesDefs = perYear.map((entry, index) => ({
    key: `year_${entry.year}`,
    name: String(entry.year),
    color: index % 2 === 0 ? themeColors.teams.api : themeColors.teams.bc
  }));
  const rows = teams.map((team) => {
    const row = { team };
    for (const entry of perYear) {
      const key = `year_${entry.year}`;
      const stat = entry.teamStats.find((item) => item.team === team) || {};
      const metricValue =
        typeof stat.metric === "number" && Number.isFinite(stat.metric) ? stat.metric : 0;
      row[key] = metricValue;
      row[`meta_${key}`] = {
        n: toNumber(stat.n),
        median: toFiniteMetric(stat.median) || 0,
        average: toFiniteMetric(stat.average) || 0
      };
      row[`color_${key}`] = cycleYearTeamColor(themeColors, team, entry.year);
    }
    return row;
  });

  if (!window.DashboardCharts?.renderProductCycleChart) {
    status.hidden = false;
    status.textContent = "Product cycle chart unavailable: Recharts renderer missing.";
    return;
  }
  window.DashboardCharts.renderProductCycleChart({
    containerId: "product-cycle-chart",
    rows,
    seriesDefs,
    colors: themeColors,
    metricLabel
  });
  setProductCycleTotalsText("");

  const yearsWithoutCycles = perYear
    .filter((entry) => entry.cycleRowsCount === 0)
    .map((entry) => entry.year);
  if (yearsWithoutCycles.length > 0) {
    status.hidden = false;
    status.textContent = `No completed Parking lot exit -> Done items found for ${yearsWithoutCycles.join(", ")}; showing other year(s).`;
  }
}

function renderLifecycleDaysChartFromPublicAggregates(publicAggregates, year, metric) {
  const status = document.getElementById("lifecycle-days-status");
  const context = document.getElementById("lifecycle-days-context");
  if (!status || !context) return;

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No lifecycle aggregates found in product-cycle-snapshot.json.";
    return;
  }

  const metricLabel = metric === "average" ? "Average" : "Median";
  const chartTitleText = `Lifecycle time spent per phase (${metricLabel})`;

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
  const rows = teams.map((team) => {
    const row = { team };
    for (const phase of PRODUCT_CYCLE_PHASES) {
      const source =
        publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.teams?.[team]?.[phase.key] || {};
      const median = toFiniteMetric(source.median);
      const average = toFiniteMetric(source.average);
      const metricValue = metric === "average" ? average : median;
      row[phase.key] =
        typeof metricValue === "number" && Number.isFinite(metricValue) ? metricValue : 0;
      row[`meta_${phase.key}`] = {
        n: toCount(source.n),
        median: median || 0,
        average: average || 0
      };
    }
    return row;
  });
  const plottedValues = phaseDefs
    .flatMap((phase) => rows.map((row) => row[phase.key]))
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);

  const totalsNode = publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[year] || {};
  const doneCount = toCount(totalsNode.done);
  const ongoingCount = toCount(totalsNode.ongoing);
  const totalCount = toCount(totalsNode.total);
  const sampleCount = toCount(totalsNode.cycle_sample);
  const totalsText = `${year}: total ${totalCount} • done ${doneCount} • ongoing ${ongoingCount} • cycle sample ${sampleCount}`;

  if (plottedValues.length === 0) {
    status.hidden = false;
    status.textContent = `No lifecycle phase time data found for ${year}.`;
    clearChartContainer("lifecycle-days-chart");
    return;
  }
  if (!window.DashboardCharts?.renderLifecycleDaysChart) {
    status.hidden = false;
    status.textContent = "Lifecycle chart unavailable: Recharts renderer missing.";
    return;
  }
  window.DashboardCharts.renderLifecycleDaysChart({
    containerId: "lifecycle-days-chart",
    rows,
    phaseDefs,
    colors: themeColors,
    metricLabel
  });
  context.textContent = `${chartTitleText} • ${totalsText}`;
}

function renderProductCycleChart() {
  const status = document.getElementById("product-cycle-status");
  const root = document.getElementById("product-cycle-chart");
  const context = document.getElementById("product-cycle-context");
  const effortSelect = document.getElementById("product-cycle-effort-scope");
  const metricSelect = document.getElementById("product-cycle-metric-scope");
  if (!status || !root || !context) return;

  status.hidden = true;
  setProductCycleTotalsText("");
  const effortScope = PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS.includes(state.productCycleEffortScope)
    ? state.productCycleEffortScope
    : "all";
  const metric = state.productCycleMetricScope === "average" ? "average" : "median";
  if (effortSelect) effortSelect.value = effortScope;
  if (metricSelect) metricSelect.value = metric;

  const publicAggregates = getProductCyclePublicAggregates();
  if (!publicAggregates) {
    status.hidden = false;
    status.textContent = "No product cycle aggregates found in product-cycle-snapshot.json.";
    clearChartContainer("product-cycle-chart");
    return;
  }
  renderProductCycleChartFromPublicAggregates(publicAggregates, effortScope, metric);
}

function renderLifecycleDaysChart() {
  const status = document.getElementById("lifecycle-days-status");
  const root = document.getElementById("lifecycle-days-chart");
  const context = document.getElementById("lifecycle-days-context");
  const yearSelect = document.getElementById("lifecycle-days-year-scope");
  const metricSelect = document.getElementById("lifecycle-days-metric-scope");
  if (!status || !root || !context) return;

  status.hidden = true;
  const year = LIFECYCLE_YEAR_OPTIONS.includes(state.lifecycleDaysYearScope)
    ? state.lifecycleDaysYearScope
    : "2026";
  const metric = state.lifecycleDaysMetricScope === "average" ? "average" : "median";
  if (yearSelect) yearSelect.value = year;
  if (metricSelect) metricSelect.value = metric;

  const publicAggregates = getProductCyclePublicAggregates();
  if (!publicAggregates) {
    status.hidden = false;
    status.textContent = "No lifecycle aggregates found in product-cycle-snapshot.json.";
    clearChartContainer("lifecycle-days-chart");
    return;
  }
  renderLifecycleDaysChartFromPublicAggregates(publicAggregates, year, metric);
}

function renderManagementChart() {
  const status = document.getElementById("management-status");
  const root = document.getElementById("management-chart");
  const context = document.getElementById("management-context");
  if (!status || !root || !context) return;

  status.hidden = true;

  const scope = state.managementUatScope === "bugs_only" ? "bugs_only" : "all";
  const scopeSelect = document.getElementById("management-uat-scope");
  if (scopeSelect) scopeSelect.value = scope;
  const flowVariants = state.snapshot?.kpis?.broadcast?.flow_by_priority_variants;
  const scopedFlow = flowVariants && typeof flowVariants === "object" ? flowVariants[scope] : null;
  const flow = scopedFlow || state.snapshot?.kpis?.broadcast?.flow_by_priority;
  if (!flow || typeof flow !== "object") {
    status.hidden = false;
    status.textContent = "No Broadcast flow_by_priority data found in backlog-snapshot.json.";
    return;
  }

  const bands = ["highest", "high", "medium"];
  const baseLabels = ["Highest", "High", "Medium"];
  const themeColors = getThemeColors();
  const devMedian = bands.map((band) => {
    const value = flow?.[band]?.median_dev_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const uatMedian = bands.map((band) => {
    const value = flow?.[band]?.median_uat_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const devAvg = bands.map((band) => {
    const value = flow?.[band]?.avg_dev_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const uatAvg = bands.map((band) => {
    const value = flow?.[band]?.avg_uat_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const devCounts = bands.map((band) => toNumber(flow?.[band]?.n_dev));
  const uatCounts = bands.map((band) => toNumber(flow?.[band]?.n_uat));
  const labels = baseLabels;
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
    devMedian: Number.isFinite(devMedian[idx]) ? devMedian[idx] : 0,
    uatMedian: Number.isFinite(uatMedian[idx]) ? uatMedian[idx] : 0,
    devAvg: Number.isFinite(devAvg[idx]) ? devAvg[idx] : 0,
    uatAvg: Number.isFinite(uatAvg[idx]) ? uatAvg[idx] : 0,
    devCount: devCounts[idx],
    uatCount: uatCounts[idx]
  }));

  const yValues = [...devMedian, ...uatMedian].filter((value) => Number.isFinite(value));
  const variantCandidates = [
    flowVariants?.all,
    flowVariants?.bugs_only,
    state.snapshot?.kpis?.broadcast?.flow_by_priority
  ].filter((candidate) => candidate && typeof candidate === "object");
  const variantYValues = [];
  for (const candidate of variantCandidates) {
    for (const band of ["medium", "high", "highest"]) {
      const dev = candidate?.[band]?.median_dev_days;
      const uat = candidate?.[band]?.median_uat_days;
      if (typeof dev === "number" && Number.isFinite(dev)) variantYValues.push(dev);
      if (typeof uat === "number" && Number.isFinite(uat)) variantYValues.push(uat);
    }
  }
  const maxY = [...yValues, ...variantYValues].length
    ? Math.max(...yValues, ...variantYValues)
    : 1;
  const paddedMaxY = Math.max(1, Math.ceil(maxY * 1.12));

  if (!window.DashboardCharts?.renderManagementChart) {
    status.hidden = false;
    status.textContent = "Management chart unavailable: Recharts renderer missing.";
    return;
  }
  window.DashboardCharts.renderManagementChart({
    containerId: "management-chart",
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
    bindCompositionTeamScopeToggle();
    bindManagementUatScopeToggle();
    bindProductCycleControls();
    bindLifecycleDaysControls();
    setLastUpdatedSubtitles(state.snapshot);
    setProductCycleUpdatedSubtitles(state.productCycle, state.snapshot?.updatedAt);
    if (state.mode !== "composition") {
      renderLineChart();
    }
    if (state.mode !== "trend") {
      renderStackedBarChart();
    }
    renderUatAgingChart();
    renderManagementChart();
    renderProductCycleChart();
    renderLifecycleDaysChart();
  } catch (error) {
    const message = `Failed to load backlog-snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    setStatusMessageForIds(CHART_STATUS_IDS, message);
  }
}

loadSnapshot();
