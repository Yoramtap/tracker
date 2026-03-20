"use strict";

const PRODUCT_CYCLE_SCOPES = ["inception", "since_2026"];
const PRODUCT_CYCLE_SCOPE_LABELS = {
  inception: "All ideas",
  since_2026: "Created in 2026"
};
const PR_CYCLE_WINDOWS = ["90d", "6m", "1y"];
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
  "pr-activity": {
    panelId: "pr-activity-panel",
    statusId: "pr-activity-status",
    contextId: "pr-activity-context",
    containerId: "pr-offered-chart",
    missingMessage: "No Jira-linked PR activity found in backlog-snapshot.json."
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
      "pr-activity-status"
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
    name: "pr-activity-metric",
    stateKey: "prActivityMetric",
    defaultValue: "offered",
    normalizeValue: (value) => (value === "merged" ? "merged" : "offered"),
    onChangeRender: renderPrActivityCharts
  },
  {
    name: "pr-activity-show-markers",
    stateKey: "showPrActivityMarkers",
    defaultValue: true,
    normalizeChecked: (checked) => checked !== false,
    onChangeRender: renderPrActivityCharts,
    controlType: "checkbox"
  },
  {
    name: "pr-cycle-team",
    stateKey: "prCycleTeam",
    defaultValue: "bc",
    normalizeValue: (value) => String(value || "").trim().toLowerCase() || "bc",
    onChangeRender: renderPrCycleExperiment
  },
  {
    name: "pr-cycle-window",
    stateKey: "prCycleWindow",
    defaultValue: "90d",
    normalizeValue: (value) => normalizeOption(value, PR_CYCLE_WINDOWS, "90d"),
    onChangeRender: renderPrCycleExperiment
  },
  {
    name: "product-cycle-scope",
    stateKey: "productCycleScope",
    defaultValue: "inception",
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
  prCycle: null,
  loadedSources: {},
  loadErrors: {},
  mode: "all",
  compositionTeamScope: "bc",
  prActivityMetric: "offered",
  prActivityHiddenKeys: [],
  showPrActivityMarkers: true,
  managementFlowScope: "ongoing",
  prCycleTeam: "bc",
  prCycleWindow: "90d",
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
const {
  React,
  ResponsiveContainer,
  LineChart,
  Line,
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
  tooltipTitleLine,
  trendLayoutForViewport,
  withSafeTooltipProps
} = dashboardChartCore;

const PR_ACTIVITY_LINE_DEFS = [
  { dataKey: "api", name: "API", colorKey: "api" },
  { dataKey: "legacy", name: "Legacy FE", colorKey: "legacy" },
  { dataKey: "react", name: "React FE", colorKey: "react" },
  { dataKey: "bc", name: "BC", colorKey: "bc" },
  { dataKey: "workers", name: "Workers", colorKey: "workers" },
  { dataKey: "titanium", name: "Titanium", colorKey: "titanium" }
];
const PR_ACTIVITY_REFERENCE_MARKERS = [
  {
    date: "2025-04-01",
    label: "NAB"
  },
  {
    date: "2025-09-01",
    label: "IBC"
  },
  {
    date: "2026-01-01",
    label: "Codex"
  }
];
const chartDateTickFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "2-digit",
  timeZone: "UTC"
});

function toChartDateValue(dateText) {
  const timestamp = new Date(`${String(dateText || "")}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatChartDateTick(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return chartDateTickFormatter.format(new Date(value));
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
  setConfigContext(config, `${scopeLabelMap[scope] || "BC"} • last 10 snapshots`);
  renderSnapshotChart(config, { scope });
}

function renderTrendChart() {
  const config = getConfig("trend");
  setConfigContext(config, "Open bugs across tracked teams plus BC aging overlays");
  renderSnapshotChart(config);
}

function setPrActivityNote(text = "") {
  const note = document.getElementById("pr-activity-note");
  if (!note) return;
  const safeText = String(text || "").trim();
  note.hidden = safeText.length === 0;
  note.textContent = safeText;
}

function normalizeDisplayTeamName(name) {
  const raw = String(name || "").trim();
  if (raw.toLowerCase() === "orchestration") return "Workers";
  return raw;
}

function buildPrActivityRows(metricKey = "offered") {
  const points = Array.isArray(state.snapshot?.prActivity?.points)
    ? state.snapshot.prActivity.points
    : [];
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

function buildPrMergeTimeRows() {
  const points = Array.isArray(state.snapshot?.prActivity?.points)
    ? state.snapshot.prActivity.points
    : [];
  return points.map((point) => ({
    date: String(point?.date || ""),
    dateValue: toChartDateValue(point?.date),
    api:
      toNumber(point?.api?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.api?.avgReviewToMergeDays)
        : null,
    legacy:
      toNumber(point?.legacy?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.legacy?.avgReviewToMergeDays)
        : null,
    react:
      toNumber(point?.react?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.react?.avgReviewToMergeDays)
        : null,
    bc:
      toNumber(point?.bc?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.bc?.avgReviewToMergeDays)
        : null,
    workers:
      toNumber(point?.workers?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.workers?.avgReviewToMergeDays)
        : null,
    titanium:
      toNumber(point?.titanium?.avgReviewToMergeSampleCount) > 0
        ? toNumber(point?.titanium?.avgReviewToMergeDays)
        : null
  }));
}

function getPrActivityLineDefs(colors) {
  return PR_ACTIVITY_LINE_DEFS.map((line) => ({
    ...line,
    stroke: colors.teams[line.colorKey]
  }));
}

function getPrActivityYUpper(rows, lineDefs) {
  return rows.reduce((highest, row) => {
    const rowMax = lineDefs.reduce(
      (lineHighest, lineDef) => Math.max(lineHighest, toNumber(row?.[lineDef.dataKey])),
      0
    );
    return Math.max(highest, rowMax);
  }, 0);
}

function getSharedPrCountYUpper() {
  const offeredRows = buildPrActivityRows("offered");
  const mergedRows = buildPrActivityRows("merged");
  const lineDefs = getPrActivityLineDefs(getThemeColors());
  return Math.max(
    getPrActivityYUpper(offeredRows, lineDefs),
    getPrActivityYUpper(mergedRows, lineDefs)
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

function PrActivityChartView({
  rows,
  colors,
  yAxisLabel,
  tooltipLabel,
  tooltipValueFormatter,
  yAxisUpperOverride = 0,
  hiddenKeys,
  setHiddenKeys,
  showLegend = true,
  hideReferenceLabelsOnCompact = false
}) {
  const lineDefs = getPrActivityLineDefs(colors);
  const layout = trendLayoutForViewport(rows.length);
  const chartMargin = {
    ...layout.margin,
    top: Number(layout.margin?.top || 0) + (showLegend ? 28 : 18)
  };
  const compactViewport = isCompactViewport();
  const yUpper = Math.max(yAxisUpperOverride, getPrActivityYUpper(rows, lineDefs));
  const niceYAxis = buildNiceNumberAxis(yUpper);
  const xTicks = rows.map((row) => row.dateValue).filter((value) => value > 0);
  const visibleReferenceMarkers =
    state.showPrActivityMarkers && xTicks.length > 0
      ? PR_ACTIVITY_REFERENCE_MARKERS.filter((marker) => {
          const markerValue = toChartDateValue(marker.date);
          return markerValue >= xTicks[0] && markerValue <= xTicks[xTicks.length - 1];
        })
      : [];

  return h(
    "div",
    { className: "chart-series-shell" },
    showLegend
      ? renderLegendNode({
          colors,
          defs: lineDefs,
          hiddenKeys,
          setHiddenKeys,
          compact: layout.legendCompact
        })
      : null,
    h(
      ResponsiveContainer,
      { width: "100%", height: layout.chartHeight },
      h(
        LineChart,
        {
          data: rows,
          margin: chartMargin
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "dateValue",
          type: "number",
          domain:
            xTicks.length > 0 ? [xTicks[0], xTicks[xTicks.length - 1]] : ["dataMin", "dataMax"],
          ticks: xTicks,
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: layout.xTickFontSize },
          tickMargin: layout.xTickMargin,
          interval: layout.xAxisInterval,
          minTickGap: layout.minTickGap,
          tickFormatter: formatChartDateTick,
          label: buildAxisLabel("Month")
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: layout.yTickFontSize },
          domain: [0, niceYAxis.upper],
          ticks: niceYAxis.ticks,
          allowDecimals: false,
          label: buildAxisLabel(yAxisLabel, { axis: "y", offset: 6 })
        }),
        ...visibleReferenceMarkers.map((marker) =>
          renderPrActivityReferenceLine(
            marker,
            compactViewport,
            !(hideReferenceLabelsOnCompact && compactViewport)
          )
        ),
        h(
          Tooltip,
          withSafeTooltipProps({
            content: createTooltipContent(colors, (row, payload) => [
              tooltipTitleLine("month", formatChartDateTick(row.dateValue), colors),
              tooltipTitleLine("metric", tooltipLabel, colors),
              ...payload.map((item) =>
                makeTooltipLine(
                  item.dataKey,
                  `${item.name}: ${tooltipValueFormatter(toNumber(item.value), item)}`,
                  colors
                )
              )
            ]),
            cursor: { stroke: colors.active, strokeWidth: 1.5, strokeDasharray: "3 3" }
          })
        ),
        lineDefs.map((lineDef) =>
          h(Line, {
            key: lineDef.dataKey,
            type: "monotone",
            dataKey: lineDef.dataKey,
            name: lineDef.name,
            stroke: lineDef.stroke,
            strokeWidth: 2.5,
            dot: {
              r: compactViewport ? 2.75 : 3.25,
              fill: lineDef.stroke,
              stroke: "#ffffff",
              strokeWidth: 1.25
            },
            activeDot: activeLineDot(colors),
            hide: hiddenKeys.has(lineDef.dataKey),
            isAnimationActive: false
          })
        )
      )
    )
  );
}

function renderPrActivityChart(containerId) {
  const metricKey = state.prActivityMetric === "merged" ? "merged" : "offered";
  const rows = buildPrActivityRows(metricKey);
  const colors = getThemeColors();
  const yAxisLabel = metricKey === "merged" ? "Merged PRs" : "PR inflow";
  const tooltipLabel = yAxisLabel;
  const yAxisUpperOverride = getSharedPrCountYUpper();
  const hiddenKeys = getSharedPrActivityHiddenKeys();
  renderWithRoot(containerId, rows.length > 0, (root) => {
    root.render(
      h(PrActivityChartView, {
        rows,
        colors,
        yAxisLabel,
        tooltipLabel,
        tooltipValueFormatter: (value) => `${value} ${tooltipLabel.toLowerCase()}`,
        yAxisUpperOverride,
        hiddenKeys,
        setHiddenKeys: setSharedPrActivityHiddenKeys,
        showLegend: true
      })
    );
  });
}

function renderPrMergeTimeChart(containerId) {
  const rows = buildPrMergeTimeRows();
  const colors = getThemeColors();
  const hiddenKeys = getSharedPrActivityHiddenKeys();
  renderWithRoot(containerId, rows.length > 0, (root) => {
    root.render(
      h(PrActivityChartView, {
        rows,
        colors,
        yAxisLabel: "Avg days to merge",
        tooltipLabel: "Average review-to-merge time",
        tooltipValueFormatter: (value) => {
          const roundedDays = Math.max(0, Math.round(Number(value) || 0));
          return `~${roundedDays} day${roundedDays === 1 ? "" : "s"}`;
        },
        hiddenKeys,
        setHiddenKeys: setSharedPrActivityHiddenKeys,
        showLegend: false,
        hideReferenceLabelsOnCompact: true
      })
    );
  });
}

function renderPrActivityCharts() {
  withChart("pr-activity", ({ status, context }) => {
    const prActivity = state.snapshot?.prActivity;
    const points = Array.isArray(prActivity?.points) ? prActivity.points : [];
    if (points.length === 0) {
      clearChartContainer("pr-offered-chart");
      clearChartContainer("pr-merge-time-chart");
      setPrActivityNote("");
      showPanelStatus(status, "No Jira-linked PR activity found in backlog-snapshot.json.");
      return;
    }

    status.hidden = true;
    const since = String(prActivity?.since || "2025-01-01");
    const caveat = String(prActivity?.caveat || "").trim();
    const metricKey = state.prActivityMetric === "merged" ? "merged" : "offered";
    syncRadioValue("pr-activity-metric", metricKey);
    syncCheckboxValue("pr-activity-show-markers", state.showPrActivityMarkers);
    setPanelContext(
      context,
      metricKey === "merged"
        ? `Monthly deduped Jira-linked merged PRs and review-to-merge time since ${since}`
        : `Monthly deduped Jira-linked PR inflow and review-to-merge time since ${since}`
    );
    setPrActivityNote(caveat);
    renderPrActivityChart("pr-offered-chart");
    renderPrMergeTimeChart("pr-merge-time-chart");
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

function renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData, scope) {
  const chartCore = window.DashboardChartCore;
  const panel = getChartNodes("product-cycle");
  const titleNode = document.getElementById("product-cycle-title");
  if (!panel || !chartCore || !chartScopeData || typeof chartScopeData !== "object") return false;
  const { status, context, config } = panel;
  const { ReferenceLine, h } = chartCore;
  if (titleNode) titleNode.textContent = "Cycle time by team";

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
    chartScopeData.scopeLabel || PRODUCT_CYCLE_SCOPE_LABELS[scope] || "Created in 2026"
  );
  setPanelContext(
    context,
    fetchedCount > 0
      ? `${scopeLabel} with measurable cycle time • n=${cycleSampleCount} of ${fetchedCount} fetched`
      : `${scopeLabel} • n=${cycleSampleCount}`
  );

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
      frontReferenceNodes: [
        h(ReferenceLine, {
          x: 1,
          stroke: "rgba(0, 0, 0, 0.9)",
          strokeDasharray: "7 5",
          strokeWidth: 1.8,
          isFront: true,
          ifOverflow: "extendDomain",
          label: {
            value: "ambition",
            position: "top",
            offset: compactViewport ? 8 : 12,
            fill: "rgba(0, 0, 0, 0.95)",
            fontSize: compactViewport ? 10 : 11,
            fontWeight: 700
          }
        })
      ],
      chartMargin: compactViewport
        ? { top: 36, right: 44, bottom: 56, left: 12 }
        : { top: 42, right: 132, bottom: 72, left: 12 },
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
  const teams = Array.isArray(chartSnapshotData.teams)
    ? chartSnapshotData.teams.map((team) => normalizeDisplayTeamName(team)).filter(Boolean)
    : [];
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
    teams,
    teamDefs,
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
  setPanelContext(
    context,
    fetchedCount > 0
      ? `Current open ideas in tracked stages • n=${sampleSize} of ${fetchedCount} fetched`
      : `Current snapshot • n=${sampleSize}`
  );
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

function syncCheckboxValue(name, checked) {
  const checkbox = document.querySelector(`input[name="${name}"]`);
  if (!checkbox) return;
  checkbox.checked = Boolean(checked);
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

function formatStageDuration(value) {
  return `${toNumber(value).toFixed(1)}d`;
}

function getPrCycleStageDisplayLabel(stage) {
  const key = String(stage?.key || "").trim();
  if (key === "coding") return "Progress";
  if (key === "review") return "Review";
  if (key === "merge") return "QA";
  return String(stage?.label || "").trim();
}

function getPrCycleTeamColor(teamKey) {
  const normalizedKey = String(teamKey || "").trim().toLowerCase();
  const baseMap = buildTeamColorMap([normalizedKey]);
  return baseMap[normalizedKey] || "#4f8fcb";
}

function renderPrCycleExperimentCard(containerId, team, snapshot) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const stages = Array.isArray(team?.stages) ? team.stages : [];
  const teamColor = getPrCycleTeamColor(team?.key);
  const maxDays = stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
  const rowsMarkup = stages
    .map((stage) => {
      const width = Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100));
      const tone = ["amber", "blue", "stone"].includes(String(stage?.tone || ""))
        ? String(stage.tone)
        : "amber";
      const sampleCount = toCount(stage?.sampleCount);
      return `
        <div class="pr-cycle-stage-row" data-stage="${escapeHtml(String(stage?.key || ""))}">
          <div class="pr-cycle-stage-row__label">
            <span class="pr-cycle-stage-row__label-text">${escapeHtml(getPrCycleStageDisplayLabel(stage))}</span>
            <span class="pr-cycle-stage-row__sample">${sampleCount > 0 ? `n=${sampleCount}` : "n=0"}</span>
          </div>
          <div class="pr-cycle-stage-row__track" aria-hidden="true">
            <div class="pr-cycle-stage-row__fill pr-cycle-stage-row__fill--${tone}" style="width:${width}%"></div>
          </div>
          <div class="pr-cycle-stage-row__value">${formatStageDuration(stage?.days)}</div>
        </div>
      `;
    })
    .join("");
  const issueCount = toNumber(team?.issueCount || team?.pullRequestCount);
  const footerPrimary = issueCount > 0 ? `${issueCount} issues sampled` : "No sampled issues";
  const footerSecondary = String(snapshot?.windowLabel || "").trim();

  container.innerHTML = `
    <article class="pr-cycle-stage-card" data-team="${escapeHtml(String(team?.key || ""))}" style="--pr-cycle-accent:${escapeHtml(teamColor)};">
      <div class="pr-cycle-stage-card__header">
        <div class="pr-cycle-stage-card__meta">
          <div class="pr-cycle-stage-card__team">${escapeHtml(team?.label || "")}</div>
          <div class="pr-cycle-stage-card__total">${formatStageDuration(team?.totalCycleDays)}</div>
          <div class="pr-cycle-stage-card__submeta">${escapeHtml(snapshot?.windowLabel || "")}</div>
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
    const windows = state.prCycle?.windows && typeof state.prCycle.windows === "object"
      ? state.prCycle.windows
      : null;
    const availableWindowKeys = Object.keys(windows || {});
    const fallbackWindowKey =
      String(state.prCycle?.defaultWindow || "").trim().toLowerCase() || "90d";
    const selectedWindowKey = availableWindowKeys.includes(state.prCycleWindow)
      ? state.prCycleWindow
      : availableWindowKeys.includes(fallbackWindowKey)
        ? fallbackWindowKey
        : "90d";
    const selectedWindowSnapshot =
      windows?.[selectedWindowKey] && typeof windows[selectedWindowKey] === "object"
        ? windows[selectedWindowKey]
        : state.prCycle;
    const teams = Array.isArray(selectedWindowSnapshot?.teams) ? selectedWindowSnapshot.teams : [];
    if (teams.length === 0) {
      clearChartContainer(config.containerId);
      showPanelStatus(status, config.missingMessage);
      return;
    }

    const availableKeys = teams.map((team) => String(team?.key || "").trim().toLowerCase());
    const fallbackTeamKey =
      String(state.prCycle?.defaultTeam || "").trim().toLowerCase() || availableKeys[0];
    const selectedKey = availableKeys.includes(state.prCycleTeam)
      ? state.prCycleTeam
      : fallbackTeamKey;
    const selectedTeam =
      teams.find((team) => String(team?.key || "").trim().toLowerCase() === selectedKey) || teams[0];

    state.prCycleTeam = selectedKey;
    state.prCycleWindow = selectedWindowKey;
    syncRadioValue("pr-cycle-team", selectedKey);
    syncRadioValue("pr-cycle-window", selectedWindowKey);
    status.hidden = true;
    setPanelContext(
      context,
      `${selectedTeam.label} • ${toNumber(selectedTeam.issueCount || selectedTeam.pullRequestCount)} issues • ${String(selectedWindowSnapshot?.windowLabel || state.prCycle?.windowLabel || "")}`
    );
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
  state.prCycle = null;
  state.loadedSources = {};
  state.loadErrors = {};
  state.mode = getModeFromUrl();
  readDashboardControlStateFromUrl();
  renderDashboardRefreshStrip();
  applyModeVisibility();
  initChartVisibility();
  syncDashboardControlsFromState();
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
