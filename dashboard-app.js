"use strict";

(function initDashboardApp() {

const PRODUCT_CYCLE_SCOPE = "inception";
const PRODUCT_CYCLE_SCOPE_LABEL = "All ideas";
const PR_ACTIVITY_INFLOW_SPLIT = 15;
const PR_ACTIVITY_INFLOW_AXIS_MIN_UPPER = 30;
const PR_ACTIVITY_INFLOW_AXIS_STEP = 5;
const PR_ACTIVITY_REVIEW_SPLIT = 7;
const PR_ACTIVITY_REVIEW_AXIS_UPPER = 30;
const PR_ACTIVITY_REVIEW_AXIS_STEP = 5;
const THIRTY_DAY_WINDOW_KEY = "30d";
const PR_CYCLE_WINDOWS = [THIRTY_DAY_WINDOW_KEY, "90d", "6m", "1y"];
const PR_ACTIVITY_WINDOWS = [THIRTY_DAY_WINDOW_KEY, "90d", "6m", "1y"];
const MANAGEMENT_FLOW_SCOPES = ["ongoing", "done"];
const LIFECYCLE_TEAM_SCOPE_DEFAULT = "all";
const PRODUCT_CYCLE_TEAM_DEFAULT = "frontend";
const CHART_CONFIG = {
  trend: {
    panelId: "trend-panel",
    statusId: "trend-status",
    contextId: "trend-context",
    containerId: "bug-trend-chart",
    rendererName: "renderBugBacklogTrendByTeamChart",
    missingMessage: "Trend chart unavailable: Recharts did not load. Check local script paths."
  },
  composition: {
    panelId: "composition-panel",
    statusId: "composition-status",
    contextId: "composition-context",
    containerId: "bug-composition-chart",
    rendererName: "renderBugCompositionByPriorityChart",
    missingMessage:
      "Composition chart unavailable: Recharts did not load. Check local script paths."
  },
  "management-facility": {
    panelId: "management-facility-panel",
    statusId: "management-facility-status",
    contextId: "management-facility-context",
    containerId: "development-vs-uat-by-facility-chart",
    rendererName: "renderDevelopmentVsUatByFacilityChart",
    missingMessage: "Development vs UAT chart unavailable: Recharts renderer missing."
  },
  "pr-activity": {
    panelId: "pr-activity-panel",
    statusId: "pr-activity-status",
    contextId: "pr-activity-context",
    containerId: "pr-position-chart",
    missingMessage: "No Jira-linked PR activity found in backlog-snapshot.json."
  },
  "pr-activity-legacy": {
    panelId: "pr-activity-legacy-panel",
    statusId: "pr-activity-legacy-status",
    contextId: "pr-activity-legacy-context",
    containerId: "pr-activity-legacy-count-chart",
    missingMessage: "No Jira-linked PR activity found in backlog-snapshot.json."
  },
  contributors: {
    panelId: "contributors-panel",
    statusId: "contributors-status",
    contextId: "contributors-context",
    containerId: "top-contributors-chart",
    missingMessage: "Contributors chart unavailable: Recharts renderer missing."
  },
  "product-cycle": {
    panelId: "product-cycle-panel",
    statusId: "product-cycle-status",
    contextId: "product-cycle-context",
    containerId: "cycle-time-parking-lot-to-done-chart",
    missingMessage: "No product cycle aggregates found in product-cycle-snapshot.json."
  },
  "pr-cycle-experiment": {
    panelId: "pr-cycle-experiment-panel",
    statusId: "pr-cycle-experiment-status",
    contextId: "pr-cycle-experiment-context",
    containerId: "pr-cycle-experiment-card",
    missingMessage: "No PR cycle experiment data found in pr-cycle-snapshot.json."
  },
  "lifecycle-days": {
    panelId: "lifecycle-days-panel",
    statusId: "lifecycle-days-status",
    contextId: "lifecycle-days-context",
    containerId: "lifecycle-time-spent-per-phase-chart",
    rendererName: "renderLifecycleTimeSpentPerStageChart",
    missingMessage: "No lifecycle aggregates found in product-cycle-snapshot.json."
  }
};
const CHART_STATUS_IDS = [...new Set(Object.values(CHART_CONFIG).map((config) => config.statusId))];
const DATA_SOURCE_CONFIG = {
  snapshot: {
    stateKey: "snapshot",
    url: "./backlog-snapshot.json",
    errorMessage: "Failed to load backlog-snapshot.json",
    statusIds: [
      "trend-status",
      "composition-status",
      "management-facility-status",
      "pr-activity-status",
      "pr-activity-legacy-status"
    ]
  },
  productCycle: {
    stateKey: "productCycle",
    url: "./product-cycle-snapshot.json",
    errorMessage: "Failed to load product-cycle-snapshot.json",
    statusIds: ["product-cycle-status", "lifecycle-days-status"]
  },
  contributors: {
    stateKey: "contributors",
    url: "./contributors-snapshot.json",
    errorMessage: "Failed to load contributors-snapshot.json",
    statusIds: ["contributors-status"],
    clearContainers: ["top-contributors-chart"]
  },
  prCycle: {
    stateKey: "prCycle",
    url: "./pr-cycle-snapshot.json",
    errorMessage: "Failed to load pr-cycle-snapshot.json",
    statusIds: ["pr-cycle-experiment-status"],
    clearContainers: ["pr-cycle-experiment-card"]
  }
};
const PRELOADED_DATA_SOURCE_PROMISES =
  window.__dashboardDataSourcePromiseCache || Object.create(null);
const CHART_DATA_SOURCES = {
  trend: ["snapshot"],
  composition: ["snapshot"],
  "management-facility": ["snapshot"],
  "pr-activity": ["snapshot"],
  "pr-activity-legacy": ["snapshot"],
  contributors: ["contributors"],
  "product-cycle": ["productCycle"],
  "pr-cycle-experiment": ["prCycle"],
  "lifecycle-days": ["productCycle"]
};
const CHART_RENDERERS = {
  trend: renderTrendChart,
  composition: renderBugCompositionByPriorityChart,
  "management-facility": renderDevelopmentVsUatByFacilityChart,
  "pr-activity": renderPrActivityCharts,
  "pr-activity-legacy": renderLegacyPrActivityCharts,
  contributors: renderTopContributorsChart,
  "product-cycle": renderLeadAndCycleTimeByTeamChart,
  "pr-cycle-experiment": renderPrCycleExperiment,
  "lifecycle-days": renderLifecycleTimeSpentPerStageChart
};
const CONTROL_BINDINGS = [
  {
    name: "composition-team-scope",
    stateKey: "compositionTeamScope",
    defaultValue: "bc",
    normalizeValue: (value) => value || "bc",
    onChangeRender: renderBugCompositionByPriorityChart
  },
  {
    name: "management-facility-flow-scope",
    stateKey: "managementFlowScope",
    defaultValue: "ongoing",
    normalizeValue: (value) => normalizeOption(value, MANAGEMENT_FLOW_SCOPES, "ongoing"),
    onChangeRender: renderDevelopmentVsUatByFacilityChart
  },
  {
    name: "pr-cycle-team",
    stateKey: "prCycleTeam",
    defaultValue: "bc",
    normalizeValue: (value) =>
      String(value || "")
        .trim()
        .toLowerCase() || "bc",
    onChangeRender: renderPrCycleExperiment
  },
  {
    name: "pr-cycle-window",
    stateKey: "prCycleWindow",
    defaultValue: THIRTY_DAY_WINDOW_KEY,
    normalizeValue: (value) => normalizeOption(value, PR_CYCLE_WINDOWS, THIRTY_DAY_WINDOW_KEY),
    onChangeRender: renderPrCycleExperiment
  },
  {
    name: "pr-activity-window",
    stateKey: "prActivityWindow",
    defaultValue: THIRTY_DAY_WINDOW_KEY,
    normalizeValue: (value) => normalizeOption(value, PR_ACTIVITY_WINDOWS, THIRTY_DAY_WINDOW_KEY),
    onChangeRender: renderPrActivityCharts
  },
  {
    name: "pr-activity-legacy-metric",
    stateKey: "prActivityLegacyMetric",
    defaultValue: "offered",
    normalizeValue: (value) => (value === "merged" ? "merged" : "offered"),
    onChangeRender: renderLegacyPrActivityCharts
  },
  {
    name: "pr-activity-legacy-show-markers",
    stateKey: "showLegacyPrActivityMarkers",
    defaultValue: true,
    normalizeChecked: (checked) => checked !== false,
    onChangeRender: renderLegacyPrActivityCharts,
    controlType: "checkbox"
  },
  {
    name: "product-cycle-team",
    stateKey: "productCycleTeam",
    defaultValue: PRODUCT_CYCLE_TEAM_DEFAULT,
    normalizeValue: productCycleTeamKey,
    onChangeRender: renderLeadAndCycleTimeByTeamChart
  },
  {
    name: "lifecycle-team",
    stateKey: "lifecycleTeamScope",
    defaultValue: LIFECYCLE_TEAM_SCOPE_DEFAULT,
    normalizeValue: (value) =>
      String(value || "")
        .trim()
        .toLowerCase() || LIFECYCLE_TEAM_SCOPE_DEFAULT,
    onChangeRender: renderLifecycleTimeSpentPerStageChart
  }
];

const state = {
  snapshot: null,
  contributors: null,
  productCycle: null,
  prCycle: null,
  loadedSources: {},
  loadErrors: {},
  mode: "all",
  compositionTeamScope: "bc",
  prActivityHiddenKeys: [],
  prActivityLegacyHiddenKeys: [],
  prActivityWindow: THIRTY_DAY_WINDOW_KEY,
  prActivityLegacyMetric: "offered",
  showLegacyPrActivityMarkers: true,
  productCycleTeam: PRODUCT_CYCLE_TEAM_DEFAULT,
  managementFlowScope: "ongoing",
  prCycleTeam: "bc",
  prCycleWindow: THIRTY_DAY_WINDOW_KEY,
  lifecycleTeamScope: LIFECYCLE_TEAM_SCOPE_DEFAULT
};

const visibleChartModes = new Set();
const queuedChartModes = new Set();
let chartVisibilityObserver = null;
let chartRenderFrame = 0;

const dashboardUiUtils = window.DashboardViewUtils;
if (!dashboardUiUtils) {
  throw new Error("Dashboard UI helpers not loaded.");
}
const dashboardDataUtils = window.DashboardDataUtils;
if (!dashboardDataUtils) {
  throw new Error("Dashboard data helpers not loaded.");
}
const dashboardChartCore = window.DashboardChartCore;
if (!dashboardChartCore) {
  throw new Error("Dashboard chart core not loaded.");
}
const dashboardSvgCore = window.DashboardSvgCore;
if (!dashboardSvgCore) {
  throw new Error("Dashboard SVG core not loaded.");
}
const {
  toNumber,
  formatUpdatedAt,
  getOldestTimestamp,
  setStatusMessage,
  setStatusMessageForIds,
  getThemeColors,
  clearChartContainer,
  getModeFromUrl,
  isEmbedMode
} = dashboardUiUtils;
const { buildTeamColorMap, buildTintMap, orderProductCycleTeams, toCount } = dashboardDataUtils;
const {
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  activeLineDot,
  buildAxisLabel,
  buildNiceNumberAxis,
  createTooltipContent,
  formatDateShort,
  h,
  isCompactViewport,
  makeTooltipLine,
  renderLegendNode,
  renderWithRoot,
  singleChartHeightForMode,
  tooltipTitleLine,
  trendLayoutForViewport,
  withSafeTooltipProps
} = dashboardChartCore;
const { SvgChartShell, linearScale, withAlpha } = dashboardSvgCore;

const PR_ACTIVITY_LINE_DEFS = [
  { dataKey: "api", name: "API", colorKey: "api" },
  { dataKey: "legacy", name: "Legacy FE", colorKey: "legacy" },
  { dataKey: "react", name: "React FE", colorKey: "react" },
  { dataKey: "bc", name: "BC", colorKey: "bc" },
  { dataKey: "workers", name: "Workers", colorKey: "workers" },
  { dataKey: "titanium", name: "Titanium", colorKey: "titanium" }
];
const PR_ACTIVITY_REFERENCE_MARKERS = [
  { date: "2025-04-01", label: "NAB" },
  { date: "2025-09-01", label: "IBC" },
  { date: "2026-01-01", label: "Codex" }
];
const chartMonthRangeShortFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function toChartDateValue(dateText) {
  const timestamp = new Date(`${String(dateText || "")}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatChartDateTick(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  });
}

function formatCompactChartDateTick(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  });
}

function normalizePrActivityInterval(interval) {
  const safeInterval = String(interval || "").trim().toLowerCase();
  return safeInterval === "sprint" ? "sprint" : "month";
}

function prActivityInflowLabel(interval, { short = false } = {}) {
  const unit = normalizePrActivityInterval(interval) === "sprint" ? "sprint" : "month";
  return short ? `Avg. PR inflow per ${unit}` : `Avg PR inflow per ${unit}`;
}

function shiftChartIsoDate(dateText, deltaDays) {
  const date = new Date(`${String(dateText || "")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function shiftChartIsoMonths(dateText, deltaMonths) {
  const date = new Date(`${String(dateText || "")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  return date.toISOString().slice(0, 10);
}

function getPrActivityWindowLabel(windowKey) {
  switch (windowKey) {
    case THIRTY_DAY_WINDOW_KEY:
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "6m":
      return "Last 6 months";
    case "1y":
    default:
      return "Last year";
  }
}

function getPrActivityWindowedPoints(points, selectedWindowKey) {
  const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
  if (safePoints.length === 0) {
    return {
      points: [],
      windowKey: selectedWindowKey,
      windowLabel: getPrActivityWindowLabel(selectedWindowKey)
    };
  }
  const latestPoint = safePoints[safePoints.length - 1];
  const latestDate = String(latestPoint?.date || "").trim();
  let startDate = latestDate;
  if (selectedWindowKey === THIRTY_DAY_WINDOW_KEY) startDate = shiftChartIsoDate(latestDate, -29);
  else if (selectedWindowKey === "90d") startDate = shiftChartIsoDate(latestDate, -89);
  else if (selectedWindowKey === "6m") startDate = shiftChartIsoMonths(latestDate, -6);
  else startDate = shiftChartIsoMonths(latestDate, -12);
  const filteredPoints = safePoints.filter((point) => String(point?.date || "") >= startDate);
  return {
    points: filteredPoints.length > 0 ? filteredPoints : safePoints,
    windowKey: selectedWindowKey,
    windowLabel: getPrActivityWindowLabel(selectedWindowKey)
  };
}

function formatPrActivityScopeLabel(startDateText, endDateText, windowKey) {
  const startValue = toChartDateValue(startDateText);
  const endValue = toChartDateValue(endDateText);
  const prefix = `${getPrActivityWindowLabel(windowKey)} avg`;
  if (!startValue || !endValue) return prefix;
  return `${prefix} • ${chartMonthRangeShortFormatter.format(new Date(startValue))} to ${chartMonthRangeShortFormatter.format(new Date(endValue))}`;
}

function buildLifecycleMobileTick(colors, secondaryLabels) {
  const stageLabelMap = {
    Parking: "Parking",
    Design: "Design",
    Ready: "Ready",
    "In Development": "In Dev",
    UAT: "UAT"
  };
  return function lifecycleMobileTick(props) {
    const { x, y, payload } = props || {};
    const raw = String(payload?.value || "");
    const line1 = stageLabelMap[raw] || raw;
    const line2 =
      secondaryLabels && typeof secondaryLabels === "object"
        ? String(secondaryLabels[raw] || "")
        : "";
    return h(
      "g",
      { transform: `translate(${x},${y})` },
      h(
        "text",
        {
          x: 0,
          y: 10,
          textAnchor: "middle",
          fill: colors.text,
          fontSize: 11
        },
        line1
      ),
      line2
        ? h(
            "text",
            {
              x: 0,
              y: 24,
              textAnchor: "middle",
              fill: "rgba(31,51,71,0.78)",
              fontSize: 10
            },
            line2
          )
        : null
    );
  };
}

function normalizeOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function getConfig(configKey) {
  return CHART_CONFIG[configKey] || null;
}

function getRenderer(
  config,
  rendererName = config.rendererName,
  missingMessage = config.missingMessage
) {
  const renderer = window.DashboardCharts?.[rendererName];
  if (renderer) return renderer;
  setStatusMessage(config.statusId, missingMessage);
  return null;
}

function renderNamedChart(config, props, options = {}) {
  const { rendererName = config.rendererName, missingMessage = config.missingMessage } = options;
  const renderChart = getRenderer(config, rendererName, missingMessage);
  if (!renderChart) return false;
  renderChart(props);
  return true;
}

function renderSnapshotChart(config, extra = {}) {
  setStatusMessage(config.statusId);
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  renderNamedChart(config, {
    containerId: config.containerId,
    snapshot: state.snapshot,
    colors: getThemeColors(),
    ...extra
  });
}

function applyModeVisibility() {
  const validModes = new Set(Object.keys(CHART_CONFIG));
  const selectedMode = validModes.has(state.mode) ? state.mode : "all";
  const showAll = selectedMode === "all";
  const embedMode = isEmbedMode();
  const actionsPanel = document.getElementById("actions-required-panel");
  document.body.classList.toggle("embed-mode", embedMode);
  document.body.classList.toggle("single-chart-mode", embedMode && !showAll);
  document.body.classList.toggle("embedded-frame-mode", embedMode && showAll);
  if (actionsPanel) actionsPanel.hidden = !showAll;
  for (const [mode, config] of Object.entries(CHART_CONFIG)) {
    const panel = document.getElementById(config.panelId);
    if (!panel) continue;
    panel.hidden = showAll ? false : mode !== selectedMode;
  }
}

function setPanelContext(node, text) {
  if (!node) return;
  const safeText = String(text || "").trim();
  node.hidden = safeText.length === 0;
  node.textContent = safeText;
}

function setConfigContext(config, text) {
  setPanelContext(document.getElementById(config.contextId), text);
}

function getDashboardRefreshUpdatedAt() {
  return getOldestTimestamp([
    state.snapshot?.updatedAt,
    state.snapshot?.chartData ? state.snapshot?.chartDataUpdatedAt : "",
    state.productCycle?.generatedAt,
    state.contributors?.updatedAt,
    state.prCycle?.updatedAt
  ]);
}

function renderDashboardRefreshStrip() {
  const panel = document.getElementById("dashboard-refresh-panel");
  const textNode = document.getElementById("dashboard-refresh-text");
  if (!panel || !textNode) return;
  const refreshUpdatedAt = getDashboardRefreshUpdatedAt();
  panel.hidden = false;
  textNode.hidden = refreshUpdatedAt.length === 0;
  textNode.textContent = refreshUpdatedAt
    ? `Last updated ${formatUpdatedAt(refreshUpdatedAt)}`
    : "";
}

function formatCompactMonths(value) {
  const safeValue = Math.max(0, toNumber(value));
  return `${safeValue.toFixed(1)} mo`;
}

function buildBugActionItem() {
  const points = Array.isArray(state.snapshot?.combinedPoints) ? state.snapshot.combinedPoints : [];
  if (points.length === 0) return null;
  const latestPoint = points[points.length - 1];
  const latestMs = new Date(`${String(latestPoint?.date || "")}T00:00:00Z`).getTime();
  const previousPoint =
    Number.isFinite(latestMs) && points.length > 1
      ? points.find((point) => {
          const pointMs = new Date(`${String(point?.date || "")}T00:00:00Z`).getTime();
          return Number.isFinite(pointMs) && pointMs >= latestMs - 29 * 86400000;
        }) || points[0] || null
      : points.length > 1
        ? points[points.length - 2]
        : null;
  const teamDefs = [
    { key: "api", label: "API" },
    { key: "legacy", label: "Legacy FE" },
    { key: "react", label: "React FE" },
    { key: "bc", label: "Broadcast" },
    { key: "workers", label: "Workers" },
    { key: "titanium", label: "Titanium" }
  ];

  const rankedTeams = teamDefs
    .map((team) => {
      const latest = latestPoint?.[team.key] && typeof latestPoint[team.key] === "object" ? latestPoint[team.key] : {};
      const previous =
        previousPoint?.[team.key] && typeof previousPoint[team.key] === "object"
          ? previousPoint[team.key]
          : {};
      const highest = toNumber(latest.highest);
      const high = toNumber(latest.high);
      const medium = toNumber(latest.medium);
      const low = toNumber(latest.low);
      const lowest = toNumber(latest.lowest);
      const total = highest + high + medium + low + lowest;
      const previousTotal =
        toNumber(previous.highest) +
        toNumber(previous.high) +
        toNumber(previous.medium) +
        toNumber(previous.low) +
        toNumber(previous.lowest);
      const delta = total - previousTotal;
      const aged30 = toNumber(latest.longstanding_30d_plus);
      const aged60 = toNumber(latest.longstanding_60d_plus);
      const highestHigh = highest + high;
      const score =
        highest * 20 +
        high * 2 +
        aged60 * 0.45 +
        aged30 * 0.2 +
        Math.max(delta, 0) * 3;
      return {
        ...team,
        total,
        highestHigh,
        delta,
        aged30,
        aged60,
        score
      };
    })
    .filter((team) => team.total > 0)
    .sort((left, right) => right.score - left.score);

  const leadTeam = rankedTeams[0];
  if (!leadTeam || (leadTeam.highestHigh === 0 && leadTeam.aged30 === 0 && leadTeam.delta <= 0)) {
    return null;
  }

  return {
    key: "bug-pressure",
    score: leadTeam.score,
    title: `${leadTeam.label} bug backlog`,
    href: "#composition-panel",
    linkLabel: "Open bug graph"
  };
}

function buildUatActionItem() {
  const rows = Array.isArray(state.snapshot?.chartData?.managementBusinessUnit?.byScope?.ongoing?.rows)
    ? state.snapshot.chartData.managementBusinessUnit.byScope.ongoing.rows
    : [];
  const rankedRows = rows
    .map((row) => ({
      label: String(row?.label || "").trim(),
      sampleCount: toNumber(row?.sampleCount),
      uatAvg: toNumber(row?.uatAvg),
      score: toNumber(row?.sampleCount) * 8 + toNumber(row?.uatAvg)
    }))
    .filter((row) => row.label && row.sampleCount > 0 && row.uatAvg > 1)
    .sort((left, right) => right.score - left.score);
  const leadRow = rankedRows[0];
  if (!leadRow) return null;

  return {
    key: "uat-pressure",
    score: leadRow.score,
    title: `${leadRow.label} UAT backlog`,
    href: "#management-facility-panel",
    linkLabel: "Open UAT graph"
  };
}

function buildFlowActionItem() {
  const teams = Array.isArray(state.prCycle?.windows?.[THIRTY_DAY_WINDOW_KEY]?.teams)
    ? state.prCycle.windows[THIRTY_DAY_WINDOW_KEY].teams
    : [];
  const rankedTeams = teams
    .map((team) => ({
      label: String(team?.label || "").trim(),
      issueCount: toNumber(team?.issueCount),
      totalCycleDays: toNumber(team?.totalCycleDays),
      bottleneckLabel: String(team?.bottleneckLabel || "").trim(),
      score: toNumber(team?.totalCycleDays) * Math.max(1, toNumber(team?.issueCount) / 10)
    }))
    .filter((team) => team.label && team.issueCount > 0 && team.totalCycleDays > 7)
    .sort((left, right) => right.score - left.score);
  const leadTeam = rankedTeams[0];
  if (!leadTeam) return null;

  return {
    key: "flow-pressure",
    score: leadTeam.score,
    title:
      leadTeam.key === "workers"
        ? "Workflow bottleneck in Workers"
        : `Workflow bottleneck in ${leadTeam.label}`,
    href: "#pr-cycle-experiment-panel",
    linkLabel: "Open workflow graph"
  };
}

function buildActionsRequiredItems() {
  return [buildUatActionItem(), buildFlowActionItem(), buildBugActionItem()]
    .filter(Boolean)
    .slice(0, 3);
}

function renderActionsRequiredFrame() {
  const panel = document.getElementById("actions-required-panel");
  const listNode = document.getElementById("actions-required-list");
  const contextNode = document.getElementById("actions-required-context");
  const statusNode = document.getElementById("actions-required-status");
  if (!panel || !listNode || !contextNode || !statusNode) return;

  if (state.mode !== "all") {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  const actionItems = buildActionsRequiredItems();
  const points = Array.isArray(state.snapshot?.combinedPoints) ? state.snapshot.combinedPoints : [];
  const latestSnapshotDate = points.length > 0 ? String(points[points.length - 1]?.date || "") : "";
  const actionWindowStart = latestSnapshotDate
    ? shiftChartIsoDate(latestSnapshotDate, -29)
    : "";
  setPanelContext(
    contextNode,
    latestSnapshotDate
      ? `Last 30 days • ${actionWindowStart} to ${latestSnapshotDate} • ranked by current pressure`
      : ""
  );

  if (actionItems.length === 0) {
    statusNode.hidden = true;
    listNode.innerHTML =
      '<p class="action-card__empty">No urgent action card is firing from the current snapshot.</p>';
    return;
  }

  statusNode.hidden = true;
  listNode.innerHTML = `
    <ul class="action-link-list">
      ${actionItems
        .map(
          (item) => `
            <li class="action-link-list__item">
              <a class="action-link-list__link" href="${escapeHtml(item.href || "#")}">${escapeHtml(item.title || "")}</a>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function getBroadcastScopeLabel() {
  return String(state.snapshot?.uatAging?.scope?.label || "Broadcast");
}

function getChartNodes(configKey) {
  const config = getConfig(configKey);
  if (!config) return null;
  const status = document.getElementById(config.statusId);
  const context = document.getElementById(config.contextId);
  return status ? { config, status, context } : null;
}

function withChart(configKey, onReady, { resetStatus = true } = {}) {
  const chart = getChartNodes(configKey);
  if (!chart) return;
  if (resetStatus) chart.status.hidden = true;
  onReady(chart);
}

function showPanelStatus(status, message, { containerId = "" } = {}) {
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  if (containerId) clearChartContainer(containerId);
}

function renderChartWithState(configKey, buildResult) {
  withChart(configKey, ({ status, context, config }) => {
    const result = buildResult({ status, context, config });
    if (!result) return;
    if (result.error) {
      showPanelStatus(
        status,
        result.error,
        result.clearContainer ? { containerId: config.containerId } : {}
      );
      return;
    }
    if (Object.prototype.hasOwnProperty.call(result, "contextText")) {
      setPanelContext(context, result.contextText);
    }
    renderNamedChart(
      config,
      {
        containerId: config.containerId,
        colors: getThemeColors(),
        ...(result.props || {})
      },
      result.options || {}
    );
  });
}

function renderBugCompositionByPriorityChart() {
  const config = getConfig("composition");
  const points = Array.isArray(state.snapshot?.combinedPoints) ? state.snapshot.combinedPoints : [];
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;
  setConfigContext(config, latestPoint?.date ? `Latest snapshot • ${latestPoint.date}` : "");
  renderSnapshotChart(config);
}

function renderTrendChart() {
  const config = getConfig("trend");
  setConfigContext(config, "Last 10 sprints");
  renderSnapshotChart(config);
}

function setPrActivityHelpDetails({ since = "", until = "", caveat = "", interval = "" } = {}) {
  const metaNode = document.getElementById("pr-activity-help-meta");
  const noteNode = document.getElementById("pr-activity-help-note");
  const safeSince = String(since || "").trim();
  const safeUntil = String(until || "").trim();
  const safeCaveat = String(caveat || "").trim();
  const unitLabel =
    normalizePrActivityInterval(interval) === "sprint" ? "sprint buckets" : "month buckets";

  if (metaNode) {
    const rangeText =
      safeSince && safeUntil
        ? `Current view averages ${unitLabel} from ${safeSince} to ${safeUntil}.`
        : safeSince
          ? `Current view averages ${unitLabel} starting on ${safeSince}.`
          : "";
    metaNode.hidden = rangeText.length === 0;
    metaNode.textContent = rangeText;
  }

  if (noteNode) {
    const friendlyNote = safeCaveat
      ? "These are Jira-linked proxy dates, so use the trends for direction rather than exact operational accounting. One underlying PR can still be associated with more than one done Jira ticket."
      : "";
    noteNode.hidden = friendlyNote.length === 0;
    noteNode.textContent = friendlyNote;
  }
}

function buildLegacyPrActivityRows(metricKey = "offered") {
  const points = buildLegacyPrActivitySourcePoints();
  return points.map((point) => ({
    date: String(point?.date || ""),
    dateValue: toChartDateValue(point?.date),
    api: toNumber(point?.api?.[metricKey]),
    legacy: toNumber(point?.legacy?.[metricKey]),
    react: toNumber(point?.react?.[metricKey]),
    bc: toNumber(point?.bc?.[metricKey]),
    workers: toNumber(point?.workers?.[metricKey]),
    titanium: toNumber(point?.titanium?.[metricKey])
  }));
}

function monthBucketDate(isoDate) {
  const safeValue = String(isoDate || "").trim();
  if (!safeValue) return "";
  const date = new Date(`${safeValue}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 7) + "-01";
}

function buildLegacyPrActivityMonthlyPoints() {
  const points = Array.isArray(state.snapshot?.prActivity?.points) ? state.snapshot.prActivity.points : [];
  const teamKeys = PR_ACTIVITY_LINE_DEFS.map((lineDef) => lineDef.dataKey);
  const byMonth = new Map();

  for (const point of points) {
    const monthDate = monthBucketDate(point?.date);
    if (!monthDate) continue;
    let bucket = byMonth.get(monthDate);
    if (!bucket) {
      bucket = { date: monthDate };
      for (const teamKey of teamKeys) {
        bucket[teamKey] = {
          offered: 0,
          merged: 0,
          reviewToMergeDaysTotal: 0,
          avgReviewToMergeSampleCount: 0
        };
      }
      byMonth.set(monthDate, bucket);
    }

    for (const teamKey of teamKeys) {
      const teamPoint = point?.[teamKey];
      const offered = toCount(teamPoint?.offered);
      const merged = toCount(teamPoint?.merged);
      const sampleCount = toCount(teamPoint?.avgReviewToMergeSampleCount);
      const averageDays = toNumber(teamPoint?.avgReviewToMergeDays);

      bucket[teamKey].offered += offered;
      bucket[teamKey].merged += merged;
      bucket[teamKey].avgReviewToMergeSampleCount += sampleCount;
      bucket[teamKey].reviewToMergeDaysTotal += averageDays * sampleCount;
    }
  }

  return Array.from(byMonth.values())
    .sort((left, right) => String(left?.date || "").localeCompare(String(right?.date || "")))
    .map((bucket) => {
      const row = { date: bucket.date };
      for (const teamKey of teamKeys) {
        const teamBucket = bucket[teamKey];
        const sampleCount = toCount(teamBucket?.avgReviewToMergeSampleCount);
        row[teamKey] = {
          offered: toCount(teamBucket?.offered),
          merged: toCount(teamBucket?.merged),
          avgReviewToMergeSampleCount: sampleCount,
          avgReviewToMergeDays:
            sampleCount > 0 ? teamBucket.reviewToMergeDaysTotal / sampleCount : null
        };
      }
      return row;
    });
}

function buildLegacyPrActivitySourcePoints() {
  return buildLegacyPrActivityMonthlyPoints();
}

function buildLegacyPrMergeTimeRows() {
  const points = buildLegacyPrActivitySourcePoints();
  return points.map((point) => ({
    date: String(point?.date || ""),
    dateValue: toChartDateValue(point?.date),
    api:
      toCount(point?.api?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.api?.avgReviewToMergeDays)
        : null,
    legacy:
      toCount(point?.legacy?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.legacy?.avgReviewToMergeDays)
        : null,
    react:
      toCount(point?.react?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.react?.avgReviewToMergeDays)
        : null,
    bc:
      toCount(point?.bc?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.bc?.avgReviewToMergeDays)
        : null,
    workers:
      toCount(point?.workers?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.workers?.avgReviewToMergeDays)
        : null,
    titanium:
      toCount(point?.titanium?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.titanium?.avgReviewToMergeDays)
        : null
  }));
}

function normalizeDisplayTeamName(name) {
  const raw = String(name || "").trim();
  if (raw.toLowerCase() === "orchestration") return "Workers";
  return raw;
}

function getPrCycleTeamMetric(windowSnapshot, teamKey) {
  const teams = Array.isArray(windowSnapshot?.teams) ? windowSnapshot.teams : [];
  return (
    teams.find(
      (team) =>
        String(team?.key || "")
          .trim()
          .toLowerCase() === String(teamKey || "").trim().toLowerCase()
    ) || null
  );
}

function getPrCycleStageMetric(teamSnapshot, stageKey) {
  const stages = Array.isArray(teamSnapshot?.stages) ? teamSnapshot.stages : [];
  return (
    stages.find(
      (stage) =>
        String(stage?.key || "")
          .trim()
          .toLowerCase() === String(stageKey || "").trim().toLowerCase()
    ) || null
  );
}

function buildPrActivityScatterSeries(points, selectedWindowKey, prCycleWindowSnapshot) {
  const safePoints = Array.isArray(points) ? points : [];
  const periodStart = safePoints.length > 0 ? String(safePoints[0]?.date || "") : "";
  const periodEnd = safePoints.length > 0 ? String(safePoints[safePoints.length - 1]?.date || "") : "";
  return PR_ACTIVITY_LINE_DEFS.map((lineDef) => {
    const values = safePoints
      .map((point) => {
        const teamMetrics =
          point && typeof point === "object" && point[lineDef.dataKey] && typeof point[lineDef.dataKey] === "object"
            ? point[lineDef.dataKey]
            : null;
        return teamMetrics ? { ...teamMetrics } : null;
      })
      .filter(Boolean);
    if (values.length === 0) return null;
    const averageInflow =
      values.reduce((sum, value) => sum + toNumber(value?.offered), 0) / Math.max(1, values.length);
    const teamSnapshot = getPrCycleTeamMetric(prCycleWindowSnapshot, lineDef.dataKey);
    if (!teamSnapshot) return null;
    const reviewStage = getPrCycleStageMetric(teamSnapshot, "review");
    const qaStage = getPrCycleStageMetric(teamSnapshot, "merge");
    const reviewDays = toNumber(reviewStage?.days);
    const qaDays = toNumber(qaStage?.days);
    const reviewSampleCount = toCount(reviewStage?.sampleCount);
    const qaSampleCount = toCount(qaStage?.sampleCount);
    const workflowSampleCount = toCount(teamSnapshot?.issueCount);
    if (reviewSampleCount <= 0 && qaSampleCount <= 0) return null;
    const averageRow = {
      teamKey: lineDef.dataKey,
      teamLabel: lineDef.name,
      teamColorKey: lineDef.colorKey,
      x: Number(averageInflow.toFixed(1)),
      y: Number((reviewDays + qaDays).toFixed(1)),
      workflowSampleCount,
      reviewSampleCount,
      qaSampleCount,
      reviewDays: Number(reviewDays.toFixed(1)),
      qaDays: Number(qaDays.toFixed(1)),
      tooltipScopeLabel: formatPrActivityScopeLabel(periodStart, periodEnd, selectedWindowKey)
    };
    return {
      ...lineDef,
      rows: [averageRow],
      latest: averageRow
    };
  }).filter(Boolean);
}

function getPrActivityLineDefs(colors) {
  return PR_ACTIVITY_LINE_DEFS.map((line) => ({
    ...line,
    stroke: colors.teams[line.colorKey]
  }));
}

function getLegacyPrActivityYUpper(rows, lineDefs) {
  return (Array.isArray(rows) ? rows : []).reduce((highest, row) => {
    const rowMax = lineDefs.reduce(
      (lineHighest, lineDef) => Math.max(lineHighest, toNumber(row?.[lineDef.dataKey])),
      0
    );
    return Math.max(highest, rowMax);
  }, 0);
}

function getLegacySharedPrCountYUpper() {
  const offeredRows = buildLegacyPrActivityRows("offered");
  const mergedRows = buildLegacyPrActivityRows("merged");
  const lineDefs = getPrActivityLineDefs(getThemeColors());
  return Math.max(
    getLegacyPrActivityYUpper(offeredRows, lineDefs),
    getLegacyPrActivityYUpper(mergedRows, lineDefs)
  );
}

function wrapReferenceLabel(text, maxLineLength = 16) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const nextLine = `${currentLine} ${word}`;
    if (nextLine.length <= maxLineLength) {
      currentLine = nextLine;
      continue;
    }
    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

function renderPrActivityReferenceLine(marker, compactViewport, showLabel = true) {
  const lines = wrapReferenceLabel(marker.label, compactViewport ? 12 : 16);
  const lineHeight = compactViewport ? 12 : 14;
  return h(ReferenceLine, {
    key: marker.date,
    x: toChartDateValue(marker.date),
    stroke: "rgba(0, 0, 0, 0.9)",
    strokeDasharray: "7 5",
    strokeWidth: 1.8,
    ifOverflow: "extendDomain",
    label: !showLabel
      ? undefined
      : ({ viewBox }) =>
          h(
            "text",
            {
              x: toNumber(viewBox?.x),
              y:
                toNumber(viewBox?.y) -
                (compactViewport ? 10 : 14) -
                lineHeight * (lines.length - 1),
              fill: "rgba(0, 0, 0, 0.95)",
              fontSize: compactViewport ? 10 : 11,
              fontWeight: 700,
              textAnchor: "middle"
            },
            lines.map((line, index) =>
              h(
                "tspan",
                {
                  key: `${marker.date}-${index}`,
                  x: toNumber(viewBox?.x),
                  dy: index === 0 ? 0 : lineHeight
                },
                line
              )
            )
          )
  });
}

function formatWholeCountLabel(value) {
  return String(Math.max(0, Math.round(toNumber(value))));
}

function formatMergeTimeLabel(value) {
  const roundedDays = Math.max(0, Math.round(toNumber(value)));
  return roundedDays === 1 ? "1 day" : `${roundedDays} days`;
}

function buildPrActivityReviewAxis() {
  const ticks = [];
  for (let value = 0; value <= PR_ACTIVITY_REVIEW_AXIS_UPPER; value += PR_ACTIVITY_REVIEW_AXIS_STEP) {
    ticks.push(value);
  }
  return { upper: PR_ACTIVITY_REVIEW_AXIS_UPPER, ticks };
}

function buildPrActivityInflowAxis(rows) {
  const maxInflow = (Array.isArray(rows) ? rows : []).reduce(
    (highest, row) => Math.max(highest, toNumber(row?.x)),
    0
  );
  const upper = Math.max(
    PR_ACTIVITY_INFLOW_AXIS_MIN_UPPER,
    Math.ceil(maxInflow / PR_ACTIVITY_INFLOW_AXIS_STEP) * PR_ACTIVITY_INFLOW_AXIS_STEP
  );
  const ticks = [];
  for (let value = 0; value <= upper; value += PR_ACTIVITY_INFLOW_AXIS_STEP) ticks.push(value);
  return { upper, ticks };
}

function buildPrActivityAxisRowsForAllWindows(allPoints, prCycleWindows) {
  const safePoints = Array.isArray(allPoints) ? allPoints : [];
  const safeWindows = prCycleWindows && typeof prCycleWindows === "object" ? prCycleWindows : {};
  return PR_ACTIVITY_WINDOWS.flatMap((windowKey) => {
    const windowSnapshot = safeWindows[windowKey];
    if (!windowSnapshot) return [];
    const { points } = getPrActivityWindowedPoints(safePoints, windowKey);
    return buildPrActivityScatterSeries(points, windowKey, windowSnapshot).flatMap((item) => item.rows);
  });
}

function createPrActivityScatterShape(compactViewport) {
  return function prActivityScatterShape(props) {
    const { cx, cy, fill, payload } = props || {};
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !payload) return null;
    const dotRadius = compactViewport ? 5.5 : 6.5;
    const labelX = cx + (compactViewport ? 10 : 12);
    const labelY = cy - (compactViewport ? 10 : 12);

    return h(
      "g",
      null,
      h("circle", {
        cx,
        cy,
        r: dotRadius,
        fill,
        fillOpacity: 0.96,
        stroke: "#ffffff",
        strokeWidth: 1.6
      }),
      h(
        "text",
        {
          x: labelX,
          y: labelY,
          fill: "rgba(31, 51, 71, 0.96)",
          fontFamily: "var(--font-ui)",
          fontSize: compactViewport ? 10 : 11,
          fontWeight: 700,
          textAnchor: "start",
          dominantBaseline: "auto",
          stroke: "rgba(255,255,255,0.96)",
          strokeWidth: 4,
          paintOrder: "stroke"
        },
        payload?.teamLabel || ""
      )
    );
  };
}

const PR_ACTIVITY_QUADRANTS = [
  {
    key: "few-long",
    x1: 0,
    fill: "rgba(128, 148, 175, 0.12)",
  },
  {
    key: "many-long",
    x1: "median",
    fill: "rgba(207, 170, 120, 0.12)",
  },
  {
    key: "few-short",
    x1: 0,
    fill: "rgba(111, 160, 153, 0.12)",
  },
  {
    key: "many-short",
    x1: "median",
    fill: "rgba(104, 171, 121, 0.14)",
  }
];

function renderPrActivityQuadrantAreas({ medianX, medianY, xUpper, yUpper }) {
  return PR_ACTIVITY_QUADRANTS.map((quadrant, index) => {
    const area = {
      ...quadrant,
      x1: quadrant.x1 === "median" ? medianX : 0,
      x2: index % 2 === 0 ? medianX : xUpper,
      y1: index < 2 ? medianY : 0,
      y2: index < 2 ? yUpper : medianY
    };
    return (
    h(ReferenceArea, {
      key: area.key,
      x1: area.x1,
      x2: area.x2,
      y1: area.y1,
      y2: area.y2,
      ifOverflow: "extendDomain",
      fill: area.fill,
      strokeOpacity: 0,
      label: null
    })
    );
  });
}

function getSharedPrActivityHiddenKeys() {
  return new Set(Array.isArray(state.prActivityHiddenKeys) ? state.prActivityHiddenKeys : []);
}

function setSharedPrActivityHiddenKeys(updater) {
  const previous = getSharedPrActivityHiddenKeys();
  const nextValue = typeof updater === "function" ? updater(previous) : updater;
  const nextSet = nextValue instanceof Set ? nextValue : new Set(nextValue || []);
  state.prActivityHiddenKeys = Array.from(nextSet);
  renderPrActivityCharts();
}

function getLegacyPrActivityHiddenKeys() {
  return new Set(
    Array.isArray(state.prActivityLegacyHiddenKeys) ? state.prActivityLegacyHiddenKeys : []
  );
}

function setLegacyPrActivityHiddenKeys(updater) {
  const previous = getLegacyPrActivityHiddenKeys();
  const nextValue = typeof updater === "function" ? updater(previous) : updater;
  const nextSet = nextValue instanceof Set ? nextValue : new Set(nextValue || []);
  state.prActivityLegacyHiddenKeys = Array.from(nextSet);
  renderLegacyPrActivityCharts();
}

function buildLegacyPrActivityTicks(yUpper) {
  const safeUpper = Math.max(1, Math.ceil(toNumber(yUpper)));
  if (safeUpper <= 10) return Array.from({ length: safeUpper + 1 }, (_, index) => index);
  const step = safeUpper <= 40 ? 5 : safeUpper <= 80 ? 10 : 20;
  const ticks = [];
  for (let tick = 0; tick <= safeUpper; tick += step) ticks.push(tick);
  if (ticks[ticks.length - 1] !== safeUpper) ticks.push(safeUpper);
  return ticks;
}

function buildLegacyPrActivityPath(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (afterNext.x - current.x) / 6;
    const control2Y = next.y - (afterNext.y - current.y) / 6;
    path += ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)} ${control2X.toFixed(2)} ${control2Y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

function buildLegacyPrActivityDisplayedXTicks(rows, compactViewport) {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (safeRows.length <= 3) return safeRows.map((row) => row.dateValue).filter((value) => value > 0);
  const step = compactViewport ? 2 : 1;
  const ticks = safeRows
    .filter((_, index) => index % step === 0 || index === safeRows.length - 1)
    .map((row) => row.dateValue)
    .filter((value) => value > 0);
  return Array.from(new Set(ticks));
}

function LegacyPrActivitySvgChart({
  rows,
  colors,
  yAxisLabel,
  tooltipLabel,
  tooltipValueFormatter,
  yAxisUpperOverride = 0,
  yAxisPadRatio = 1,
  hiddenKeys,
  setHiddenKeys,
  showLegend = true,
  hideReferenceLabelsOnCompact = false,
  xAxisLabel = "Period"
}) {
  const lineDefs = getPrActivityLineDefs(colors);
  const compactViewport = isCompactViewport();
  const rawYUpper = Math.max(yAxisUpperOverride, getLegacyPrActivityYUpper(rows, lineDefs));
  const yUpper = Math.max(1, Math.ceil(rawYUpper * Math.max(1, toNumber(yAxisPadRatio))));
  const width = 960;
  const height = compactViewport ? 320 : 360;
  const margin = compactViewport
    ? { top: 22, right: 14, bottom: 54, left: 48 }
    : { top: 26, right: 18, bottom: 62, left: 56 };
  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const xTicks = rows.map((row) => row.dateValue).filter((value) => value > 0);
  const displayedXTicks = buildLegacyPrActivityDisplayedXTicks(rows, compactViewport);
  const xMin = xTicks.length > 0 ? xTicks[0] : 0;
  const xMax = xTicks.length > 0 ? xTicks[xTicks.length - 1] : 1;
  const yTicks = buildLegacyPrActivityTicks(yUpper);
  const visibleDefs = lineDefs.filter((lineDef) => !hiddenKeys.has(lineDef.dataKey));
  const visibleReferenceMarkers =
    state.showLegacyPrActivityMarkers && xTicks.length > 0
      ? PR_ACTIVITY_REFERENCE_MARKERS.filter((marker) => {
          const markerValue = toChartDateValue(marker.date);
          return markerValue >= xTicks[0] && markerValue <= xTicks[xTicks.length - 1];
        })
      : [];
  const seriesRows = visibleDefs.map((lineDef) => ({
    ...lineDef,
    points: rows
      .map((row) => {
        const value = row?.[lineDef.dataKey];
        if (!Number.isFinite(value) || value === null) return null;
        return {
          key: `${lineDef.dataKey}-${row.date}`,
          date: row.date,
          value: toNumber(value),
          x: linearScale(row.dateValue, xMin, xMax, plotLeft, plotRight),
          y: linearScale(toNumber(value), 0, yUpper, plotBottom, plotTop),
          lineDef
        };
      })
      .filter(Boolean)
  }));
  const [tooltipContent, setTooltipContent] = React.useState(null);

  function showTooltip(point) {
    setTooltipContent(
      h(
        "div",
        null,
        h("p", null, h("strong", null, point.lineDef.name)),
        h("p", null, point.date || ""),
        h("p", null, tooltipValueFormatter(point.value))
      )
    );
  }

  return h(
    "div",
    { className: "chart-series-shell" },
    showLegend
      ? h(
          "div",
          { className: "svg-chart-legend", role: "group", "aria-label": `${tooltipLabel} line toggles` },
          ...lineDefs.map((lineDef) => {
            const hidden = hiddenKeys.has(lineDef.dataKey);
            return h(
              "button",
              {
                key: `legacy-pr-legend-${lineDef.dataKey}`,
                type: "button",
                className: `svg-chart-legend__button${hidden ? " svg-chart-legend__button--off" : ""}`,
                onClick: () =>
                  setHiddenKeys((previous) => {
                    const next = new Set(previous);
                    if (next.has(lineDef.dataKey)) next.delete(lineDef.dataKey);
                    else next.add(lineDef.dataKey);
                    return next;
                  }),
                "aria-pressed": hidden ? "false" : "true"
              },
              h("span", {
                className: "svg-chart-legend__swatch",
                style: { background: hidden ? withAlpha(lineDef.stroke, 0.28) : lineDef.stroke }
              }),
              h("span", { className: "svg-chart-legend__label" }, lineDef.name)
            );
          })
        )
      : null,
    h(
      SvgChartShell,
      { width, height, colors, tooltipContent, legendItems: [] },
      h(
        "g",
        null,
        ...yTicks.map((tick) => {
          const y = linearScale(tick, 0, yUpper, plotBottom, plotTop);
          return h(
            "g",
            { key: `legacy-pr-y-${tick}` },
            h("line", {
              x1: plotLeft,
              x2: plotRight,
              y1: y,
              y2: y,
              stroke: colors.grid,
              strokeWidth: tick === 0 ? 1.2 : 1
            }),
            h(
              "text",
              {
                x: plotLeft - 8,
                y: y + 4,
                fill: colors.text,
                fontSize: compactViewport ? 10 : 11,
                fontWeight: 600,
                textAnchor: "end"
              },
              String(tick)
            )
          );
        }),
        ...displayedXTicks.map((tick) =>
          h(
            "text",
            {
              key: `legacy-pr-x-${tick}`,
              x: linearScale(tick, xMin, xMax, plotLeft, plotRight),
              y: plotBottom + 20,
              fill: colors.text,
              fontSize: compactViewport ? 10 : 11,
              fontWeight: 600,
              textAnchor: "middle"
            },
            formatCompactChartDateTick(tick)
          )
        ),
        ...visibleReferenceMarkers.map((marker) =>
          h(
            "g",
            { key: `legacy-pr-marker-${marker.date}` },
            h("line", {
              x1: linearScale(toChartDateValue(marker.date), xMin, xMax, plotLeft, plotRight),
              x2: linearScale(toChartDateValue(marker.date), xMin, xMax, plotLeft, plotRight),
              y1: plotTop,
              y2: plotBottom,
              stroke: "rgba(31, 51, 71, 0.58)",
              strokeDasharray: "7 5",
              strokeWidth: 1.8
            }),
            !(hideReferenceLabelsOnCompact && compactViewport)
              ? h(
                  "text",
                  {
                    x: linearScale(toChartDateValue(marker.date), xMin, xMax, plotLeft, plotRight),
                    y: plotTop - 6,
                    fill: "rgba(0, 0, 0, 0.95)",
                    fontSize: compactViewport ? 10 : 11,
                    fontWeight: 700,
                    textAnchor: "middle"
                  },
                  marker.label
                )
              : null
          )
        ),
        ...seriesRows.flatMap((series) => [
          h("path", {
            key: `legacy-pr-line-${series.dataKey}`,
            d: buildLegacyPrActivityPath(series.points),
            fill: "none",
            stroke: series.stroke,
            strokeWidth: 2.5,
            strokeLinecap: "round",
            strokeLinejoin: "round"
          }),
          ...series.points.map((point) =>
            h("circle", {
              key: point.key,
              cx: point.x,
              cy: point.y,
              r: compactViewport ? 3 : 3.5,
              fill: series.stroke,
              stroke: "#ffffff",
              strokeWidth: 1.25,
              onMouseEnter: () => showTooltip(point),
              onMouseLeave: () => setTooltipContent(null)
            })
          )
        ]),
        h(
          "text",
          {
            x: plotLeft - 42,
            y: plotTop + (plotBottom - plotTop) / 2,
            fill: "rgba(31, 51, 71, 0.92)",
            fontSize: compactViewport ? 10 : 11,
            fontWeight: 700,
            textAnchor: "middle",
            transform: `rotate(-90 ${plotLeft - 42} ${plotTop + (plotBottom - plotTop) / 2})`
          },
          yAxisLabel
        ),
        h(
          "text",
          {
            x: plotLeft + (plotRight - plotLeft) / 2,
            y: plotBottom + 42,
            fill: "rgba(31, 51, 71, 0.92)",
            fontSize: compactViewport ? 10 : 11,
            fontWeight: 700,
            textAnchor: "middle"
          },
          xAxisLabel
        ),
      )
    )
  );
}

function renderLegacyPrActivityCountChart(containerId) {
  const metricKey = state.prActivityLegacyMetric === "merged" ? "merged" : "offered";
  const rows = buildLegacyPrActivityRows(metricKey);
  const colors = getThemeColors();
  const yAxisLabel = metricKey === "merged" ? "Merged PRs" : "PR inflow";
  const hiddenKeys = getLegacyPrActivityHiddenKeys();
  renderWithRoot(containerId, rows.length > 0, (root) => {
    root.render(
      h(LegacyPrActivitySvgChart, {
        rows,
        colors,
        yAxisLabel,
        tooltipLabel: yAxisLabel,
        tooltipValueFormatter: (value) => `${value} ${yAxisLabel.toLowerCase()}`,
        yAxisUpperOverride: getLegacySharedPrCountYUpper(),
        hiddenKeys,
        setHiddenKeys: setLegacyPrActivityHiddenKeys,
        showLegend: true,
        xAxisLabel: "Month"
      })
    );
  });
}

function renderLegacyPrMergeTimeChart(containerId) {
  const rows = buildLegacyPrMergeTimeRows();
  const colors = getThemeColors();
  const hiddenKeys = getLegacyPrActivityHiddenKeys();
  renderWithRoot(containerId, rows.length > 0, (root) => {
    root.render(
      h(LegacyPrActivitySvgChart, {
        rows,
        colors,
        yAxisLabel: "Avg days to merge",
        tooltipLabel: "Average review-to-merge time",
        tooltipValueFormatter: (value) => {
          const roundedDays = Math.max(0, Math.round(Number(value) || 0));
          return `~${roundedDays} day${roundedDays === 1 ? "" : "s"}`;
        },
        hiddenKeys,
        setHiddenKeys: setLegacyPrActivityHiddenKeys,
        yAxisPadRatio: 1.12,
        showLegend: false,
        hideReferenceLabelsOnCompact: true,
        xAxisLabel: "Month"
      })
    );
  });
}

function PrActivityScatterView({ series, colors, hiddenKeys, setHiddenKeys, interval, axisRows }) {
  const visibleSeries = series.filter((item) => !hiddenKeys.has(item.dataKey));
  const compactViewport = isCompactViewport();
  const fixedAxisRows = Array.isArray(axisRows) && axisRows.length > 0 ? axisRows : visibleSeries.flatMap((item) => item.rows);
  const inflowAxisLabel = prActivityInflowLabel(interval);
  const inflowTooltipLabel = prActivityInflowLabel(interval, { short: true });
  const xAxis = buildPrActivityInflowAxis(fixedAxisRows);
  const yAxis = buildPrActivityReviewAxis(fixedAxisRows);
  const splitX = PR_ACTIVITY_INFLOW_SPLIT;
  const splitY = PR_ACTIVITY_REVIEW_SPLIT;
  const chartHeight = compactViewport
    ? singleChartHeightForMode("trend", 420)
    : singleChartHeightForMode("trend", 500);
  const chartMargin = compactViewport
    ? { top: 24, right: 48, bottom: 28, left: 8 }
    : { top: 28, right: 72, bottom: 36, left: 18 };

  return h(
    "div",
    { className: "chart-series-shell chart-series-shell--feature" },
    renderLegendNode({
      colors,
      defs: getPrActivityLineDefs(colors),
      hiddenKeys,
      setHiddenKeys,
      compact: compactViewport
    }),
    h(
      ResponsiveContainer,
      { width: "100%", height: chartHeight },
      h(
        ScatterChart,
        {
          margin: chartMargin
        },
        ...renderPrActivityQuadrantAreas({
          medianX: splitX,
          medianY: splitY,
          xUpper: xAxis.upper,
          yUpper: yAxis.upper
        }),
        h(ReferenceLine, {
          x: splitX,
          ifOverflow: "extendDomain",
          stroke: "rgba(31, 51, 71, 0.42)",
          strokeWidth: 1.25,
          strokeDasharray: "5 5"
        }),
        h(ReferenceLine, {
          y: splitY,
          ifOverflow: "extendDomain",
          stroke: "rgba(31, 51, 71, 0.42)",
          strokeWidth: 1.25,
          strokeDasharray: "5 5"
        }),
        h(XAxis, {
          type: "number",
          dataKey: "x",
          stroke: colors.text,
          domain: [0, xAxis.upper],
          ticks: xAxis.ticks,
          allowDecimals: false,
          tick: { fill: colors.text, fontSize: compactViewport ? 10 : 11, fontFamily: "var(--font-ui)" },
          tickFormatter: formatWholeCountLabel,
          label: buildAxisLabel(inflowAxisLabel)
        }),
        h(YAxis, {
          type: "number",
          dataKey: "y",
          stroke: colors.text,
          domain: [0, yAxis.upper],
          ticks: yAxis.ticks,
          allowDecimals: false,
          tick: { fill: colors.text, fontSize: compactViewport ? 10 : 11, fontFamily: "var(--font-ui)" },
          tickFormatter: formatWholeCountLabel,
          label: buildAxisLabel("Avg review + QA time (days)", { axis: "y", offset: 6 })
        }),
        h(
          Tooltip,
          withSafeTooltipProps({
            content: createTooltipContent(colors, (row) => [
              tooltipTitleLine("team", row?.teamLabel || "", colors),
              tooltipTitleLine("scope", row?.tooltipScopeLabel || "All-time avg", colors),
              makeTooltipLine("count", `${inflowTooltipLabel}: ${formatWholeCountLabel(row?.x)}`, colors),
              makeTooltipLine(
                "duration",
                `Avg. review + QA stage time: ${formatMergeTimeLabel(row?.y)}`,
                colors
              ),
              makeTooltipLine(
                "review",
                `Review sample: ${formatWholeCountLabel(row?.reviewSampleCount)} tickets`,
                colors
              ),
              makeTooltipLine(
                "qa",
                `QA sample: ${formatWholeCountLabel(row?.qaSampleCount)} tickets`,
                colors
              ),
              makeTooltipLine(
                "workflow",
                `Workflow sample: ${formatWholeCountLabel(row?.workflowSampleCount)} issues`,
                colors
              )
            ]),
            cursor: { stroke: colors.active, strokeWidth: 1.5, strokeDasharray: "3 3" }
          })
        ),
        visibleSeries.map((item) =>
          h(Scatter, {
            key: item.dataKey,
            data: item.rows,
            name: item.name,
            fill: item.stroke,
            shape: createPrActivityScatterShape(compactViewport),
            isAnimationActive: false
          })
        )
      )
    )
  );
}

function renderPrActivityPositionChart(containerId) {
  const colors = getThemeColors();
  const hiddenKeys = getSharedPrActivityHiddenKeys();
  const interval = normalizePrActivityInterval(state.snapshot?.prActivity?.interval);
  const allPoints = Array.isArray(state.snapshot?.prActivity?.points) ? state.snapshot.prActivity.points : [];
  const selectedWindowKey = normalizeOption(
    state.prActivityWindow,
    PR_ACTIVITY_WINDOWS,
    THIRTY_DAY_WINDOW_KEY
  );
  const { points } = getPrActivityWindowedPoints(allPoints, selectedWindowKey);
  const prCycleWindowSnapshot =
    state.prCycle?.windows && typeof state.prCycle.windows === "object"
      ? state.prCycle.windows[selectedWindowKey] || null
      : null;
  const allAxisRows = buildPrActivityAxisRowsForAllWindows(allPoints, state.prCycle?.windows);
  const baseSeries = buildPrActivityScatterSeries(points, selectedWindowKey, prCycleWindowSnapshot);
  const series = baseSeries.map((item) => ({
    ...item,
    stroke: colors.teams[item.colorKey]
  }));
  renderWithRoot(containerId, series.length > 0, (root) => {
    root.render(
      h(PrActivityScatterView, {
        series,
        colors,
        hiddenKeys,
        setHiddenKeys: setSharedPrActivityHiddenKeys,
        interval,
        axisRows: allAxisRows
      })
    );
  });
}

function renderPrActivityCharts() {
  withChart("pr-activity", ({ status, context }) => {
    const prActivity = state.snapshot?.prActivity;
    const allPoints = Array.isArray(prActivity?.points) ? prActivity.points : [];
    const prCycleWindows =
      state.prCycle?.windows && typeof state.prCycle.windows === "object" ? state.prCycle.windows : null;
    if (allPoints.length === 0 || !prCycleWindows) {
      clearChartContainer("pr-position-chart");
      setPrActivityHelpDetails({});
      showPanelStatus(status, "No PR activity or workflow breakdown data found for this chart.");
      return;
    }

    status.hidden = true;
    const since = String(prActivity?.since || "");
    const interval = String(prActivity?.interval || "").trim();
    const caveat = String(prActivity?.caveat || "").trim();
    const selectedWindowKey = normalizeOption(
      state.prActivityWindow,
      PR_ACTIVITY_WINDOWS,
      THIRTY_DAY_WINDOW_KEY
    );
    const { points, windowLabel } = getPrActivityWindowedPoints(allPoints, selectedWindowKey);
    const windowStart = points.length > 0 ? String(points[0]?.date || since) : since;
    const latestPoint = points.length > 0 ? points[points.length - 1] : null;
    state.prActivityWindow = selectedWindowKey;
    syncRadioValue("pr-activity-window", selectedWindowKey);
    setPanelContext(
      context,
      latestPoint?.date
        ? `${windowLabel} team averages • ${windowStart} to ${latestPoint.date}`
        : ""
    );
    setPrActivityHelpDetails({
      since: windowStart || since,
      until: latestPoint?.date || "",
      caveat,
      interval
    });
    renderPrActivityPositionChart("pr-position-chart");
  });
}

function renderLegacyPrActivityCharts() {
  withChart("pr-activity-legacy", ({ status, context }) => {
    const prActivity = state.snapshot?.prActivity;
    const points = buildLegacyPrActivitySourcePoints();
    if (points.length === 0) {
      clearChartContainer("pr-activity-legacy-count-chart");
      clearChartContainer("pr-activity-legacy-merge-time-chart");
      showPanelStatus(status, "No Jira-linked PR activity found in backlog-snapshot.json.");
      return;
    }

    status.hidden = true;
    const since = String(points[0]?.date || prActivity?.since || "");
    const metricKey = state.prActivityLegacyMetric === "merged" ? "merged" : "offered";
    syncRadioValue("pr-activity-legacy-metric", metricKey);
    syncCheckboxValue("pr-activity-legacy-show-markers", state.showLegacyPrActivityMarkers);
    setPanelContext(
      context,
      `Monthly Jira-linked PR activity since ${since || points[0]?.date || ""}`
    );
    renderLegacyPrActivityCountChart("pr-activity-legacy-count-chart");
    renderLegacyPrMergeTimeChart("pr-activity-legacy-merge-time-chart");
  });
}

function renderPublicAggregateChart(configKey, scope, onReady) {
  const config = getConfig(configKey);
  if (config?.radioName) syncRadioValue(config.radioName, scope);
  withChart(configKey, ({ status, context, config }) => {
    const chartDataValue = state.productCycle?.chartData;
    const chartData = chartDataValue && typeof chartDataValue === "object" ? chartDataValue : null;
    if (!chartData) {
      showPanelStatus(status, config.missingMessage, { containerId: config.containerId });
      return;
    }
    onReady({ status, context, chartData, config, scope });
  });
}

function renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData) {
  const chartCore = window.DashboardChartCore;
  const panel = getChartNodes("product-cycle");
  const titleNode = document.getElementById("product-cycle-title");
  if (!panel || !chartCore || !chartScopeData || typeof chartScopeData !== "object") return false;
  const { status, context, config } = panel;
  if (titleNode) titleNode.textContent = "How long ready product ideas take to ship";

  const rows = (Array.isArray(chartScopeData.rows) ? chartScopeData.rows.slice() : [])
    .map((row) => ({
      ...row,
      team: normalizeDisplayTeamName(row?.team)
    }))
    .filter((row) => !(String(row?.team || "") === "UNMAPPED" && toCount(row?.meta_cycle?.n) === 0))
    .sort((left, right) => {
      const leftN = toCount(left?.meta_cycle?.n);
      const rightN = toCount(right?.meta_cycle?.n);
      if (leftN === 0 && rightN > 0) return 1;
      if (rightN === 0 && leftN > 0) return -1;
      const cycleDiff = toNumber(left?.cycle) - toNumber(right?.cycle);
      if (cycleDiff !== 0) return cycleDiff;
      return String(left?.team || "").localeCompare(String(right?.team || ""));
    });
  const teams = orderProductCycleTeams(rows.map((row) => String(row?.team || "")).filter(Boolean));
  if (teams.length === 0) return false;

  const fallbackCycleSampleCount = rows.reduce((sum, row) => sum + toCount(row?.meta_cycle?.n), 0);
  const cycleSampleCount = toCount(chartScopeData.cycleSampleCount) || fallbackCycleSampleCount;
  const sampleCount = Math.max(toCount(chartScopeData.sampleCount), cycleSampleCount);
  const fetchedCount = Math.max(
    toCount(state.productCycle?.chartData?.fetchedCount),
    toCount(state.productCycle?.fetchedCount)
  );
  const scopeLabel = String(
    chartScopeData.scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL
  );

  if (sampleCount === 0) {
    showPanelStatus(status, `No product-cycle items found for ${scopeLabel.toLowerCase()}.`, {
      containerId: config.containerId
    });
    return true;
  }

  const allowedTeamKeys = ["all", ...teams.map(productCycleTeamKey)];
  const selectedTeamKey = allowedTeamKeys.includes(productCycleTeamKey(state.productCycleTeam))
    ? productCycleTeamKey(state.productCycleTeam)
    : productCycleTeamKey(teams[0]);
  state.productCycleTeam = selectedTeamKey;

  renderProductCycleTeamControls(teams);
  bindRadioState(
    "product-cycle-team",
    "productCycleTeam",
    productCycleTeamKey,
    renderLeadAndCycleTimeByTeamChart
  );
  syncRadioValue("product-cycle-team", selectedTeamKey);

  clearChartContainer(config.containerId);
  if (selectedTeamKey === "all") {
    renderProductCycleComparisonCard(config.containerId, rows, scopeLabel);
    setPanelContext(
      context,
      fetchedCount > 0
        ? `${scopeLabel} • ${cycleSampleCount} teams sampled from ${fetchedCount} fetched ideas`
        : `${scopeLabel} • ${cycleSampleCount} teams sampled`
    );
    return true;
  }

  const selectedRow = rows.find((row) => productCycleTeamKey(row?.team) === selectedTeamKey) || rows[0];
  const selectedSampleCount = toCount(selectedRow?.meta_cycle?.n);
  renderProductCycleSingleTeamCard(config.containerId, selectedRow, rows);
  setPanelContext(
    context,
    fetchedCount > 0
      ? `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${scopeLabel} • ${selectedSampleCount} ideas sampled from ${fetchedCount} fetched ideas`
      : `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${scopeLabel} • ${selectedSampleCount} ideas sampled`
  );
  return true;
}

function computeLifecycleChartYUpper(chartData) {
  const currentStageSnapshot = chartData?.currentStageSnapshot;
  const rows = Array.isArray(currentStageSnapshot?.rows) ? currentStageSnapshot.rows : [];
  const teamDefs = Array.isArray(currentStageSnapshot?.teamDefs)
    ? currentStageSnapshot.teamDefs
    : [];
  const plottedValues = teamDefs
    .flatMap((teamDef, index) => {
      const key = String(teamDef?.slot || `slot_${index}`);
      return rows.map((row) => row?.[key]);
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  const storedUpper = toNumber(currentStageSnapshot?.yUpper);
  const fallbackUpper = Math.max(1, plottedValues.length > 0 ? Math.max(...plottedValues) : 0);
  return Math.max(storedUpper, fallbackUpper);
}

function normalizeCurrentStageChartData(chartSnapshotData) {
  if (!chartSnapshotData || typeof chartSnapshotData !== "object") return null;
  const rows = (Array.isArray(chartSnapshotData.rows) ? chartSnapshotData.rows : []).map((row) => {
    const phaseLabel = String(row?.phaseLabel || "");
    if (phaseLabel === "Development") {
      return {
        ...row,
        phaseLabel: "In Development"
      };
    }
    if (phaseLabel === "Feedback") {
      return {
        ...row,
        phaseLabel: "UAT"
      };
    }
    return row;
  });
  const teamDefs = Array.isArray(chartSnapshotData.teamDefs)
    ? chartSnapshotData.teamDefs.map((teamDef) => ({
        ...teamDef,
        name: normalizeDisplayTeamName(teamDef?.name),
        team: normalizeDisplayTeamName(teamDef?.team)
      }))
    : [];
  const rawSecondaryLabels =
    chartSnapshotData.categorySecondaryLabels &&
    typeof chartSnapshotData.categorySecondaryLabels === "object"
      ? chartSnapshotData.categorySecondaryLabels
      : {};
  const categorySecondaryLabels = { ...rawSecondaryLabels };
  if (
    Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "Development") &&
    !Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "In Development")
  ) {
    categorySecondaryLabels["In Development"] = categorySecondaryLabels.Development;
    delete categorySecondaryLabels.Development;
  }
  if (
    Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "Feedback") &&
    !Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "UAT")
  ) {
    categorySecondaryLabels.UAT = categorySecondaryLabels.Feedback;
    delete categorySecondaryLabels.Feedback;
  }
  return {
    ...chartSnapshotData,
    teamDefs,
    rows,
    categorySecondaryLabels
  };
}

function lifecycleTeamScopeKey(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase() || LIFECYCLE_TEAM_SCOPE_DEFAULT
  );
}

function totalLifecycleSampleCount(teamDef, rows) {
  const slotKey = String(teamDef?.slot || "");
  if (!slotKey) return 0;
  return (Array.isArray(rows) ? rows : []).reduce(
    (sum, row) => sum + toCount(row?.[`meta_${slotKey}`]?.n),
    0
  );
}

function getLifecycleTeamOptions(normalizedChartData) {
  const rows = Array.isArray(normalizedChartData?.rows) ? normalizedChartData.rows : [];
  const teamDefs = Array.isArray(normalizedChartData?.teamDefs) ? normalizedChartData.teamDefs : [];
  const orderedTeamDefs = orderProductCycleTeams(
    teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean)
  )
    .map((teamName) => teamDefs.find((teamDef) => String(teamDef?.team || "") === teamName))
    .filter(Boolean);
  const options = orderedTeamDefs
    .map((teamDef) => {
      const team = String(teamDef?.team || "");
      const key = lifecycleTeamScopeKey(team);
      const sampleCount = totalLifecycleSampleCount(teamDef, rows);
      if (!team || key === "unmapped" || sampleCount <= 0) return null;
      return {
        key,
        label: normalizeDisplayTeamName(team),
        team,
        sampleCount
      };
    })
    .filter(Boolean);
  return [{ key: LIFECYCLE_TEAM_SCOPE_DEFAULT, label: "All teams avg", sampleCount: 0 }, ...options];
}

function renderLifecycleTeamControls(options) {
  const container = document.getElementById("lifecycle-team-switch");
  if (!container) return;
  const selectedKey = lifecycleTeamScopeKey(state.lifecycleTeamScope);
  const safeOptions = Array.isArray(options) ? options : [];
  container.innerHTML = safeOptions
    .map(
      (option) => `
        <label class="pr-cycle-team-pill">
          <input type="radio" name="lifecycle-team" value="${escapeHtml(option.key)}"${
            option.key === selectedKey ? " checked" : ""
          } />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `
    )
    .join("");
}

function buildLifecycleFilteredView(normalizedChartData, selectedTeamKey) {
  const rows = Array.isArray(normalizedChartData?.rows) ? normalizedChartData.rows : [];
  const teamDefs = Array.isArray(normalizedChartData?.teamDefs) ? normalizedChartData.teamDefs : [];
  const selectedKey = lifecycleTeamScopeKey(selectedTeamKey);
  if (selectedKey === LIFECYCLE_TEAM_SCOPE_DEFAULT) {
    const includedTeamDefs = teamDefs.filter((teamDef) => {
      const key = lifecycleTeamScopeKey(teamDef?.team);
      return key !== "unmapped" && totalLifecycleSampleCount(teamDef, rows) > 0;
    });
    const aggregateRows = rows.map((row) => {
      const totals = includedTeamDefs.reduce(
        (acc, teamDef) => {
          const slotKey = String(teamDef?.slot || "");
          const meta = row?.[`meta_${slotKey}`] || {};
          const sampleCount = toCount(meta?.n);
          const average = toNumber(meta?.average);
          if (sampleCount <= 0 || !Number.isFinite(average) || average <= 0) return acc;
          acc.weightedValue += average * sampleCount;
          acc.sampleCount += sampleCount;
          return acc;
        },
        { weightedValue: 0, sampleCount: 0 }
      );
      const average = totals.sampleCount > 0 ? Number((totals.weightedValue / totals.sampleCount).toFixed(2)) : 0;
      return {
        phaseLabel: row?.phaseLabel,
        phaseKey: row?.phaseKey,
        slot_0: average,
        meta_slot_0: {
          team: "All teams avg",
          n: totals.sampleCount,
          average
        }
      };
    });
    return {
      rows: aggregateRows,
      teamDefs: [{ slot: "slot_0", name: "All teams avg", team: "All teams avg" }],
      categorySecondaryLabels: Object.fromEntries(
        aggregateRows.map((row) => [String(row?.phaseLabel || ""), `n=${toCount(row?.meta_slot_0?.n)}`])
      ),
      selectionLabel: "All teams avg",
      sampleSize: aggregateRows.reduce((sum, row) => sum + toCount(row?.meta_slot_0?.n), 0)
    };
  }

  const selectedTeamDef = teamDefs.find(
    (teamDef) => lifecycleTeamScopeKey(teamDef?.team) === selectedKey
  );
  if (!selectedTeamDef) return null;
  const slotKey = String(selectedTeamDef.slot || "");
  const filteredRows = rows.map((row) => {
    const value = toNumber(row?.[slotKey]);
    const meta = row?.[`meta_${slotKey}`] || {};
    return {
      phaseLabel: row?.phaseLabel,
      phaseKey: row?.phaseKey,
      slot_0: value,
      meta_slot_0: {
        team: normalizeDisplayTeamName(selectedTeamDef.team),
        n: toCount(meta?.n),
        average: Number.isFinite(toNumber(meta?.average)) ? toNumber(meta?.average) : value
      }
    };
  });
  return {
    rows: filteredRows,
    teamDefs: [
      {
        slot: "slot_0",
        name: normalizeDisplayTeamName(selectedTeamDef.name),
        team: normalizeDisplayTeamName(selectedTeamDef.team)
      }
    ],
    categorySecondaryLabels: Object.fromEntries(
      filteredRows.map((row) => [String(row?.phaseLabel || ""), `n=${toCount(row?.meta_slot_0?.n)}`])
    ),
    selectionLabel: normalizeDisplayTeamName(selectedTeamDef.team),
    sampleSize: filteredRows.reduce((sum, row) => sum + toCount(row?.meta_slot_0?.n), 0)
  };
}

function renderLifecycleTimeSpentPerStageChartFromChartData(chartSnapshotData) {
  const panel = getChartNodes("lifecycle-days");
  const normalizedChartData = normalizeCurrentStageChartData(chartSnapshotData);
  if (!panel || !normalizedChartData) return false;
  const { status, context, config } = panel;

  const lifecycleTeamOptions = getLifecycleTeamOptions(normalizedChartData);
  const validTeamKeys = new Set(lifecycleTeamOptions.map((option) => option.key));
  const selectedTeamKey = validTeamKeys.has(lifecycleTeamScopeKey(state.lifecycleTeamScope))
    ? lifecycleTeamScopeKey(state.lifecycleTeamScope)
    : LIFECYCLE_TEAM_SCOPE_DEFAULT;
  state.lifecycleTeamScope = selectedTeamKey;
  renderLifecycleTeamControls(lifecycleTeamOptions);
  bindRadioState(
    "lifecycle-team",
    "lifecycleTeamScope",
    lifecycleTeamScopeKey,
    renderLifecycleTimeSpentPerStageChart
  );
  syncRadioValue("lifecycle-team", selectedTeamKey);

  const filteredView = buildLifecycleFilteredView(normalizedChartData, selectedTeamKey);
  if (!filteredView) return false;
  const teams = orderProductCycleTeams(filteredView.teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean));
  const rows = Array.isArray(filteredView.rows) ? filteredView.rows : [];
  const teamDefsBase = Array.isArray(filteredView.teamDefs) ? filteredView.teamDefs : [];
  if (teams.length === 0 || teamDefsBase.length === 0) return false;

  const themeColors = getThemeColors();
  const compactViewport = isCompactViewport();
  const lifecycleTintByTeam = buildTintMap(buildTeamColorMap(teams), 0.02);
  const teamDefs = teamDefsBase.map((teamDef, index) => ({
    key: String(teamDef?.slot || `slot_${index}`),
    ...teamDef,
    color: themeColors.teams.api,
    showSeriesLabel: false,
    metaTeamColorMap: lifecycleTintByTeam
  }));
  const plottedValues = teamDefs
    .flatMap((teamDef) => rows.map((row) => row[teamDef.key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const categorySecondaryLabels =
    filteredView.categorySecondaryLabels &&
    typeof filteredView.categorySecondaryLabels === "object"
      ? filteredView.categorySecondaryLabels
      : Object.fromEntries(rows.map((row) => [String(row.phaseLabel || ""), ""]));
  const sampleSize = toCount(filteredView.sampleSize);
  const fetchedCount = Math.max(
    toCount(state.productCycle?.chartData?.fetchedCount),
    toCount(state.productCycle?.fetchedCount)
  );
  const yUpper = computeLifecycleChartYUpper(state.productCycle?.chartData);

  if (plottedValues.length === 0) {
    showPanelStatus(status, "No current lifecycle stage counts found.", {
      containerId: config.containerId
    });
    return true;
  }

  renderNamedChart(
    config,
    {
      containerId: config.containerId,
      rows,
      seriesDefs: teamDefs,
      colors: themeColors,
      chartHeight: compactViewport
        ? singleChartHeightForMode("lifecycle-days", 440)
        : singleChartHeightForMode("lifecycle-days", 490),
      yUpperOverride: yUpper,
      categoryKey: "phaseLabel",
      categoryAxisHeight: compactViewport ? 60 : 72,
      chartMargin: compactViewport
        ? { top: 18, right: 8, bottom: 44, left: 8 }
        : { top: 18, right: 14, bottom: 46, left: 8 },
      xAxisProps: {
        tick: compactViewport
          ? buildLifecycleMobileTick(themeColors, categorySecondaryLabels)
          : undefined
      },
      yAxisProps: {
        label: buildAxisLabel("Average time (months)", { axis: "y", offset: 6 })
      },
      categoryTickTwoLine: !compactViewport,
      categorySecondaryLabels,
      timeWindowLabel: "",
      orientation: "columns",
      showLegend: false,
      tooltipLayout: "stage_team_breakdown"
    },
    { missingMessage: "Lifecycle chart unavailable: Recharts renderer missing." }
  );
  setPanelContext(
    context,
    fetchedCount > 0
      ? `${filteredView.selectionLabel} • ${sampleSize} open ideas sampled • current snapshot`
      : `${filteredView.selectionLabel} • current snapshot • ${sampleSize} open ideas sampled`
  );
  return true;
}

function renderLeadAndCycleTimeByTeamChart() {
  renderPublicAggregateChart("product-cycle", PRODUCT_CYCLE_SCOPE, ({ chartData }) => {
    const chartScopeData = chartData?.leadCycleByScope?.[PRODUCT_CYCLE_SCOPE];
    if (renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData)) return;
    const config = getConfig("product-cycle");
    if (config) {
      setStatusMessage(
        config.statusId,
        `No product cycle chart data found for ${PRODUCT_CYCLE_SCOPE_LABEL}.`
      );
      clearChartContainer(config.containerId);
    }
  });
}

function renderProductCycleTeamControls(teams) {
  const container = document.getElementById("product-cycle-team-switch");
  if (!container) return;
  const safeTeams = orderProductCycleTeams(Array.isArray(teams) ? teams.filter(Boolean) : []);
  const options = ["all", ...safeTeams.map((team) => productCycleTeamKey(team))];
  const teamByKey = new Map(safeTeams.map((team) => [productCycleTeamKey(team), team]));
  container.hidden = false;
  container.innerHTML = options
    .map((key) => {
      const label = key === "all" ? "All" : normalizeDisplayTeamName(teamByKey.get(key) || key);
      return `
        <label class="pr-cycle-team-pill">
          <input type="radio" name="product-cycle-team" value="${escapeHtml(key)}"${
            key === productCycleTeamKey(state.productCycleTeam) ? " checked" : ""
          } />
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    })
    .join("");
}

function productCycleTeamKey(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase() || PRODUCT_CYCLE_TEAM_DEFAULT
  );
}

function formatCycleMonthsValueMarkup(valueInDays) {
  const months = Math.max(0, toNumber(valueInDays) / 30.4375);
  const rounded = months === 0 ? "0" : months.toFixed(1);
  const unit = Math.abs(months - 1) < 0.05 ? "month" : "months";
  return `<span class="metric-duration__value">${rounded}</span><span class="metric-duration__unit">${unit}</span>`;
}

function formatStackedCycleMonthsValueMarkup(valueInDays) {
  const months = Math.max(0, toNumber(valueInDays) / 30.4375);
  const rounded = months === 0 ? "0" : months.toFixed(1);
  const unit = Math.abs(months - 1) < 0.05 ? "month" : "months";
  return `<span class="stacked-duration"><span class="stacked-duration__value">${rounded}</span><span class="stacked-duration__unit">${unit}</span></span>`;
}

function getAlertLevelFromMonths(valueInMonths) {
  const safeValue = Math.max(0, toNumber(valueInMonths));
  if (safeValue >= 2) return "critical";
  return "";
}

function formatStageValueFrame(markup, className = "") {
  const modifier = String(className || "").trim();
  return `<span class="pr-cycle-stage-row__value-frame${modifier ? ` ${modifier}` : ""}">${markup}</span>`;
}

function getCycleFillWidth(value, upperBound) {
  const safeUpper = Math.max(1, toNumber(upperBound));
  const safeValue = Math.max(0, toNumber(value));
  if (safeValue <= 0) return 0;
  return Math.max(12, Math.round((safeValue / safeUpper) * 100));
}

function renderProductCycleSingleTeamCard(containerId, row, allRows) {
  const container = document.getElementById(containerId);
  if (!container || !row) return;
  const teamColor = getPrCycleTeamColor(row?.team);
  const cycleSample = toCount(row?.meta_cycle?.n);
  const shippedCount = toCount(row?.cycleDoneCount);
  const ongoingCount = toCount(row?.cycleOngoingCount);
  const maxCycleDays = 5 * 30.4375;
  const maxShipped = Math.max(1, ...allRows.map((item) => toCount(item?.cycleDoneCount)));
  const maxOngoing = Math.max(1, ...allRows.map((item) => toCount(item?.cycleOngoingCount)));
  const cycleWidth = cycleSample > 0 ? getCycleFillWidth(row?.cycle, maxCycleDays) : 0;
  const shippedWidth = shippedCount > 0 ? getCycleFillWidth(shippedCount, maxShipped) : 0;
  const ongoingWidth = ongoingCount > 0 ? getCycleFillWidth(ongoingCount, maxOngoing) : 0;

  container.innerHTML = `
    <div class="product-cycle-team-card-wrap">
      <article class="pr-cycle-stage-card product-cycle-team-card" data-team="${escapeHtml(
        String(row?.team || "")
      )}" style="--pr-cycle-accent:${escapeHtml(teamColor)};">
        <div class="pr-cycle-stage-card__header">
          <div class="pr-cycle-stage-card__meta">
            <div class="pr-cycle-stage-card__team">${escapeHtml(normalizeDisplayTeamName(row?.team || ""))}</div>
          </div>
        </div>
        <div class="pr-cycle-stage-list">
          <div class="pr-cycle-stage-row product-cycle-team-card__row" data-stage="cycle">
            <div class="pr-cycle-stage-row__label">
              <span class="pr-cycle-stage-row__label-text">Cycle time</span>
              <span class="pr-cycle-stage-row__sample">${cycleSample > 0 ? `n=${cycleSample}` : "n=0"}</span>
            </div>
            <div class="pr-cycle-stage-row__track" aria-hidden="true">
              <div class="pr-cycle-stage-row__fill" style="width:${cycleWidth}%"></div>
            </div>
            <div class="pr-cycle-stage-row__value">${formatStageValueFrame(formatStackedCycleMonthsValueMarkup(row?.cycle))}</div>
          </div>
          <div class="pr-cycle-stage-row product-cycle-team-card__row" data-stage="shipped">
            <div class="pr-cycle-stage-row__label">
              <span class="pr-cycle-stage-row__label-text">Shipped</span>
              <span class="pr-cycle-stage-row__sample">done ideas</span>
            </div>
            <div class="pr-cycle-stage-row__track" aria-hidden="true">
              <div class="pr-cycle-stage-row__fill" style="width:${shippedWidth}%"></div>
            </div>
            <div class="pr-cycle-stage-row__value">${formatStageValueFrame(String(shippedCount))}</div>
          </div>
          <div class="pr-cycle-stage-row product-cycle-team-card__row" data-stage="ongoing">
            <div class="pr-cycle-stage-row__label">
              <span class="pr-cycle-stage-row__label-text">Development</span>
              <span class="pr-cycle-stage-row__sample">ongoing ideas</span>
            </div>
            <div class="pr-cycle-stage-row__track" aria-hidden="true">
              <div class="pr-cycle-stage-row__fill" style="width:${ongoingWidth}%"></div>
            </div>
            <div class="pr-cycle-stage-row__value">${formatStageValueFrame(String(ongoingCount))}</div>
          </div>
        </div>
        <div class="pr-cycle-stage-card__footer">
          <span><strong>${shippedCount} shipped</strong>${
            ongoingCount > 0 ? ` • ${ongoingCount} in development` : ""
          }</span>
        </div>
      </article>
    </div>
  `;
}

function renderProductCycleComparisonCard(containerId, rows, scopeLabel) {
  const container = document.getElementById(containerId);
  if (!container || !Array.isArray(rows) || rows.length === 0) return;
  const maxCycleDays = 5 * 30.4375;
  const rowsMarkup = rows
    .map((row) => {
      const cycleSample = toCount(row?.meta_cycle?.n);
      const teamColor = getPrCycleTeamColor(row?.team);
      const cycleWidth = cycleSample > 0 ? getCycleFillWidth(row?.cycle, maxCycleDays) : 0;
      const cycleAlertLevel = getAlertLevelFromMonths(toNumber(row?.cycle) / 30.4375);
      return `
        <div class="pr-cycle-stage-row product-cycle-compare-row" data-stage="cycle">
          <div class="pr-cycle-stage-row__label">
            <span class="pr-cycle-stage-row__label-text">${escapeHtml(
              normalizeDisplayTeamName(row?.team || "")
            )}</span>
            <span class="pr-cycle-stage-row__sample">${cycleSample > 0 ? `n=${cycleSample}` : "n=0"}</span>
          </div>
          <div class="pr-cycle-stage-row__track" aria-hidden="true">
            <div class="pr-cycle-stage-row__fill" style="width:${cycleWidth}%;background:${escapeHtml(
              teamColor
            )};"></div>
          </div>
          <div class="pr-cycle-stage-row__value">${formatStageValueFrame(
            formatStackedCycleMonthsValueMarkup(row?.cycle),
            cycleAlertLevel ? `pr-cycle-stage-row__value-frame--${cycleAlertLevel}` : ""
          )}</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="product-cycle-team-card-wrap">
      <article class="pr-cycle-stage-card product-cycle-compare-card">
        <div class="pr-cycle-stage-card__header">
          <div class="pr-cycle-stage-card__meta">
            <div class="pr-cycle-stage-card__team">All teams</div>
            <div class="pr-cycle-stage-card__submeta">${
              scopeLabel ? `${escapeHtml(scopeLabel)} • ` : ""
            }Target: 1 month</div>
          </div>
        </div>
        <div class="pr-cycle-stage-list">${rowsMarkup}</div>
      </article>
    </div>
  `;
}

function syncRadioValue(name, value) {
  const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
  radios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function syncCheckboxValue(name, checked) {
  const checkbox = document.querySelector(`input[name="${name}"]`);
  if (!checkbox) return;
  checkbox.checked = Boolean(checked);
}

function syncRadioAvailability(name, allowedValues) {
  const allowed = new Set((Array.isArray(allowedValues) ? allowedValues : []).map((value) => String(value)));
  const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
  radios.forEach((radio) => {
    const isAllowed = allowed.has(String(radio.value || ""));
    radio.disabled = !isAllowed;
    const label = radio.closest("label");
    if (label) {
      label.setAttribute("aria-disabled", isAllowed ? "false" : "true");
      label.classList.toggle("is-disabled", !isAllowed);
    }
  });
}

function readDashboardControlStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  CONTROL_BINDINGS.forEach(
    ({ name, stateKey, normalizeValue, normalizeChecked, controlType, defaultValue }) => {
      if (!params.has(name)) {
        state[stateKey] = defaultValue;
        return;
      }
      if (controlType === "checkbox") {
        const raw = String(params.get(name) || "")
          .trim()
          .toLowerCase();
        const checked = !["0", "false", "off", "no"].includes(raw);
        state[stateKey] = normalizeChecked(checked);
        return;
      }
      state[stateKey] = normalizeValue(String(params.get(name) || ""));
    }
  );
}

function syncDashboardControlsFromState() {
  CONTROL_BINDINGS.forEach(({ name, stateKey, controlType }) => {
    if (controlType === "checkbox") {
      syncCheckboxValue(name, state[stateKey]);
      return;
    }
    syncRadioValue(name, state[stateKey]);
  });
}

function writeDashboardControlStateToUrl() {
  const nextUrl = new URL(window.location.href);
  CONTROL_BINDINGS.forEach(({ name, stateKey, controlType }) => {
    if (controlType === "checkbox") {
      nextUrl.searchParams.set(name, state[stateKey] ? "true" : "false");
      return;
    }
    nextUrl.searchParams.set(name, String(state[stateKey] || ""));
  });
  window.history.replaceState({}, "", nextUrl);
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
      writeDashboardControlStateToUrl();
      onChangeRender();
    });
  });
}

function bindCheckboxState(name, stateKey, normalizeChecked, onChangeRender) {
  const checkbox = document.querySelector(`input[name="${name}"]`);
  if (!checkbox || checkbox.dataset.bound === "1") return;
  checkbox.dataset.bound = "1";
  checkbox.addEventListener("change", () => {
    state[stateKey] = normalizeChecked(checkbox.checked);
    writeDashboardControlStateToUrl();
    onChangeRender();
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatStageDurationValueMarkup(value) {
  const safeValue = toNumber(value);
  const rounded = safeValue.toFixed(1);
  const unit = Math.abs(safeValue - 1) < 0.05 ? "day" : "days";
  return `<span class="metric-duration__value">${rounded}</span><span class="metric-duration__unit">${unit}</span>`;
}

function formatStackedStageDurationValueMarkup(value) {
  const safeValue = toNumber(value);
  const rounded = safeValue.toFixed(1);
  const unit = Math.abs(safeValue - 1) < 0.05 ? "day" : "days";
  return `<span class="stacked-duration"><span class="stacked-duration__value">${rounded}</span><span class="stacked-duration__unit">${unit}</span></span>`;
}

function getPrCycleStageDisplayLabel(stage) {
  const key = String(stage?.key || "").trim();
  if (key === "coding") return "Progress";
  if (key === "review") return "Review";
  if (key === "merge") return "QA";
  return String(stage?.label || "").trim();
}

function getPrCycleTeamColor(teamKey) {
  const normalizedKey = String(teamKey || "")
    .trim()
    .toLowerCase();
  const baseMap = buildTeamColorMap([normalizedKey]);
  return baseMap[normalizedKey] || "#4f8fcb";
}

function renderPrCycleExperimentCard(containerId, team, snapshot) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const stages = Array.isArray(team?.stages) ? team.stages : [];
  const teamColor = getPrCycleTeamColor(team?.key);
  const maxDays =
    stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
  const rowsMarkup = stages
    .map((stage) => {
      const width = Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100));
      const sampleCount = toCount(stage?.sampleCount);
      return `
        <div class="pr-cycle-stage-row" data-stage="${escapeHtml(String(stage?.key || ""))}">
          <div class="pr-cycle-stage-row__label">
            <span class="pr-cycle-stage-row__label-text">${escapeHtml(getPrCycleStageDisplayLabel(stage))}</span>
            <span class="pr-cycle-stage-row__sample">${sampleCount > 0 ? `n=${sampleCount}` : "n=0"}</span>
          </div>
          <div class="pr-cycle-stage-row__track" aria-hidden="true">
            <div class="pr-cycle-stage-row__fill" style="width:${width}%"></div>
          </div>
          <div class="pr-cycle-stage-row__value">${formatStageValueFrame(formatStackedStageDurationValueMarkup(stage?.days))}</div>
        </div>
      `;
    })
    .join("");
  const issueCount = toNumber(team?.issueCount || team?.pullRequestCount);
  const footerPrimary = issueCount > 0 ? `${issueCount} issues sampled` : "No sampled issues";
  const footerSecondary = String(snapshot?.windowLabel || "").trim();

  container.innerHTML = `
    <article class="pr-cycle-stage-card workflow-breakdown-card" data-team="${escapeHtml(String(team?.key || ""))}" style="--pr-cycle-accent:${escapeHtml(teamColor)};">
        <div class="pr-cycle-stage-card__header">
          <div class="pr-cycle-stage-card__meta">
            <div class="pr-cycle-stage-card__team">${escapeHtml(team?.label || "")}</div>
          <div class="pr-cycle-stage-card__total metric-duration">${formatStageDurationValueMarkup(team?.totalCycleDays)}</div>
          </div>
        </div>
      <div class="pr-cycle-stage-list">${rowsMarkup}</div>
      <div class="pr-cycle-stage-card__footer">
        <span><strong>${escapeHtml(footerPrimary)}</strong>${footerSecondary ? ` • ${escapeHtml(footerSecondary)}` : ""}</span>
        <span>Bottleneck: <strong>${escapeHtml(team?.bottleneckLabel || "")}</strong></span>
      </div>
    </article>
  `;
}

function renderPrCycleExperiment() {
  withChart("pr-cycle-experiment", ({ status, context, config }) => {
    const windows =
      state.prCycle?.windows && typeof state.prCycle.windows === "object"
        ? state.prCycle.windows
        : null;
    const availableWindowKeys = Object.keys(windows || {});
    const effectiveWindowKeys =
      availableWindowKeys.length > 0 ? availableWindowKeys : [THIRTY_DAY_WINDOW_KEY];
    const fallbackWindowKey =
      String(state.prCycle?.defaultWindow || "")
        .trim()
        .toLowerCase() || THIRTY_DAY_WINDOW_KEY;
    const selectedWindowKey = effectiveWindowKeys.includes(state.prCycleWindow)
      ? state.prCycleWindow
      : effectiveWindowKeys.includes(fallbackWindowKey)
        ? fallbackWindowKey
        : THIRTY_DAY_WINDOW_KEY;
    const selectedWindowSnapshot =
      windows?.[selectedWindowKey] && typeof windows[selectedWindowKey] === "object"
        ? windows[selectedWindowKey]
        : windows?.[fallbackWindowKey] && typeof windows[fallbackWindowKey] === "object"
          ? windows[fallbackWindowKey]
          : Object.values(windows || {}).find((windowSnapshot) => windowSnapshot && typeof windowSnapshot === "object") ||
            null;
    const teams = Array.isArray(selectedWindowSnapshot?.teams) ? selectedWindowSnapshot.teams : [];
    if (teams.length === 0) {
      clearChartContainer(config.containerId);
      showPanelStatus(status, config.missingMessage);
      return;
    }

    const availableKeys = teams.map((team) =>
      String(team?.key || "")
        .trim()
        .toLowerCase()
    );
    syncRadioAvailability("pr-cycle-window", effectiveWindowKeys);
    syncRadioAvailability("pr-cycle-team", availableKeys);
    const fallbackTeamKey =
      String(state.prCycle?.defaultTeam || "")
        .trim()
        .toLowerCase() || availableKeys[0];
    const selectedKey = availableKeys.includes(state.prCycleTeam)
      ? state.prCycleTeam
      : fallbackTeamKey;
    const selectedTeam =
      teams.find(
        (team) =>
          String(team?.key || "")
            .trim()
            .toLowerCase() === selectedKey
      ) || teams[0];

    state.prCycleTeam = selectedKey;
    state.prCycleWindow = selectedWindowKey;
    syncRadioValue("pr-cycle-team", selectedKey);
    syncRadioValue("pr-cycle-window", selectedWindowKey);
    status.hidden = true;
    setPanelContext(context, "");
    renderPrCycleExperimentCard(config.containerId, selectedTeam, selectedWindowSnapshot);
  });
}

function renderLifecycleTimeSpentPerStageChart() {
  renderChartWithState("lifecycle-days", () => {
    const chartData = state.productCycle?.chartData;
    const chartSnapshotData =
      chartData && typeof chartData === "object" ? chartData.currentStageSnapshot : null;
    if (renderLifecycleTimeSpentPerStageChartFromChartData(chartSnapshotData)) return null;
    const config = getConfig("lifecycle-days");
    return {
      error:
        config?.missingMessage ||
        "No current lifecycle chart data found in product-cycle-snapshot.json.",
      clearContainer: true
    };
  });
}

function compareBusinessUnitLabels(left, right) {
  const leftLabel = String(left || "").trim();
  const rightLabel = String(right || "").trim();
  const leftIsTechDebt = leftLabel.toLowerCase() === "tech debt";
  const rightIsTechDebt = rightLabel.toLowerCase() === "tech debt";
  if (leftIsTechDebt && !rightIsTechDebt) return 1;
  if (!leftIsTechDebt && rightIsTechDebt) return -1;
  return leftLabel.localeCompare(rightLabel);
}

function buildEmptyBusinessUnitRow(label) {
  return {
    label,
    devAvg: 0,
    uatAvg: 0,
    devCount: 0,
    uatCount: 0,
    sampleCount: 0,
    issueIds: [],
    issueItems: [],
    facilities: []
  };
}

function getAlignedBusinessUnitRows(scope) {
  const byScope = state.snapshot?.chartData?.managementBusinessUnit?.byScope;
  const ongoingRows = Array.isArray(byScope?.ongoing?.rows) ? byScope.ongoing.rows : [];
  const doneRows = Array.isArray(byScope?.done?.rows) ? byScope.done.rows : [];
  const labels = Array.from(
    new Set(
      [...ongoingRows, ...doneRows].map((row) => String(row?.label || "").trim()).filter(Boolean)
    )
  ).sort(compareBusinessUnitLabels);
  const targetRows = scope === "done" ? doneRows : ongoingRows;
  const rowMap = new Map(targetRows.map((row) => [String(row?.label || "").trim(), row]));
  return labels.map((label) => rowMap.get(label) || buildEmptyBusinessUnitRow(label));
}

function renderDevelopmentVsUatByFacilityChart() {
  renderChartWithState("management-facility", () => {
    const scope = normalizeOption(state.managementFlowScope, MANAGEMENT_FLOW_SCOPES, "ongoing");
    const titleNode = document.getElementById("management-facility-title");
    syncRadioValue("management-facility-flow-scope", scope);
    const rows = getAlignedBusinessUnitRows(scope);
    if (rows.length === 0) {
      return { error: `No ${scope} Business Unit chart data found in backlog-snapshot.json.` };
    }

    const doneScope = scope === "done";
    if (titleNode) titleNode.textContent = "How long ideas stay in UAT by Business Unit";
    return {
      contextText: `${getBroadcastScopeLabel()} • ${doneScope ? "done" : "ongoing"} scope • ${rows.reduce((sum, row) => sum + row.sampleCount, 0)} issues sampled`,
      props: {
        rows,
        groupingLabel: "Business Unit",
        jiraBrowseBase: "https://nepgroup.atlassian.net/browse/",
        scope
      }
    };
  });
}

function renderTopContributorsCard(containerId, rows, summary) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const safeRows = Array.isArray(rows) ? rows : [];
  const maxTotal = Math.max(1, ...safeRows.map((row) => toNumber(row?.totalIssues)));
  const totalIssues = toNumber(summary?.total_issues);
  const doneIssues = toNumber(summary?.done_issues);
  const activeIssues = toNumber(summary?.active_issues);
  const totalContributors = toNumber(summary?.total_contributors);
  const linkedIssues = toNumber(summary?.linked_issues);

  const rowsMarkup = safeRows
    .map((row) => {
      const contributor = String(row?.contributor || "").trim();
      const total = toNumber(row?.totalIssues);
      const done = toNumber(row?.doneIssues);
      const active = toNumber(row?.activeIssues);
      const totalWidth = total > 0 ? Math.max(10, Math.round((total / maxTotal) * 100)) : 0;
      return `
        <div class="pr-cycle-stage-row contributors-card__row">
          <div class="pr-cycle-stage-row__label">
            <span class="pr-cycle-stage-row__label-text">${escapeHtml(contributor)}</span>
            <span class="pr-cycle-stage-row__sample">done ${done}${active > 0 ? ` • active ${active}` : ""}</span>
          </div>
          <div class="pr-cycle-stage-row__track contributors-card__track" aria-hidden="true">
            <div class="pr-cycle-stage-row__fill contributors-card__fill" style="width:${totalWidth}%"></div>
          </div>
          <div class="pr-cycle-stage-row__value">${total}</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="product-cycle-team-card-wrap">
      <article class="pr-cycle-stage-card contributors-card">
        <div class="pr-cycle-stage-card__header">
          <div class="pr-cycle-stage-card__meta">
            <div class="pr-cycle-stage-card__team">Community contributors</div>
            <div class="pr-cycle-stage-card__total">${totalIssues}</div>
          </div>
        </div>
        <div class="pr-cycle-stage-list">${rowsMarkup}</div>
        <div class="pr-cycle-stage-card__footer">
          <span><strong>${totalContributors} contributors ranked</strong>${linkedIssues > 0 ? ` • ${linkedIssues} linked issues` : ""}</span>
        </div>
      </article>
    </div>
  `;
}

function renderTopContributorsChart() {
  withChart("contributors", ({ status, context, config }) => {
    const contributorsSnapshot = state.contributors;
    const rows = Array.isArray(contributorsSnapshot?.chartData?.rows)
      ? contributorsSnapshot.chartData.rows.slice().sort((left, right) => {
          const leftTotal = toNumber(left?.totalIssues);
          const rightTotal = toNumber(right?.totalIssues);
          if (rightTotal !== leftTotal) return rightTotal - leftTotal;
          const leftDone = toNumber(left?.doneIssues);
          const rightDone = toNumber(right?.doneIssues);
          if (rightDone !== leftDone) return rightDone - leftDone;
          return String(left?.contributor || "").localeCompare(String(right?.contributor || ""));
        })
      : [];
    if (rows.length === 0) {
      showPanelStatus(status, "No contributor chart data found in contributors-snapshot.json.", {
        containerId: config.containerId
      });
      return;
    }

    const summary = contributorsSnapshot?.summary || {};
    status.hidden = true;
    setPanelContext(
      context,
      `${toNumber(summary.total_issues)} total • ${toNumber(summary.done_issues)} done • ${toNumber(summary.active_issues)} active`
    );
    renderTopContributorsCard(config.containerId, rows, summary);
  });
}

function bindDashboardControls() {
  CONTROL_BINDINGS.forEach(
    ({ name, stateKey, normalizeValue, normalizeChecked, onChangeRender, controlType }) => {
      if (controlType === "checkbox") {
        bindCheckboxState(name, stateKey, normalizeChecked, onChangeRender);
        return;
      }
      bindRadioState(name, stateKey, normalizeValue, onChangeRender);
    }
  );
}

function renderVisibleCharts() {
  Object.entries(CHART_RENDERERS).forEach(([mode, run]) => {
    if (!isChartActive(mode) || !isChartReady(mode)) return;
    queueChartRender(mode, run);
  });
}

function getRequiredSourceKeys(mode) {
  if (mode === "all") return Object.keys(DATA_SOURCE_CONFIG);
  return CHART_DATA_SOURCES[mode] || ["snapshot"];
}

function isChartActive(mode) {
  if (state.mode !== "all") return state.mode === mode;
  return visibleChartModes.has(mode);
}

function isChartReady(mode) {
  const requiredSources = CHART_DATA_SOURCES[mode] || [];
  if (requiredSources.length === 0) return true;
  if (requiredSources.some((sourceKey) => state.loadErrors[sourceKey])) return false;
  return requiredSources.every((sourceKey) => state.loadedSources[sourceKey] === true);
}

function flushChartRenderQueue() {
  chartRenderFrame = 0;
  const iterator = queuedChartModes.values().next();
  if (iterator.done) return;

  const mode = iterator.value;
  queuedChartModes.delete(mode);

  if (isChartActive(mode) && isChartReady(mode)) {
    const renderChart = CHART_RENDERERS[mode];
    if (typeof renderChart === "function") renderChart();
  }

  if (queuedChartModes.size > 0) {
    chartRenderFrame = window.requestAnimationFrame(flushChartRenderQueue);
  }
}

function queueChartRender(mode, renderChart) {
  if (!mode || typeof renderChart !== "function") return;
  queuedChartModes.add(mode);
  if (chartRenderFrame !== 0) return;
  chartRenderFrame = window.requestAnimationFrame(flushChartRenderQueue);
}

function disconnectChartVisibilityObserver() {
  if (!chartVisibilityObserver) return;
  chartVisibilityObserver.disconnect();
  chartVisibilityObserver = null;
}

function seedVisibleChartModes() {
  visibleChartModes.clear();

  if (state.mode !== "all") {
    visibleChartModes.add(state.mode);
    return;
  }
  Object.keys(CHART_CONFIG).forEach((mode) => visibleChartModes.add(mode));
}

function initChartVisibility() {
  disconnectChartVisibilityObserver();
  seedVisibleChartModes();
}

async function loadDataSource(sourceKey) {
  const source = DATA_SOURCE_CONFIG[sourceKey];
  if (!source) return;
  try {
    const preloadedPromise = PRELOADED_DATA_SOURCE_PROMISES[sourceKey];
    const sourceData =
      preloadedPromise && typeof preloadedPromise.then === "function"
        ? await preloadedPromise
        : await fetch(source.url, { cache: "no-cache" }).then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          });
    state[source.stateKey] = sourceData;
    state.loadedSources[sourceKey] = true;
    delete state.loadErrors[sourceKey];
    renderDashboardRefreshStrip();
    renderActionsRequiredFrame();
    renderVisibleCharts();
  } catch (error) {
    state[source.stateKey] = null;
    const message = `${source.errorMessage}: ${error instanceof Error ? error.message : String(error)}`;
    state.loadErrors[sourceKey] = message;
    state.loadedSources[sourceKey] = true;
    setStatusMessageForIds(source.statusIds || [], message);
    (source.clearContainers || []).forEach(clearChartContainer);
    renderDashboardRefreshStrip();
    renderActionsRequiredFrame();
  }
}

async function loadSnapshot() {
  setStatusMessageForIds(CHART_STATUS_IDS);
  state.snapshot = null;
  state.productCycle = null;
  state.contributors = null;
  state.prCycle = null;
  state.loadedSources = {};
  state.loadErrors = {};
  state.mode = getModeFromUrl();
  readDashboardControlStateFromUrl();
  renderDashboardRefreshStrip();
  renderActionsRequiredFrame();
  applyModeVisibility();
  initChartVisibility();
  syncDashboardControlsFromState();
  bindDashboardControls();

  try {
    const requiredSourceKeys = getRequiredSourceKeys(state.mode);
    await Promise.allSettled(requiredSourceKeys.map((sourceKey) => loadDataSource(sourceKey)));
    renderDashboardRefreshStrip();
    renderActionsRequiredFrame();
    renderVisibleCharts();
  } catch (error) {
    const message = `Failed to load backlog-snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    setStatusMessageForIds(CHART_STATUS_IDS, message);
    renderDashboardRefreshStrip();
    renderActionsRequiredFrame();
  }
}

loadSnapshot();

})();
