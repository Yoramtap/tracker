"use strict";

(function initDashboardApp() {

const PRODUCT_CYCLE_SCOPE = "inception";
const PRODUCT_CYCLE_SCOPE_LABEL = "All ideas";
const PRODUCT_CYCLE_MULTI_TEAM_KEY = "multiteam";
const PRODUCT_CYCLE_MULTI_TEAM_LABEL = "Multi team";
const PRODUCT_CYCLE_TEAM_ORDER = [
  PRODUCT_CYCLE_MULTI_TEAM_KEY,
  "api",
  "frontend",
  "broadcast",
  "workers",
  "titanium",
  "shift",
  "unmapped"
];
const PR_ACTIVITY_INFLOW_SPLIT = 15;
const PR_ACTIVITY_INFLOW_AXIS_MIN_UPPER = 30;
const PR_ACTIVITY_INFLOW_AXIS_STEP = 5;
const PR_ACTIVITY_REVIEW_SPLIT = 7;
const PR_ACTIVITY_REVIEW_AXIS_UPPER = 30;
const PR_ACTIVITY_REVIEW_AXIS_STEP = 5;
const THIRTY_DAY_WINDOW_KEY = "30d";
const ALL_TEAM_SCOPE_KEY = "all";
const ALL_TEAMS_LABEL = "All teams";
const BUG_TRENDS_VIEW_DEFAULT = "graph";
const BUG_TRENDS_VIEW_MODES = [BUG_TRENDS_VIEW_DEFAULT, "table"];
const PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT = "delivery";
const PRODUCT_DELIVERY_WORKFLOW_VIEW_MODES = [PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT, "workflow"];
const PR_ACTIVITY_WINDOWS = [THIRTY_DAY_WINDOW_KEY, "90d", "6m", "1y"];
const MANAGEMENT_FLOW_SCOPES = ["ongoing", "done"];
const LIFECYCLE_TEAM_SCOPE_DEFAULT = "all";
const PRODUCT_CYCLE_TEAM_DEFAULT = "all";
const DEVELOPMENT_WORKFLOW_WINDOWS = [THIRTY_DAY_WINDOW_KEY, "90d", "6m", "1y"];
const SECTION_FILTER_ALL = "all";
const SECTION_FILTER_DEFAULT = "community";
const SECTION_FILTER_ITEMS = [
  { value: "community", label: "Community" },
  { value: "shipped", label: "Shipped" },
  { value: "product", label: "Product" },
  { value: "development", label: "Development" },
  { value: "bug", label: "Bugs" },
  { value: SECTION_FILTER_ALL, label: "All" }
];
const SECTION_FILTER_OPTIONS = SECTION_FILTER_ITEMS.map(({ value }) => value);
const SECTION_FILTER_PANEL_IDS = {
  [SECTION_FILTER_ALL]: [],
  shipped: ["product-cycle-shipments-panel"],
  product: ["uat-acceptance-time-panel", "cycle-time-to-ship-panel"],
  community: ["community-contributors-panel"],
  development: ["development-workflow-breakdown-panel", "development-workflow-trends-panel"],
  bug: ["bug-trends-panel"]
};
const CHART_CONFIG = {
  trend: {
    panelId: "bug-trends-panel",
    statusId: "bug-trends-status",
    contextId: "bug-trends-context",
    containerId: "bug-trends-chart",
    missingMessage: "Bug trends view unavailable: chart renderer missing."
  },
  "management-facility": {
    panelId: "uat-acceptance-time-panel",
    statusId: "management-facility-status",
    contextId: "management-facility-context",
    containerId: "development-vs-uat-by-facility-chart",
    rendererName: "renderDevelopmentVsUatByFacilityChart",
    missingMessage: "Development vs UAT chart unavailable: renderer missing."
  },
  "pr-activity-legacy": {
    panelId: "development-workflow-trends-panel",
    statusId: "pr-activity-legacy-status",
    contextId: "pr-activity-legacy-context",
    containerId: "pr-activity-legacy-count-chart",
    missingMessage: "No Jira-linked PR activity found in pr-activity-snapshot.json."
  },
  contributors: {
    panelId: "community-contributors-panel",
    statusId: "contributors-status",
    contextId: "contributors-context",
    containerId: "top-contributors-chart",
    missingMessage: "Contributors chart unavailable: renderer missing."
  },
  "product-cycle-shipments": {
    panelId: "product-cycle-shipments-panel",
    statusId: "product-cycle-shipments-status",
    contextId: "product-cycle-shipments-context",
    containerId: "product-cycle-shipments-chart",
    missingMessage: "No product cycle shipments found in product-cycle-shipments-snapshot.json."
  },
  "product-cycle": {
    panelId: "cycle-time-to-ship-panel",
    statusId: "product-cycle-status",
    contextId: "product-cycle-context",
    containerId: "cycle-time-parking-lot-to-done-chart",
    missingMessage: "No product cycle aggregates found in product-cycle-snapshot.json."
  },
  "pr-cycle-experiment": {
    panelId: "development-workflow-breakdown-panel",
    statusId: "pr-cycle-experiment-status",
    contextId: "pr-cycle-experiment-context",
    containerId: "pr-cycle-experiment-card",
    missingMessage: "No PR cycle experiment data found in pr-cycle-snapshot.json."
  }
};
const CHART_STATUS_IDS = [...new Set(Object.values(CHART_CONFIG).map((config) => config.statusId))];
const PANEL_DISPLAY_ORDER = [
  "actions-required-panel",
  "product-cycle-shipments-panel",
  "community-contributors-panel",
  "uat-acceptance-time-panel",
  "cycle-time-to-ship-panel",
  "development-workflow-breakdown-panel",
  "development-workflow-trends-panel",
  "bug-trends-panel"
];
const DATA_SOURCE_CONFIG = {
  snapshot: {
    stateKey: "snapshot",
    url: "./backlog-snapshot.json",
    errorMessage: "Failed to load backlog-snapshot.json",
    statusIds: ["bug-trends-status"]
  },
  prActivity: {
    stateKey: "prActivitySnapshot",
    url: "./pr-activity-snapshot.json",
    errorMessage: "Failed to load pr-activity-snapshot.json",
    statusIds: ["pr-activity-legacy-status", "pr-cycle-experiment-status"],
    clearContainers: ["pr-activity-legacy-count-chart", "pr-activity-legacy-merge-time-chart", "pr-cycle-experiment-card"]
  },
  managementFacility: {
    stateKey: "managementFacilitySnapshot",
    url: "./management-facility-snapshot.json",
    errorMessage: "Failed to load management-facility-snapshot.json",
    statusIds: ["management-facility-status"],
    clearContainers: ["development-vs-uat-by-facility-chart"]
  },
  productCycle: {
    stateKey: "productCycle",
    url: "./product-cycle-snapshot.json",
    errorMessage: "Failed to load product-cycle-snapshot.json",
    statusIds: ["product-cycle-status"]
  },
  productCycleShipments: {
    stateKey: "productCycleShipments",
    url: "./product-cycle-shipments-snapshot.json",
    errorMessage: "Failed to load product-cycle-shipments-snapshot.json",
    statusIds: ["product-cycle-shipments-status"],
    clearContainers: ["product-cycle-shipments-chart"]
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
  "management-facility": ["managementFacility"],
  "pr-activity-legacy": ["prActivity"],
  contributors: ["contributors"],
  "product-cycle-shipments": ["productCycleShipments"],
  "product-cycle": ["productCycle"],
  "pr-cycle-experiment": ["prCycle"]
};
const CHART_RENDERERS = {
  trend: renderBugTrendsPanel,
  "management-facility": renderDevelopmentVsUatByFacilityChart,
  "pr-activity-legacy": renderLegacyPrActivityCharts,
  contributors: renderTopContributorsChart,
  "product-cycle-shipments": renderProductCycleShipmentsTimeline,
  "product-cycle": renderLeadAndCycleTimeByTeamChart,
  "pr-cycle-experiment": renderPrCycleExperiment
};

function productDeliveryWorkflowViewKey(value) {
  return normalizeOption(
    value,
    PRODUCT_DELIVERY_WORKFLOW_VIEW_MODES,
    PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT
  );
}

function bugTrendsViewKey(value) {
  return normalizeOption(value, BUG_TRENDS_VIEW_MODES, BUG_TRENDS_VIEW_DEFAULT);
}

function normalizeDashboardMode(mode) {
  return mode === "composition" ? "trend" : mode;
}

function defaultBugTrendsViewForMode(mode) {
  return mode === "composition" ? "table" : BUG_TRENDS_VIEW_DEFAULT;
}

function sectionFilterKey(value) {
  return normalizeOption(
    String(value || "")
      .trim()
      .toLowerCase(),
    SECTION_FILTER_OPTIONS,
    SECTION_FILTER_DEFAULT
  );
}

function isPanelVisibleForSection(panelId, sectionKey = state.sectionFilter) {
  const activeSection = sectionFilterKey(sectionKey);
  if (activeSection === SECTION_FILTER_ALL) return true;
  return (SECTION_FILTER_PANEL_IDS[activeSection] || []).includes(String(panelId || "").trim());
}

function renderSectionFilteredPanels() {
  applyModeVisibility();
  ensureActiveSourcesLoaded();
  renderVisibleCharts();
}

async function renderSectionFilteredPanelsAfterShell() {
  if (state.mode !== "all") {
    renderSectionFilteredPanels();
    return;
  }

  const ensureHeavyPanelShell = dashboardRuntimeContract?.ensureHeavyPanelShell;
  const ensureHeavyScripts = dashboardRuntimeContract?.ensureHeavyScripts;
  if (typeof ensureHeavyPanelShell === "function") {
    setStatusMessage("actions-required-status", "Loading dashboard section…");
    try {
      await ensureHeavyPanelShell(state.mode, state.sectionFilter);
      if (typeof ensureHeavyScripts === "function") {
        await ensureHeavyScripts(state.mode, state.sectionFilter);
      }
      applyDashboardPanelOrder();
      syncDashboardControlsFromState(CONTROL_BINDINGS, state);
      bindDashboardControlState(CONTROL_BINDINGS, state);
    } catch (error) {
      setStatusMessage(
        "actions-required-status",
        `Failed to load dashboard section: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
  }

  renderSectionFilteredPanels();
  setStatusMessage("actions-required-status", "");
}

function renderSectionFilterIcon(value) {
  const icons = {
    community: "./assets/icons/share-3735079.png",
    shipped: "./assets/icons/bookmark-3735089.png",
    product: "./assets/icons/chart-3735080.png",
    development: "./assets/icons/chart-3735080.png",
    bug: "./assets/icons/search-3735055.png"
  };
  const src = icons[String(value || "").trim()];
  if (!src) {
    return '<span class="report-intro__icon report-intro__icon--empty" aria-hidden="true"></span>';
  }
  return `<span class="report-intro__icon" aria-hidden="true"><img class="report-intro__icon-image" src="${escapeHtml(src)}" alt="" width="16" height="16" /></span>`;
}

function renderSectionFilterRadios(name = "report-section", selectedValue = state.sectionFilter) {
  return SECTION_FILTER_ITEMS.map(
    ({ value, label }) => `
          <label class="report-intro__card report-intro__card--${escapeHtml(value)}">
            <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${
              value === selectedValue ? " checked" : ""
            } />
            <span class="report-intro__label">
              ${renderSectionFilterIcon(value)}
              <span class="report-intro__title">${escapeHtml(label)}</span>
            </span>
          </label>
        `
  ).join("");
}

const CONTROL_BINDINGS = [
  {
    name: "report-section",
    stateKey: "sectionFilter",
    defaultValue: SECTION_FILTER_DEFAULT,
    normalizeValue: sectionFilterKey,
    onChangeRender: renderSectionFilteredPanelsAfterShell
  },
  {
    name: "bug-trends-view",
    stateKey: "bugTrendsView",
    defaultValue: BUG_TRENDS_VIEW_DEFAULT,
    normalizeValue: bugTrendsViewKey,
    onChangeRender: renderBugTrendsPanel
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
    defaultValue: ALL_TEAM_SCOPE_KEY,
    normalizeValue: (value) =>
      String(value || "")
        .trim()
        .toLowerCase() || ALL_TEAM_SCOPE_KEY,
    onChangeRender: renderPrCycleExperiment
  },
  {
    name: "pr-cycle-window",
    stateKey: "developmentWorkflowWindow",
    defaultValue: THIRTY_DAY_WINDOW_KEY,
    normalizeValue: (value) =>
      normalizeOption(value, DEVELOPMENT_WORKFLOW_WINDOWS, THIRTY_DAY_WINDOW_KEY),
    onChangeRender: renderPrCycleExperiment
  },
  {
    name: "pr-activity-legacy-metric",
    stateKey: "prActivityLegacyMetric",
    defaultValue: "offered",
    normalizeValue: (value) => (value === "merged" ? "merged" : "offered"),
    onChangeRender: renderLegacyPrActivityCharts
  },
  {
    name: "product-delivery-workflow-view",
    stateKey: "productDeliveryWorkflowView",
    defaultValue: PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT,
    normalizeValue: productDeliveryWorkflowViewKey,
    onChangeRender: renderLeadAndCycleTimeByTeamChart
  },
  {
    name: "product-cycle-team",
    stateKey: "productCycleTeam",
    defaultValue: PRODUCT_CYCLE_TEAM_DEFAULT,
    normalizeValue: productCycleTeamKey,
    onChangeRender: renderLeadAndCycleTimeByTeamChart
  }
];

const state = {
  snapshot: null,
  prActivitySnapshot: null,
  managementFacilitySnapshot: null,
  contributors: null,
  productCycle: null,
  productCycleShipments: null,
  prCycle: null,
  loadedSources: {},
  loadErrors: {},
  mode: "all",
  sectionFilter: SECTION_FILTER_DEFAULT,
  bugTrendsView: BUG_TRENDS_VIEW_DEFAULT,
  prActivityLegacyHiddenKeys: [],
  developmentWorkflowWindow: THIRTY_DAY_WINDOW_KEY,
  prActivityLegacyMetric: "offered",
  productDeliveryWorkflowView: PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT,
  productCycleTeam: PRODUCT_CYCLE_TEAM_DEFAULT,
  productCycleShipmentsYear: "",
  productCycleShipmentsMonthKey: "",
  managementFlowScope: "ongoing",
  prCycleTeam: ALL_TEAM_SCOPE_KEY,
  prCycleWindow: THIRTY_DAY_WINDOW_KEY
};

const queuedChartModes = new Set();
let chartRenderFrame = 0;
let resizeRenderFrame = 0;
let windowResizeBound = false;
const legacyPrActivityMonthlyCache = {
  source: null,
  points: []
};

const dashboardUiUtils = window.DashboardViewUtils;
if (!dashboardUiUtils) {
  throw new Error("Dashboard UI helpers not loaded.");
}
const dashboardRuntimeContract = window.DashboardRuntimeContract;
if (!dashboardRuntimeContract) {
  throw new Error("Dashboard runtime contract not loaded.");
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
    getOldestTimestamp,
    setStatusMessage,
  setStatusMessageForIds,
  getThemeColors,
  clearChartContainer,
  getModeFromUrl,
  getRequiredSourceKeys,
  syncControlValue,
  syncRadioAvailability,
  readDashboardControlStateFromUrl,
  syncDashboardControlsFromState,
  bindDashboardControlState,
  setPanelContext,
  formatContextWithFreshness,
  getSnapshotContextTimestamp,
  renderDashboardRefreshStrip,
  renderDashboardChartState,
  showPanelStatus,
  withChart,
  escapeHtml,
  isEmbedMode
} = dashboardUiUtils;
const { buildTeamColorMap, buildTintMap, toCount } = dashboardDataUtils;
const {
  React,
  buildRowMarkup,
  getPrCycleTeamColor,
  h,
  isCompactViewport,
  renderProductCycleCard,
  renderWithRoot
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

function isoDateOnlyFromTimestamp(value) {
  const parsed = new Date(String(value || ""));
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function capChartDateToTimestamp(dateText, timestamp) {
  const safeDate = String(dateText || "").trim();
  const ceilingDate = isoDateOnlyFromTimestamp(timestamp);
  if (!safeDate) return "";
  if (!ceilingDate) return safeDate;
  return safeDate > ceilingDate ? ceilingDate : safeDate;
}

function getSnapshotDisplayDate(dateText, { preferChartData = false } = {}) {
  return capChartDateToTimestamp(dateText, getSnapshotContextTimestamp(state, { preferChartData }));
}

function getPrActivitySnapshot() {
  if (state.prActivitySnapshot && typeof state.prActivitySnapshot === "object") {
    return state.prActivitySnapshot;
  }
  if (state.snapshot?.prActivity && typeof state.snapshot.prActivity === "object") {
    return {
      updatedAt: String(state.snapshot?.updatedAt || "").trim(),
      prActivity: state.snapshot.prActivity
    };
  }
  return null;
}

function getManagementFacilitySnapshot() {
  if (state.managementFacilitySnapshot && typeof state.managementFacilitySnapshot === "object") {
    return state.managementFacilitySnapshot;
  }
  if (state.snapshot?.chartData?.managementBusinessUnit) {
    return {
      updatedAt: String(state.snapshot?.updatedAt || "").trim(),
      chartDataUpdatedAt: String(state.snapshot?.chartDataUpdatedAt || "").trim(),
      chartData: state.snapshot.chartData
    };
  }
  return null;
}

function getPrActivityDisplayDate(dateText) {
  return capChartDateToTimestamp(
    dateText,
    getOldestTimestamp([getPrActivitySnapshot()?.updatedAt, state.prCycle?.updatedAt])
  );
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
  const latestDate = getPrActivityDisplayDate(latestPoint?.date || "");
  let startDate = latestDate;
  if (selectedWindowKey === THIRTY_DAY_WINDOW_KEY) startDate = shiftChartIsoDate(latestDate, -29);
  else if (selectedWindowKey === "90d") startDate = shiftChartIsoDate(latestDate, -89);
  else if (selectedWindowKey === "6m") startDate = shiftChartIsoMonths(latestDate, -6);
  else startDate = shiftChartIsoMonths(latestDate, -12);
  const filteredPoints = safePoints.filter(
    (point) => getPrActivityDisplayDate(point?.date || "") >= startDate
  );
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

function normalizeOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function getManagementFlowScopeLabel(scope) {
  return scope === "done" ? "Done after UAT" : "Open in UAT";
}

function applyDashboardPanelOrder() {
  const main = document.getElementById("dashboard-main");
  if (!main) return;
  PANEL_DISPLAY_ORDER.forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (panel && panel.parentElement === main) {
      main.appendChild(panel);
    }
  });
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

function applyModeVisibility() {
  const validModes = new Set(Object.keys(CHART_CONFIG));
  const selectedMode = validModes.has(state.mode) ? state.mode : "all";
  const showAll = selectedMode === "all";
  const selectedSection = sectionFilterKey(state.sectionFilter);
  const embedMode = isEmbedMode();
  const actionsPanel = document.getElementById("actions-required-panel");
  document.body.classList.toggle("embed-mode", embedMode);
  document.body.classList.toggle("single-chart-mode", embedMode && !showAll);
  document.body.classList.toggle("embedded-frame-mode", embedMode && showAll);
  if (actionsPanel) actionsPanel.hidden = !showAll;
  for (const [mode, config] of Object.entries(CHART_CONFIG)) {
    const panel = document.getElementById(config.panelId);
    if (!panel) continue;
    panel.hidden = showAll ? !isPanelVisibleForSection(config.panelId, selectedSection) : mode !== selectedMode;
  }
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
  setPanelContext(
    contextNode,
    formatContextWithFreshness("", getSnapshotContextTimestamp(state))
  );

  statusNode.hidden = true;
  listNode.innerHTML = `
    <div class="report-intro">
        <fieldset class="report-intro__grid" aria-label="Report section filter">
          <legend class="sr-only">Report section filter</legend>
          ${renderSectionFilterRadios("report-section", state.sectionFilter)}
      </fieldset>
    </div>
  `;
  syncDashboardControlsFromState(CONTROL_BINDINGS, state);
  bindDashboardControlState(CONTROL_BINDINGS, state);
}

function getBroadcastScopeLabel() {
  const managementFacilitySnapshot = getManagementFacilitySnapshot();
  return String(
    managementFacilitySnapshot?.chartData?.managementBusinessUnit?.scopeLabel ||
      "Broadcast"
  );
}

function setBugTrendsContainerView(viewKey, containerId = "bug-trends-chart") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.className =
    viewKey === "table"
      ? "chart-canvas composition-table-wrap"
      : "chart-canvas chart-canvas--standard";
}

function renderBugTrendsPanel() {
  const config = getConfig("trend");
  const viewKey = bugTrendsViewKey(state.bugTrendsView);
  state.bugTrendsView = viewKey;
  syncControlValue("bug-trends-view", viewKey);
  const points = Array.isArray(state.snapshot?.combinedPoints) ? state.snapshot.combinedPoints : [];
  const trendPoints = points.slice(-10);
  const firstPoint = trendPoints[0] || null;
  const lastPoint = trendPoints[trendPoints.length - 1] || null;
  const firstDisplayDate = getSnapshotDisplayDate(firstPoint?.date || "");
  const lastDisplayDate = getSnapshotDisplayDate(lastPoint?.date || "");
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;
  const latestDisplayDate = getSnapshotDisplayDate(latestPoint?.date || "");
  renderDashboardChartState("trend", getConfig, () => ({
    contextText: formatContextWithFreshness(
      viewKey === "table"
        ? latestDisplayDate
          ? `Latest backlog snapshot • ${latestDisplayDate}`
          : ""
        : firstDisplayDate && lastDisplayDate
          ? `Last ${trendPoints.length} sprints • ${firstDisplayDate} to ${lastDisplayDate}`
          : "Last 10 sprints",
      getSnapshotContextTimestamp(state)
    ),
    render: () => {
      setBugTrendsContainerView(viewKey, config?.containerId);
      renderNamedChart(
        config,
        {
          containerId: config.containerId,
          snapshot: state.snapshot,
          colors: getThemeColors()
        },
        {
          rendererName:
            viewKey === "table"
              ? "renderBugCompositionByPriorityChart"
              : "renderBugBacklogTrendByTeamChart"
        }
      );
    }
  }));
}

function setPrActivityHelpDetails({ since = "", until = "", caveat = "", interval = "" } = {}) {
  const metaNode = document.getElementById("pr-activity-help-meta");
  const noteNode = document.getElementById("pr-activity-help-note");
  const safeSince = String(since || "").trim();
  const safeUntil = String(until || "").trim();
  const safeCaveat = String(caveat || "").trim();
  const unitLabel = normalizePrActivityInterval(interval) === "sprint" ? "sprints" : "months";

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
    noteNode.hidden = safeCaveat.length === 0;
    noteNode.textContent = safeCaveat;
  }
}

function monthBucketDate(isoDate) {
  const safeValue = String(isoDate || "").trim();
  if (!safeValue) return "";
  const date = new Date(`${safeValue}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 7) + "-01";
}

function buildLegacyPrActivityMonthlyPoints() {
  const prActivitySnapshot = getPrActivitySnapshot();
  const monthlyPoints = Array.isArray(prActivitySnapshot?.prActivity?.monthlyPoints)
    ? prActivitySnapshot.prActivity.monthlyPoints
    : [];
  if (monthlyPoints.length > 0) return monthlyPoints;

  const prActivitySource = prActivitySnapshot?.prActivity || null;
  if (legacyPrActivityMonthlyCache.source === prActivitySource) {
    return legacyPrActivityMonthlyCache.points;
  }

  const points = Array.isArray(prActivitySnapshot?.prActivity?.points)
    ? prActivitySnapshot.prActivity.points
    : [];
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

  const derivedPoints = Array.from(byMonth.values())
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
  legacyPrActivityMonthlyCache.source = prActivitySource;
  legacyPrActivityMonthlyCache.points = derivedPoints;
  return derivedPoints;
}

function normalizeDisplayTeamName(name) {
  const raw = String(name || "").trim();
  const key = normalizeProductCycleTeamKey(raw);
  if (key === "workers") return "Workers";
  if (key === PRODUCT_CYCLE_MULTI_TEAM_KEY) return PRODUCT_CYCLE_MULTI_TEAM_LABEL;
  return raw;
}

function normalizeProductCycleTeamKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return PRODUCT_CYCLE_TEAM_DEFAULT;
  if (raw === "orchestration" || raw === "workers") return "workers";
  if (raw === PRODUCT_CYCLE_MULTI_TEAM_KEY || raw === "multi team" || raw === "multi-team") {
    return PRODUCT_CYCLE_MULTI_TEAM_KEY;
  }
  return raw;
}

function buildPrCycleAllTeamsMetric(windowSnapshot, inflowByTeamKey = {}) {
  const teams = Array.isArray(windowSnapshot?.teams) ? windowSnapshot.teams : [];
  const teamRows = teams
    .map((team) => {
      const key = String(team?.key || "")
        .trim()
        .toLowerCase();
      const label = String(team?.label || "").trim();
      const stageDays = Array.isArray(team?.stages)
        ? team.stages.reduce((sum, stage) => sum + toNumber(stage?.days), 0)
        : 0;
      const totalCycleDays = Number(
        (Number.isFinite(toNumber(team?.totalCycleDays)) ? toNumber(team?.totalCycleDays) : stageDays).toFixed(1)
      );
      return {
        key,
        label,
        issueCount: toCount(team?.issueCount || team?.pullRequestCount),
        avgPrInflow: toNumber(inflowByTeamKey[key]),
        totalCycleDays
      };
    })
    .filter((team) => team.key && team.label)
    .sort((left, right) => {
      if (left.totalCycleDays !== right.totalCycleDays) {
        return left.totalCycleDays - right.totalCycleDays;
      }
      return left.label.localeCompare(right.label);
    });
  return {
    key: ALL_TEAM_SCOPE_KEY,
    label: "All teams",
    issueCount: teamRows.reduce((sum, team) => sum + toCount(team?.issueCount), 0),
    teamRows
  };
}

function buildPrActivityAverageInflowByTeam(points, prCycleWindowSnapshot) {
  const safePoints = Array.isArray(points) ? points : [];
  const availableTeamKeys = new Set(
    (Array.isArray(prCycleWindowSnapshot?.teams) ? prCycleWindowSnapshot.teams : [])
      .map((team) =>
        String(team?.key || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
  return Object.fromEntries(
    PR_ACTIVITY_LINE_DEFS.map((lineDef) => {
      if (!availableTeamKeys.has(lineDef.dataKey)) return null;
      const inflowValues = safePoints
        .map((point) => toNumber(point?.[lineDef.dataKey]?.offered))
        .filter((value) => Number.isFinite(value));
      if (inflowValues.length === 0) return null;
      return [
        lineDef.dataKey,
        Number(
          (inflowValues.reduce((sum, value) => sum + value, 0) / Math.max(1, inflowValues.length)).toFixed(1)
        )
      ];
    }).filter(Boolean)
  );
}

function buildPrActivityScatterSeries(points, selectedWindowKey, prCycleWindowSnapshot) {
  const safePoints = Array.isArray(points) ? points : [];
  const periodStart =
    safePoints.length > 0 ? getPrActivityDisplayDate(safePoints[0]?.date || "") : "";
  const periodEnd =
    safePoints.length > 0
      ? getPrActivityDisplayDate(safePoints[safePoints.length - 1]?.date || "")
      : "";
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

function PrActivityScatterView({ series, colors, hiddenKeys, setHiddenKeys, interval, axisRows }) {
  const compactViewport = isCompactViewport();
  const visibleSeries = series.filter((item) => !hiddenKeys.has(item.dataKey));
  const fixedAxisRows =
    Array.isArray(axisRows) && axisRows.length > 0
      ? axisRows
      : visibleSeries.flatMap((item) => item.rows);
  const inflowAxisLabel = prActivityInflowLabel(interval);
  const inflowTooltipLabel = prActivityInflowLabel(interval, { short: true });
  const xAxis = buildPrActivityInflowAxis(fixedAxisRows);
  const yAxis = buildPrActivityReviewAxis();
  const width = 960;
  const height = compactViewport ? 340 : 460;
  const margin = compactViewport
    ? { top: 18, right: 18, bottom: 54, left: 48 }
    : { top: 28, right: 88, bottom: 68, left: 62 };
  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const splitX = PR_ACTIVITY_INFLOW_SPLIT;
  const splitY = PR_ACTIVITY_REVIEW_SPLIT;
  const [tooltipContent, setTooltipContent] = React.useState(null);

  const pointRows = visibleSeries.flatMap((item) =>
    item.rows.map((row) => ({
      ...row,
      dataKey: item.dataKey,
      stroke: item.stroke,
      xPos: linearScale(toNumber(row?.x), 0, xAxis.upper, plotLeft, plotRight),
      yPos: linearScale(toNumber(row?.y), 0, yAxis.upper, plotBottom, plotTop)
    }))
  );

  const showTooltip = (point) => {
    setTooltipContent(
      h(
        "div",
        null,
        h("p", null, h("strong", null, point?.teamLabel || "")),
        h("p", null, h("strong", null, point?.tooltipScopeLabel || "All-time avg")),
        h("p", null, `${inflowTooltipLabel}: ${formatWholeCountLabel(point?.x)}`),
        h("p", null, `Avg. review + QA stage time: ${formatMergeTimeLabel(point?.y)}`),
        h("p", null, `Review sample: ${formatWholeCountLabel(point?.reviewSampleCount)} tickets`),
        h("p", null, `QA sample: ${formatWholeCountLabel(point?.qaSampleCount)} tickets`),
        h("p", null, `Workflow sample: ${formatWholeCountLabel(point?.workflowSampleCount)} issues`)
      )
    );
  };

  const quadrantRects = [
    { key: "few-long", x1: 0, x2: splitX, y1: splitY, y2: yAxis.upper, fill: "rgba(128, 148, 175, 0.12)" },
    { key: "many-long", x1: splitX, x2: xAxis.upper, y1: splitY, y2: yAxis.upper, fill: "rgba(207, 170, 120, 0.12)" },
    { key: "few-short", x1: 0, x2: splitX, y1: 0, y2: splitY, fill: "rgba(111, 160, 153, 0.12)" },
    { key: "many-short", x1: splitX, x2: xAxis.upper, y1: 0, y2: splitY, fill: "rgba(104, 171, 121, 0.14)" }
  ];

  return h(
    "div",
    { className: "chart-series-shell chart-series-shell--feature" },
    h(
      "div",
      { className: "svg-chart-legend", role: "group", "aria-label": `${inflowTooltipLabel} line toggles` },
      ...getPrActivityLineDefs(colors).map((lineDef) => {
        const hidden = hiddenKeys.has(lineDef.dataKey);
        return h(
          "button",
          {
            key: `pr-activity-legend-${lineDef.dataKey}`,
            type: "button",
            className: `svg-chart-legend__button${hidden ? " svg-chart-legend__button--off" : ""}`,
            style: compactViewport ? { minHeight: "34px", padding: "6px 8px" } : undefined,
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
    ),
    h(
      SvgChartShell,
      { width, height, colors, tooltipContent, legendItems: [] },
      h(
        "g",
        null,
        ...quadrantRects.map((rect) =>
          h("rect", {
            key: rect.key,
            x: linearScale(rect.x1, 0, xAxis.upper, plotLeft, plotRight),
            y: linearScale(rect.y2, 0, yAxis.upper, plotBottom, plotTop),
            width:
              linearScale(rect.x2, 0, xAxis.upper, plotLeft, plotRight) -
              linearScale(rect.x1, 0, xAxis.upper, plotLeft, plotRight),
            height:
              linearScale(rect.y1, 0, yAxis.upper, plotBottom, plotTop) -
              linearScale(rect.y2, 0, yAxis.upper, plotBottom, plotTop),
            fill: rect.fill
          })
        ),
        ...yAxis.ticks.map((tick) => {
          const y = linearScale(tick, 0, yAxis.upper, plotBottom, plotTop);
          return h(
            "g",
            { key: `pr-scatter-y-${tick}` },
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
        ...xAxis.ticks.map((tick) => {
          const x = linearScale(tick, 0, xAxis.upper, plotLeft, plotRight);
          return h(
            "g",
            { key: `pr-scatter-x-${tick}` },
            h("line", {
              x1: x,
              x2: x,
              y1: plotTop,
              y2: plotBottom,
              stroke: tick === 0 ? "transparent" : "rgba(31, 51, 71, 0.06)",
              strokeWidth: 1
            }),
            h(
              "text",
              {
                x,
                y: plotBottom + 18,
                fill: colors.text,
                fontSize: compactViewport ? 10 : 11,
                fontWeight: 600,
                textAnchor: "middle"
              },
              formatWholeCountLabel(tick)
            )
          );
        }),
        h("line", {
          x1: linearScale(splitX, 0, xAxis.upper, plotLeft, plotRight),
          x2: linearScale(splitX, 0, xAxis.upper, plotLeft, plotRight),
          y1: plotTop,
          y2: plotBottom,
          stroke: "rgba(31, 51, 71, 0.42)",
          strokeWidth: 1.25,
          strokeDasharray: "5 5"
        }),
        h("line", {
          x1: plotLeft,
          x2: plotRight,
          y1: linearScale(splitY, 0, yAxis.upper, plotBottom, plotTop),
          y2: linearScale(splitY, 0, yAxis.upper, plotBottom, plotTop),
          stroke: "rgba(31, 51, 71, 0.42)",
          strokeWidth: 1.25,
          strokeDasharray: "5 5"
        }),
        h("line", {
          x1: plotLeft,
          x2: plotRight,
          y1: plotBottom,
          y2: plotBottom,
          stroke: "rgba(31, 51, 71, 0.58)",
          strokeWidth: 1.2
        }),
        h("line", {
          x1: plotLeft,
          x2: plotLeft,
          y1: plotTop,
          y2: plotBottom,
          stroke: "rgba(31, 51, 71, 0.58)",
          strokeWidth: 1.2
        }),
        ...pointRows.map((point) =>
          h(
            "g",
            { key: `pr-scatter-point-${point.dataKey}` },
            h("circle", {
              cx: point.xPos,
              cy: point.yPos,
              r: compactViewport ? 5 : 6.5,
              fill: point.stroke,
              fillOpacity: 0.96,
              stroke: "#ffffff",
              strokeWidth: 1.6
            }),
            h(
              "text",
              {
                x: point.xPos + (compactViewport ? 8 : 12),
                y: point.yPos - (compactViewport ? 8 : 12),
                fill: "rgba(31, 51, 71, 0.96)",
                fontFamily: "var(--font-ui)",
                fontSize: compactViewport ? 9 : 11,
                fontWeight: 700,
                textAnchor: "start",
                dominantBaseline: "auto",
                stroke: "rgba(255,255,255,0.96)",
                strokeWidth: 4,
                paintOrder: "stroke"
              },
              point.teamLabel || ""
            ),
            h("circle", {
              cx: point.xPos,
              cy: point.yPos,
              r: compactViewport ? 12 : 14,
              fill: "transparent",
              onMouseEnter: () => showTooltip(point),
              onMouseLeave: () => setTooltipContent(null),
              "aria-label": `${point.teamLabel || ""}: ${inflowTooltipLabel} ${formatWholeCountLabel(point.x)}, ${formatMergeTimeLabel(point.y)}`
            })
          )
        ),
        h(
          "text",
          {
            x: plotLeft + (plotRight - plotLeft) / 2,
            y: plotBottom + (compactViewport ? 40 : 48),
            fill: "rgba(31, 51, 71, 0.92)",
            fontSize: compactViewport ? 10 : 11,
            fontWeight: 700,
            textAnchor: "middle"
          },
          compactViewport ? "PR inflow" : inflowAxisLabel
        ),
        h(
          "text",
          {
            x: plotLeft - (compactViewport ? 36 : 44),
            y: plotTop + (plotBottom - plotTop) / 2,
            fill: "rgba(31, 51, 71, 0.92)",
            fontSize: compactViewport ? 10 : 11,
            fontWeight: 700,
            textAnchor: "middle",
            transform: `rotate(-90 ${plotLeft - (compactViewport ? 36 : 44)} ${plotTop + (plotBottom - plotTop) / 2})`
          },
          compactViewport ? "Review + QA days" : "Avg review + QA time (days)"
        )
      )
    )
  );
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
  if (points.length === 2) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }

  const deltas = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const dx = points[index + 1].x - points[index].x;
    const dy = points[index + 1].y - points[index].y;
    deltas.push(dx > 0 ? dy / dx : 0);
  }

  const tangents = new Array(points.length).fill(0);
  tangents[0] = deltas[0];
  tangents[tangents.length - 1] = deltas[deltas.length - 1];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previousDelta = deltas[index - 1];
    const nextDelta = deltas[index];
    tangents[index] =
      previousDelta === 0 || nextDelta === 0 || previousDelta * nextDelta < 0
        ? 0
        : (previousDelta + nextDelta) / 2;
  }

  for (let index = 0; index < deltas.length; index += 1) {
    const delta = deltas[index];
    if (delta === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const leftRatio = tangents[index] / delta;
    const rightRatio = tangents[index + 1] / delta;
    const magnitude = Math.hypot(leftRatio, rightRatio);
    if (magnitude <= 3) continue;
    const scale = 3 / magnitude;
    tangents[index] = scale * leftRatio * delta;
    tangents[index + 1] = scale * rightRatio * delta;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const dx = next.x - current.x;
    const control1X = current.x + dx / 3;
    const control1Y = current.y + (tangents[index] * dx) / 3;
    const control2X = next.x - dx / 3;
    const control2Y = next.y - (tangents[index + 1] * dx) / 3;
    path += ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)} ${control2X.toFixed(2)} ${control2Y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

function buildLegacyPrActivityDisplayedXTicks(rows, compactViewport) {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (safeRows.length <= 3) return safeRows.map((row) => row.dateValue).filter((value) => value > 0);
  const step = compactViewport ? 3 : 2;
  const ticks = safeRows
    .filter((_, index) => index % step === 0 || index === safeRows.length - 1)
    .map((row) => row.dateValue)
    .filter((value) => value > 0);
  return Array.from(new Set(ticks));
}

function roundLegacyPrActivityUpper(yUpper) {
  const safeUpper = Math.max(1, Math.ceil(toNumber(yUpper)));
  if (safeUpper <= 10) return safeUpper;
  const step = safeUpper <= 40 ? 5 : safeUpper <= 80 ? 10 : 20;
  return Math.ceil(safeUpper / step) * step;
}

function LegacyPrActivitySvgChart({
  rows,
  colors,
  yAxisLabel,
  tooltipLabel,
  tooltipValueFormatter,
  yAxisUpperOverride = 0,
  yAxisFixedUpper = null,
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
  const yUpper = Number.isFinite(yAxisFixedUpper) && yAxisFixedUpper > 0
    ? yAxisFixedUpper
    : roundLegacyPrActivityUpper(rawYUpper * Math.max(1, toNumber(yAxisPadRatio)));
  const width = 960;
  const height = compactViewport ? 276 : 360;
  const margin = compactViewport
    ? { top: 14, right: 10, bottom: 36, left: 40 }
    : { top: 26, right: 18, bottom: 62, left: 56 };
  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const axisLabelOffset = compactViewport ? 34 : 42;
  const axisLabelFontSize = compactViewport ? 9 : 11;
  const xTicks = rows.map((row) => row.dateValue).filter((value) => value > 0);
  const displayedXTicks = buildLegacyPrActivityDisplayedXTicks(rows, compactViewport);
  const xMin = xTicks.length > 0 ? xTicks[0] : 0;
  const xMax = xTicks.length > 0 ? xTicks[xTicks.length - 1] : 1;
  const yTicks = buildLegacyPrActivityTicks(yUpper);
  const visibleDefs = lineDefs.filter((lineDef) => !hiddenKeys.has(lineDef.dataKey));
  const visibleReferenceMarkers =
    xTicks.length > 0
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
                style: compactViewport ? { minHeight: "34px", padding: "6px 8px" } : undefined,
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
              y: plotBottom + 18,
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
            x: plotLeft - axisLabelOffset,
            y: plotTop + (plotBottom - plotTop) / 2,
            fill: "rgba(31, 51, 71, 0.92)",
            fontSize: axisLabelFontSize,
            fontWeight: 700,
            textAnchor: "middle",
            transform: `rotate(-90 ${plotLeft - axisLabelOffset} ${plotTop + (plotBottom - plotTop) / 2})`
          },
          yAxisLabel
        ),
        compactViewport
          ? null
          : h(
              "text",
              {
                x: plotLeft + (plotRight - plotLeft) / 2,
                y: plotBottom + 42,
                fill: "rgba(31, 51, 71, 0.92)",
                fontSize: axisLabelFontSize,
                fontWeight: 700,
                textAnchor: "middle"
              },
              xAxisLabel
            ),
      )
    )
  );
}

function renderLegacyPrActivityCharts() {
  withChart("pr-activity-legacy", getConfig, ({ status, context }) => {
    const prActivity = getPrActivitySnapshot()?.prActivity;
    const points = buildLegacyPrActivityMonthlyPoints();
    if (points.length === 0) {
      clearChartContainer("pr-activity-legacy-count-chart");
      clearChartContainer("pr-activity-legacy-merge-time-chart");
      showPanelStatus(status, getConfig("pr-activity-legacy")?.missingMessage);
      return;
    }

    const compactViewport = isCompactViewport();
    const since = String(points[0]?.date || prActivity?.monthlySince || prActivity?.since || "");
    const metricKey = state.prActivityLegacyMetric === "merged" ? "merged" : "offered";
    syncControlValue("pr-activity-legacy-metric", metricKey);
    setPanelContext(
      context,
      formatContextWithFreshness(
        compactViewport
          ? `Monthly Jira-linked PR activity • ${since || points[0]?.date || ""}`
          : `Monthly Jira-linked PR activity since ${since || points[0]?.date || ""}`,
        getSnapshotContextTimestamp(state)
      )
    );
    const colors = getThemeColors();
    const hiddenKeys = getLegacyPrActivityHiddenKeys();
    const buildLegacyRows = (valueAccessor) =>
      points.map((point) => ({
        date: String(point?.date || ""),
        dateValue: toChartDateValue(point?.date),
        api: toNumber(valueAccessor(point?.api)),
        legacy: toNumber(valueAccessor(point?.legacy)),
        react: toNumber(valueAccessor(point?.react)),
        bc: toNumber(valueAccessor(point?.bc)),
        workers: toNumber(valueAccessor(point?.workers)),
        titanium: toNumber(valueAccessor(point?.titanium))
      }));
    const lineDefs = getPrActivityLineDefs(colors);
    const offeredRows = buildLegacyRows((teamMetrics) => teamMetrics?.[metricKey]);
    const mergedCountRows = buildLegacyRows((teamMetrics) => teamMetrics?.merged);
    const mergeTimeRows = buildLegacyRows((teamMetrics) => teamMetrics?.avgReviewToMergeDays);
    const yAxisUpperOverride = Math.max(
      getLegacyPrActivityYUpper(offeredRows, lineDefs),
      getLegacyPrActivityYUpper(mergedCountRows, lineDefs)
    );
    const renderLegacyChart = (containerId, rows, options) => {
      renderWithRoot(containerId, rows.length > 0, (root) => {
        root.render(
          h(LegacyPrActivitySvgChart, {
            rows,
            colors,
            hiddenKeys,
            setHiddenKeys: setLegacyPrActivityHiddenKeys,
            ...options
          })
        );
      });
    };
    renderLegacyChart("pr-activity-legacy-count-chart", offeredRows, {
      yAxisLabel: metricKey === "merged" ? "Merged PRs" : "PR inflow",
      tooltipLabel: metricKey === "merged" ? "Merged PRs" : "PR inflow",
      tooltipValueFormatter: (value) => `${value} ${metricKey === "merged" ? "merged prs" : "pr inflow"}`,
      yAxisUpperOverride,
      showLegend: true,
      xAxisLabel: "Month"
    });
    renderLegacyChart("pr-activity-legacy-merge-time-chart", mergeTimeRows, {
      yAxisLabel: "Avg days to merge",
      tooltipLabel: "Average review-to-merge time",
      tooltipValueFormatter: (value) => {
        const roundedDays = Math.max(0, Math.round(Number(value) || 0));
        return `~${roundedDays} day${roundedDays === 1 ? "" : "s"}`;
      },
      yAxisUpperOverride: getLegacyPrActivityYUpper(mergeTimeRows, lineDefs),
      showLegend: false,
      hideReferenceLabelsOnCompact: true,
      xAxisLabel: "Month"
    });
  });
}

function renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData, {
  configKey = "product-cycle",
  teamSwitchContainerId = "product-cycle-team-switch",
  teamControlName = "product-cycle-team",
  teamStateKey = "productCycleTeam",
  onChangeRender = renderLeadAndCycleTimeByTeamChart
} = {}) {
  if (!chartScopeData || typeof chartScopeData !== "object") return;
  renderDashboardChartState(configKey, getConfig, ({ config }) => {
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
    const teams = orderProductCycleTeamsForDisplay(
      rows.map((row) => String(row?.team || "")).filter(Boolean)
    );
    if (teams.length === 0) {
      return {
        error: `No product-cycle items found for ${PRODUCT_CYCLE_SCOPE_LABEL.toLowerCase()}.`,
        clearContainer: true
      };
    }

    const fallbackCycleSampleCount = rows.reduce((sum, row) => sum + toCount(row?.meta_cycle?.n), 0);
    const cycleSampleCount = toCount(chartScopeData.cycleSampleCount) || fallbackCycleSampleCount;
    const sampleCount = Math.max(toCount(chartScopeData.sampleCount), cycleSampleCount);
    const fetchedCount = Math.max(
      toCount(state.productCycle?.chartData?.fetchedCount),
      toCount(state.productCycle?.fetchedCount)
    );
    const scopeLabel = String(chartScopeData.scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL);

    if (sampleCount === 0) {
      return {
        error: `No product-cycle items found for ${scopeLabel.toLowerCase()}.`,
        clearContainer: true
      };
    }

    const allowedTeamKeys = ["all", ...teams.map(productCycleTeamKey)];
    const selectedTeamKey = allowedTeamKeys.includes(productCycleTeamKey(state[teamStateKey]))
      ? productCycleTeamKey(state[teamStateKey])
      : productCycleTeamKey(teams[0]);
    state[teamStateKey] = selectedTeamKey;
    const selectedRow = rows.find((row) => productCycleTeamKey(row?.team) === selectedTeamKey) || rows[0];
    const selectedSampleCount = toCount(selectedRow?.meta_cycle?.n);

    return buildRadioChartStateResult({
      containerId: teamSwitchContainerId,
      name: teamControlName,
      options: ["all", ...teams.map(productCycleTeamKey)].map((key) => ({
        value: key,
        label:
          key === "all"
            ? ALL_TEAMS_LABEL
            : normalizeDisplayTeamName(teams.find((team) => productCycleTeamKey(team) === key) || key)
      })),
      selectedValue: selectedTeamKey,
      stateKey: teamStateKey,
      normalizeValue: productCycleTeamKey,
      onChangeRender,
      state,
      contextText: formatContextWithFreshness(
        selectedTeamKey === "all"
          ? fetchedCount > 0
            ? `${scopeLabel} • ${cycleSampleCount} ideas with cycle data from ${fetchedCount} fetched ideas`
            : `${scopeLabel} • ${cycleSampleCount} ideas with cycle data`
          : fetchedCount > 0
            ? `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${scopeLabel} • ${selectedSampleCount} ideas with cycle data from ${fetchedCount} fetched ideas`
            : `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${scopeLabel} • ${selectedSampleCount} ideas with cycle data`,
        getSnapshotContextTimestamp(state),
        "generated"
      ),
      render: () => {
        clearChartContainer(config.containerId);
        if (selectedTeamKey === "all") {
          window.DashboardCharts?.renderProductCycleComparisonCard?.(config.containerId, rows, scopeLabel);
          return;
        }

        window.DashboardCharts?.renderProductCycleSingleTeamCard?.(config.containerId, selectedRow, rows);
      }
    });
  });
}

function buildRadioChartStateResult({
  containerId,
  name,
  options,
  selectedValue,
  stateKey,
  normalizeValue,
  onChangeRender,
  state,
  contextText,
  render,
  error,
  clearContainer = false
}) {
  if (error) {
    return clearContainer ? { error, clearContainer: true } : { error };
  }
  return {
    controlGroup: {
      containerId,
      name,
      options,
      selectedValue,
      bindings: [{ name, stateKey, normalizeValue, onChangeRender }],
      state
    },
    contextText,
    render
  };
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
  return normalizeProductCycleTeamKey(value) || LIFECYCLE_TEAM_SCOPE_DEFAULT;
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
  const orderedTeamDefs = orderProductCycleTeamsForDisplay(
    teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean)
  )
    .map((teamName) => teamDefs.find((teamDef) => String(teamDef?.team || "") === teamName))
    .filter(Boolean);
  const options = orderedTeamDefs
    .map((teamDef) => {
      const team = String(teamDef?.team || "");
      const key = lifecycleTeamScopeKey(team);
      const sampleCount = totalLifecycleSampleCount(teamDef, rows);
      if (!team || key === "unmapped") return null;
      return {
        key,
        label: normalizeDisplayTeamName(team),
        team,
        sampleCount
      };
    })
    .filter(Boolean);
  return [{ key: LIFECYCLE_TEAM_SCOPE_DEFAULT, label: ALL_TEAMS_LABEL, sampleCount: 0 }, ...options];
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
          team: ALL_TEAMS_LABEL,
          n: totals.sampleCount,
          average
        }
      };
    });
    return {
      rows: aggregateRows,
      teamDefs: [{ slot: "slot_0", name: ALL_TEAMS_LABEL, team: ALL_TEAMS_LABEL }],
      categorySecondaryLabels: Object.fromEntries(
        aggregateRows.map((row) => [String(row?.phaseLabel || ""), `n=${toCount(row?.meta_slot_0?.n)}`])
      ),
      selectionLabel: ALL_TEAMS_LABEL,
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

function renderLifecycleTimeSpentPerStageChartFromChartData(chartSnapshotData, {
  configKey = "product-cycle",
  teamSwitchContainerId = "product-cycle-team-switch",
  teamControlName = "product-cycle-team",
  teamStateKey = "productCycleTeam",
  normalizeTeamValue = productCycleTeamKey,
  onChangeRender = renderLeadAndCycleTimeByTeamChart
} = {}) {
  const normalizedChartData = normalizeCurrentStageChartData(chartSnapshotData);
  if (!normalizedChartData) return;
  renderDashboardChartState(configKey, getConfig, ({ config }) => {
    const lifecycleTeamOptions = getLifecycleTeamOptions(normalizedChartData);
    const validTeamKeys = new Set(lifecycleTeamOptions.map((option) => option.key));
    const selectedTeamKey = validTeamKeys.has(lifecycleTeamScopeKey(state[teamStateKey]))
      ? lifecycleTeamScopeKey(state[teamStateKey])
      : LIFECYCLE_TEAM_SCOPE_DEFAULT;
    state[teamStateKey] = selectedTeamKey;

    const filteredView = buildLifecycleFilteredView(normalizedChartData, selectedTeamKey);
    if (!filteredView) {
      return { error: "No current lifecycle stage counts found.", clearContainer: true };
    }
    const teams = orderProductCycleTeamsForDisplay(
      filteredView.teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean)
    );
    const rows = Array.isArray(filteredView.rows) ? filteredView.rows : [];
    const teamDefsBase = Array.isArray(filteredView.teamDefs) ? filteredView.teamDefs : [];
    if (teams.length === 0 || teamDefsBase.length === 0) {
      return { error: "No current lifecycle stage counts found.", clearContainer: true };
    }

    const themeColors = getThemeColors();
    const lifecycleTeamColorMap =
      selectedTeamKey === LIFECYCLE_TEAM_SCOPE_DEFAULT
        ? { [ALL_TEAMS_LABEL]: themeColors.teams.all }
        : buildTeamColorMap(teams);
    const lifecycleTintByTeam = buildTintMap(lifecycleTeamColorMap, 0.02);
    const teamDefs = teamDefsBase.map((teamDef, index) => ({
      key: String(teamDef?.slot || `slot_${index}`),
      ...teamDef,
      color:
        lifecycleTeamColorMap[String(teamDef?.team || "")] ||
        buildTeamColorMap([String(teamDef?.team || "")])[String(teamDef?.team || "")] ||
        themeColors.teams.api,
      showSeriesLabel: false,
      metaTeamColorMap: lifecycleTintByTeam
    }));
    const categorySecondaryLabels =
      filteredView.categorySecondaryLabels &&
      typeof filteredView.categorySecondaryLabels === "object"
        ? filteredView.categorySecondaryLabels
        : Object.fromEntries(rows.map((row) => [String(row.phaseLabel || ""), ""]));
    const sampleSize = toCount(filteredView.sampleSize);

    return buildRadioChartStateResult({
      containerId: teamSwitchContainerId,
      name: teamControlName,
      options: lifecycleTeamOptions.map((option) => ({
        value: option.key,
        label: option.label
      })),
      selectedValue: selectedTeamKey,
      stateKey: teamStateKey,
      normalizeValue: normalizeTeamValue,
      onChangeRender,
      state,
      contextText: formatContextWithFreshness(
        `${filteredView.selectionLabel} • ${sampleSize} open ideas sampled`,
        getSnapshotContextTimestamp(state),
        "generated"
      ),
      render: () => {
        window.DashboardCharts?.renderLifecycleTimeSpentPerStageChart?.({
          containerId: config.containerId,
          rows,
          seriesDefs: teamDefs,
          colors: themeColors,
          categorySecondaryLabels
        });
        return {
          clearError: true
        };
      }
    });
  });
}

function getShipmentMonthsByYear(timelineSnapshot) {
  const safeMonths = Array.isArray(timelineSnapshot?.months) ? timelineSnapshot.months : [];
  const monthsByYear = new Map();
  for (const month of safeMonths) {
    const monthKey = String(month?.monthKey || "").trim();
    const yearKey = monthKey.slice(0, 4);
    if (!/^\d{4}$/.test(yearKey)) continue;
    if (!monthsByYear.has(yearKey)) monthsByYear.set(yearKey, []);
    monthsByYear.get(yearKey).push(month);
  }
  for (const months of monthsByYear.values()) {
    months.sort((left, right) =>
      String(left?.monthKey || "").localeCompare(String(right?.monthKey || ""))
    );
  }
  return monthsByYear;
}

function renderProductCycleShipmentsTimeline() {
  renderDashboardChartState("product-cycle-shipments", getConfig, ({ config }) => {
    const timelineSnapshot = state.productCycleShipments?.chartData?.shippedTimeline;
    const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
    const availableYears = Array.from(monthsByYear.keys()).sort((left, right) =>
      left.localeCompare(right)
    );
    if (availableYears.length === 0) {
      return {
        error: config.missingMessage,
        clearContainer: true
      };
    }

    const selectedYear = availableYears.includes(state.productCycleShipmentsYear)
      ? state.productCycleShipmentsYear
      : availableYears[availableYears.length - 1];
    const monthsInYear = monthsByYear.get(selectedYear) || [];
    const availableMonthKeys = new Set(
      monthsInYear.map((month) => String(month?.monthKey || "").trim()).filter(Boolean)
    );
    const selectedMonthKey = availableMonthKeys.has(state.productCycleShipmentsMonthKey)
      ? state.productCycleShipmentsMonthKey
      : String(monthsInYear[monthsInYear.length - 1]?.monthKey || "").trim();

    state.productCycleShipmentsYear = selectedYear;
    state.productCycleShipmentsMonthKey = selectedMonthKey;

    return {
      contextText: formatContextWithFreshness(
        `Shipment history • ${toCount(timelineSnapshot?.totalShipped)} shipped total • ${availableYears.join(", ")}`,
        state.productCycleShipments?.generatedAt,
        "generated"
      ),
      render: () => {
        window.DashboardCharts?.renderProductCycleShipmentsTimeline?.({
          containerId: config.containerId,
          timelineSnapshot,
          selectedYear,
          selectedMonthKey
        });
        const container = document.getElementById(config.containerId);
        if (container) {
          container.onclick = (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            const yearButton = target.closest("[data-shipped-year-target]");
            if (yearButton instanceof HTMLButtonElement && !yearButton.disabled) {
              state.productCycleShipmentsYear =
                String(yearButton.dataset.shippedYearTarget || "").trim() ||
                state.productCycleShipmentsYear;
              state.productCycleShipmentsMonthKey = "";
              renderProductCycleShipmentsTimeline();
              return;
            }
            const monthButton = target.closest("[data-shipped-month-key]");
            if (monthButton instanceof HTMLButtonElement && !monthButton.disabled) {
              state.productCycleShipmentsMonthKey =
                String(monthButton.dataset.shippedMonthKey || "").trim() ||
                state.productCycleShipmentsMonthKey;
              renderProductCycleShipmentsTimeline();
            }
          };
        }
        return {
          clearError: true
        };
      }
    };
  });
}

function renderLeadAndCycleTimeByTeamChart() {
  const viewKey = productDeliveryWorkflowViewKey(state.productDeliveryWorkflowView);
  state.productDeliveryWorkflowView = viewKey;
  syncControlValue("product-delivery-workflow-view", viewKey);

  const chartDataValue = state.productCycle?.chartData;
  const chartData = chartDataValue && typeof chartDataValue === "object" ? chartDataValue : null;
  if (!chartData) {
    renderDashboardChartState("product-cycle", getConfig, ({ config }) => ({
      error: config.missingMessage,
      clearContainer: true
    }));
    return;
  }

  if (viewKey === "workflow") {
    const chartSnapshotData = chartData.currentStageSnapshot;
    if (!chartSnapshotData) {
      renderDashboardChartState("product-cycle", getConfig, () => ({
        error: "No current lifecycle chart data found in product-cycle-snapshot.json.",
        clearContainer: true
      }));
      return;
    }
    renderLifecycleTimeSpentPerStageChartFromChartData(chartSnapshotData, {
      configKey: "product-cycle",
      teamSwitchContainerId: "product-cycle-team-switch",
      teamControlName: "product-cycle-team",
      teamStateKey: "productCycleTeam",
      normalizeTeamValue: productCycleTeamKey,
      onChangeRender: renderLeadAndCycleTimeByTeamChart
    });
    return;
  }

  const chartScopeData = chartData.leadCycleByScope?.[PRODUCT_CYCLE_SCOPE];
  if (!chartScopeData) {
    renderDashboardChartState("product-cycle", getConfig, () => ({
      error: `No product cycle chart data found for ${PRODUCT_CYCLE_SCOPE_LABEL}.`,
      clearContainer: true
    }));
    return;
  }

  renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData, {
    configKey: "product-cycle",
    teamSwitchContainerId: "product-cycle-team-switch",
    teamControlName: "product-cycle-team",
    teamStateKey: "productCycleTeam",
    onChangeRender: renderLeadAndCycleTimeByTeamChart
  });
}

function productCycleTeamKey(value) {
  return normalizeProductCycleTeamKey(value);
}

function orderProductCycleTeamsForDisplay(teams) {
  const rankByTeam = new Map(PRODUCT_CYCLE_TEAM_ORDER.map((team, index) => [team, index]));
  const seenKeys = new Set();
  return (Array.isArray(teams) ? teams : [])
    .map((team) => String(team || "").trim())
    .filter(Boolean)
    .filter((team) => {
      const key = productCycleTeamKey(team);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftRank = rankByTeam.has(productCycleTeamKey(left))
        ? rankByTeam.get(productCycleTeamKey(left))
        : Number.MAX_SAFE_INTEGER;
      const rightRank = rankByTeam.has(productCycleTeamKey(right))
        ? rankByTeam.get(productCycleTeamKey(right))
        : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left || "").localeCompare(String(right || ""));
    });
}

function getPrCycleStageDisplayLabel(stage) {
  const key = String(stage?.key || "").trim();
  if (key === "coding") return "Progress";
  if (key === "review") return "Review";
  if (key === "merge") return "QA";
  return String(stage?.label || "").trim();
}

function formatStackedCycleDaysValueMarkup(valueInDays) {
  const days = Math.max(0, toNumber(valueInDays));
  const rounded = days.toFixed(1);
  const unit = Math.abs(days - 1) < 0.05 ? "day" : "days";
  return `<span class="stacked-duration"><span class="stacked-duration__value">${rounded}</span><span class="stacked-duration__unit">${unit}</span></span>`;
}

function formatWorkflowBreakdownMetricMarkup(value, unit, modifierClass = "") {
  return `
    <span class="workflow-breakdown-metric${modifierClass ? ` ${modifierClass}` : ""}">
      <span class="workflow-breakdown-metric__value">${escapeHtml(value)}</span>
      <span class="workflow-breakdown-metric__unit">${escapeHtml(unit)}</span>
    </span>
  `;
}

function formatWorkflowBreakdownDurationMetricMarkup(valueInDays) {
  const days = Math.max(0, toNumber(valueInDays));
  const rounded = days.toFixed(1);
  const unit = Math.abs(days - 1) < 0.05 ? "day" : "days";
  return formatWorkflowBreakdownMetricMarkup(rounded, unit, "workflow-breakdown-metric--days");
}

function formatWorkflowBreakdownInflowMetricMarkup(value) {
  const inflow = toNumber(value);
  if (!Number.isFinite(inflow) || inflow <= 0) return "";
  const rounded = String(Math.max(0, Math.round(inflow)));
  return formatWorkflowBreakdownMetricMarkup(
    rounded,
    "PR/sprint",
    "workflow-breakdown-metric--inflow"
  );
}

function formatWorkflowBreakdownValueMarkup(totalCycleDays, avgPrInflow) {
  return `
    <span class="workflow-breakdown-metrics">
      ${formatWorkflowBreakdownDurationMetricMarkup(totalCycleDays)}
      ${formatWorkflowBreakdownInflowMetricMarkup(avgPrInflow)}
    </span>
  `;
}

function renderPrCycleExperimentCard(containerId, team, snapshot) {
  if (!team) return;
  const compactViewport = isCompactViewport();
  const isAllTeamsView =
    String(team?.key || "").trim().toLowerCase() === ALL_TEAM_SCOPE_KEY &&
    Array.isArray(team?.teamRows);
  if (isAllTeamsView) {
    const teamRows = Array.isArray(team?.teamRows) ? team.teamRows : [];
    const maxDays =
      teamRows.reduce((highest, row) => Math.max(highest, toNumber(row?.totalCycleDays)), 0) || 1;
    const rowsMarkup = teamRows
      .map((row) => {
        const width = Math.max(12, Math.round((toNumber(row?.totalCycleDays) / maxDays) * 100));
        const sampleCount = toCount(row?.issueCount);
        return buildRowMarkup({
          stage: String(row?.key || ""),
          label: normalizeDisplayTeamName(row?.label || ""),
          sampleMarkup: sampleCount > 0 ? `n=${sampleCount}` : "n=0",
          width,
          wrapValueFrame: false,
          valueMarkup: formatWorkflowBreakdownValueMarkup(row?.totalCycleDays, row?.avgPrInflow),
          fillStyle: `background:${escapeHtml(getPrCycleTeamColor(row?.key))}`
        });
      })
      .join("");
    const issueCount = toNumber(team?.issueCount);
    const footerPrimary =
      issueCount > 0
        ? compactViewport
          ? `${issueCount} sampled`
          : `${issueCount} issues sampled`
        : compactViewport
          ? "No samples"
          : "No sampled issues";
    const footerSecondary = String(snapshot?.windowLabel || "").trim();
    renderProductCycleCard(containerId, {
      className: "workflow-breakdown-card",
      teamKey: ALL_TEAM_SCOPE_KEY,
      teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
      headerMarkup: `
        <div class="pr-cycle-stage-card__team">All teams</div>
        <div class="pr-cycle-stage-card__submeta">Progress + Review + QA totals</div>
      `,
      rowsMarkup,
      footerMarkup: `
        <div class="pr-cycle-stage-card__footer">
          <span><strong>${escapeHtml(footerPrimary)}</strong>${footerSecondary ? ` • ${escapeHtml(footerSecondary)}` : ""}</span>
          <span>Sorted: <strong>Fastest to slowest</strong></span>
        </div>
      `
    });
    return;
  }

  const stages = Array.isArray(team?.stages) ? team.stages : [];
  const teamColor = getPrCycleTeamColor(team?.key);
  const maxDays = stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
  const rowsMarkup = stages
    .map((stage) => {
      const width = Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100));
      const sampleCount = toCount(stage?.sampleCount);
      return buildRowMarkup({
        stage: String(stage?.key || ""),
        label: getPrCycleStageDisplayLabel(stage),
        sampleMarkup: sampleCount > 0 ? `n=${sampleCount}` : "n=0",
        width,
        valueMarkup: formatStackedCycleDaysValueMarkup(stage?.days)
      });
    })
    .join("");
  const issueCount = toNumber(team?.issueCount || team?.pullRequestCount);
  const footerPrimary =
    issueCount > 0
      ? compactViewport
        ? `${issueCount} sampled`
        : `${issueCount} issues sampled`
      : compactViewport
        ? "No samples"
        : "No sampled issues";
  const footerSecondary = String(snapshot?.windowLabel || "").trim();
  const inflow = toNumber(team?.avgPrInflow);
  const inflowSummary = Number.isFinite(inflow) && inflow > 0 ? `PR/sprint ≈ ${Math.round(inflow)}` : "";
  const footerLabel = compactViewport ? "Blocker" : "Bottleneck";
  renderProductCycleCard(containerId, {
    className: "workflow-breakdown-card",
    teamKey: String(team?.key || ""),
    teamColor,
    headerMarkup: `
      <div class="pr-cycle-stage-card__team">${escapeHtml(String(team?.label || ""))}</div>
      <div class="pr-cycle-stage-card__total metric-duration"><span class="metric-duration__value">${toNumber(
        team?.totalCycleDays
      ).toFixed(1)}</span><span class="metric-duration__unit">${
        Math.abs(toNumber(team?.totalCycleDays) - 1) < 0.05 ? "day" : "days"
      }</span></div>
    `,
    rowsMarkup,
    footerMarkup: `
      <div class="pr-cycle-stage-card__footer">
        <span><strong>${escapeHtml(footerPrimary)}</strong>${footerSecondary ? ` • ${escapeHtml(footerSecondary)}` : ""}${
          inflowSummary ? ` • ${escapeHtml(inflowSummary)}` : ""
        }</span>
        <span>${footerLabel}: <strong>${escapeHtml(String(team?.bottleneckLabel || ""))}</strong></span>
      </div>
    `
  });
}

function renderPrCycleExperiment() {
  withChart("pr-cycle-experiment", getConfig, ({ status, context, config }) => {
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
    const desiredWindowKey = normalizeOption(
      state.developmentWorkflowWindow || state.prCycleWindow,
      DEVELOPMENT_WORKFLOW_WINDOWS,
      THIRTY_DAY_WINDOW_KEY
    );
    const selectedWindowKey = effectiveWindowKeys.includes(desiredWindowKey)
      ? desiredWindowKey
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

    const availableKeys = [
      ALL_TEAM_SCOPE_KEY,
      ...teams.map((team) =>
        String(team?.key || "")
          .trim()
          .toLowerCase()
      )
    ];
    syncRadioAvailability("pr-cycle-window", effectiveWindowKeys);
    syncRadioAvailability("pr-cycle-team", availableKeys);
    const fallbackTeamKey = ALL_TEAM_SCOPE_KEY;
    const selectedKey = availableKeys.includes(state.prCycleTeam)
      ? state.prCycleTeam
      : fallbackTeamKey;
    const inflowByTeamKeyFromSnapshot = Object.fromEntries(
      teams
        .map((team) => {
          const teamKey = String(team?.key || "")
            .trim()
            .toLowerCase();
          if (!teamKey || team?.avgPrInflow === null || team?.avgPrInflow === undefined) return null;
          return [teamKey, toNumber(team?.avgPrInflow)];
        })
        .filter(Boolean)
    );
    if (
      Object.keys(inflowByTeamKeyFromSnapshot).length === 0 &&
      state.loadedSources.prActivity !== true &&
      !state.loadErrors.prActivity
    ) {
      void loadDataSource("prActivity");
    }
    const prActivitySourcePoints = Array.isArray(getPrActivitySnapshot()?.prActivity?.points)
      ? getPrActivitySnapshot().prActivity.points
      : [];
    const { points: prActivityWindowPoints } = getPrActivityWindowedPoints(
      prActivitySourcePoints,
      selectedWindowKey
    );
    const inflowByTeamKey =
      Object.keys(inflowByTeamKeyFromSnapshot).length > 0
        ? inflowByTeamKeyFromSnapshot
        : buildPrActivityAverageInflowByTeam(prActivityWindowPoints, selectedWindowSnapshot);
    const selectedTeam =
      selectedKey === ALL_TEAM_SCOPE_KEY
        ? buildPrCycleAllTeamsMetric(selectedWindowSnapshot, inflowByTeamKey)
        : (() => {
            const matchedTeam =
              teams.find(
                (team) =>
                  String(team?.key || "")
                    .trim()
                    .toLowerCase() === selectedKey
              ) || teams[0];
            if (!matchedTeam) return null;
            return {
              ...matchedTeam,
              avgPrInflow: toNumber(
                inflowByTeamKey[
                  String(matchedTeam?.key || "")
                    .trim()
                    .toLowerCase()
                ]
              )
            };
          })();

    state.prCycleTeam = selectedKey;
    state.developmentWorkflowWindow = selectedWindowKey;
    state.prCycleWindow = selectedWindowKey;
    syncControlValue("pr-cycle-team", selectedKey);
    syncControlValue("pr-cycle-window", selectedWindowKey);
    setPanelContext(
      context,
      formatContextWithFreshness(
        `${selectedTeam?.label || ""} • ${selectedWindowSnapshot?.windowLabel || ""} • ${toCount(selectedTeam?.issueCount)} issues sampled`,
        state.prCycle?.updatedAt
      )
    );
    renderPrCycleExperimentCard(config.containerId, selectedTeam, selectedWindowSnapshot);
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
  const byScope = getManagementFacilitySnapshot()?.chartData?.managementBusinessUnit?.byScope;
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
  renderDashboardChartState("management-facility", getConfig, ({ config }) => {
    const scope = normalizeOption(state.managementFlowScope, MANAGEMENT_FLOW_SCOPES, "ongoing");
    const scopeLabel = getManagementFlowScopeLabel(scope);
    const titleNode = document.getElementById("management-facility-title");
    syncControlValue("management-facility-flow-scope", scope);
    const rows = getAlignedBusinessUnitRows(scope);
    if (rows.length === 0) {
      return {
        error: `No ${scopeLabel.toLowerCase()} Business Unit chart data found in backlog-snapshot.json.`,
        clearContainer: true
      };
    }

    if (titleNode) titleNode.textContent = "Product acceptance time by business unit";
    return {
      contextText: formatContextWithFreshness(
        `${getBroadcastScopeLabel()} • ${scopeLabel.toLowerCase()} • ${rows.reduce((sum, row) => sum + row.sampleCount, 0)} issues sampled`,
        getSnapshotContextTimestamp(state, { preferChartData: true }),
        "chart data updated"
      ),
      render: () => {
        renderNamedChart(
          config,
          {
            containerId: config.containerId,
            rows,
            groupingLabel: "Business Unit",
            jiraBrowseBase: "https://nepgroup.atlassian.net/browse/",
            scope,
            colors: getThemeColors()
          },
          { missingMessage: "Development vs UAT chart unavailable: renderer missing." }
        );
      }
    };
  });
}

function summarizeContributorRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (summary, row) => ({
      totalIssues: summary.totalIssues + toCount(row?.totalIssues),
      doneIssues: summary.doneIssues + toCount(row?.doneIssues),
      activeIssues: summary.activeIssues + toCount(row?.activeIssues),
      totalContributors: summary.totalContributors + 1
    }),
    { totalIssues: 0, doneIssues: 0, activeIssues: 0, totalContributors: 0 }
  );
}

function renderTopContributorsCard(containerId, rows, summary) {
  if (!containerId || !Array.isArray(rows)) return;
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalIssues = toCount(summary?.totalIssues);
  const totalContributors = Math.max(toCount(summary?.totalContributors), safeRows.length);
  const maxTotal = Math.max(1, ...safeRows.map((row) => toCount(row?.totalIssues)));
  const rowsMarkup = safeRows
    .map((row) => {
      const total = toCount(row?.totalIssues);
      const done = toCount(row?.doneIssues);
      const active = toCount(row?.activeIssues);
      const width = total > 0 ? Math.max(10, Math.round((total / maxTotal) * 100)) : 0;
      return buildRowMarkup({
        rowClassName: "contributors-card__row",
        trackClassName: "contributors-card__track",
        fillClassName: "contributors-card__fill",
        label: String(row?.contributor || "").trim(),
        sampleMarkup: `done ${done}${active > 0 ? ` • active ${active}` : ""}`,
        width,
        valueMarkup: String(total)
      });
    })
    .join("");

  renderProductCycleCard(containerId, {
    className: "contributors-card",
    headerMarkup: `
      <div class="pr-cycle-stage-card__team">Community contributors</div>
      <div class="pr-cycle-stage-card__total">${totalIssues}</div>
    `,
    rowsMarkup,
    footerMarkup: `
      <div class="pr-cycle-stage-card__footer">
        <span><strong>${totalContributors} contributors ranked</strong> • ${totalIssues} included issues</span>
      </div>
    `
  });
}

function renderTopContributorsChart() {
  withChart("contributors", getConfig, ({ status, context, config }) => {
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

    const displaySummary = summarizeContributorRows(rows);
    setPanelContext(
      context,
      formatContextWithFreshness(
        `${displaySummary?.totalIssues || 0} total • ${displaySummary?.doneIssues || 0} done • ${displaySummary?.activeIssues || 0} active`,
        contributorsSnapshot?.updatedAt
      )
    );
    renderTopContributorsCard(config.containerId, rows, displaySummary);
  });
}

function queueRenderableCharts(entries, shouldQueue) {
  entries.forEach(([mode, payload]) => {
    if (!shouldQueue(mode, payload)) return;
    queueChartRender(mode, typeof payload === "function" ? payload : CHART_RENDERERS[mode]);
  });
}

function renderVisibleCharts() {
  queueRenderableCharts(Object.entries(CHART_RENDERERS), (mode) => isChartActive(mode) && isChartReady(mode));
}

function queueReadyChartsForSource(sourceKey) {
  queueRenderableCharts(Object.entries(CHART_DATA_SOURCES), (mode, requiredSources) => {
    if (!requiredSources.includes(sourceKey)) return false;
    return isChartActive(mode) && isChartReady(mode);
  });
}

function getActiveSourceKeys() {
  return getRequiredSourceKeys(state.mode, Object.keys(DATA_SOURCE_CONFIG), state.sectionFilter);
}

function ensureActiveSourcesLoaded() {
  getActiveSourceKeys().forEach((sourceKey) => {
    if (state.loadedSources[sourceKey] === true) return;
    void loadDataSource(sourceKey);
  });
}

function isChartActive(mode) {
  if (state.mode !== "all") return state.mode === mode;
  const config = CHART_CONFIG[mode];
  return isPanelVisibleForSection(config?.panelId, state.sectionFilter);
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

  if (queuedChartModes.size > 0) scheduleChartRenderFlush();
}

function scheduleChartRenderFlush() {
  if (chartRenderFrame !== 0) return;
  chartRenderFrame = window.requestAnimationFrame(flushChartRenderQueue);
}

function queueChartRender(mode, renderChart) {
  if (!mode || typeof renderChart !== "function") return;
  queuedChartModes.add(mode);
  scheduleChartRenderFlush();
}

function scheduleResizeRender() {
  if (resizeRenderFrame !== 0) return;
  resizeRenderFrame = window.requestAnimationFrame(() => {
    resizeRenderFrame = 0;
    renderVisibleCharts();
  });
}

function bindWindowResizeRerender() {
  if (windowResizeBound) return;
  windowResizeBound = true;
  window.addEventListener("resize", scheduleResizeRender);
  window.addEventListener("orientationchange", scheduleResizeRender);
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
    renderDashboardRefreshStrip(state);
    renderActionsRequiredFrame();
    queueReadyChartsForSource(sourceKey);
  } catch (error) {
    state[source.stateKey] = null;
    const message = `${source.errorMessage}: ${error instanceof Error ? error.message : String(error)}`;
    state.loadErrors[sourceKey] = message;
    state.loadedSources[sourceKey] = true;
    setStatusMessageForIds(source.statusIds || [], message);
    (source.clearContainers || []).forEach(clearChartContainer);
    renderDashboardRefreshStrip(state);
    renderActionsRequiredFrame();
  }
}

async function loadSnapshot() {
  setStatusMessageForIds(CHART_STATUS_IDS);
  state.snapshot = null;
  state.prActivitySnapshot = null;
  state.managementFacilitySnapshot = null;
  state.productCycle = null;
  state.productCycleShipments = null;
  state.contributors = null;
  state.prCycle = null;
  state.loadedSources = {};
  state.loadErrors = {};
  const rawMode = getModeFromUrl();
  state.mode = normalizeDashboardMode(rawMode);
  readDashboardControlStateFromUrl(CONTROL_BINDINGS, state);
  if (!new URLSearchParams(window.location.search).has("bug-trends-view")) {
    state.bugTrendsView = defaultBugTrendsViewForMode(rawMode);
  }
  renderDashboardRefreshStrip(state);
  renderActionsRequiredFrame();
  applyDashboardPanelOrder();
  applyModeVisibility();
  syncDashboardControlsFromState(CONTROL_BINDINGS, state);
  bindDashboardControlState(CONTROL_BINDINGS, state);
  bindWindowResizeRerender();

  try {
    const requiredSourceKeys = getActiveSourceKeys();
    await Promise.allSettled(requiredSourceKeys.map((sourceKey) => loadDataSource(sourceKey)));
    renderDashboardRefreshStrip(state);
    renderActionsRequiredFrame();
  } catch (error) {
    const message = `Failed to load backlog-snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    setStatusMessageForIds(CHART_STATUS_IDS, message);
    renderDashboardRefreshStrip(state);
    renderActionsRequiredFrame();
  }
}

loadSnapshot();

})();
