"use strict";

const PRODUCT_CYCLE_SCOPES = ["inception", "since_2026"];
const PRODUCT_CYCLE_SCOPE_LABELS = {
  inception: "All ideas",
  since_2026: "Created in 2026"
};
const MANAGEMENT_FLOW_SCOPES = ["ongoing", "done"];
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
  contributors: {
    panelId: "contributors-panel",
    statusId: "contributors-status",
    contextId: "contributors-context",
    containerId: "top-contributors-chart",
    rendererName: "renderTopContributorsChart",
    missingMessage: "Contributors chart unavailable: Recharts renderer missing."
  },
  "product-cycle": {
    panelId: "product-cycle-panel",
    radioName: "product-cycle-scope",
    statusId: "product-cycle-status",
    contextId: "product-cycle-context",
    containerId: "cycle-time-parking-lot-to-done-chart",
    rendererName: "renderLeadAndCycleTimeByTeamChart",
    missingMessage: "No product cycle aggregates found in product-cycle-snapshot.json."
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
    statusIds: ["trend-status", "composition-status", "management-facility-status"]
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
  }
};
const PRELOADED_DATA_SOURCE_PROMISES =
  window.__dashboardDataSourcePromiseCache || Object.create(null);
const CHART_DATA_SOURCES = {
  trend: ["snapshot"],
  composition: ["snapshot"],
  "management-facility": ["snapshot"],
  contributors: ["contributors"],
  "product-cycle": ["productCycle"],
  "lifecycle-days": ["productCycle"]
};
const CHART_RENDERERS = {
  trend: renderTrendChart,
  composition: renderBugCompositionByPriorityChart,
  "management-facility": renderDevelopmentVsUatByFacilityChart,
  contributors: renderTopContributorsChart,
  "product-cycle": renderLeadAndCycleTimeByTeamChart,
  "lifecycle-days": renderLifecycleTimeSpentPerStageChart
};
const CONTROL_BINDINGS = [
  {
    name: "composition-team-scope",
    stateKey: "compositionTeamScope",
    normalizeValue: (value) => value || "bc",
    onChangeRender: renderBugCompositionByPriorityChart
  },
  {
    name: "management-facility-flow-scope",
    stateKey: "managementFlowScope",
    normalizeValue: (value) => normalizeOption(value, MANAGEMENT_FLOW_SCOPES, "ongoing"),
    onChangeRender: renderDevelopmentVsUatByFacilityChart
  },
  {
    name: "product-cycle-scope",
    stateKey: "productCycleScope",
    normalizeValue: (value) => normalizeOption(value, PRODUCT_CYCLE_SCOPES, "inception"),
    onChangeRender: () => {
      renderLeadAndCycleTimeByTeamChart();
      renderLifecycleTimeSpentPerStageChart();
    }
  }
];

const state = {
  snapshot: null,
  contributors: null,
  productCycle: null,
  loadedSources: {},
  loadErrors: {},
  mode: "all",
  compositionTeamScope: "bc",
  managementFlowScope: "ongoing",
  productCycleScope: "inception"
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
const {
  toNumber,
  formatUpdatedAt,
  getOldestTimestamp,
  setStatusMessage,
  setStatusMessageForIds,
  readThemeColor,
  getThemeColors,
  clearChartContainer,
  getModeFromUrl,
  isEmbedMode
} = dashboardUiUtils;
const { buildTeamColorMap, buildTintMap, orderProductCycleTeams, toCount } = dashboardDataUtils;
const { buildAxisLabel, h, isCompactViewport } = dashboardChartCore;

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
  document.body.classList.toggle("embed-mode", embedMode);
  document.body.classList.toggle("single-chart-mode", embedMode && !showAll);
  document.body.classList.toggle("embedded-frame-mode", embedMode && showAll);
  for (const [mode, config] of Object.entries(CHART_CONFIG)) {
    const panel = document.getElementById(config.panelId);
    if (!panel) continue;
    panel.hidden = showAll ? false : mode !== selectedMode;
  }
}

function setPanelContext(node, text) {
  if (!node) return;
  node.textContent = String(text || "").trim();
}

function setConfigContext(config, text) {
  setPanelContext(document.getElementById(config.contextId), text);
}

function getDashboardRefreshUpdatedAt() {
  return getOldestTimestamp([
    state.snapshot?.updatedAt,
    state.productCycle?.generatedAt,
    state.contributors?.updatedAt
  ]);
}

function renderDashboardRefreshStrip() {
  const panel = document.getElementById("dashboard-refresh-panel");
  const textNode = document.getElementById("dashboard-refresh-text");
  if (!panel || !textNode) return;
  const refreshUpdatedAt = getDashboardRefreshUpdatedAt();
  panel.hidden = refreshUpdatedAt.length === 0;
  textNode.textContent = refreshUpdatedAt
    ? `Last updated ${formatUpdatedAt(refreshUpdatedAt)}`
    : "";
}

function getBroadcastScopeLabel() {
  return String(state.snapshot?.uatAging?.scope?.label || "Broadcast");
}

function getChartNodes(configKey) {
  const config = getConfig(configKey);
  if (!config) return null;
  const status = document.getElementById(config.statusId);
  const context = document.getElementById(config.contextId);
  return status && context ? { config, status, context } : null;
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
  const scope = state.compositionTeamScope || "bc";
  syncRadioValue("composition-team-scope", scope);
  const scopeLabelMap = {
    bc: "BC",
    api: "API",
    legacy: "Legacy",
    react: "React",
    all: "All"
  };
  setConfigContext(
    config,
    `${scopeLabelMap[scope] || "BC"} • last 10 snapshots`
  );
  renderSnapshotChart(config, { scope });
}

function renderTrendChart() {
  const config = getConfig("trend");
  setConfigContext(config, "Open bugs across tracked teams plus BC aging overlays");
  renderSnapshotChart(config);
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

function renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData, scope) {
  const panel = getChartNodes("product-cycle");
  const titleNode = document.getElementById("product-cycle-title");
  if (!panel || !chartScopeData || typeof chartScopeData !== "object") return false;
  const { status, context, config } = panel;
  if (titleNode) titleNode.textContent = "Cycle time by team";

  const rows = (Array.isArray(chartScopeData.rows) ? chartScopeData.rows.slice() : []).sort(
    (left, right) => {
      const leftN = toCount(left?.meta_cycle?.n);
      const rightN = toCount(right?.meta_cycle?.n);
      if (leftN === 0 && rightN > 0) return 1;
      if (rightN === 0 && leftN > 0) return -1;
      const cycleDiff = toNumber(left?.cycle) - toNumber(right?.cycle);
      if (cycleDiff !== 0) return cycleDiff;
      return String(left?.team || "").localeCompare(String(right?.team || ""));
    }
  );
  const teams = orderProductCycleTeams(rows.map((row) => String(row?.team || "")).filter(Boolean));
  if (teams.length === 0) return false;

  const fallbackCycleSampleCount = rows.reduce((sum, row) => sum + toCount(row?.meta_cycle?.n), 0);
  const cycleSampleCount = toCount(chartScopeData.cycleSampleCount) || fallbackCycleSampleCount;
  const sampleCount = Math.max(toCount(chartScopeData.sampleCount), cycleSampleCount);
  const scopeLabel = String(
    chartScopeData.scopeLabel || PRODUCT_CYCLE_SCOPE_LABELS[scope] || "Created in 2026"
  );
  setPanelContext(context, `${scopeLabel} • n=${cycleSampleCount}`);

  if (sampleCount === 0) {
    showPanelStatus(status, `No product-cycle items found for ${scopeLabel.toLowerCase()}.`, {
      containerId: config.containerId
    });
    return true;
  }

  const themeColors = getThemeColors();
  const compactViewport = isCompactViewport();
  const teamColorMap = buildTeamColorMap(teams);
  const cycleTintByTeam = buildTintMap(teamColorMap, 0.02);
  const cycleUpperDays = 5 * 30.4375;
  const valueTicks = [0, 1, 2, 3, 4, 5];
  const valueTickFormatter = (value) => {
    const months = toCount(value);
    if (months <= 0) return "0";
    if (compactViewport) return `${months}m`;
    return months === 1 ? "1 month" : `${months} months`;
  };
  const topAxisLabel = buildAxisLabel(
    compactViewport
      ? "Cycle time"
      : "Cycle time: the average time it takes teams to ship from development to UAT to done.",
    { offset: compactViewport ? 16 : 22 }
  );
  const overlayDots = rows
    .map((row) => {
      const cycleN = toCount(row?.meta_cycle?.n);
      const hasExplicitCycleDoneCount = Object.prototype.hasOwnProperty.call(
        row || {},
        "cycleDoneCount"
      );
      const cycleDoneCount = Math.min(
        cycleN,
        hasExplicitCycleDoneCount
          ? toCount(row?.cycleDoneCount)
          : Math.min(toCount(row?.doneCount), cycleN)
      );
      if (cycleN <= 0) return null;
      return {
        x: toNumber(row?.cycle) / 30.4375,
        y: String(row?.team || ""),
        labelPrefix: compactViewport ? "" : cycleDoneCount > 0 ? "✓" : "",
        accentColor: "rgba(56,161,105,0.95)",
        labelText: compactViewport
          ? String(cycleDoneCount)
          : `${cycleDoneCount} ${cycleDoneCount === 1 ? "idea" : "ideas"} shipped`,
        muted: cycleDoneCount <= 0,
        fontSize: compactViewport ? 10 : 11,
        labelDx: compactViewport ? 6 : 10
      };
    })
    .filter(Boolean);
  const seriesDefs = [
    {
      key: "cycle",
      name: "Cycle time",
      color: readThemeColor("--product-cycle-cycle", "#4e86b9"),
      categoryColors: cycleTintByTeam,
      showValueLabel: false
    }
  ];

  renderNamedChart(
    config,
    {
      containerId: config.containerId,
      rows,
      seriesDefs,
      colors: themeColors,
      yUpperOverride: cycleUpperDays,
      valueTicks,
      valueTickFormatter,
      chartMargin: compactViewport
        ? { top: 14, right: 44, bottom: 56, left: 12 }
        : { top: 14, right: 132, bottom: 72, left: 12 },
      xAxisProps: {
        label: topAxisLabel
      },
      yAxisProps: compactViewport
        ? {
            width: 108,
            tick: {
              fill: themeColors.text,
              fontSize: 11,
              fontWeight: 500
            }
          }
        : null,
      tooltipLayout: "summary_n_average",
      showLegend: false,
      overlayDots,
      gridHorizontal: false,
      timeWindowLabel: "Cycle time",
      orientation: "horizontal",
      colorByCategoryKey: "team",
      categoryKey: "team",
      categoryTickTwoLine: false
    },
    { missingMessage: "Product cycle chart unavailable: Recharts renderer missing." }
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
    rows,
    categorySecondaryLabels
  };
}

function renderLifecycleTimeSpentPerStageChartFromChartData(chartSnapshotData) {
  const panel = getChartNodes("lifecycle-days");
  const normalizedChartData = normalizeCurrentStageChartData(chartSnapshotData);
  if (!panel || !normalizedChartData) return false;
  const { status, context, config } = panel;

  const teams = orderProductCycleTeams(
    Array.isArray(normalizedChartData.teams) ? normalizedChartData.teams.filter(Boolean) : []
  );
  const rows = Array.isArray(normalizedChartData.rows) ? normalizedChartData.rows : [];
  const teamDefsBase = Array.isArray(normalizedChartData.teamDefs)
    ? normalizedChartData.teamDefs
    : [];
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
    normalizedChartData.categorySecondaryLabels &&
    typeof normalizedChartData.categorySecondaryLabels === "object"
      ? normalizedChartData.categorySecondaryLabels
      : Object.fromEntries(rows.map((row) => [String(row.phaseLabel || ""), ""]));
  const fallbackSampleSize = Object.values(categorySecondaryLabels).reduce((sum, value) => {
    const match = /n=(\d+)/.exec(String(value || ""));
    return sum + (match ? toCount(match[1]) : 0);
  }, 0);
  const sampleSize = toCount(normalizedChartData.sampleSize) || fallbackSampleSize;
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
      yUpperOverride: yUpper,
      categoryKey: "phaseLabel",
      categoryAxisHeight: compactViewport ? 60 : 72,
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
  setPanelContext(context, `Current snapshot • n=${sampleSize}`);
  return true;
}

function renderLeadAndCycleTimeByTeamChart() {
  const scope = normalizeOption(state.productCycleScope, PRODUCT_CYCLE_SCOPES, "inception");
  renderPublicAggregateChart("product-cycle", scope, ({ chartData, scope: selectedScope }) => {
    const chartScopeData = chartData?.leadCycleByScope?.[selectedScope];
    if (renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData, selectedScope)) return;
    const config = getConfig("product-cycle");
    if (config) {
      setStatusMessage(
        config.statusId,
        `No product cycle chart data found for ${PRODUCT_CYCLE_SCOPE_LABELS[selectedScope] || selectedScope}.`
      );
      clearChartContainer(config.containerId);
    }
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

function renderDevelopmentVsUatByFacilityChart() {
  renderChartWithState("management-facility", () => {
    const scope = normalizeOption(state.managementFlowScope, MANAGEMENT_FLOW_SCOPES, "ongoing");
    const titleNode = document.getElementById("management-facility-title");
    syncRadioValue("management-facility-flow-scope", scope);
    const businessUnitRows = Array.isArray(
      state.snapshot?.chartData?.managementBusinessUnit?.byScope?.[scope]?.rows
    )
      ? state.snapshot.chartData.managementBusinessUnit.byScope[scope].rows
      : [];
    const rows = businessUnitRows;
    if (rows.length === 0) {
      return { error: `No ${scope} Business Unit chart data found in backlog-snapshot.json.` };
    }

    const doneScope = scope === "done";
    if (titleNode) titleNode.textContent = "Development vs UAT by Business Unit";
    return {
      contextText: `${getBroadcastScopeLabel()} • Business Unit • ${doneScope ? "done" : "ongoing"} • n=${rows.reduce((sum, row) => sum + row.sampleCount, 0)}`,
      props: {
        rows,
        groupingLabel: "Business Unit",
        jiraBrowseBase: "https://nepgroup.atlassian.net/browse/",
        devColor: readThemeColor("--mgmt-dev", "#2f5f83"),
        uatColor: readThemeColor("--mgmt-done-uat", "#82bd95")
      }
    };
  });
}

function renderTopContributorsChart() {
  renderChartWithState("contributors", ({ config: _config }) => {
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
      return {
        error: "No contributor chart data found in contributors-snapshot.json.",
        clearContainer: true
      };
    }

    const summary = contributorsSnapshot?.summary || {};
    return {
      contextText: `${toNumber(summary.total_issues)} total • ${toNumber(summary.done_issues)} done • ${toNumber(summary.active_issues)} not done`,
      props: {
        rows,
        barColor: readThemeColor("--team-react", "#5ba896")
      }
    };
  });
}

function bindDashboardControls() {
  CONTROL_BINDINGS.forEach(({ name, stateKey, normalizeValue, onChangeRender }) => {
    bindRadioState(name, stateKey, normalizeValue, onChangeRender);
  });
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
    renderVisibleCharts();
  } catch (error) {
    state[source.stateKey] = null;
    const message = `${source.errorMessage}: ${error instanceof Error ? error.message : String(error)}`;
    state.loadErrors[sourceKey] = message;
    state.loadedSources[sourceKey] = true;
    setStatusMessageForIds(source.statusIds || [], message);
    (source.clearContainers || []).forEach(clearChartContainer);
    renderDashboardRefreshStrip();
  }
}

async function loadSnapshot() {
  setStatusMessageForIds(CHART_STATUS_IDS);
  state.snapshot = null;
  state.productCycle = null;
  state.contributors = null;
  state.loadedSources = {};
  state.loadErrors = {};
  state.mode = getModeFromUrl();
  renderDashboardRefreshStrip();
  applyModeVisibility();
  initChartVisibility();
  bindDashboardControls();

  try {
    const requiredSourceKeys = getRequiredSourceKeys(state.mode);
    await Promise.allSettled(requiredSourceKeys.map((sourceKey) => loadDataSource(sourceKey)));
    renderDashboardRefreshStrip();
    renderVisibleCharts();
  } catch (error) {
    const message = `Failed to load backlog-snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    setStatusMessageForIds(CHART_STATUS_IDS, message);
    renderDashboardRefreshStrip();
  }
}

loadSnapshot();
