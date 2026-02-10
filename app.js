"use strict";

const TEAM_CONFIG = [
  { key: "api", label: "API", color: "#64B5F6" },
  { key: "legacy", label: "Legacy FE", color: "#FFB74D" },
  { key: "react", label: "React FE", color: "#81C784" },
  { key: "bc", label: "BC", color: "#BA68C8" },
];

const PRIORITY_CONFIG = [
  { key: "highest", label: "Highest", color: "#9c3b2f" },
  { key: "high", label: "High", color: "#ba7a36" },
  { key: "medium", label: "Medium", color: "#66707a" },
  { key: "low", label: "Low", color: "#3f8cab" },
  { key: "lowest", label: "Lowest", color: "#1f648d" },
];

const PRIORITY_LABELS = PRIORITY_CONFIG.reduce((acc, priority) => {
  acc[priority.key] = priority.label;
  return acc;
}, {});

const state = {
  snapshot: null,
  mode: "all",
};

function getModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const chart = (params.get("chart") || "").toLowerCase();
  if (chart === "trend") return "trend";
  if (chart === "composition") return "composition";
  return "all";
}

function applyModeVisibility() {
  const trendPanel = document.getElementById("trend-panel");
  const compositionPanel = document.getElementById("composition-panel");
  if (!trendPanel || !compositionPanel) return;

  if (state.mode === "trend") {
    trendPanel.hidden = false;
    compositionPanel.hidden = true;
    return;
  }

  if (state.mode === "composition") {
    trendPanel.hidden = true;
    compositionPanel.hidden = false;
    return;
  }

  trendPanel.hidden = false;
  compositionPanel.hidden = false;
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
  return PRIORITY_CONFIG.map(
    (priority) => `${PRIORITY_LABELS[priority.key]}: ${toNumber(point[priority.key])}`
  ).join("<br>");
}

function formatDateShort(date) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${month}/${day}`;
}

function renderLineChart() {
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;

  const x = state.snapshot.combinedPoints.map((point) => point.date);
  const traces = TEAM_CONFIG.map((team) => {
    const y = state.snapshot.combinedPoints.map((point) => totalForPoint(point[team.key]));
    const customData = state.snapshot.combinedPoints.map((point) => breakdownText(point[team.key]));
    return {
      type: "scatter",
      mode: "lines+markers",
      name: team.label,
      x,
      y,
      customdata: customData,
      hovertemplate:
        "<b>%{fullData.name}</b><br>Date: %{x}<br>Total: %{y}<br>%{customdata}<extra></extra>",
      line: { color: team.color, width: 3 },
      marker: { size: 7 },
    };
  });

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    uirevision: "backlog-line",
    margin: { t: 18, r: 20, b: 42, l: 56 },
    xaxis: {
      title: "Date",
      tickangle: -30,
      color: "#d9e8ff",
      gridcolor: "rgba(175,203,250,0.12)",
    },
    yaxis: {
      title: "Open Bugs",
      rangemode: "tozero",
      color: "#d9e8ff",
      gridcolor: "rgba(175,203,250,0.12)",
    },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "left",
      x: 0,
      font: { color: "#d9e8ff" },
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
  const traces = PRIORITY_CONFIG.map((priority) => ({
    type: "bar",
    name: priority.label,
    marker: { color: priority.color },
    x,
    y: flat.map((item) => item[priority.key]),
    customdata: flat.map((item) => [item.date, item.team, item.total]),
    hovertemplate:
      "<b>%{customdata[1]}</b><br>Date: %{customdata[0]}<br>" +
      `${priority.label}: %{y}<br>Total: %{customdata[2]}<extra></extra>`,
  }));

  const layout = {
    barmode: "stack",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    uirevision: "backlog-stack",
    margin: { t: 18, r: 12, b: 78, l: 52 },
    bargap: 0.36,
    xaxis: {
      type: "multicategory",
      tickangle: -90,
      tickfont: { size: 9 },
      color: "#d9e8ff",
      showgrid: false,
    },
    yaxis: {
      title: "Open Bugs",
      rangemode: "tozero",
      color: "#d9e8ff",
      gridcolor: "rgba(175,203,250,0.12)",
    },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "left",
      x: 0,
      font: { color: "#d9e8ff" },
    },
  };

  Plotly.react("stacked-chart", traces, layout, {
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
  });
}

async function loadSnapshot() {
  const status = document.getElementById("status");
  status.hidden = true;
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
  } catch (error) {
    status.hidden = false;
    status.textContent = `Failed to load snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

loadSnapshot();
