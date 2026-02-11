"use strict";

const TEAM_CONFIG = [
  { key: "api", label: "API" },
  { key: "legacy", label: "Legacy FE" },
  { key: "react", label: "React FE" },
  { key: "bc", label: "BC" },
];

const PRIORITY_CONFIG = [
  { key: "highest", label: "Highest" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "lowest", label: "Lowest" },
];

const PRIORITY_LABELS = PRIORITY_CONFIG.reduce((acc, priority) => {
  acc[priority.key] = priority.label;
  return acc;
}, {});
const PRIORITY_STACK_ORDER = [...PRIORITY_CONFIG].reverse();

const CHART_COLORS = {
  transparent: "rgba(0,0,0,0)",
};

const state = {
  snapshot: null,
  mode: "all",
};

function readThemeColor(name, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function getThemeColors() {
  return {
    text: readThemeColor("--text", "#172b4d"),
    grid: readThemeColor("--chart-grid", "rgba(9,30,66,0.14)"),
    active: readThemeColor("--chart-active", "#0c66e4"),
    teams: {
      api: readThemeColor("--team-api", "#2f6ea8"),
      legacy: readThemeColor("--team-legacy", "#8d6f3f"),
      react: readThemeColor("--team-react", "#3f7f75"),
      bc: readThemeColor("--team-bc", "#76649a"),
    },
    priorities: {
      highest: readThemeColor("--priority-highest", "#9f4d44"),
      high: readThemeColor("--priority-high", "#b48238"),
      medium: readThemeColor("--priority-medium", "#6f778d"),
      low: readThemeColor("--priority-low", "#3f73b8"),
      lowest: readThemeColor("--priority-lowest", "#2f7a67"),
    },
    uatBuckets: {
      d0_7: readThemeColor("--uat-bucket-0-7", "#a8c6de"),
      d8_14: readThemeColor("--uat-bucket-8-14", "#87aecd"),
      d15_30: readThemeColor("--uat-bucket-15-30", "#5f8fb7"),
      d31_60: readThemeColor("--uat-bucket-31-60", "#3f6f99"),
      d61_plus: readThemeColor("--uat-bucket-61-plus", "#2a4f73"),
    },
    tooltip: {
      bg: readThemeColor("--tooltip-bg", "rgba(255,255,255,0.98)"),
      border: readThemeColor("--tooltip-border", "rgba(31,51,71,0.25)"),
      text: readThemeColor("--tooltip-text", "#1f3347"),
    },
    barBorder: readThemeColor("--bar-border", "rgba(25,39,58,0.35)"),
  };
}

function buildBaseLayout(colors) {
  return {
    paper_bgcolor: CHART_COLORS.transparent,
    plot_bgcolor: CHART_COLORS.transparent,
    font: { color: colors.text },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "left",
      x: 0,
      font: { color: colors.text },
    },
    modebar: {
      bgcolor: CHART_COLORS.transparent,
      color: colors.text,
      activecolor: colors.active,
    },
    hoverlabel: {
      bgcolor: colors.tooltip.bg,
      bordercolor: colors.tooltip.border,
      font: { color: colors.tooltip.text, size: 12 },
      namelength: -1,
    },
  };
}

function getModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const chart = (params.get("chart") || "").toLowerCase();
  if (chart === "trend") return "trend";
  if (chart === "composition") return "composition";
  if (chart === "uat") return "uat";
  return "all";
}

function applyModeVisibility() {
  const trendPanel = document.getElementById("trend-panel");
  const compositionPanel = document.getElementById("composition-panel");
  const uatPanel = document.getElementById("uat-panel");
  if (!trendPanel || !compositionPanel || !uatPanel) return;

  if (state.mode === "trend") {
    trendPanel.hidden = false;
    compositionPanel.hidden = true;
    uatPanel.hidden = true;
    return;
  }

  if (state.mode === "composition") {
    trendPanel.hidden = true;
    compositionPanel.hidden = false;
    uatPanel.hidden = true;
    return;
  }

  if (state.mode === "uat") {
    trendPanel.hidden = true;
    compositionPanel.hidden = true;
    uatPanel.hidden = false;
    return;
  }

  trendPanel.hidden = false;
  compositionPanel.hidden = false;
  uatPanel.hidden = false;
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function totalForPoint(point) {
  return (
    toNumber(point.highest) +
    toNumber(point.high) +
    toNumber(point.medium) +
    toNumber(point.low) +
    toNumber(point.lowest)
  );
}

function breakdownText(point) {
  return PRIORITY_CONFIG.map((priority) => {
    const value = toNumber(point[priority.key]);
    return `${PRIORITY_LABELS[priority.key]}: ${value}`;
  }).join("<br>");
}

function formatDateShort(date) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${month}/${day}`;
}

function renderLineChart() {
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  const themeColors = getThemeColors();

  const x = state.snapshot.combinedPoints.map((point) => point.date);
  const traces = TEAM_CONFIG.map((team) => {
    const y = state.snapshot.combinedPoints.map((point) => totalForPoint(point[team.key]));
    const customData = state.snapshot.combinedPoints.map((point) =>
      breakdownText(point[team.key])
    );
    return {
      type: "scatter",
      mode: "lines+markers",
      name: team.label,
      x,
      y,
      customdata: customData,
      hovertemplate:
        "<b>%{fullData.name}</b><br>Date: %{x}<br>Total: %{y}<br>%{customdata}<extra></extra>",
      line: { color: themeColors.teams[team.key], width: 3 },
      marker: { size: 7 },
    };
  });

  const layout = {
    ...buildBaseLayout(themeColors),
    uirevision: "backlog-line",
    margin: { t: 18, r: 20, b: 42, l: 56 },
    xaxis: {
      title: "Date",
      tickangle: -30,
      color: themeColors.text,
      gridcolor: themeColors.grid,
      automargin: true,
    },
    yaxis: {
      title: "Open Bugs",
      rangemode: "tozero",
      color: themeColors.text,
      gridcolor: themeColors.grid,
      automargin: true,
    },
  };

  Plotly.react("chart", traces, layout, {
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
  });
}

function renderStackedBarChart() {
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  const themeColors = getThemeColors();

  const root = document.getElementById("stacked-chart");
  if (!root) return;

  const points = state.snapshot.combinedPoints;
  const flat = [];
  points.forEach((point) => {
    TEAM_CONFIG.forEach((team) => {
      const teamPoint = point[team.key];
      flat.push({
        date: point.date,
        dateShort: formatDateShort(point.date),
        team: team.label,
        total: totalForPoint(teamPoint),
        highest: toNumber(teamPoint.highest),
        high: toNumber(teamPoint.high),
        medium: toNumber(teamPoint.medium),
        low: toNumber(teamPoint.low),
        lowest: toNumber(teamPoint.lowest),
      });
    });
  });

  const x = [flat.map((item) => item.dateShort), flat.map((item) => item.team)];
  const traces = PRIORITY_STACK_ORDER.map((priority) => ({
    type: "bar",
    name: priority.label,
    marker: {
      color: themeColors.priorities[priority.key],
      line: { color: themeColors.barBorder, width: 0.7 },
    },
    x,
    y: flat.map((item) => item[priority.key]),
    customdata: flat.map((item) => [item.date, item.team, item.total]),
    hovertemplate:
      "<b>%{customdata[1]}</b><br>Date: %{customdata[0]}<br>" +
      `${priority.label}: %{y}<br>Total: %{customdata[2]}<extra></extra>`,
  }));

  const layout = {
    ...buildBaseLayout(themeColors),
    barmode: "stack",
    uirevision: "backlog-stack",
    margin: { t: 18, r: 16, b: 86, l: 56 },
    bargap: 0.36,
    xaxis: {
      type: "multicategory",
      tickangle: -90,
      tickfont: { size: 9 },
      color: themeColors.text,
      showgrid: false,
      automargin: true,
    },
    yaxis: {
      title: "Open Bugs",
      rangemode: "tozero",
      color: themeColors.text,
      gridcolor: themeColors.grid,
      automargin: true,
    },
  };

  Plotly.react("stacked-chart", traces, layout, {
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
  });
}

function renderUatAgingChart() {
  const status = document.getElementById("uat-status");
  const root = document.getElementById("uat-chart");
  const title = document.querySelector("#uat-panel h2");
  const baseTitle = "Interactive chart - UAT aging by priority";
  if (title) title.textContent = baseTitle;
  if (!status || !root) return;

  status.hidden = true;
  if (!state.snapshot || !state.snapshot.uatAging) {
    status.hidden = false;
    status.textContent = "No UAT aging data found in snapshot.json.";
    return;
  }

  const themeColors = getThemeColors();
  const uat = state.snapshot.uatAging;
  const scopeLabel = String(uat?.scope?.label || "All labels");
  if (title) title.textContent = `${baseTitle} (${scopeLabel}, ${toNumber(uat.totalIssues)} total tickets)`;
  const priorities = PRIORITY_STACK_ORDER.map((priority) => priority.key);
  const priorityLabels = PRIORITY_CONFIG.reduce((acc, priority) => {
    acc[priority.key] = priority.label;
    return acc;
  }, {});
  const buckets = Array.isArray(uat.buckets) ? uat.buckets : [];
  const bucketLabels = buckets.map((bucket) => bucket.label);
  const bucketTotals = buckets.map((bucket) =>
    priorities.reduce(
      (sum, priority) => sum + toNumber(uat?.priorities?.[priority]?.buckets?.[bucket.id]),
      0
    )
  );

  if (buckets.length === 0) {
    status.hidden = false;
    status.textContent = "UAT aging buckets are missing from snapshot.json.";
    return;
  }

  const traces = priorities.map((priority) => ({
    type: "bar",
    name: priorityLabels[priority],
    x: bucketLabels,
    y: buckets.map((bucket) => toNumber(uat?.priorities?.[priority]?.buckets?.[bucket.id])),
    marker: {
      color: themeColors.priorities[priority] || themeColors.priorities.medium,
      line: { color: themeColors.barBorder, width: 0.7 },
    },
    customdata: buckets.map((_, bucketIndex) => ({
      total: bucketTotals[bucketIndex],
    })),
    hovertemplate:
      "<b>Time spent: %{x}</b><br>Priority: %{fullData.name}<br>Count: %{y}<br>" +
      "Total: %{customdata.total}<extra></extra>",
  }));

  const layout = {
    ...buildBaseLayout(themeColors),
    barmode: "stack",
    uirevision: "backlog-uat-aging",
    margin: { t: 18, r: 16, b: 52, l: 56 },
    bargap: 0.28,
    xaxis: {
      title: "Time spent",
      color: themeColors.text,
      showgrid: false,
      automargin: true,
    },
    yaxis: {
      title: "Open UAT Bugs",
      rangemode: "tozero",
      color: themeColors.text,
      gridcolor: themeColors.grid,
      automargin: true,
    },
    annotations: [
      {
        xref: "paper",
        yref: "paper",
        x: 1,
        y: 1.14,
        showarrow: false,
        xanchor: "right",
        yanchor: "bottom",
        text: `Scope: ${uat?.scope?.project || "?"} / ${uat?.scope?.issueType || "?"} / ${uat?.scope?.status || "?"} / ${uat?.scope?.label || "?"}`,
        font: { size: 11, color: themeColors.text },
      },
    ],
  };

  Plotly.react("uat-chart", traces, layout, {
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
  });
}

async function loadSnapshot() {
  const status = document.getElementById("status");
  const uatStatus = document.getElementById("uat-status");
  status.hidden = true;
  if (uatStatus) uatStatus.hidden = true;
  state.mode = getModeFromUrl();
  applyModeVisibility();

  try {
    const response = await fetch("./snapshot.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    state.snapshot = await response.json();
    if (state.mode !== "composition") {
      renderLineChart();
    }
    if (state.mode !== "trend") {
      renderStackedBarChart();
    }
    renderUatAgingChart();
  } catch (error) {
    status.hidden = false;
    status.textContent = `Failed to load snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (uatStatus) {
      uatStatus.hidden = false;
      uatStatus.textContent = status.textContent;
    }
  }
}

loadSnapshot();
