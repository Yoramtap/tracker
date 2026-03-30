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
      url: "./backlog-snapshot.json",
      errorMessage: "Failed to load backlog-snapshot.json",
      statusIds: ["bug-trends-status"],
      clearContainers: ["bug-trends-chart", "bug-trends-table"]
    },
    prActivity: {
      stateKey: "prActivitySnapshot",
      url: "./pr-activity-snapshot.json",
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
      statusIds: ["workflow-breakdown-status"],
      clearContainers: ["workflow-breakdown-card"]
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
    "workflow-breakdown": ["prCycle"]
  };
  const CHART_RENDERERS = {
    trend: renderBugTrendsPanel,
    "management-facility": renderDevelopmentVsUatByFacilityChart,
    "pr-activity-legacy": renderLegacyPrActivityCharts,
    contributors: renderTopContributorsChart,
    "product-cycle-shipments": renderProductCycleShipmentsTimeline,
    "product-cycle": renderLeadAndCycleTimeByTeamChart,
    "workflow-breakdown": renderWorkflowBreakdown
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
      onChangeRender: renderWorkflowBreakdown
    },
    {
      name: "pr-cycle-window",
      stateKey: "developmentWorkflowWindow",
      defaultValue: THIRTY_DAY_WINDOW_KEY,
      normalizeValue: (value) =>
        normalizeOption(value, DEVELOPMENT_WORKFLOW_WINDOWS, THIRTY_DAY_WINDOW_KEY),
      onChangeRender: renderWorkflowBreakdown
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
  function getDashboardPretextLayout() {
    return window.DashboardPretextLayout || window.DashboardPretextExperiment || null;
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
      formatContextWithFreshness("Oldest panel data", getSnapshotContextTimestamp(state))
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

  function buildIssueItemsSearchUrl(issueItems, jiraBrowseBase = "https://nepgroup.atlassian.net/browse/") {
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
    return buildJiraSearchUrl(jiraRoot, `issueKey in (${issueKeys.join(",")}) ORDER BY updated DESC`);
  }

  function buildBugTeamSearchUrl(teamKey) {
    const jql = TEAM_BUG_JQL[String(teamKey || "").trim().toLowerCase()];
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

  function buildBugTrendsStatsModel(viewKey, points) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const rankedTeams = Object.entries(latestPoint)
      .filter(([key]) => key !== "date")
      .map(([key, teamPoint]) => {
        const total = sumBugPriorityTotal(teamPoint);
        const urgentCount = toCount(teamPoint?.highest) + toCount(teamPoint?.high);
        return {
          key,
          label: normalizeDisplayTeamName(key),
          total,
          urgentShare: total > 0 ? Math.round((urgentCount / total) * 100) : 0,
          longstanding30: toCount(teamPoint?.longstanding_30d_plus)
        };
      })
      .filter((team) => team.total > 0)
      .sort((left, right) => {
        if (right.total !== left.total) return right.total - left.total;
        return left.label.localeCompare(right.label);
      });

    const totalOpen = rankedTeams.reduce((sum, team) => sum + team.total, 0);
    const leadTeam = rankedTeams[0] || null;
    const bcLongstanding =
      rankedTeams.find((team) => String(team.key || "").trim().toLowerCase() === "bc")
        ?.longstanding30 || 0;
    const trendWindowSize = Math.min(10, safePoints.length);

    return {
      accentColor: "var(--chart-active)",
      stats: [
        { label: "Open bugs", value: String(totalOpen) },
        { label: "Sprint window", value: `${trendWindowSize} sprints` }
      ]
    };
  }

  function buildBugTrendsTableModel(points) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const latestDate = getSnapshotDisplayDate(latestPoint?.date || "");
    const latestMs = new Date(`${latestPoint?.date || ""}T00:00:00Z`).getTime();
    const target30d = Number.isFinite(latestMs)
      ? latestMs - 30 * 24 * 60 * 60 * 1000
      : Number.NaN;
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
          ? `${leadTeam.label} merged the most PRs in the latest month, while ${slowestMerge?.label || "the slowest team"} is still taking the longest to move from review to merge.`
          : `${leadTeam.label} opened the most PRs in the latest month, while ${slowestMerge?.label || "the slowest team"} is still taking the longest to move from review to merge.`,
      calloutLabel: metricKey === "merged" ? "PRs merged" : "PRs opened",
      calloutValue: String(leadTeam.count),
      calloutSubtext: `${leadTeam.label} in the latest month`,
      chips: [
        metricKey === "merged" ? "Merged view" : "Opened view",
        slowestMerge ? `Slowest merge: ${slowestMerge.label}` : ""
      ].filter(Boolean),
      accentColor: getPrCycleTeamColor(leadTeam.key)
    };
  }

  function buildLegacyPrActivityStatsModel(points, metricKey) {
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
    const totalVolume = rankedVolume.reduce((sum, row) => sum + row.count, 0);
    const leadTeam = rankedVolume[0] || null;
    const slowestMerge = PR_ACTIVITY_LINE_DEFS.map((lineDef) => ({
      label: lineDef.name,
      days: toNumber(latestPoint?.[lineDef.dataKey]?.avgReviewToMergeDays)
    }))
      .filter((row) => row.days > 0)
      .sort((left, right) => {
        if (right.days !== left.days) return right.days - left.days;
        return left.label.localeCompare(right.label);
      })[0];
    const latestMonth = formatCompactMonthYear(latestPoint?.date || "");

    return {
      accentColor: leadTeam ? getPrCycleTeamColor(leadTeam.key) : "var(--chart-active)",
      stats: [
        { label: "Latest month", value: latestMonth || "Current" },
        {
          label: metricKey === "merged" ? "PRs merged" : "PRs opened",
          value: String(totalVolume)
        },
        { label: "Busiest team", value: leadTeam?.label || "None" },
        {
          label: "Slowest merge",
          value: slowestMerge
            ? `${slowestMerge.label} ${Math.round(Math.max(0, slowestMerge.days))} days`
            : "None"
        }
      ]
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
        const clearChart = window.DashboardCharts?.clearChart;
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
          pretextLayout.renderUtilityListPanel?.(tableContainerId, buildBugTrendsTableModel(points));
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
    if (String(raw || "").trim().toUpperCase() === "UNMAPPED") return "Unmapped";
    return raw;
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

  function buildPrCycleAllTeamsMetric(windowSnapshot, inflowByTeamKey = {}) {
    const teams = Array.isArray(windowSnapshot?.teams) ? windowSnapshot.teams : [];
    const weightedStageDaysByLabel = new Map();
    const teamRows = teams
      .map((team) => {
        const key = String(team?.key || "")
          .trim()
          .toLowerCase();
        const label = String(team?.label || "").trim();
        const issueCount = toCount(team?.issueCount || team?.pullRequestCount);
        const stageDays = Array.isArray(team?.stages)
          ? team.stages.reduce((sum, stage) => sum + toNumber(stage?.days), 0)
          : 0;
        if (Array.isArray(team?.stages) && issueCount > 0) {
          team.stages.forEach((stage) => {
            const stageLabel = getPrCycleStageDisplayLabel(stage);
            weightedStageDaysByLabel.set(
              stageLabel,
              (weightedStageDaysByLabel.get(stageLabel) || 0) + toNumber(stage?.days) * issueCount
            );
          });
        }
        const totalCycleDays = Number(
          (Number.isFinite(toNumber(team?.totalCycleDays))
            ? toNumber(team?.totalCycleDays)
            : stageDays
          ).toFixed(1)
        );
        return {
          key,
          label,
          issueCount,
          avgPrInflow: toNumber(inflowByTeamKey[key]),
          totalCycleDays,
          bottleneckLabel: String(team?.bottleneckLabel || "").trim()
        };
      })
      .filter((team) => team.key && team.label)
      .sort((left, right) => {
        if (left.totalCycleDays !== right.totalCycleDays) {
          return left.totalCycleDays - right.totalCycleDays;
        }
        return left.label.localeCompare(right.label);
      });
    const totalIssueCount = teamRows.reduce((sum, team) => sum + toCount(team?.issueCount), 0);
    const weightedCycleDaysTotal = teamRows.reduce(
      (sum, team) => sum + toNumber(team?.totalCycleDays) * toCount(team?.issueCount),
      0
    );
    const totalCycleDays = Number(
      (totalIssueCount > 0
        ? weightedCycleDaysTotal / totalIssueCount
        : teamRows.reduce((sum, team) => sum + toNumber(team?.totalCycleDays), 0) /
          Math.max(1, teamRows.length)
      ).toFixed(1)
    );
    const avgPrInflow = Number(
      teamRows.reduce((sum, team) => sum + Math.max(0, toNumber(team?.avgPrInflow)), 0).toFixed(1)
    );
    const slowestTeam = teamRows[teamRows.length - 1] || null;
    const fastestTeam = teamRows[0] || null;
    const bottleneckLabel =
      Array.from(weightedStageDaysByLabel.entries()).sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return String(left[0] || "").localeCompare(String(right[0] || ""));
      })[0]?.[0] || "";
    return {
      key: ALL_TEAM_SCOPE_KEY,
      label: "All teams",
      issueCount: totalIssueCount,
      totalCycleDays,
      avgPrInflow,
      bottleneckLabel,
      teamCount: teamRows.length,
      fastestTeamLabel: String(fastestTeam?.label || "").trim(),
      fastestTeamDays: toNumber(fastestTeam?.totalCycleDays),
      slowestTeamLabel: String(slowestTeam?.label || "").trim(),
      slowestTeamDays: toNumber(slowestTeam?.totalCycleDays),
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
            (
              inflowValues.reduce((sum, value) => sum + value, 0) / Math.max(1, inflowValues.length)
            ).toFixed(1)
          )
        ];
      }).filter(Boolean)
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
    const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (safeRows.length <= 3)
      return safeRows.map((row) => row.dateValue).filter((value) => value > 0);
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
                    "aria-label": `${point.lineDef.name}: ${point.date || ""} ${tooltipValueFormatter(point.value)}`
                  },
                  h(
                    "title",
                    null,
                    `${point.lineDef.name} • ${point.date || ""} • ${tooltipValueFormatter(point.value)}`
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
      const points = buildLegacyPrActivityMonthlyPoints();
      if (points.length === 0) {
        clearChartContainer("pr-activity-legacy-count-chart");
        clearChartContainer("pr-activity-legacy-merge-time-chart");
        clearPanelLead(config?.panelId);
        clearPanelStats(config?.summaryId);
        showPanelStatus(status, config?.missingMessage);
        return;
      }

      const compactViewport = isCompactViewport();
      const since = String(points[0]?.date || prActivity?.monthlySince || prActivity?.since || "");
      const metricKey = state.prActivityLegacyMetric === "merged" ? "merged" : "offered";
      syncControlValue("pr-activity-legacy-metric", metricKey);
      setPanelContext(
        context,
        isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
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

  function renderLeadAndCycleTimeByTeamChartFromChartData(
    chartScopeData,
    {
      configKey = "product-cycle",
      teamSwitchContainerId = "product-cycle-team-switch",
      teamControlName = "product-cycle-team",
      teamStateKey = "productCycleTeam",
      onChangeRender = renderLeadAndCycleTimeByTeamChart
    } = {}
  ) {
    if (!chartScopeData || typeof chartScopeData !== "object") return;
    renderDashboardChartState(configKey, getConfig, ({ config }) => {
      const rows = (Array.isArray(chartScopeData.rows) ? chartScopeData.rows.slice() : [])
        .map((row) => ({
          ...row,
          team: normalizeDisplayTeamName(row?.team)
        }))
        .filter(
          (row) => !(String(row?.team || "") === "UNMAPPED" && toCount(row?.meta_cycle?.n) === 0)
        )
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

      const fallbackCycleSampleCount = rows.reduce(
        (sum, row) => sum + toCount(row?.meta_cycle?.n),
        0
      );
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
      const selectedRow =
        rows.find((row) => productCycleTeamKey(row?.team) === selectedTeamKey) || rows[0];
      const selectedSampleCount = toCount(selectedRow?.meta_cycle?.n);

      return buildRadioChartStateResult({
        containerId: teamSwitchContainerId,
        name: teamControlName,
        options: ["all", ...teams.map(productCycleTeamKey)].map((key) => ({
          value: key,
          label:
            key === "all"
              ? ALL_TEAMS_LABEL
              : normalizeDisplayTeamName(
                  teams.find((team) => productCycleTeamKey(team) === key) || key
                )
        })),
        selectedValue: selectedTeamKey,
        stateKey: teamStateKey,
        normalizeValue: productCycleTeamKey,
        onChangeRender,
        state,
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              selectedTeamKey === "all"
                ? fetchedCount > 0
                  ? `${cycleSampleCount} ideas with cycle data from ${fetchedCount} fetched ideas`
                  : `${cycleSampleCount} ideas with cycle data`
                : fetchedCount > 0
                  ? `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${selectedSampleCount} ideas with cycle data from ${fetchedCount} fetched ideas`
                  : `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${selectedSampleCount} ideas with cycle data`,
              getSnapshotContextTimestamp(state),
              "generated"
            ),
        render: () => {
          const pretextLayout = getDashboardPretextLayout();
          clearChartContainer(config.containerId);
          if (selectedTeamKey === "all") {
            if (isPretextLayoutActive() && pretextLayout) {
              const model = buildPretextProductCycleComparisonModel(
                rows,
                scopeLabel,
                cycleSampleCount,
                fetchedCount
              );
              const rendered =
                pretextLayout.renderPretextCard?.(config.containerId, model) ||
                pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
              if (rendered) return;
            }
            window.DashboardCharts?.renderProductCycleComparisonCard?.(
              config.containerId,
              rows,
              scopeLabel
            );
            return;
          }

          if (isPretextLayoutActive() && pretextLayout) {
            const model = buildPretextProductCycleSingleTeamModel(selectedRow, rows, scopeLabel);
            const rendered =
              pretextLayout.renderPretextCard?.(config.containerId, model) ||
              pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
            if (rendered) return;
          }

          window.DashboardCharts?.renderProductCycleSingleTeamCard?.(
            config.containerId,
            selectedRow,
            rows
          );
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
    const rows = (Array.isArray(chartSnapshotData.rows) ? chartSnapshotData.rows : []).map(
      (row) => {
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
      }
    );
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
    const teamDefs = Array.isArray(normalizedChartData?.teamDefs)
      ? normalizedChartData.teamDefs
      : [];
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
    return [
      { key: LIFECYCLE_TEAM_SCOPE_DEFAULT, label: ALL_TEAMS_LABEL, sampleCount: 0 },
      ...options
    ];
  }

  function buildLifecycleFilteredView(normalizedChartData, selectedTeamKey) {
    const rows = Array.isArray(normalizedChartData?.rows) ? normalizedChartData.rows : [];
    const teamDefs = Array.isArray(normalizedChartData?.teamDefs)
      ? normalizedChartData.teamDefs
      : [];
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
        const average =
          totals.sampleCount > 0
            ? Number((totals.weightedValue / totals.sampleCount).toFixed(2))
            : 0;
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
          aggregateRows.map((row) => [
            String(row?.phaseLabel || ""),
            `n=${toCount(row?.meta_slot_0?.n)}`
          ])
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
        filteredRows.map((row) => [
          String(row?.phaseLabel || ""),
          `n=${toCount(row?.meta_slot_0?.n)}`
        ])
      ),
      selectionLabel: normalizeDisplayTeamName(selectedTeamDef.team),
      sampleSize: filteredRows.reduce((sum, row) => sum + toCount(row?.meta_slot_0?.n), 0)
    };
  }

  function buildLifecycleLeadModel(filteredView) {
    const rows = Array.isArray(filteredView?.rows) ? filteredView.rows : [];
    const slowestRow = [...rows].sort((left, right) => {
      if (toNumber(right?.slot_0) !== toNumber(left?.slot_0)) {
        return toNumber(right?.slot_0) - toNumber(left?.slot_0);
      }
      return String(left?.phaseLabel || "").localeCompare(String(right?.phaseLabel || ""));
    })[0];
    if (!slowestRow) return null;
    const selectionLabel = String(filteredView?.selectionLabel || ALL_TEAMS_LABEL).trim();
    const sampleSize = toCount(filteredView?.sampleSize);
    const slowestPhase = String(slowestRow?.phaseLabel || "the longest stage").trim();
    const slowestDays = Math.max(0, Math.round(toNumber(slowestRow?.slot_0)));

    return {
      summaryText: `${selectionLabel} is currently spending the most time in ${slowestPhase}, with ${sampleSize} open ideas still sitting inside the visible workflow stages.`,
      calloutLabel: "Longest stage",
      calloutValue: `${slowestDays} d`,
      calloutSubtext: slowestPhase,
      chips: [selectionLabel, `${sampleSize} open ideas`, `${rows.length} stages`],
      accentColor: "rgba(174, 135, 95, 0.22)"
    };
  }

  function renderLifecycleTimeSpentPerStageChartFromChartData(
    chartSnapshotData,
    {
      configKey = "product-cycle",
      teamSwitchContainerId = "product-cycle-team-switch",
      teamControlName = "product-cycle-team",
      teamStateKey = "productCycleTeam",
      normalizeTeamValue = productCycleTeamKey,
      onChangeRender = renderLeadAndCycleTimeByTeamChart
    } = {}
  ) {
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
        clearPanelLead(config.panelId);
        return { error: "No current lifecycle stage counts found.", clearContainer: true };
      }
      const teams = orderProductCycleTeamsForDisplay(
        filteredView.teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean)
      );
      const rows = Array.isArray(filteredView.rows) ? filteredView.rows : [];
      const teamDefsBase = Array.isArray(filteredView.teamDefs) ? filteredView.teamDefs : [];
      if (teams.length === 0 || teamDefsBase.length === 0) {
        clearPanelLead(config.panelId);
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
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `${filteredView.selectionLabel} • ${sampleSize} open ideas sampled`,
              getSnapshotContextTimestamp(state),
              "generated"
            ),
        render: () => {
          const pretextLayout = getDashboardPretextLayout();
          if (isPretextLayoutActive() && pretextLayout) {
            clearPanelLead(config.panelId);
            const model = buildPretextLifecycleStageModel(filteredView, selectedTeamKey);
            const rendered =
              pretextLayout.renderPretextCard?.(config.containerId, model) ||
              pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
            if (rendered) {
              return {
                clearError: true
              };
            }
          }
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

  function buildShipmentTimelineLeadModel(timelineSnapshot, selectedYear, selectedMonthKey) {
    const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
    const months = monthsByYear.get(selectedYear) || [];
    const selectedMonth =
      months.find((month) => String(month?.monthKey || "").trim() === String(selectedMonthKey || "").trim()) ||
      months[months.length - 1] ||
      null;
    if (!selectedMonth) return null;

    const topTeam = [...(Array.isArray(selectedMonth?.teams) ? selectedMonth.teams : [])].sort(
      (left, right) => {
        if (toCount(right?.shippedCount) !== toCount(left?.shippedCount)) {
          return toCount(right?.shippedCount) - toCount(left?.shippedCount);
        }
        return String(left?.team || "").localeCompare(String(right?.team || ""));
      }
    )[0];
    const monthLabel = formatCompactMonthYear(selectedMonth?.monthKey);

    return {
      summaryText: `${monthLabel} shipped ${toCount(selectedMonth?.totalShipped)} ideas across ${toCount(
        selectedMonth?.teamCount
      )} teams, led by ${normalizeDisplayTeamName(topTeam?.team || "the busiest team")}.`,
      calloutLabel: "Shipped",
      calloutValue: String(toCount(selectedMonth?.totalShipped)),
      calloutSubtext: monthLabel,
      chips: [
        `${toCount(timelineSnapshot?.totalShipped)} shipped total`,
        `${toCount(selectedMonth?.teamCount)} teams this month`,
        topTeam ? `Top team: ${normalizeDisplayTeamName(topTeam.team)}` : ""
      ].filter(Boolean),
      accentColor: "rgba(82, 131, 94, 0.22)"
    };
  }

  function buildShipmentTimelineStatsModel(timelineSnapshot, selectedYear, selectedMonthKey) {
    const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
    const months = monthsByYear.get(selectedYear) || [];
    const selectedMonth =
      months.find(
        (month) => String(month?.monthKey || "").trim() === String(selectedMonthKey || "").trim()
      ) ||
      months[months.length - 1] ||
      null;
    if (!selectedMonth) return null;

    const topTeam = [...(Array.isArray(selectedMonth?.teams) ? selectedMonth.teams : [])].sort(
      (left, right) => {
        if (toCount(right?.shippedCount) !== toCount(left?.shippedCount)) {
          return toCount(right?.shippedCount) - toCount(left?.shippedCount);
        }
        return String(left?.team || "").localeCompare(String(right?.team || ""));
      }
    )[0];
    const monthLabel = formatCompactMonthYear(selectedMonth?.monthKey);
    const yearTotal = months.reduce((sum, month) => sum + toCount(month?.totalShipped), 0);

    return {
      accentColor: "var(--team-react)",
      stats: [
        { label: "Month", value: monthLabel || String(selectedYear || "") },
        { label: "Shipped", value: formatCountLabel(selectedMonth?.totalShipped, "idea") },
        { label: "Top team", value: normalizeDisplayTeamName(topTeam?.team || "None") },
        { label: "Year total", value: formatCountLabel(yearTotal, "idea") }
      ]
    };
  }

  function renderProductCycleShipmentsTimeline() {
    renderDashboardChartState("product-cycle-shipments", getConfig, ({ config }) => {
      const timelineSnapshot = state.productCycleShipments?.chartData?.shippedTimeline;
      const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
      const availableYears = Array.from(monthsByYear.keys()).sort((left, right) =>
        left.localeCompare(right)
      );
      if (availableYears.length === 0) {
        clearPanelLead(config.panelId);
        clearPanelStats(config.summaryId);
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
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `Shipment history • ${toCount(timelineSnapshot?.totalShipped)} shipped total • ${availableYears.join(", ")}`,
              state.productCycleShipments?.generatedAt,
              "generated"
            ),
        render: () => {
          if (isPretextLayoutActive()) {
            clearPanelLead(config.panelId);
            renderPanelStats(
              config.summaryId,
              buildShipmentTimelineStatsModel(timelineSnapshot, selectedYear, selectedMonthKey)
            );
          } else {
            clearPanelStats(config.summaryId);
            renderPanelLead(
              config.panelId,
              buildShipmentTimelineLeadModel(timelineSnapshot, selectedYear, selectedMonthKey)
            );
          }
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

  function formatWorkflowBreakdownMetricMarkup(value, modifierClass = "") {
    return `
    <span class="workflow-breakdown-metric${modifierClass ? ` ${modifierClass}` : ""}">
      <span class="workflow-breakdown-metric__value">${escapeHtml(value)}</span>
    </span>
  `;
  }

  function formatWorkflowBreakdownDurationMetricMarkup(valueInDays) {
    const days = Math.max(0, toNumber(valueInDays));
    const rounded = days.toFixed(1);
    return formatWorkflowBreakdownMetricMarkup(rounded, "workflow-breakdown-metric--days");
  }

  function formatWorkflowBreakdownInflowMetricMarkup(value) {
    const inflow = toNumber(value);
    if (!Number.isFinite(inflow) || inflow <= 0) return "";
    const rounded = String(Math.max(0, Math.round(inflow)));
    return formatWorkflowBreakdownMetricMarkup(rounded, "workflow-breakdown-metric--inflow");
  }

  function formatWorkflowBreakdownValueMarkup(totalCycleDays, avgPrInflow) {
    return `
    <span class="workflow-breakdown-metrics">
      ${formatWorkflowBreakdownDurationMetricMarkup(totalCycleDays)}
      ${formatWorkflowBreakdownInflowMetricMarkup(avgPrInflow)}
    </span>
  `;
  }

  function formatWorkflowBreakdownHeaderMarkup() {
    return `
    <div class="workflow-breakdown-card__header-main">
      <div class="pr-cycle-stage-card__team">All teams</div>
    </div>
  `;
  }

  function isPretextLayoutActive() {
    const pretextLayout = getDashboardPretextLayout();
    return (
      pretextLayout?.isLayoutEnabled?.(window.location.search) === true ||
      pretextLayout?.isWorkflowEnabled?.(window.location.search) === true
    );
  }

  function formatWorkflowDaysText(value) {
    const days = Math.max(0, toNumber(value));
    return `${days.toFixed(1)} ${Math.abs(days - 1) < 0.05 ? "day" : "days"}`;
  }

  function formatCycleMonthsText(valueInDays, { short = false } = {}) {
    const months = Math.max(0, toNumber(valueInDays) / 30.4375);
    const rounded = months === 0 ? "0" : months.toFixed(1);
    const unit = Math.abs(months - 1) < 0.05 ? "month" : "months";
    if (short) return `${rounded} ${unit}`;
    return `${rounded} ${unit}`;
  }

  function getPretextFillWidth(value, upperBound) {
    const safeUpper = Math.max(1, toNumber(upperBound));
    const safeValue = Math.max(0, toNumber(value));
    if (safeValue <= 0) return 0;
    return Math.max(12, Math.round((safeValue / safeUpper) * 100));
  }

  function formatWorkflowWindowPhrase(value) {
    const label = String(value || "this window")
      .trim()
      .toLowerCase();
    if (!label) return "this window";
    if (label.startsWith("last ")) return `the ${label}`;
    return label;
  }

  function normalizeWorkflowBottleneckLabel(value) {
    const raw = String(value || "").trim();
    const normalized = raw.toLowerCase();
    if (normalized === "in progress") return "Progress";
    if (normalized === "in review") return "Review";
    return raw;
  }

  function buildPretextWorkflowBreakdownModel(
    team,
    snapshot,
    footerPrimary,
    footerSecondary,
    inflowSummary
  ) {
    const teamColor = getPrCycleTeamColor(team?.key);
    const stages = Array.isArray(team?.stages) ? team.stages : [];
    const maxDays =
      stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
    const issueCount = toCount(team?.issueCount || team?.pullRequestCount);
    const inflow = toNumber(team?.avgPrInflow);
    const bottleneckLabel = normalizeWorkflowBottleneckLabel(team?.bottleneckLabel);

    return {
      teamKey: String(team?.key || ""),
      teamColor,
      accentColor: teamColor,
      stats: [
        { label: "Cycle time", value: formatWorkflowDaysText(team?.totalCycleDays) },
        { label: "Main blocker", value: bottleneckLabel || "None" },
        { label: "Sample", value: `${issueCount} ${issueCount === 1 ? "issue" : "issues"}` },
        inflow > 0
          ? { label: "PRs / sprint", value: `≈ ${Math.round(inflow)}` }
          : { label: "Window", value: String(snapshot?.windowLabel || "").trim() }
      ],
      columnStartLabel: "Stage",
      columnEndLabel: "Avg time",
      footerBits: [footerSecondary].filter(Boolean),
      rows: stages.map((stage) => ({
        label: getPrCycleStageDisplayLabel(stage),
        metaBits: [
          `${toCount(stage?.sampleCount)} ${toCount(stage?.sampleCount) === 1 ? "issue" : "issues"}`
        ],
        valueText: formatWorkflowDaysText(stage?.days),
        width: Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100)),
        color: teamColor
      }))
    };
  }

  function buildPretextAllTeamsBreakdownModel(team, snapshot, footerPrimary, footerSecondary) {
    const orderedRows = [...(Array.isArray(team?.teamRows) ? team.teamRows : [])].sort(
      (left, right) => {
        if (toNumber(left?.totalCycleDays) !== toNumber(right?.totalCycleDays)) {
          return toNumber(left?.totalCycleDays) - toNumber(right?.totalCycleDays);
        }
        return String(left?.label || "").localeCompare(String(right?.label || ""));
      }
    );
    const maxDays =
      orderedRows.reduce((highest, row) => Math.max(highest, toNumber(row?.totalCycleDays)), 0) ||
      1;
    const inflowSummary =
      toNumber(team?.avgPrInflow) > 0
        ? `≈ ${Math.round(toNumber(team?.avgPrInflow))} PRs per sprint`
        : "";

    return {
      teamKey: ALL_TEAM_SCOPE_KEY,
      teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
      accentColor: "var(--chart-active)",
      stats: [
        { label: "Cycle time", value: formatWorkflowDaysText(team?.totalCycleDays) },
        {
          label: "Main blocker",
          value: normalizeWorkflowBottleneckLabel(team?.bottleneckLabel) || "None"
        },
        { label: "Teams", value: `${toCount(team?.teamCount)} teams` },
        inflowSummary
          ? { label: "PRs / sprint", value: `≈ ${Math.round(toNumber(team?.avgPrInflow))}` }
          : { label: "Sample", value: footerPrimary }
      ],
      columnStartLabel: "Team",
      columnEndLabel: "Avg cycle",
      footerBits: [footerSecondary].filter(Boolean),
      rows: orderedRows.map((row) => {
        const bottleneck = normalizeWorkflowBottleneckLabel(row?.bottleneckLabel);
        const inflow = toNumber(row?.avgPrInflow);
        return {
          label: normalizeDisplayTeamName(row?.label || ""),
          metaBits: [
            `${toCount(row?.issueCount)} ${toCount(row?.issueCount) === 1 ? "issue" : "issues"}`,
            bottleneck ? `${bottleneck} blocker` : "",
            Number.isFinite(inflow) && inflow > 0 ? `≈ ${Math.round(inflow)} PRs / sprint` : ""
          ].filter(Boolean),
          valueText: formatWorkflowDaysText(row?.totalCycleDays),
          width: Math.max(12, Math.round((toNumber(row?.totalCycleDays) / maxDays) * 100)),
          color: getPrCycleTeamColor(row?.key)
        };
      })
    };
  }

  function buildPretextContributorsModel(rows, summary) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length === 0) return null;
    const topContributor = safeRows[0] || null;
    const totalIssues = toCount(summary?.totalIssues);
    const totalContributors = Math.max(toCount(summary?.totalContributors), safeRows.length);
    const maxTotal = Math.max(1, ...safeRows.map((row) => toCount(row?.totalIssues)));

    return {
      teamKey: "contributors",
      teamColor: "var(--team-react)",
      accentColor: "var(--team-react)",
      stats: [
        { label: "Included issues", value: `${totalIssues}` },
        {
          label: "Top contributor",
          value: String(topContributor?.contributor || "").trim() || `${totalContributors} ranked`
        },
        { label: "Active", value: `${toCount(summary?.activeIssues)}` },
        { label: "Done", value: `${toCount(summary?.doneIssues)}` }
      ],
      columnStartLabel: "Contributor",
      columnEndLabel: "Included issues",
      rows: safeRows.map((row) => ({
        label: String(row?.contributor || "").trim(),
        metaBits: [
          `${toCount(row?.doneIssues)} done`,
          toCount(row?.activeIssues) > 0 ? `${toCount(row?.activeIssues)} active` : ""
        ].filter(Boolean),
        valueText: String(toCount(row?.totalIssues)),
        width: getPretextFillWidth(row?.totalIssues, maxTotal),
        color: "var(--team-react)"
      }))
    };
  }

  function buildPretextManagementFacilityModel(scopeLabel, rows, scopeKey = "ongoing") {
    const safeRows = (Array.isArray(rows) ? rows : []).filter((row) => toCount(row?.sampleCount) > 0);
    if (safeRows.length === 0) return null;
    const sampleCount = safeRows.reduce((sum, row) => sum + toCount(row?.sampleCount), 0);
    const weightedUatAverage =
      safeRows.reduce((sum, row) => sum + toNumber(row?.uatAvg) * toCount(row?.sampleCount), 0) /
      Math.max(1, sampleCount);
    const sortedRows = [...safeRows].sort((left, right) => {
      if (toNumber(right?.uatAvg) !== toNumber(left?.uatAvg)) {
        return toNumber(right?.uatAvg) - toNumber(left?.uatAvg);
      }
      return String(left?.label || "").localeCompare(String(right?.label || ""));
    });
    const slowestRow = sortedRows[0] || null;
    const maxUatDays = Math.max(1, ...sortedRows.map((row) => toNumber(row?.uatAvg)));

    return {
      teamKey: "uat",
      teamColor: "var(--chart-active)",
      accentColor: "var(--chart-active)",
      stats: [
        { label: "UAT average", value: formatCycleMonthsText(weightedUatAverage, { short: true }) },
        ...(scopeKey === "done"
          ? []
          : [{ label: "Action needed", value: String(slowestRow?.label || "").trim() || scopeLabel }]),
        { label: "Slowest avg", value: formatCycleMonthsText(slowestRow?.uatAvg, { short: true }) },
        { label: "Sample", value: `${sampleCount} issues` }
      ],
      columnStartLabel: "Business unit",
      columnEndLabel: "Avg time in UAT",
      rows: sortedRows.map((row) => ({
        label: String(row?.label || "").trim(),
        rowHref: buildIssueItemsSearchUrl(row?.issueItems),
        linkAriaLabel: `Open ${String(row?.label || "").trim()} Jira issues in new tab`,
        metaBits: [
          `${toCount(row?.sampleCount)} ${toCount(row?.sampleCount) === 1 ? "issue" : "issues"}`
        ],
        valueText: formatCycleMonthsText(row?.uatAvg, { short: true }),
        width: getPretextFillWidth(row?.uatAvg, maxUatDays),
        color: "var(--chart-active)"
      }))
    };
  }

  function buildPretextLifecycleStageModel(filteredView, selectedTeamKey) {
    const safeRows = Array.isArray(filteredView?.rows) ? filteredView.rows : [];
    if (safeRows.length === 0) return null;
    const sampleSize = toCount(filteredView?.sampleSize);
    const selectionLabel = String(filteredView?.selectionLabel || "All teams").trim();
    const rankedRows = [...safeRows].sort((left, right) => {
      if (toNumber(right?.slot_0) !== toNumber(left?.slot_0)) {
        return toNumber(right?.slot_0) - toNumber(left?.slot_0);
      }
      return String(left?.phaseLabel || "").localeCompare(String(right?.phaseLabel || ""));
    });
    const lifecycleStageOrder = new Map([
      ["parking", 0],
      ["parking lot", 0],
      ["design", 1],
      ["ready", 2],
      ["development", 3],
      ["in development", 3],
      ["feedback", 4],
      ["uat", 4]
    ]);
    const displayRows = [...safeRows].sort((left, right) => {
      const leftRank = lifecycleStageOrder.get(String(left?.phaseLabel || "").trim().toLowerCase());
      const rightRank = lifecycleStageOrder.get(
        String(right?.phaseLabel || "").trim().toLowerCase()
      );
      if (leftRank !== undefined || rightRank !== undefined) {
        return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
      }
      return String(left?.phaseLabel || "").localeCompare(String(right?.phaseLabel || ""));
    });
    const longestRow = rankedRows[0] || null;
    const maxDays = Math.max(1, ...rankedRows.map((row) => toNumber(row?.slot_0)));
    const teamKey =
      lifecycleTeamScopeKey(selectedTeamKey) === LIFECYCLE_TEAM_SCOPE_DEFAULT
        ? ALL_TEAM_SCOPE_KEY
        : lifecycleTeamScopeKey(selectedTeamKey);
    const rowColor =
      teamKey === ALL_TEAM_SCOPE_KEY ? "var(--product-cycle-cycle)" : getPrCycleTeamColor(teamKey);
    const accentColor =
      teamKey === ALL_TEAM_SCOPE_KEY ? "var(--product-cycle-cycle)" : rowColor;

    return {
      teamKey,
      teamColor: rowColor,
      accentColor,
      stats: [
        { label: "Longest hold", value: formatCycleMonthsText(longestRow?.slot_0, { short: true }) },
        {
          label: "Slowest stage",
          value: String(longestRow?.phaseLabel || "").trim() || selectionLabel
        },
        { label: "Sample", value: `${sampleSize} open ideas` },
        { label: "Scope", value: selectionLabel }
      ],
      columnStartLabel: "Stage",
      columnEndLabel: "Avg time",
      footerBits: ["Ideas workflow"].filter(Boolean),
      rows: displayRows.map((row) => ({
        label: String(row?.phaseLabel || "").trim(),
        metaBits: [`${toCount(row?.meta_slot_0?.n)} open ideas`],
        valueText: formatCycleMonthsText(row?.slot_0, { short: true }),
        width: getPretextFillWidth(row?.slot_0, maxDays),
        color: rowColor
      }))
    };
  }

  function buildPretextProductCycleComparisonModel(
    rows,
    scopeLabel,
    cycleSampleCount,
    fetchedCount
  ) {
    const safeRows = (Array.isArray(rows) ? rows : []).filter(
      (row) => toCount(row?.meta_cycle?.n) > 0
    );
    const maxCycleDays =
      safeRows.reduce((highest, row) => Math.max(highest, toNumber(row?.cycle)), 0) || 1;
    const weightedCycleDays =
      safeRows.reduce((sum, row) => sum + toNumber(row?.cycle) * toCount(row?.meta_cycle?.n), 0) /
      Math.max(
        1,
        safeRows.reduce((sum, row) => sum + toCount(row?.meta_cycle?.n), 0)
      );
    const rankedRows = [...safeRows].sort((left, right) => {
      if (toNumber(left?.cycle) !== toNumber(right?.cycle)) {
        return toNumber(left?.cycle) - toNumber(right?.cycle);
      }
      return String(left?.team || "").localeCompare(String(right?.team || ""));
    });
    const fastestRow = rankedRows[0] || null;

    return {
      teamKey: ALL_TEAM_SCOPE_KEY,
      teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
      accentColor: "var(--product-cycle-cycle)",
      stats: [
        { label: "Avg cycle", value: formatCycleMonthsText(weightedCycleDays, { short: true }) },
        {
          label: "Fastest team",
          value: normalizeDisplayTeamName(fastestRow?.team || "") || "N/A"
        },
        { label: "Teams", value: `${rankedRows.length}` },
        { label: "Sample", value: `${toCount(cycleSampleCount)} ideas` }
      ],
      columnStartLabel: "Team",
      columnEndLabel: "Avg cycle",
      footerBits: [
        String(scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL).trim(),
        fetchedCount > 0 ? `${toCount(fetchedCount)} fetched ideas` : ""
      ].filter(Boolean),
      rows: rankedRows
        .map((row) => {
          const doneCount = toCount(row?.cycleDoneCount);
          const ongoingCount = toCount(row?.cycleOngoingCount);
          return {
            label: normalizeDisplayTeamName(row?.team || ""),
            metaBits: [
              `${toCount(row?.meta_cycle?.n)} ideas`,
              doneCount > 0 ? `${doneCount} shipped` : "",
              ongoingCount > 0 ? `${ongoingCount} in development` : ""
            ].filter(Boolean),
            valueText: formatCycleMonthsText(row?.cycle, { short: true }),
            width: Math.max(12, Math.round((toNumber(row?.cycle) / maxCycleDays) * 100)),
            color: getPrCycleTeamColor(row?.team)
          };
        })
    };
  }

  function buildPretextProductCycleSingleTeamModel(row, allRows, scopeLabel) {
    const cycleSample = toCount(row?.meta_cycle?.n);
    const shippedCount = toCount(row?.cycleDoneCount);
    const ongoingCount = toCount(row?.cycleOngoingCount);
    const teamColor = getPrCycleTeamColor(row?.team);
    const maxCycleDays = 5 * 30.4375;
    const maxShipped = Math.max(
      1,
      ...(Array.isArray(allRows) ? allRows : []).map((item) => toCount(item?.cycleDoneCount))
    );
    const maxOngoing = Math.max(
      1,
      ...(Array.isArray(allRows) ? allRows : []).map((item) => toCount(item?.cycleOngoingCount))
    );

    return {
      teamKey: String(row?.team || ""),
      teamColor,
      accentColor: teamColor,
      stats: [
        { label: "Cycle time", value: formatCycleMonthsText(row?.cycle, { short: true }) },
        { label: "Sample", value: `${cycleSample} ideas` },
        { label: "Shipped", value: `${shippedCount}` },
        { label: "Ongoing", value: `${ongoingCount}` }
      ],
      columnStartLabel: "Measure",
      columnEndLabel: "Current",
      footerBits: [String(scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL).trim()].filter(Boolean),
      rows: [
        {
          label: "Cycle time",
          metaBits: [`${cycleSample} ideas`],
          valueText: formatCycleMonthsText(row?.cycle, { short: true }),
          width: getPretextFillWidth(row?.cycle, maxCycleDays),
          color: teamColor
        },
        {
          label: "Shipped",
          metaBits: ["completed ideas"],
          valueText: String(shippedCount),
          width: getPretextFillWidth(shippedCount, maxShipped),
          color: teamColor
        },
        {
          label: "Ongoing",
          metaBits: ["in development"],
          valueText: String(ongoingCount),
          width: getPretextFillWidth(ongoingCount, maxOngoing),
          color: teamColor
        }
      ]
    };
  }

  function formatWorkflowBreakdownColumnHeaderRowMarkup() {
    return `
    <div class="pr-cycle-stage-row workflow-breakdown-column-header" aria-hidden="true">
      <div class="pr-cycle-stage-row__label workflow-breakdown-column-header__placeholder"></div>
      <div class="workflow-breakdown-column-header__spacer"></div>
      <div class="pr-cycle-stage-row__value workflow-breakdown-column-header__value">
        <span class="workflow-breakdown-metrics workflow-breakdown-metrics--headings">
          <span class="workflow-breakdown-metric-heading">Days</span>
          <span class="workflow-breakdown-metric-heading">PR/sprint</span>
        </span>
      </div>
    </div>
  `;
  }

  function renderWorkflowBreakdownCard(containerId, team, snapshot) {
    if (!team) return;
    const compactViewport = isCompactViewport();
    const pretextWorkflowEnabled = isPretextLayoutActive();
    const pretextLayout = getDashboardPretextLayout();
    const isAllTeamsView =
      String(team?.key || "")
        .trim()
        .toLowerCase() === ALL_TEAM_SCOPE_KEY && Array.isArray(team?.teamRows);
    if (isAllTeamsView) {
      const teamRows = Array.isArray(team?.teamRows) ? team.teamRows : [];
      const maxDays =
        teamRows.reduce((highest, row) => Math.max(highest, toNumber(row?.totalCycleDays)), 0) || 1;
      const rowsMarkup = `${formatWorkflowBreakdownColumnHeaderRowMarkup()}${teamRows
        .map((row) => {
          const width = Math.max(12, Math.round((toNumber(row?.totalCycleDays) / maxDays) * 100));
          const sampleCount = toCount(row?.issueCount);
          return buildRowMarkup({
            stage: String(row?.key || ""),
            label: normalizeDisplayTeamName(row?.label || ""),
            sampleMarkup: sampleCount > 0 ? `n = ${sampleCount}` : "n = 0",
            width,
            wrapValueFrame: false,
            valueMarkup: formatWorkflowBreakdownValueMarkup(row?.totalCycleDays, row?.avgPrInflow),
            fillStyle: `background:${escapeHtml(getPrCycleTeamColor(row?.key))}`
          });
        })
        .join("")}`;
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
      if (pretextWorkflowEnabled && pretextLayout) {
        const model = buildPretextAllTeamsBreakdownModel(
          team,
          snapshot,
          footerPrimary,
          footerSecondary
        );
        const rendered =
          pretextLayout.renderPretextCard?.(containerId, model) ||
          pretextLayout.renderWorkflowBreakdownCard?.(containerId, model);
        if (rendered) return;
      }
      renderProductCycleCard(containerId, {
        className: "workflow-breakdown-card",
        teamKey: ALL_TEAM_SCOPE_KEY,
        teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
        headerMarkup: formatWorkflowBreakdownHeaderMarkup(),
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
    const maxDays =
      stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
    const rowsMarkup = stages
      .map((stage) => {
        const width = Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100));
        const sampleCount = toCount(stage?.sampleCount);
        return buildRowMarkup({
          stage: String(stage?.key || ""),
          label: getPrCycleStageDisplayLabel(stage),
          sampleMarkup: sampleCount > 0 ? `n = ${sampleCount}` : "n = 0",
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
    const inflowSummary =
      Number.isFinite(inflow) && inflow > 0 ? `≈ ${Math.round(inflow)} PRs per sprint` : "";
    const footerLabel = compactViewport ? "Blocker" : "Bottleneck";
    if (pretextWorkflowEnabled && pretextLayout) {
      const model = buildPretextWorkflowBreakdownModel(
        team,
        snapshot,
        footerPrimary,
        footerSecondary,
        inflowSummary
      );
      const rendered =
        pretextLayout.renderPretextCard?.(containerId, model) ||
        pretextLayout.renderWorkflowBreakdownCard?.(containerId, model);
      if (rendered) return;
    }
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

  function renderWorkflowBreakdown() {
    withChart("workflow-breakdown", getConfig, ({ status, context, config }) => {
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
            : Object.values(windows || {}).find(
                (windowSnapshot) => windowSnapshot && typeof windowSnapshot === "object"
              ) || null;
      const teams = Array.isArray(selectedWindowSnapshot?.teams)
        ? selectedWindowSnapshot.teams
        : [];
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
      let selectedKey = availableKeys.includes(state.prCycleTeam)
        ? state.prCycleTeam
        : fallbackTeamKey;
      const inflowByTeamKeyFromSnapshot = Object.fromEntries(
        teams
          .map((team) => {
            const teamKey = String(team?.key || "")
              .trim()
              .toLowerCase();
            if (!teamKey || team?.avgPrInflow === null || team?.avgPrInflow === undefined)
              return null;
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
        isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `${selectedTeam?.label || ""} • ${selectedWindowSnapshot?.windowLabel || ""} • ${toCount(selectedTeam?.issueCount)} issues sampled`,
              state.prCycle?.updatedAt
            )
      );
      renderWorkflowBreakdownCard(config.containerId, selectedTeam, selectedWindowSnapshot);
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

  function buildManagementFacilityLeadModel(scopeLabel, rows) {
    const safeRows = (Array.isArray(rows) ? rows : []).filter((row) => toCount(row?.sampleCount) > 0);
    if (safeRows.length === 0) return null;
    const weightedUatAverage =
      safeRows.reduce((sum, row) => sum + toNumber(row?.uatAvg) * toCount(row?.sampleCount), 0) /
      Math.max(1, safeRows.reduce((sum, row) => sum + toCount(row?.sampleCount), 0));
    const slowestRow = [...safeRows].sort((left, right) => {
      if (toNumber(right?.uatAvg) !== toNumber(left?.uatAvg)) {
        return toNumber(right?.uatAvg) - toNumber(left?.uatAvg);
      }
      return String(left?.label || "").localeCompare(String(right?.label || ""));
    })[0];
    const sampleCount = safeRows.reduce((sum, row) => sum + toCount(row?.sampleCount), 0);

    return {
      summaryText: `${scopeLabel} work is averaging ${formatCycleMonthsText(
        weightedUatAverage
      )} in UAT, with ${String(
        slowestRow?.label || "the slowest business unit"
      ).trim()} currently waiting the longest.`,
      calloutLabel: "UAT average",
      calloutValue: formatCycleMonthsText(weightedUatAverage, { short: true }),
      calloutSubtext: slowestRow ? `Slowest: ${String(slowestRow.label || "").trim()}` : scopeLabel,
      chips: [
        scopeLabel,
        `${sampleCount} issues sampled`,
        `${getBroadcastScopeLabel()} scope`
      ],
      accentColor: "rgba(79, 123, 155, 0.22)"
    };
  }

  function renderDevelopmentVsUatByFacilityChart() {
    renderDashboardChartState("management-facility", getConfig, ({ config }) => {
      const scope = normalizeOption(state.managementFlowScope, MANAGEMENT_FLOW_SCOPES, "ongoing");
      const scopeLabel = getManagementFlowScopeLabel(scope);
      const titleNode = document.getElementById("management-facility-title");
      syncControlValue("management-facility-flow-scope", scope);
      const rows = getAlignedBusinessUnitRows(scope);
      if (rows.length === 0) {
        clearPanelLead(config.panelId);
        return {
          error: `No ${scopeLabel.toLowerCase()} Business Unit chart data found in backlog-snapshot.json.`,
          clearContainer: true
        };
      }

      if (titleNode) titleNode.textContent = "User acceptance time by business unit";
      return {
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `${scopeLabel} • ${rows.reduce((sum, row) => sum + row.sampleCount, 0)} issues sampled`,
              getSnapshotContextTimestamp(state, { preferChartData: true }),
              "chart data updated"
            ),
        render: () => {
          const pretextLayout = getDashboardPretextLayout();
          if (isPretextLayoutActive() && pretextLayout) {
            clearPanelLead(config.panelId);
            const model = buildPretextManagementFacilityModel(scopeLabel, rows, scope);
            const rendered =
              pretextLayout.renderManagementAcceptancePanel?.(config.containerId, model) ||
              pretextLayout.renderPretextCard?.(config.containerId, model) ||
              pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
            if (rendered) return;
          } else {
            renderPanelLead(config.panelId, buildManagementFacilityLeadModel(scopeLabel, rows));
          }
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

  function buildContributorsLeadModel(rows, summary) {
    const topRow = (Array.isArray(rows) ? rows : [])[0] || null;
    if (!topRow) return null;
    return {
      summaryText: `${String(topRow?.contributor || "The top contributor").trim()} leads the community queue with ${toCount(
        topRow?.totalIssues
      )} included issues, while the wider contributor set is carrying ${toCount(
        summary?.activeIssues
      )} active issues in total.`,
      calloutLabel: "Top contributor",
      calloutValue: String(toCount(topRow?.totalIssues)),
      calloutSubtext: String(topRow?.contributor || "").trim(),
      chips: [
        `${toCount(summary?.totalContributors)} contributors`,
        `${toCount(summary?.doneIssues)} done`,
        `${toCount(summary?.activeIssues)} active`
      ],
      accentColor: "rgba(98, 153, 140, 0.22)"
    };
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
        clearPanelLead(config.panelId);
        showPanelStatus(status, "No contributor chart data found in contributors-snapshot.json.", {
          containerId: config.containerId
        });
        return;
      }

      const displaySummary = summarizeContributorRows(rows);
      setPanelContext(context, "");
      const pretextLayout = getDashboardPretextLayout();
      if (isPretextLayoutActive() && pretextLayout) {
        clearPanelLead(config.panelId);
        const model = buildPretextContributorsModel(rows, displaySummary);
        const rendered =
          pretextLayout.renderPretextCard?.(config.containerId, model) ||
          pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
        if (rendered) return;
      } else {
        renderPanelLead(config.panelId, buildContributorsLeadModel(rows, displaySummary));
      }
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
