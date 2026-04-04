import { resolveDashboardAppDeps } from "./dashboard-app/deps.js";
import { createProductPanels } from "./dashboard-app/product-panels.js";
import { createWorkflowPanels } from "./dashboard-app/workflow-panels.js";

(function initDashboardApp() {
  const {
    dashboardRuntimeContract,
    dashboardUiUtils,
    dashboardDataUtils,
    dashboardChartCore,
    dashboardSvgCore,
    getDashboardCharts,
    getDashboardPretextLayout,
    getPreloadedDataSourcePromises,
    browserApi
  } = resolveDashboardAppDeps();
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
  const THIRTY_DAY_WINDOW_KEY = "30d";
  const ALL_TEAM_SCOPE_KEY = "all";
  const ALL_TEAMS_LABEL = "All teams";
  const BUG_TRENDS_VIEW_DEFAULT = "graph";
  const BUG_TRENDS_VIEW_MODES = [BUG_TRENDS_VIEW_DEFAULT, "table"];
  const TEAM_BUG_JQL = {
    api: "project = TFC AND type = Bug AND labels = API",
    legacy: "project = TFC AND type = Bug AND labels = Frontend",
    react: 'project = TFC AND type = Bug AND labels = "NewFrontend"',
    bc: "project = TFC AND type = Bug AND labels = Broadcast",
    workers: "project = TFO AND type = Bug AND labels = Workers",
    titanium: 'project = MESO AND type = Bug AND labels = "READY"'
  };
  const PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT = "delivery";
  const PRODUCT_DELIVERY_WORKFLOW_VIEW_MODES = [PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT, "workflow"];
  const MANAGEMENT_FLOW_SCOPES = ["ongoing", "done"];
  const LIFECYCLE_TEAM_SCOPE_DEFAULT = "all";
  const PRODUCT_CYCLE_TEAM_DEFAULT = "all";
  const DEVELOPMENT_WORKFLOW_WINDOWS = [THIRTY_DAY_WINDOW_KEY, "90d", "6m", "1y"];
  const getSourcePath = (rootKey, relativePath) =>
    dashboardRuntimeContract.getSourcePath(rootKey, relativePath);
  const SECTION_FILTER_DEFAULT = dashboardRuntimeContract.defaultSection || "community";
  const SECTION_FILTER_ITEMS = Array.isArray(dashboardRuntimeContract.sectionFilterItems)
    ? dashboardRuntimeContract.sectionFilterItems
    : [];
  const SECTION_FILTER_OPTIONS = SECTION_FILTER_ITEMS.map(({ value }) => value);
  const SECTION_FILTER_ITEMS_BY_VALUE = new Map(
    SECTION_FILTER_ITEMS.map((item) => [item.value, item])
  );
  const SECTION_FILTER_PANEL_IDS = {
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
      summaryId: "bug-trends-summary",
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
      summaryId: "pr-activity-legacy-summary",
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
      summaryId: "product-cycle-shipments-summary",
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
    "workflow-breakdown": {
      panelId: "development-workflow-breakdown-panel",
      statusId: "workflow-breakdown-status",
      contextId: "workflow-breakdown-context",
      containerId: "workflow-breakdown-card",
      missingMessage: "No workflow breakdown data found in pr-cycle-snapshot.json."
    }
  };
  const CHART_STATUS_IDS = [
    ...new Set(Object.values(CHART_CONFIG).map((config) => config.statusId))
  ];
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
      url: getSourcePath("data", "backlog-snapshot.json"),
      errorMessage: "Failed to load backlog-snapshot.json",
      statusIds: ["bug-trends-status"],
      clearContainers: ["bug-trends-chart", "bug-trends-table"]
    },
    prActivity: {
      stateKey: "prActivitySnapshot",
      url: getSourcePath("data", "pr-activity-snapshot.json"),
      errorMessage: "Failed to load pr-activity-snapshot.json",
      statusIds: ["pr-activity-legacy-status", "workflow-breakdown-status"],
      clearContainers: [
        "pr-activity-legacy-count-chart",
        "pr-activity-legacy-merge-time-chart",
        "workflow-breakdown-card"
      ]
    },
    managementFacility: {
      stateKey: "managementFacilitySnapshot",
      url: getSourcePath("data", "management-facility-snapshot.json"),
      errorMessage: "Failed to load management-facility-snapshot.json",
      statusIds: ["management-facility-status"],
      clearContainers: ["development-vs-uat-by-facility-chart"]
    },
    productCycle: {
      stateKey: "productCycle",
      url: getSourcePath("data", "product-cycle-snapshot.json"),
      errorMessage: "Failed to load product-cycle-snapshot.json",
      statusIds: ["product-cycle-status"]
    },
    productCycleShipments: {
      stateKey: "productCycleShipments",
      url: getSourcePath("data", "product-cycle-shipments-snapshot.json"),
      errorMessage: "Failed to load product-cycle-shipments-snapshot.json",
      statusIds: ["product-cycle-shipments-status"],
      clearContainers: ["product-cycle-shipments-chart"]
    },
    contributors: {
      stateKey: "contributors",
      url: getSourcePath("data", "contributors-snapshot.json"),
      errorMessage: "Failed to load contributors-snapshot.json",
      statusIds: ["contributors-status"],
      clearContainers: ["top-contributors-chart"]
    },
    prCycle: {
      stateKey: "prCycle",
      url: getSourcePath("data", "pr-cycle-snapshot.json"),
      errorMessage: "Failed to load pr-cycle-snapshot.json",
      statusIds: ["workflow-breakdown-status"],
      clearContainers: ["workflow-breakdown-card"]
    }
  };
  const PRELOADED_DATA_SOURCE_PROMISES = getPreloadedDataSourcePromises();
  const CHART_DATA_SOURCES = {
    trend: ["snapshot"],
    "management-facility": ["managementFacility"],
    "pr-activity-legacy": ["prActivity"],
    contributors: ["contributors"],
    "product-cycle-shipments": ["productCycleShipments"],
    "product-cycle": ["productCycle"],
    "workflow-breakdown": ["prCycle"]
  };
  let CHART_RENDERERS = {};

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
    return (SECTION_FILTER_PANEL_IDS[activeSection] || []).includes(String(panelId || "").trim());
  }

  function renderSectionFilteredPanels() {
    applyModeVisibility();
    ensurePanelBackToTopControls();
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
      try {
        await ensureHeavyPanelShell(state.mode, state.sectionFilter);
        if (typeof ensureHeavyScripts === "function") {
          await ensureHeavyScripts(state.mode, state.sectionFilter);
        }
        applyDashboardPanelOrder();
        ensurePanelBackToTopControls();
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
  }

  function renderSectionFilterIcon(value) {
    const src = SECTION_FILTER_ITEMS_BY_VALUE.get(String(value || "").trim())?.icon || "";
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

  let CONTROL_BINDINGS = [];

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
  const {
    addEventListener,
    fetchJson,
    getLocationSearch,
    hasUrlParam,
    requestAnimationFrame
  } = browserApi;

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

  function formatCompactChartPointDate(dateText) {
    const safeDate = String(dateText || "").trim();
    if (!safeDate) return "";
    const date = new Date(`${safeDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return safeDate;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
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
    return capChartDateToTimestamp(
      dateText,
      getSnapshotContextTimestamp(state, { preferChartData })
    );
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

  function normalizeOption(value, options, fallback) {
    return options.includes(value) ? value : fallback;
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

  function getDashboardTopReturnTarget() {
    return (
      document.getElementById("actions-required-panel") || document.getElementById("dashboard-main")
    );
  }

  function scrollDashboardToTop() {
    const target = getDashboardTopReturnTarget();
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function ensurePanelBackToTopControl(panel) {
    if (!(panel instanceof HTMLElement) || !panel.id || panel.id === "actions-required-panel") {
      return;
    }

    let mount = panel.querySelector(".panel-return");
    if (!mount) {
      mount = document.createElement("div");
      mount.className = "panel-return";
      mount.innerHTML = `
        <button type="button" class="panel-return__button" aria-label="Back to top of dashboard">
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 12.5V3.5"></path>
            <path d="M4.5 7L8 3.5 11.5 7"></path>
          </svg>
        </button>
      `;
      const button = mount.querySelector(".panel-return__button");
      button?.addEventListener("click", scrollDashboardToTop);
      panel.appendChild(mount);
    }
  }

  function ensurePanelBackToTopControls() {
    document.querySelectorAll(".panel").forEach((panel) => ensurePanelBackToTopControl(panel));
  }

  function getConfig(configKey) {
    return CHART_CONFIG[configKey] || null;
  }

  function getRenderer(
    config,
    rendererName = config.rendererName,
    missingMessage = config.missingMessage
  ) {
    const renderer = getDashboardCharts()?.[rendererName];
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
      panel.hidden = showAll
        ? !isPanelVisibleForSection(config.panelId, selectedSection)
        : mode !== selectedMode;
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
    <div class="dashboard-overview">
        <div class="dashboard-overview__main">
          <p class="dashboard-overview__eyebrow">Insights</p>
          <h2 class="dashboard-overview__title">Trends for product and teams</h2>
        </div>
        <div class="report-intro">
        <fieldset class="report-intro__grid" aria-label="Report section filter">
          <legend class="sr-only">Report section filter</legend>
          ${renderSectionFilterRadios("report-section", state.sectionFilter)}
        </fieldset>
        </div>
    </div>
  `;
    syncDashboardControlsFromState(CONTROL_BINDINGS, state);
    bindDashboardControlState(CONTROL_BINDINGS, state);
  }

  function getPanelLeadMountId(panelId) {
    return `${String(panelId || "").trim()}-lead`;
  }

  function ensurePanelLeadMount(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return null;
    let mount = document.getElementById(getPanelLeadMountId(panelId));
    if (mount) return mount;

    mount = document.createElement("div");
    mount.id = getPanelLeadMountId(panelId);
    mount.className = "panel-lead-mount";
    mount.hidden = true;

    const titleRow = panel.querySelector(".panel-title-row");
    if (titleRow && titleRow.parentElement === panel) {
      titleRow.insertAdjacentElement("afterend", mount);
    } else {
      panel.prepend(mount);
    }
    return mount;
  }

  function clearPanelLead(panelId) {
    const mount = ensurePanelLeadMount(panelId);
    if (!mount) return;
    mount.innerHTML = "";
    mount.hidden = true;
  }

  function clearPanelStats(summaryId) {
    const mount = document.getElementById(String(summaryId || "").trim());
    if (!mount) return;
    mount.innerHTML = "";
    mount.hidden = true;
  }

  function renderPanelStats(summaryId, model) {
    const mount = document.getElementById(String(summaryId || "").trim());
    if (!mount || !model) {
      clearPanelStats(summaryId);
      return false;
    }
    const pretextLayout = getDashboardPretextLayout();
    const rendered = pretextLayout?.renderStatsStrip?.(summaryId, model);
    if (rendered) return true;
    clearPanelStats(summaryId);
    return false;
  }

  function renderPanelLead(panelId, model) {
    const mount = ensurePanelLeadMount(panelId);
    if (!mount || !model) {
      clearPanelLead(panelId);
      return false;
    }
    const pretextLayout = getDashboardPretextLayout();
    const rendered = pretextLayout?.renderPanelLead?.(mount, model);
    if (rendered) return true;

    const chipsMarkup = (Array.isArray(model?.chips) ? model.chips : [])
      .filter(Boolean)
      .map((item) => `<span class="dashboard-panel-lead__chip">${escapeHtml(item)}</span>`)
      .join("");
    mount.hidden = false;
    mount.innerHTML = `
      <section class="dashboard-panel-lead dashboard-panel-lead--fallback">
        <div class="dashboard-panel-lead__summary-shell">
          <div class="dashboard-panel-lead__summary">${escapeHtml(model.summaryText)}</div>
        </div>
        ${chipsMarkup ? `<div class="dashboard-panel-lead__chips">${chipsMarkup}</div>` : ""}
      </section>
    `;
    return true;
  }

  function formatCompactMonthYear(monthKey) {
    const safeMonthKey = String(monthKey || "").trim();
    if (!/^\d{4}-\d{2}$/.test(safeMonthKey)) return safeMonthKey;
    const date = new Date(`${safeMonthKey}-01T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return safeMonthKey;
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function formatCountLabel(count, singular, plural = `${singular}s`) {
    const safeCount = toCount(count);
    return `${safeCount} ${safeCount === 1 ? singular : plural}`;
  }

  function buildJiraSearchUrl(jiraBase, jql) {
    const safeJql = String(jql || "").trim();
    if (!safeJql) return "";
    const url = new URL("/issues/", String(jiraBase || "https://nepgroup.atlassian.net").trim());
    url.searchParams.set("jql", safeJql);
    return url.toString();
  }

  function buildIssueItemsSearchUrl(
    issueItems,
    jiraBrowseBase = "https://nepgroup.atlassian.net/browse/"
  ) {
    const jiraRoot = String(jiraBrowseBase || "https://nepgroup.atlassian.net/browse/").replace(
      /\/browse\/?$/,
      ""
    );
    const issueKeys = Array.from(
      new Set(
        (Array.isArray(issueItems) ? issueItems : [])
          .map((item) => String(item?.issueId || item || "").trim())
          .filter(Boolean)
      )
    );
    if (issueKeys.length === 0) return "";
    return buildJiraSearchUrl(
      jiraRoot,
      `issueKey in (${issueKeys.join(",")}) ORDER BY updated DESC`
    );
  }

  function buildBugTeamSearchUrl(teamKey) {
    const jql =
      TEAM_BUG_JQL[
        String(teamKey || "")
          .trim()
          .toLowerCase()
      ];
    if (!jql) return "";
    return buildJiraSearchUrl(
      "https://nepgroup.atlassian.net",
      `${jql} ORDER BY priority DESC, updated DESC`
    );
  }

  function formatSignedWhole(value) {
    const safeValue = Math.round(toNumber(value));
    return safeValue > 0 ? `+${safeValue}` : String(safeValue);
  }

  function sumBugPriorityTotal(teamPoint) {
    return ["highest", "high", "medium", "low", "lowest"].reduce(
      (sum, key) => sum + toCount(teamPoint?.[key]),
      0
    );
  }

  function getBroadcastScopeLabel() {
    const managementFacilitySnapshot = getManagementFacilitySnapshot();
    return String(
      managementFacilitySnapshot?.chartData?.managementBusinessUnit?.scopeLabel || "Broadcast"
    );
  }

  function isPretextLayoutActive() {
    const pretextLayout = getDashboardPretextLayout();
    const locationSearch = getLocationSearch();
    return (
      pretextLayout?.isLayoutEnabled?.(locationSearch) === true ||
      pretextLayout?.isWorkflowEnabled?.(locationSearch) === true
    );
  }

  function setBugTrendsViewVisibility(viewKey) {
    const graphNode = document.getElementById("bug-trends-chart");
    const tableNode = document.getElementById("bug-trends-table");
    if (graphNode) graphNode.hidden = viewKey === "table";
    if (tableNode) tableNode.hidden = viewKey !== "table";
  }

  function buildBugTrendsLeadModel(viewKey, points) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const rankedTeams = Object.entries(latestPoint)
      .filter(([key]) => key !== "date")
      .map(([key, teamPoint]) => ({
        key,
        label: normalizeDisplayTeamName(key),
        total: sumBugPriorityTotal(teamPoint),
        longstanding30: toCount(teamPoint?.longstanding_30d_plus)
      }))
      .filter((team) => team.total > 0)
      .sort((left, right) => {
        if (right.total !== left.total) return right.total - left.total;
        return left.label.localeCompare(right.label);
      });

    const totalOpen = rankedTeams.reduce((sum, team) => sum + team.total, 0);
    const leadTeam = rankedTeams[0] || null;
    const bcLongstanding =
      rankedTeams.find(
        (team) =>
          String(team.key || "")
            .trim()
            .toLowerCase() === "bc"
      )?.longstanding30 || 0;
    const trendWindowSize = Math.min(10, safePoints.length);
    const latestDate = getSnapshotDisplayDate(latestPoint?.date || "");

    return {
      summaryText:
        viewKey === "table"
          ? `${totalOpen} open bugs are currently on the board, with ${leadTeam?.label || "the busiest team"} carrying the heaviest share of backlog pressure.`
          : `The last ${trendWindowSize} sprints end at ${totalOpen} open bugs, with ${leadTeam?.label || "the busiest team"} carrying the heaviest share of backlog pressure.`,
      calloutLabel: "Open bugs",
      calloutValue: String(totalOpen),
      calloutSubtext: leadTeam ? `Largest share: ${leadTeam.label}` : latestDate,
      chips: [
        latestDate ? `Latest: ${latestDate}` : "",
        bcLongstanding > 0 ? `BC 30d+: ${bcLongstanding}` : "",
        viewKey === "table" ? "Table view" : "Trend view"
      ].filter(Boolean),
      accentColor: "rgba(116, 78, 74, 0.22)"
    };
  }

  function buildBugTrendsTableModel(points) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const latestDate = getSnapshotDisplayDate(latestPoint?.date || "");
    const latestMs = new Date(`${latestPoint?.date || ""}T00:00:00Z`).getTime();
    const target30d = Number.isFinite(latestMs) ? latestMs - 30 * 24 * 60 * 60 * 1000 : Number.NaN;
    const comparisonPoint30d =
      safePoints.find((point) => {
        const pointMs = new Date(`${point?.date || ""}T00:00:00Z`).getTime();
        return Number.isFinite(target30d) && Number.isFinite(pointMs) && pointMs >= target30d;
      }) ||
      safePoints[0] ||
      latestPoint;

    const rows = Object.entries(latestPoint)
      .filter(([key]) => key !== "date")
      .map(([key, teamPoint]) => {
        const total = sumBugPriorityTotal(teamPoint);
        const previousTotal = sumBugPriorityTotal(comparisonPoint30d?.[key]);
        const highest = toCount(teamPoint?.highest);
        const high = toCount(teamPoint?.high);
        const highestShare = total > 0 ? Math.round((highest / total) * 100) : 0;
        const highShare = total > 0 ? Math.round((high / total) * 100) : 0;
        const teamLabel = normalizeDisplayTeamName(key);
        return {
          label: teamLabel,
          rowHref: buildBugTeamSearchUrl(key),
          linkAriaLabel: `Open ${teamLabel} Jira bugs in new tab`,
          valueText: String(total),
          width: total,
          color: getPrCycleTeamColor(key),
          metaBits: [
            `${highestShare}% highest`,
            `${highShare}% high`,
            `30d ${formatSignedWhole(total - previousTotal)}`
          ]
        };
      })
      .filter((row) => toCount(row?.valueText) > 0)
      .sort((left, right) => {
        if (toCount(right?.valueText) !== toCount(left?.valueText)) {
          return toCount(right?.valueText) - toCount(left?.valueText);
        }
        return String(left?.label || "").localeCompare(String(right?.label || ""));
      });

    return {
      accentColor: "var(--chart-active)",
      columnStartLabel: "Team",
      columnEndLabel: "Open bugs",
      rows,
      footerBits: [latestDate ? `Latest snapshot ${latestDate}` : ""].filter(Boolean)
    };
  }

  function buildLegacyPrActivityLeadModel(points, metricKey) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const rankedVolume = PR_ACTIVITY_LINE_DEFS.map((lineDef) => ({
      key: lineDef.dataKey,
      label: lineDef.name,
      count: toCount(latestPoint?.[lineDef.dataKey]?.[metricKey])
    }))
      .filter((row) => row.count > 0)
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.label.localeCompare(right.label);
      });
    const slowestMerge = PR_ACTIVITY_LINE_DEFS.map((lineDef) => ({
      label: lineDef.name,
      days: toNumber(latestPoint?.[lineDef.dataKey]?.avgReviewToMergeDays)
    }))
      .filter((row) => row.days > 0)
      .sort((left, right) => {
        if (right.days !== left.days) return right.days - left.days;
        return left.label.localeCompare(right.label);
      })[0];
    const leadTeam = rankedVolume[0] || null;
    if (!leadTeam) return null;

    return {
      summaryText:
        metricKey === "merged"
          ? `${leadTeam.label} merged the most PRs in the latest sprint, while ${slowestMerge?.label || "the slowest team"} is still taking the longest to move from review to merge.`
          : `${leadTeam.label} opened the most PRs in the latest sprint, while ${slowestMerge?.label || "the slowest team"} is still taking the longest to move from review to merge.`,
      calloutLabel: metricKey === "merged" ? "PRs merged" : "PRs opened",
      calloutValue: String(leadTeam.count),
      calloutSubtext: `${leadTeam.label} in the latest sprint`,
      chips: [
        metricKey === "merged" ? "Merged view" : "Opened view",
        slowestMerge ? `Slowest merge: ${slowestMerge.label}` : ""
      ].filter(Boolean),
      accentColor: getPrCycleTeamColor(leadTeam.key)
    };
  }

  function renderBugTrendsPanel() {
    const config = getConfig("trend");
    const viewKey = bugTrendsViewKey(state.bugTrendsView);
    state.bugTrendsView = viewKey;
    syncControlValue("bug-trends-view", viewKey);
    const points = Array.isArray(state.snapshot?.combinedPoints)
      ? state.snapshot.combinedPoints
      : [];
    const trendPoints = points.slice(-10);
    const firstPoint = trendPoints[0] || null;
    const lastPoint = trendPoints[trendPoints.length - 1] || null;
    const firstDisplayDate = getSnapshotDisplayDate(firstPoint?.date || "");
    const lastDisplayDate = getSnapshotDisplayDate(lastPoint?.date || "");
    const latestPoint = points.length > 0 ? points[points.length - 1] : null;
    const latestDisplayDate = getSnapshotDisplayDate(latestPoint?.date || "");
    renderDashboardChartState("trend", getConfig, () => ({
      contextText: isPretextLayoutActive()
        ? ""
        : formatContextWithFreshness(
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
        const pretextLayout = getDashboardPretextLayout();
        const clearChart = getDashboardCharts()?.clearChart;
        const graphContainerId = "bug-trends-chart";
        const tableContainerId = "bug-trends-table";
        const renderUtilityTable =
          viewKey === "table" && isPretextLayoutActive() && Boolean(pretextLayout);
        if (typeof clearChart === "function") clearChart({ containerId: graphContainerId });
        else {
          const graphNode = document.getElementById(graphContainerId);
          if (graphNode) graphNode.innerHTML = "";
        }
        const tableNode = document.getElementById(tableContainerId);
        if (tableNode) tableNode.innerHTML = "";
        if (isPretextLayoutActive()) {
          clearPanelLead(config.panelId);
          clearPanelStats(config.summaryId);
        } else {
          clearPanelStats(config.summaryId);
          renderPanelLead(config.panelId, buildBugTrendsLeadModel(viewKey, points));
        }
        setBugTrendsViewVisibility(renderUtilityTable ? "table" : "graph");
        if (renderUtilityTable) {
          pretextLayout.renderUtilityListPanel?.(
            tableContainerId,
            buildBugTrendsTableModel(points)
          );
          return;
        }
        renderNamedChart(
          { ...config, containerId: graphContainerId },
          {
            containerId: graphContainerId,
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

  function getLegacyPrActivityClosedSprintDate(prActivitySnapshot) {
    const explicitClosedSprintDate = String(
      prActivitySnapshot?.prActivity?.latestClosedSprintDate || ""
    ).trim();
    if (explicitClosedSprintDate) return explicitClosedSprintDate;

    const sprintPoints = Array.isArray(prActivitySnapshot?.prActivity?.points)
      ? prActivitySnapshot.prActivity.points.filter(Boolean)
      : [];
    if (sprintPoints.length < 2) return "";

    const snapshotDate = isoDateOnlyFromTimestamp(prActivitySnapshot?.updatedAt);
    const latestSprintDate = String(sprintPoints[sprintPoints.length - 1]?.date || "").trim();
    if (!snapshotDate || !latestSprintDate || latestSprintDate !== snapshotDate) return "";

    return String(sprintPoints[sprintPoints.length - 2]?.date || "").trim();
  }

  function clampLegacyPrActivityTrendPoints(points, prActivitySnapshot) {
    const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
    const ceilingDate = getLegacyPrActivityClosedSprintDate(prActivitySnapshot);
    if (!ceilingDate) return safePoints;
    const clampedPoints = safePoints.filter(
      (point) => String(point?.date || "").trim() <= ceilingDate
    );
    return clampedPoints.length > 0 ? clampedPoints : safePoints;
  }

  function buildLegacyPrActivityTrendPoints() {
    const prActivitySnapshot = getPrActivitySnapshot();
    const sprintPoints = Array.isArray(prActivitySnapshot?.prActivity?.points)
      ? prActivitySnapshot.prActivity.points
      : [];
    if (sprintPoints.length > 0) {
      return clampLegacyPrActivityTrendPoints(sprintPoints, prActivitySnapshot);
    }
    const monthlyPoints = Array.isArray(prActivitySnapshot?.prActivity?.monthlyPoints)
      ? prActivitySnapshot.prActivity.monthlyPoints
      : [];
    return clampLegacyPrActivityTrendPoints(monthlyPoints, prActivitySnapshot);
  }

  function normalizeDisplayTeamName(name) {
    const raw = String(name || "").trim();
    const key = normalizeProductCycleTeamKey(raw);
    if (key === "api") return "API";
    if (key === "legacy") return "Legacy FE";
    if (key === "react") return "React FE";
    if (key === "bc") return "BC";
    if (key === "workers") return "Workers";
    if (key === "titanium") return "Titanium";
    if (key === PRODUCT_CYCLE_MULTI_TEAM_KEY) return PRODUCT_CYCLE_MULTI_TEAM_LABEL;
    if (key === "frontend") return "Frontend";
    if (key === "broadcast") return "Broadcast";
    if (key === "shift") return "Shift";
    if (
      String(raw || "")
        .trim()
        .toUpperCase() === "UNMAPPED"
    )
      return "Unmapped";
    return raw;
  }

  function formatCompactTeamTabLabel(name) {
    const raw = String(name || "").trim();
    const key = normalizeProductCycleTeamKey(raw);
    if (key === "all") return "All";
    if (key === PRODUCT_CYCLE_MULTI_TEAM_KEY) return "Multi";
    if (key === "frontend") return "FE";
    if (key === "broadcast" || key === "bc") return "BC";
    return normalizeDisplayTeamName(raw);
  }

  function normalizeProductCycleTeamKey(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase();
    if (!raw) return PRODUCT_CYCLE_TEAM_DEFAULT;
    if (raw === "orchestration" || raw === "workers") return "workers";
    if (raw === PRODUCT_CYCLE_MULTI_TEAM_KEY || raw === "multi team" || raw === "multi-team") {
      return PRODUCT_CYCLE_MULTI_TEAM_KEY;
    }
    return raw;
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

  // Compatibility shim for older/stale references from previous naming.
  window.getSharedPrActivityHiddenKeys = getLegacyPrActivityHiddenKeys;
  window.setSharedPrActivityHiddenKeys = setLegacyPrActivityHiddenKeys;

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
        .map(
          (point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        )
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
    const safeRows = Array.isArray(rows)
      ? rows.filter((row) => row && Number.isFinite(row.dateValue) && row.dateValue > 0)
      : [];
    if (safeRows.length === 0) return [];

    const monthTicks = [];
    let currentMonthKey = "";
    let monthStartValue = 0;
    let monthEndValue = 0;

    const flushMonthTick = () => {
      if (!currentMonthKey || monthStartValue <= 0 || monthEndValue <= 0) return;
      monthTicks.push(Math.round((monthStartValue + monthEndValue) / 2));
    };

    for (const row of safeRows) {
      const monthKey = String(row?.date || "").slice(0, 7);
      if (!monthKey) continue;
      if (monthKey !== currentMonthKey) {
        flushMonthTick();
        currentMonthKey = monthKey;
        monthStartValue = row.dateValue;
      }
      monthEndValue = row.dateValue;
    }
    flushMonthTick();

    if (monthTicks.length <= 3) return monthTicks;
    const step = compactViewport ? 3 : 2;
    const ticks = monthTicks.filter(
      (_, index) => index % step === 0 || index === monthTicks.length - 1
    );
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
    const yUpper =
      Number.isFinite(yAxisFixedUpper) && yAxisFixedUpper > 0
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
      const pointDateLabel = formatCompactChartPointDate(point.date);
      setTooltipContent(
        h(
          "div",
          null,
          h("p", null, h("strong", null, point.lineDef.name)),
          h("p", null, pointDateLabel || point.date || ""),
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
            {
              className: "svg-chart-legend",
              role: "group",
              "aria-label": `${tooltipLabel} line toggles`
            },
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
                      x: linearScale(
                        toChartDateValue(marker.date),
                        xMin,
                        xMax,
                        plotLeft,
                        plotRight
                      ),
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
              h(
                "g",
                {
                  key: point.key,
                  onPointerEnter: () => showTooltip(point),
                  onPointerMove: () => showTooltip(point),
                  onPointerLeave: () => setTooltipContent(null)
                },
                h("circle", {
                  cx: point.x,
                  cy: point.y,
                  r: compactViewport ? 3 : 3.5,
                  fill: series.stroke,
                  stroke: "#ffffff",
                  strokeWidth: 1.25,
                  pointerEvents: "none"
                }),
                h(
                  "circle",
                  {
                    cx: point.x,
                    cy: point.y,
                    r: compactViewport ? 11 : 13,
                    fill: "rgba(255, 255, 255, 0.001)",
                    stroke: "transparent",
                    "aria-label": `${point.lineDef.name}: ${formatCompactChartPointDate(point.date) || point.date || ""} ${tooltipValueFormatter(point.value)}`
                  },
                  h(
                    "title",
                    null,
                    `${point.lineDef.name} • ${formatCompactChartPointDate(point.date) || point.date || ""} • ${tooltipValueFormatter(point.value)}`
                  )
                )
              )
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
              )
        )
      )
    );
  }

  function renderLegacyPrActivityCharts() {
    withChart("pr-activity-legacy", getConfig, ({ status, context }) => {
      const config = getConfig("pr-activity-legacy");
      const prActivity = getPrActivitySnapshot()?.prActivity;
      const points = buildLegacyPrActivityTrendPoints();
      if (points.length === 0) {
        clearChartContainer("pr-activity-legacy-count-chart");
        clearChartContainer("pr-activity-legacy-merge-time-chart");
        clearPanelLead(config?.panelId);
        clearPanelStats(config?.summaryId);
        showPanelStatus(status, config?.missingMessage);
        return;
      }

      const compactViewport = isCompactViewport();
      const since = String(points[0]?.date || prActivity?.since || prActivity?.monthlySince || "");
      const metricKey = state.prActivityLegacyMetric === "merged" ? "merged" : "offered";
      syncControlValue("pr-activity-legacy-metric", metricKey);
      setPanelContext(
        context,
        isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              compactViewport
                ? `Sprint Jira-linked PR activity • ${since || points[0]?.date || ""}`
                : `Sprint Jira-linked PR activity since ${since || points[0]?.date || ""}`,
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
      if (isPretextLayoutActive()) {
        clearPanelLead(config?.panelId);
        clearPanelStats(config?.summaryId);
      } else {
        clearPanelStats(config?.summaryId);
        renderPanelLead(config?.panelId, buildLegacyPrActivityLeadModel(points, metricKey));
      }
      renderLegacyChart("pr-activity-legacy-count-chart", offeredRows, {
        yAxisLabel: metricKey === "merged" ? "PRs merged" : "PRs opened",
        tooltipLabel: metricKey === "merged" ? "PRs merged" : "PRs opened",
        tooltipValueFormatter: (value) =>
          `${value} ${metricKey === "merged" ? "PRs merged" : "PRs opened"}`,
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

  const productPanels = createProductPanels({
    state,
    constants: {
      PRODUCT_CYCLE_SCOPE,
      PRODUCT_CYCLE_SCOPE_LABEL,
      PRODUCT_CYCLE_MULTI_TEAM_KEY,
      PRODUCT_CYCLE_MULTI_TEAM_LABEL,
      PRODUCT_CYCLE_TEAM_ORDER,
      ALL_TEAM_SCOPE_KEY,
      ALL_TEAMS_LABEL,
      LIFECYCLE_TEAM_SCOPE_DEFAULT,
      PRODUCT_CYCLE_TEAM_DEFAULT
    },
    accessors: {
      getConfig
    },
    ui: {
      getDashboardPretextLayout,
      isPretextLayoutActive
    },
    helpers: {
      buildTeamColorMap,
      buildTintMap,
      clearChartContainer,
      clearPanelLead,
      clearPanelStats,
      formatCompactMonthYear,
      formatCompactTeamTabLabel,
      formatContextWithFreshness,
      formatCountLabel,
      getPrCycleTeamColor,
      getSnapshotContextTimestamp,
      getThemeColors,
      normalizeDisplayTeamName,
      normalizeProductCycleTeamKey,
      renderDashboardChartState,
      renderPanelLead,
      renderPanelStats,
      syncControlValue,
      toCount,
      toNumber
    },
    chart: {
      renderProductCycleCard
    },
    getDashboardCharts
  });
  const workflowPanels = createWorkflowPanels({
    state,
    constants: {
      ALL_TEAM_SCOPE_KEY,
      THIRTY_DAY_WINDOW_KEY,
      DEVELOPMENT_WORKFLOW_WINDOWS,
      MANAGEMENT_FLOW_SCOPES
    },
    prActivityLineDefs: PR_ACTIVITY_LINE_DEFS,
    accessors: {
      getConfig,
      getManagementFacilitySnapshot,
      getPrActivitySnapshot,
      getPrActivityWindowedPoints
    },
    ui: {
      getDashboardPretextLayout,
      isPretextLayoutActive
    },
    helpers: {
      buildIssueItemsSearchUrl,
      buildRowMarkup,
      clearChartContainer,
      clearPanelLead,
      escapeHtml,
      formatContextWithFreshness,
      getBroadcastScopeLabel,
      getPrCycleTeamColor,
      getSnapshotContextTimestamp,
      getThemeColors,
      normalizeDisplayTeamName,
      normalizeOption,
      renderDashboardChartState,
      renderNamedChart,
      renderPanelLead,
      renderProductCycleCard,
      setPanelContext,
      showPanelStatus,
      syncControlValue,
      syncRadioAvailability,
      toCount,
      toNumber,
      withChart
    },
    chart: {
      isCompactViewport
    }
  });

  CONTROL_BINDINGS = [
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
      onChangeRender: workflowPanels.renderDevelopmentVsUatByFacilityChart
    },
    {
      name: "pr-cycle-team",
      stateKey: "prCycleTeam",
      defaultValue: ALL_TEAM_SCOPE_KEY,
      normalizeValue: (value) =>
        String(value || "")
          .trim()
          .toLowerCase() || ALL_TEAM_SCOPE_KEY,
      onChangeRender: workflowPanels.renderWorkflowBreakdown
    },
    {
      name: "pr-cycle-window",
      stateKey: "developmentWorkflowWindow",
      defaultValue: THIRTY_DAY_WINDOW_KEY,
      normalizeValue: (value) =>
        normalizeOption(value, DEVELOPMENT_WORKFLOW_WINDOWS, THIRTY_DAY_WINDOW_KEY),
      onChangeRender: workflowPanels.renderWorkflowBreakdown
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
      onChangeRender: productPanels.renderLeadAndCycleTimeByTeamChart
    },
    {
      name: "product-cycle-team",
      stateKey: "productCycleTeam",
      defaultValue: PRODUCT_CYCLE_TEAM_DEFAULT,
      normalizeValue: productPanels.productCycleTeamKey,
      onChangeRender: productPanels.renderLeadAndCycleTimeByTeamChart
    }
  ];

  CHART_RENDERERS = {
    trend: renderBugTrendsPanel,
    "management-facility": workflowPanels.renderDevelopmentVsUatByFacilityChart,
    "pr-activity-legacy": renderLegacyPrActivityCharts,
    contributors: workflowPanels.renderTopContributorsChart,
    "product-cycle-shipments": productPanels.renderProductCycleShipmentsTimeline,
    "product-cycle": productPanels.renderLeadAndCycleTimeByTeamChart,
    "workflow-breakdown": workflowPanels.renderWorkflowBreakdown
  };

  function queueRenderableCharts(entries, shouldQueue) {
    entries.forEach(([mode, payload]) => {
      if (!shouldQueue(mode, payload)) return;
      queueChartRender(mode, typeof payload === "function" ? payload : CHART_RENDERERS[mode]);
    });
  }

  function renderVisibleCharts() {
    queueRenderableCharts(
      Object.entries(CHART_RENDERERS),
      (mode) => isChartActive(mode) && isChartReady(mode)
    );
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
    chartRenderFrame = requestAnimationFrame(flushChartRenderQueue);
  }

  function queueChartRender(mode, renderChart) {
    if (!mode || typeof renderChart !== "function") return;
    queuedChartModes.add(mode);
    scheduleChartRenderFlush();
  }

  function scheduleResizeRender() {
    if (resizeRenderFrame !== 0) return;
    resizeRenderFrame = requestAnimationFrame(() => {
      resizeRenderFrame = 0;
      renderVisibleCharts();
    });
  }

  function bindWindowResizeRerender() {
    if (windowResizeBound) return;
    windowResizeBound = true;
    addEventListener("resize", scheduleResizeRender);
    addEventListener("orientationchange", scheduleResizeRender);
  }

  async function loadDataSource(sourceKey) {
    const source = DATA_SOURCE_CONFIG[sourceKey];
    if (!source) return;
    try {
      const preloadedPromise = PRELOADED_DATA_SOURCE_PROMISES[sourceKey];
      const sourceData =
        preloadedPromise && typeof preloadedPromise.then === "function"
          ? await preloadedPromise
          : await fetchJson(source.url);
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
    if (!hasUrlParam("bug-trends-view")) {
      state.bugTrendsView = defaultBugTrendsViewForMode(rawMode);
    }
    renderDashboardRefreshStrip(state);
    renderActionsRequiredFrame();
    applyDashboardPanelOrder();
    applyModeVisibility();
    ensurePanelBackToTopControls();
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
