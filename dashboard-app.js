"use strict";

const UAT_PRIORITY_KEYS = ["medium", "high", "highest"];

const PRODUCT_CYCLE_COMPARE_YEARS = ["2025", "2026"];
const MANAGEMENT_FLOW_SCOPES = ["ongoing", "done"];
const MODE_PANEL_IDS = {
  trend: "trend-panel",
  composition: "composition-panel",
  uat: "uat-panel",
  management: "management-panel",
  "management-facility": "management-facility-panel",
  contributors: "contributors-panel",
  "product-cycle": "product-cycle-panel",
  "lifecycle-days": "lifecycle-days-panel"
};
const CHART_STATUS_IDS = ["composition-status", "trend-status", "uat-status", "management-status", "management-facility-status", "contributors-status", "product-cycle-status", "lifecycle-days-status"];
const PUBLIC_AGGREGATE_CHART_CONFIG = {
  productCycle: {
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

const state = {
  snapshot: null,
  contributors: null,
  productCycle: null,
  mode: "all",
  compositionTeamScope: "bc",
  managementFlowScope: "ongoing",
  productCycleYearScope: "2026",
  lifecycleDaysYearScope: "2026"
};

const dashboardUiUtils = window.DashboardViewUtils;
if (!dashboardUiUtils) {
  throw new Error("Dashboard UI helpers not loaded.");
}
const dashboardDataUtils = window.DashboardDataUtils;
if (!dashboardDataUtils) {
  throw new Error("Dashboard data helpers not loaded.");
}
const {
  toNumber,
  formatUpdatedAt,
  setStatusMessage,
  setStatusMessageForIds,
  readThemeColor,
  getThemeColors,
  clearChartContainer,
  getModeFromUrl
} = dashboardUiUtils;
const {
  buildLifecycleRowsByPhaseAndTeam,
  buildProductCycleStackedRowsForYear,
  buildTeamColorMap,
  buildTintMap,
  computeLockedLifecycleYUpper,
  computeLockedProductCycleStackedYUpper,
  getProductCycleTeamsFromAggregates,
  mergePriorityFacilityBreakdown,
  orderProductCycleTeams,
  readDoneCountForTeam,
  readFlowMetricByBands,
  toCount,
  uatBucketWeekLabel
} = dashboardDataUtils;

function normalizeOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function getRenderer(statusId, rendererName, missingMessage) {
  const renderer = window.DashboardCharts?.[rendererName];
  if (renderer) return renderer;
  setStatusMessage(statusId, missingMessage);
  return null;
}

function renderNamedChart({ statusId, rendererName, missingMessage, props }) {
  const renderChart = getRenderer(statusId, rendererName, missingMessage);
  if (!renderChart) return false;
  renderChart(props);
  return true;
}

function renderSnapshotChart({ statusId, rendererName, missingMessage, containerId, extra = {} }) {
  setStatusMessage(statusId);
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  renderNamedChart({
    statusId,
    rendererName,
    missingMessage,
    props: { containerId, snapshot: state.snapshot, colors: getThemeColors(), ...extra }
  });
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

function setContextText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function contextWithUpdated(text, updatedAt) {
  const baseText = String(text || "").trim();
  const updatedText = formatUpdatedAt(updatedAt);
  if (!baseText) return `Updated ${updatedText}`;
  return `${baseText} • updated ${updatedText}`;
}

function getPanelNodes(statusId, contextId = "") {
  const status = document.getElementById(statusId);
  const context = contextId ? document.getElementById(contextId) : null;
  if (!status) return null;
  if (contextId && !context) return null;
  return { status, context };
}

function withPanel(statusId, contextId, onReady, { resetStatus = true } = {}) {
  const panel = getPanelNodes(statusId, contextId);
  if (!panel) return;
  if (resetStatus) resetPanelStatus(panel.status);
  onReady(panel);
}

function resetPanelStatus(status) {
  if (!status) return;
  status.hidden = true;
}

function showPanelStatus(status, message, { containerId = "" } = {}) {
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  if (containerId) clearChartContainer(containerId);
}

function renderBugCompositionByPriorityChart() {
  const scope = state.compositionTeamScope || "bc";
  syncRadioValue("composition-team-scope", scope);
  const compositionContext = document.getElementById("composition-context");
  const scopeLabelMap = {
    bc: "BC",
    api: "API",
    legacy: "Legacy",
    react: "React",
    all: "All"
  };
  setContextText(
    compositionContext,
    contextWithUpdated(
      `${scopeLabelMap[scope] || "BC"} • last 10 snapshots`,
      state.snapshot?.updatedAt
    )
  );
  renderSnapshotChart({
    statusId: "composition-status",
    rendererName: "renderBugCompositionByPriorityChart",
    missingMessage: "Composition chart unavailable: Recharts did not load. Check local script paths.",
    containerId: "bug-composition-chart",
    extra: { scope }
  });
}

function renderUatAgingByPriorityChart() {
  withPanel("uat-status", "uat-context", ({ status, context }) => {
    if (!state.snapshot || !state.snapshot.uatAging) {
      showPanelStatus(status, "No UAT aging data found in backlog-snapshot.json.");
      return;
    }

    const uat = state.snapshot.uatAging;
    const scopeLabel = String(uat?.scope?.label || "Broadcast");
    const buckets = Array.isArray(uat.buckets) ? uat.buckets : [];

    if (buckets.length === 0) {
      showPanelStatus(status, "UAT aging buckets are missing from backlog-snapshot.json.");
      return;
    }

    const groupedByLabel = new Map();
    const facilityByBucketPriority =
      uat?.facility_by_bucket_priority && typeof uat.facility_by_bucket_priority === "object"
        ? uat.facility_by_bucket_priority
        : {};
    for (const bucket of buckets) {
      const label = uatBucketWeekLabel(bucket);
      if (!groupedByLabel.has(label)) {
        groupedByLabel.set(label, {
          bucketId: label,
          bucketLabel: label,
          total: 0,
          medium: 0,
          high: 0,
          highest: 0,
          priorityFacilityCounter: {}
        });
      }
      const row = groupedByLabel.get(label);
      for (const priorityKey of UAT_PRIORITY_KEYS) {
        const value = toNumber(uat?.priorities?.[priorityKey]?.buckets?.[bucket.id]);
        row[priorityKey] += value;
        row.total += value;
      }
      mergePriorityFacilityBreakdown(row.priorityFacilityCounter, facilityByBucketPriority[bucket.id]);
      row.facilityPriorityGroups = row.priorityFacilityCounter;
      row.bucketWithSample = `${row.bucketLabel} (n=${row.total})`;
    }
    const bucketOrder = ["1-2 weeks", "1 month", "2 months", "More than 2 months"];
    const chartRows = bucketOrder
      .map((label) => groupedByLabel.get(label))
      .filter(Boolean);

    if (context) {
      setContextText(
        context,
        contextWithUpdated(
          `${scopeLabel} • n=${toNumber(uat.totalIssues)}`,
          state.snapshot?.updatedAt
        )
      );
    }

    renderNamedChart({
      statusId: "uat-status",
      rendererName: "renderUatPriorityAgingChart",
      missingMessage: "UAT chart unavailable: Recharts renderer missing.",
      props: {
        containerId: "uat-open-by-priority-chart",
        rows: chartRows,
        buckets: chartRows,
        colors: getThemeColors()
      }
    });
  });
}

function renderLeadAndCycleTimeByTeamChartFromPublicAggregates(publicAggregates, yearScope) {
  const panel = getPanelNodes("product-cycle-status", "product-cycle-context");
  const titleNode = document.getElementById("product-cycle-title");
  if (!panel) return;
  const { status, context } = panel;
  if (titleNode) titleNode.textContent = "Lead and cycle time by team";

  const teams = orderProductCycleTeams(
    getProductCycleTeamsFromAggregates(publicAggregates, state.productCycle?.teams)
  );
  if (teams.length === 0) {
    showPanelStatus(status, "No product cycle aggregates found in product-cycle-snapshot.json.");
    return;
  }

  const selectedYear = yearScope;

  const totalsNode = publicAggregates?.cycleTime?.totalsByYear?.[selectedYear]?.all || {};
  const samplesNode = totalsNode?.samples && typeof totalsNode.samples === "object" ? totalsNode.samples : {};
  const leadSampleCount = toCount(
    samplesNode?.full_backlog?.lead ??
      samplesNode?.lead ??
      totalsNode.lead_sample ??
      publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[selectedYear]?.lead_sample ??
      0
  );
  const cycleSampleCount = toCount(
    samplesNode?.full_backlog?.cycle ??
      samplesNode?.cycle ??
      totalsNode.cycle_sample ??
      publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[selectedYear]?.cycle_sample ??
      0
  );
  const sampleCount = Math.max(leadSampleCount, cycleSampleCount);
  const sampleLabel = `${cycleSampleCount}/${leadSampleCount} (cycle/lead)`;

  setContextText(
    context,
    contextWithUpdated(
      `${selectedYear} • n=${sampleLabel}`,
      state.productCycle?.generatedAt || state.snapshot?.updatedAt
    )
  );

  if (sampleCount === 0) {
    showPanelStatus(status, `No completed product-cycle items found for ${selectedYear}.`, {
      containerId: "cycle-time-parking-lot-to-done-chart"
    });
    return;
  }

  const themeColors = getThemeColors();
  const teamColorMap = buildTeamColorMap(teams);
  const leadTintByTeam = buildTintMap(teamColorMap, 0.35);
  const cycleTintByTeam = buildTintMap(teamColorMap, 0.02);
  const rows = buildProductCycleStackedRowsForYear({ publicAggregates, teams, year: selectedYear });
  const rowsWithCounts = rows.map((row) => {
    const leadN = toCount(row?.meta_lead?.n);
    const cycleN = toCount(row?.meta_cycle?.n);
    const rowSampleCount = Math.max(leadN, cycleN);
    const doneCount = readDoneCountForTeam(publicAggregates, selectedYear, row.team);
    return {
      ...row,
      teamWithSampleBase: `${row.team} (n=${rowSampleCount})`,
      sampleCount: rowSampleCount,
      doneCount
    };
  });
  // Keep axis fixed across year toggles, but snap to a clean boundary.
  const rawYUpper = computeLockedProductCycleStackedYUpper(
    publicAggregates,
    teams,
    PRODUCT_CYCLE_COMPARE_YEARS
  );
  const yUpper = Math.max(50, Math.ceil(rawYUpper / 50) * 50);
  const rowsWithSample = rowsWithCounts;
  const categorySecondaryLabels = Object.fromEntries(
    rowsWithSample.map((row) => [String(row.team || ""), `n=${toCount(row.sampleCount)}, done=${toNumber(row.doneCount)}`])
  );
  const seriesDefs = [
    {
      key: "cycle",
      name: "Cycle time",
      color: readThemeColor("--product-cycle-cycle", "#4e86b9"),
      categoryColors: cycleTintByTeam,
      showValueLabel: false
    },
    {
      key: "lead",
      name: "Lead time",
      color: readThemeColor("--product-cycle-lead", "#c58b4e"),
      categoryColors: leadTintByTeam,
      showValueLabel: false
    }
  ];

  renderNamedChart({
    statusId: "product-cycle-status",
    rendererName: "renderLeadAndCycleTimeByTeamChart",
    missingMessage: "Product cycle chart unavailable: Recharts renderer missing.",
    props: {
      containerId: "cycle-time-parking-lot-to-done-chart",
      rows: rowsWithSample,
      seriesDefs,
      colors: themeColors,
      metricLabel: "Average",
      yUpperOverride: yUpper,
      showLegend: true,
      timeWindowLabel: "Lead and cycle time",
      orientation: "columns",
      colorByCategoryKey: "team",
      categoryKey: "team",
      categoryAxisHeight: 72,
      categoryTickTwoLine: true,
      categorySecondaryLabels
    }
  });
}

function withPublicAggregates({ statusId, contextId, containerId, missingMessage, onReady }) {
  withPanel(statusId, contextId, ({ status, context }) => {
    const value = state.productCycle?.publicAggregates;
    const publicAggregates = value && typeof value === "object" ? value : null;
    if (!publicAggregates) {
      showPanelStatus(status, missingMessage, { containerId });
      return;
    }
    onReady({ status, context, publicAggregates });
  });
}

function renderLifecycleTimeSpentPerStageChartFromPublicAggregates(publicAggregates, year) {
  const panel = getPanelNodes("lifecycle-days-status", "lifecycle-days-context");
  if (!panel) return;
  const { status, context } = panel;

  const teams = getProductCycleTeamsFromAggregates(publicAggregates, state.productCycle?.teams);
  if (teams.length === 0) {
    showPanelStatus(status, "No lifecycle aggregates found in product-cycle-snapshot.json.");
    return;
  }

  const yearLabel = year;

  const themeColors = getThemeColors();
  const orderedTeams = orderProductCycleTeams(teams);
  const teamColorMap = buildTeamColorMap(orderedTeams, { ensureUnique: true });
  const lifecycleTintByTeam = buildTintMap(teamColorMap, 0.34);
  const { teamDefs: lifecycleTeamDefsBase, rows } = buildLifecycleRowsByPhaseAndTeam(publicAggregates, year, teams);
  const teamDefs = lifecycleTeamDefsBase.map((teamDef) => ({
    ...teamDef,
    color: themeColors.teams.api,
    showSeriesLabel: false,
    metaTeamColorMap: lifecycleTintByTeam
  }));
  const plottedValues = teamDefs
    .flatMap((teamDef) => rows.map((row) => row[teamDef.key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const categorySecondaryLabels = Object.fromEntries(
    rows.map((row) => [String(row.phaseLabel || ""), ""])
  );
  const lifecycleSampleSize = rows.reduce(
    (sum, row) =>
      sum +
      teamDefs.reduce((inner, def) => inner + toCount(row?.[`meta_${def.key}`]?.n), 0),
    0
  );

  if (plottedValues.length === 0) {
    showPanelStatus(status, `No lifecycle stage time data found for ${yearLabel}.`, {
      containerId: "lifecycle-time-spent-per-phase-chart"
    });
    return;
  }
  const yUpper = computeLockedLifecycleYUpper(publicAggregates, teams, PRODUCT_CYCLE_COMPARE_YEARS);
  renderNamedChart({
    statusId: "lifecycle-days-status",
    rendererName: "renderLifecycleTimeSpentPerStageChart",
    missingMessage: "Lifecycle chart unavailable: Recharts renderer missing.",
    props: {
      containerId: "lifecycle-time-spent-per-phase-chart",
      rows,
      seriesDefs: teamDefs,
      colors: themeColors,
      metricLabel: "Average",
      yUpperOverride: yUpper,
      categoryKey: "phaseLabel",
      categoryAxisHeight: 72,
      categoryTickTwoLine: true,
      categorySecondaryLabels,
      timeWindowLabel: "",
      orientation: "columns",
      showLegend: false
    }
  });
  setContextText(
    context,
    contextWithUpdated(
      `${yearLabel} • n=${lifecycleSampleSize}`,
      state.productCycle?.generatedAt || state.snapshot?.updatedAt
    )
  );
}

function renderLeadAndCycleTimeByTeamChart() {
  const config = PUBLIC_AGGREGATE_CHART_CONFIG.productCycle;
  const yearScope = normalizeOption(state.productCycleYearScope, PRODUCT_CYCLE_COMPARE_YEARS, "2026");

  syncRadioValue("product-cycle-year-scope", yearScope);

  withPublicAggregates({
    statusId: config.statusId,
    contextId: config.contextId,
    containerId: config.containerId,
    missingMessage: config.missingMessage,
    onReady: ({ publicAggregates }) => renderLeadAndCycleTimeByTeamChartFromPublicAggregates(publicAggregates, yearScope)
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
  const config = PUBLIC_AGGREGATE_CHART_CONFIG.lifecycleDays;
  const year = normalizeOption(state.lifecycleDaysYearScope, PRODUCT_CYCLE_COMPARE_YEARS, "2026");
  syncRadioValue(config.yearRadioName, year);
  withPublicAggregates({
    statusId: config.statusId,
    contextId: config.contextId,
    containerId: config.containerId,
    missingMessage: config.missingMessage,
    onReady: ({ publicAggregates }) => renderLifecycleTimeSpentPerStageChartFromPublicAggregates(publicAggregates, year)
  });
}

function renderDevelopmentTimeVsUatTimeChart() {
  withPanel("management-status", "management-context", ({ status, context }) => {
    const scope = "ongoing";
    const flowVariants = state.snapshot?.kpis?.broadcast?.flow_by_priority_variants;
    const scopedFlow = flowVariants && typeof flowVariants === "object" ? flowVariants[scope] : null;
    const flow = scopedFlow || state.snapshot?.kpis?.broadcast?.flow_by_priority;
    if (!flow || typeof flow !== "object") {
      showPanelStatus(status, "No Broadcast flow_by_priority data found in backlog-snapshot.json.");
      return;
    }

    const bands = ["medium", "high", "highest"];
    const labels = ["Medium", "High", "Highest"];
    const devMedian = readFlowMetricByBands(flow, bands, "median_dev_days");
    const uatMedian = readFlowMetricByBands(flow, bands, "median_uat_days");
    const devAvg = readFlowMetricByBands(flow, bands, "avg_dev_days");
    const uatAvg = readFlowMetricByBands(flow, bands, "avg_uat_days");
    const devCounts = bands.map((band) => toNumber(flow?.[band]?.n_dev));
    const uatCounts = bands.map((band) => toNumber(flow?.[band]?.n_uat));
    const rows = labels.map((label, idx) => ({
      label,
      devMedian: toNumber(devMedian[idx]),
      uatMedian: toNumber(uatMedian[idx]),
      devAvg: toNumber(devAvg[idx]),
      uatAvg: toNumber(uatAvg[idx]),
      devCount: devCounts[idx],
      uatCount: uatCounts[idx]
    }));

    const totalFlowTickets = rows.reduce((sum, row) => sum + Math.max(row.devCount, row.uatCount), 0);
    const uat = state.snapshot?.uatAging;
    const uatScopeLabel = String(uat?.scope?.label || "Broadcast");
    setContextText(
      context,
      contextWithUpdated(
        `${uatScopeLabel} • ongoing • n=${totalFlowTickets}`,
        state.snapshot?.updatedAt
      )
    );

    const yValues = [...devMedian, ...uatMedian].filter(Number.isFinite);
    const variantCandidates = [
      flowVariants?.ongoing,
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

    renderNamedChart({
      statusId: "management-status",
      rendererName: "renderDevelopmentTimeVsUatTimeChart",
      missingMessage: "Management chart unavailable: Recharts renderer missing.",
      props: {
        containerId: "development-time-vs-uat-time-chart",
        rows,
        colors: getThemeColors(),
        devColor: readThemeColor("--mgmt-dev", "#2f5f83"),
        uatColor: readThemeColor("--mgmt-uat", "#7fa8c4"),
        yTicks
      }
    });
  });
}

function renderDevelopmentVsUatByFacilityChart() {
  withPanel("management-facility-status", "management-facility-context", ({ status, context }) => {
    const scope = normalizeOption(state.managementFlowScope, MANAGEMENT_FLOW_SCOPES, "ongoing");
    syncRadioValue("management-facility-flow-scope", scope);

    const flowByFacilityVariants = state.snapshot?.kpis?.broadcast?.flow_by_facility_variants;
    const scopedFlowByFacility =
      flowByFacilityVariants && typeof flowByFacilityVariants === "object"
        ? flowByFacilityVariants[scope]
        : null;
    const flowByFacility =
      scopedFlowByFacility ||
      state.snapshot?.kpis?.broadcast?.flow_by_facility ||
      null;
    if (!flowByFacility || typeof flowByFacility !== "object") {
      showPanelStatus(status, "No Broadcast flow_by_facility data found in backlog-snapshot.json.");
      return;
    }

    const rows = Object.entries(flowByFacility)
      .map(([facility, metrics]) => {
        const node = metrics && typeof metrics === "object" ? metrics : {};
        const nDev = toNumber(node.n_dev);
        const nUat = toNumber(node.n_uat);
        const n = toNumber(node.n || Math.max(nDev, nUat));
        return {
          label: String(facility || "Unspecified"),
          devAvg: toNumber(node.avg_dev_days),
          uatAvg: toNumber(node.avg_uat_days),
          devCount: nDev,
          uatCount: nUat,
          sampleCount: n,
          issueIds: Array.isArray(node.issue_ids) ? node.issue_ids : []
        };
      })
      .filter((row) => row.sampleCount > 0)
      .sort((left, right) => {
        const leftIsUnspecified = String(left.label || "").trim().toLowerCase() === "unspecified";
        const rightIsUnspecified = String(right.label || "").trim().toLowerCase() === "unspecified";
        if (leftIsUnspecified && !rightIsUnspecified) return 1;
        if (!leftIsUnspecified && rightIsUnspecified) return -1;
        return left.label.localeCompare(right.label);
      });
    if (rows.length === 0) {
      showPanelStatus(status, `No ${scope} facility rows found in flow_by_facility data.`);
      return;
    }

    const totalFlowTickets = rows.reduce((sum, row) => sum + row.sampleCount, 0);
    const uat = state.snapshot?.uatAging;
    const uatScopeLabel = String(uat?.scope?.label || "Broadcast");
    setContextText(
      context,
      contextWithUpdated(
        `${uatScopeLabel} • ${scope === "done" ? "done" : "ongoing"} • n=${totalFlowTickets}`,
        state.snapshot?.updatedAt
      )
    );

    renderNamedChart({
      statusId: "management-facility-status",
      rendererName: "renderDevelopmentVsUatByFacilityChart",
      missingMessage: "Facility chart unavailable: Recharts renderer missing.",
      props: {
        containerId: "development-vs-uat-by-facility-chart",
        rows,
        colors: getThemeColors(),
        jiraBrowseBase: "https://nepgroup.atlassian.net/browse/",
        devColor:
          scope === "done"
            ? readThemeColor("--mgmt-done-dev", "#2f7d4d")
            : readThemeColor("--mgmt-dev", "#2f5f83"),
        uatColor:
          scope === "done"
            ? readThemeColor("--mgmt-done-uat", "#82bd95")
            : readThemeColor("--mgmt-uat", "#7fa8c4")
      }
    });
  });
}

function renderTopContributorsChart() {
  withPanel("contributors-status", "contributors-context", ({ status, context }) => {
    const contributorsSnapshot = state.contributors;
    const rowsSource = Array.isArray(contributorsSnapshot?.top_contributors)
      ? contributorsSnapshot.top_contributors
      : [];
    if (rowsSource.length === 0) {
      showPanelStatus(status, "No contributor data found in contributors-snapshot.json.", {
        containerId: "top-contributors-chart"
      });
      return;
    }
    const rows = rowsSource
      .filter((row) => String(row?.contributor?.id || "").trim() !== "unassigned")
      .slice(0, 12)
      .map((row) => {
        const statusCounts = row?.status_counts && typeof row.status_counts === "object" ? row.status_counts : {};
        const ticketStateItems = Object.entries(statusCounts)
          .filter(([, count]) => toNumber(count) > 0)
          .sort((left, right) => {
            const leftCount = toNumber(left[1]);
            const rightCount = toNumber(right[1]);
            if (rightCount !== leftCount) return rightCount - leftCount;
            return String(left[0]).localeCompare(String(right[0]));
          })
          .map(([statusName, count]) => `${statusName} = ${toNumber(count)}`);

        return {
          contributor: String(row?.contributor?.name || row?.contributor?.id || "Unknown"),
          activeIssues: toNumber(row?.active_issues),
          doneIssues: toNumber(row?.done_issues),
          totalIssues: toNumber(row?.total_issues),
          notDoneIssues: Math.max(0, toNumber(row?.total_issues) - toNumber(row?.done_issues)),
          ticketStateItems
        };
      })
      .sort((left, right) => {
        if (right.totalIssues !== left.totalIssues) return right.totalIssues - left.totalIssues;
        if (right.activeIssues !== left.activeIssues) return right.activeIssues - left.activeIssues;
        if (right.doneIssues !== left.doneIssues) return right.doneIssues - left.doneIssues;
        return left.contributor.localeCompare(right.contributor);
      });

    if (rows.length === 0) {
      showPanelStatus(status, "No assigned contributor data found after excluding Unassigned.", {
        containerId: "top-contributors-chart"
      });
      return;
    }

    const summary = contributorsSnapshot?.summary || {};
    const total = toNumber(summary.total_issues);
    const notDone = toNumber(summary.active_issues);
    const done = toNumber(summary.done_issues);
    setContextText(
      context,
      contextWithUpdated(
        `${notDone} not done • ${done} done • ${total} total`,
        state.contributors?.updatedAt || state.snapshot?.updatedAt
      )
    );

    renderNamedChart({
      statusId: "contributors-status",
      rendererName: "renderTopContributorsChart",
      missingMessage: "Contributors chart unavailable: Recharts renderer missing.",
      props: {
        containerId: "top-contributors-chart",
        rows,
        colors: getThemeColors(),
        barColor: readThemeColor("--team-react", "#5ba896")
      }
    });
  });
}

async function loadOptionalJson(response, { stateKey, errorMessage, statusIds = [], clearContainers = [] }) {
  if (response.ok) {
    state[stateKey] = await response.json();
    return;
  }

  state[stateKey] = null;
  setStatusMessageForIds(statusIds, `${errorMessage}: HTTP ${response.status}`);
  clearContainers.forEach(clearChartContainer);
}

function bindDashboardControls() {
  [
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
      name: "product-cycle-year-scope",
      stateKey: "productCycleYearScope",
      normalizeValue: (value) => normalizeOption(value, PRODUCT_CYCLE_COMPARE_YEARS, "2026"),
      onChangeRender: renderLeadAndCycleTimeByTeamChart
    },
    {
      name: "lifecycle-days-year-scope",
      stateKey: "lifecycleDaysYearScope",
      normalizeValue: (value) => normalizeOption(value, PRODUCT_CYCLE_COMPARE_YEARS, "2026"),
      onChangeRender: renderLifecycleTimeSpentPerStageChart
    }
  ].forEach(({ name, stateKey, normalizeValue, onChangeRender }) => {
    bindRadioState(name, stateKey, normalizeValue, onChangeRender);
  });
}

function updateDashboardContextLabels() {
  setContextText(
    document.getElementById("trend-context"),
    contextWithUpdated(
      "",
      state.snapshot?.updatedAt
    )
  );
  setContextText(
    document.getElementById("composition-context"),
    contextWithUpdated(
      "BC • 10 snapshots",
      state.snapshot?.updatedAt
    )
  );
}

function renderVisibleCharts() {
  [
    {
      skipMode: "composition",
      run: () =>
        renderSnapshotChart({
          statusId: "trend-status",
          rendererName: "renderBugBacklogTrendByTeamChart",
          missingMessage: "Trend chart unavailable: Recharts did not load. Check local script paths.",
          containerId: "bug-trend-chart"
        })
    },
    { skipMode: "trend", run: renderBugCompositionByPriorityChart },
    { run: renderUatAgingByPriorityChart },
    { run: renderDevelopmentTimeVsUatTimeChart },
    { run: renderDevelopmentVsUatByFacilityChart },
    { run: renderTopContributorsChart },
    { run: renderLeadAndCycleTimeByTeamChart },
    { run: renderLifecycleTimeSpentPerStageChart }
  ].forEach(({ skipMode, run }) => {
    if (!skipMode || state.mode !== skipMode) run();
  });
}

async function loadSnapshot() {
  setStatusMessageForIds(CHART_STATUS_IDS);
  state.mode = getModeFromUrl();
  applyModeVisibility();

  try {
    const [snapshotResponse, productCycleResponse, contributorsResponse] = await Promise.all([
      fetch("./backlog-snapshot.json", { cache: "no-store" }),
      fetch("./product-cycle-snapshot.json", { cache: "no-store" }),
      fetch("./contributors-snapshot.json", { cache: "no-store" })
    ]);
    if (!snapshotResponse.ok) throw new Error(`backlog-snapshot.json HTTP ${snapshotResponse.status}`);
    state.snapshot = await snapshotResponse.json();
    await Promise.all([
      loadOptionalJson(productCycleResponse, {
        stateKey: "productCycle",
        errorMessage: "Failed to load product-cycle-snapshot.json",
        statusIds: ["product-cycle-status", "lifecycle-days-status"]
      }),
      loadOptionalJson(contributorsResponse, {
        stateKey: "contributors",
        errorMessage: "Failed to load contributors-snapshot.json",
        statusIds: ["contributors-status"],
        clearContainers: ["top-contributors-chart"]
      })
    ]);
    bindDashboardControls();
    updateDashboardContextLabels();
    renderVisibleCharts();
  } catch (error) {
    const message = `Failed to load backlog-snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    setStatusMessageForIds(CHART_STATUS_IDS, message);
  }
}

loadSnapshot();
