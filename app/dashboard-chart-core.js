/* global React, ReactDOM */
"use strict";

(function initDashboardChartCore() {
  if (!window.React || !window.ReactDOM) {
    return;
  }

  const dashboardUiUtils = window.DashboardViewUtils;
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }

  const h = React.createElement;
  const PRODUCT_CYCLE_TEAM_ORDER = [
    "multi team",
    "api",
    "frontend",
    "broadcast",
    "workers",
    "titanium",
    "shift"
  ];
  const TEAM_FALLBACK_PALETTE = [
    "#4f8fcb",
    "#c78b2e",
    "#7b63c7",
    "#2f9fb4",
    "#5e6b84",
    "#b07aa1",
    "#8a6a4a",
    "#4a758e"
  ];
  const TEAM_FALLBACK_HUES = [208, 220, 232, 244, 256, 268, 282, 36, 30, 24];
  const DASHBOARD_TEAM_BASE_COLORS = {
    all: "#98a4b3",
    "all teams": "#98a4b3",
    "all teams avg": "#98a4b3",
    api: "#4f8fcb",
    frontend: "#c78b2e",
    legacy: "#c78b2e",
    react: "#2f9fb4",
    broadcast: "#7b63c7",
    bc: "#7b63c7",
    "multi team": "#667a4d",
    "multi-team": "#667a4d",
    multiteam: "#667a4d",
    orchestration: "#5e6b84",
    workers: "#5e6b84",
    titanium: "#b07aa1",
    shift: "#8a6a4a",
    unmapped: "#4a758e"
  };
  const { escapeHtml, toNumber, formatDateShort } = dashboardUiUtils;
  const roots = new Map();
  const TEAM_CONFIG = [
    { key: "api", label: "API" },
    { key: "legacy", label: "Legacy FE" },
    { key: "react", label: "React FE" },
    { key: "bc", label: "BC" },
    { key: "workers", label: "Workers" },
    { key: "titanium", label: "Titanium" }
  ];
  const TREND_TEAM_LINES = [
    ["api", "API", "api"],
    ["legacy", "Legacy FE", "legacy"],
    ["react", "React FE", "react"],
    ["bc", "BC", "bc"],
    ["workers", "Workers", "workers"],
    ["titanium", "Titanium", "titanium"]
  ];
  const TREND_LONG_LINES = [
    {
      dataKey: "bcLong30",
      name: "BC long-standing (30d+)",
      stroke: "#8e9aaa",
      strokeDasharray: "4 3"
    },
    {
      dataKey: "bcLong60",
      name: "BC long-standing (60d+)",
      stroke: "#6f7f92",
      strokeDasharray: "7 4"
    }
  ];

  function toWhole(value) {
    return Math.round(toNumber(value));
  }

  function toCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.trunc(number);
  }

  function orderProductCycleTeams(teams) {
    return [...teams].sort((left, right) => {
      const a = String(left || "").toLowerCase();
      const b = String(right || "").toLowerCase();
      const ai = PRODUCT_CYCLE_TEAM_ORDER.indexOf(a);
      const bi = PRODUCT_CYCLE_TEAM_ORDER.indexOf(b);
      const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b);
    });
  }

  function hashTeamName(teamName) {
    const text = String(teamName || "")
      .trim()
      .toLowerCase();
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function hexToRgb(hex) {
    const value = String(hex || "").trim();
    const full = /^#([0-9a-f]{6})$/i.exec(value);
    if (!full) return null;
    const parsed = full[1];
    return [
      Number.parseInt(parsed.slice(0, 2), 16),
      Number.parseInt(parsed.slice(2, 4), 16),
      Number.parseInt(parsed.slice(4, 6), 16)
    ];
  }

  function blendWithWhite(hex, factor) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const clamped = Math.max(0, Math.min(1, Number(factor) || 0));
    const [r, g, b] = rgb.map((channel) => Math.round(channel + (255 - channel) * clamped));
    const toHex = (value) => value.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function resolveTeamBaseColor(teamName, index = 0) {
    const raw = String(teamName || "").trim();
    const key = raw.toLowerCase();
    if (DASHBOARD_TEAM_BASE_COLORS[key]) return DASHBOARD_TEAM_BASE_COLORS[key];
    if (key.includes("api")) return DASHBOARD_TEAM_BASE_COLORS.api;
    if (key.includes("legacy") || key.includes("frontend"))
      return DASHBOARD_TEAM_BASE_COLORS.frontend;
    if (key.includes("react")) return DASHBOARD_TEAM_BASE_COLORS.react;
    if (key.includes("broadcast")) return DASHBOARD_TEAM_BASE_COLORS.broadcast;
    if (key === "multi team" || key === "multi-team" || key === "multiteam")
      return DASHBOARD_TEAM_BASE_COLORS["multi team"];
    if (key.includes("worker")) return DASHBOARD_TEAM_BASE_COLORS.workers;
    if (key.includes("orchestration")) return DASHBOARD_TEAM_BASE_COLORS.orchestration;
    if (key.includes("titanium") || key.includes("media"))
      return DASHBOARD_TEAM_BASE_COLORS.titanium;
    return TEAM_FALLBACK_PALETTE[
      hashTeamName(raw || `team-${index}`) % TEAM_FALLBACK_PALETTE.length
    ];
  }

  function pickUniqueTeamColor(teamName, usedColors) {
    const start = hashTeamName(teamName) % TEAM_FALLBACK_PALETTE.length;
    for (let offset = 0; offset < TEAM_FALLBACK_PALETTE.length; offset += 1) {
      const candidate = TEAM_FALLBACK_PALETTE[(start + offset) % TEAM_FALLBACK_PALETTE.length];
      if (!usedColors.has(candidate)) return candidate;
    }
    const hash = hashTeamName(teamName);
    const hue = TEAM_FALLBACK_HUES[hash % TEAM_FALLBACK_HUES.length];
    const lightness = 44 + ((hash >> 3) % 14);
    return `hsl(${hue} 38% ${lightness}%)`;
  }

  function buildTeamColorMap(teams, { ensureUnique = false } = {}) {
    if (!ensureUnique) {
      return Object.fromEntries(
        teams.map((team, index) => [team, resolveTeamBaseColor(team, index)])
      );
    }

    const colorMap = {};
    const usedColors = new Set();
    teams.forEach((team, index) => {
      let color = resolveTeamBaseColor(team, index);
      if (usedColors.has(color)) {
        color = pickUniqueTeamColor(team, usedColors);
        if (usedColors.has(color)) {
          color = pickUniqueTeamColor(`${team}-unique`, usedColors);
        }
      }
      colorMap[team] = color;
      usedColors.add(color);
    });
    return colorMap;
  }

  function buildTintMap(teamColorMap, factor) {
    return Object.fromEntries(
      Object.entries(teamColorMap).map(([team, color]) => [team, blendWithWhite(color, factor)])
    );
  }

  function viewportWidthPx(fallbackWidth = 1280) {
    const safeFallback =
      Number.isFinite(Number(fallbackWidth)) && Number(fallbackWidth) > 0 ? Number(fallbackWidth) : 1280;
    if (typeof window === "undefined") return safeFallback;
    const direct = Number(window.innerWidth);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fallback = Number(document?.documentElement?.clientWidth);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : safeFallback;
  }

  function isCompactViewport() {
    return viewportWidthPx() <= 680;
  }

  function computeYUpper(values, { min = 1, pad = 1.12 } = {}) {
    const finiteValues = (Array.isArray(values) ? values : []).filter(Number.isFinite);
    if (finiteValues.length === 0) return min;
    return Math.max(min, Math.ceil(Math.max(...finiteValues) * pad));
  }

  function ensureRoot(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    if (!roots.has(containerId)) {
      roots.set(containerId, ReactDOM.createRoot(container));
    }
    return roots.get(containerId);
  }

  function clearChart({ containerId }) {
    if (!containerId) return;
    const root = roots.get(containerId);
    if (root) {
      root.render(null);
      return;
    }
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = "";
  }

  function normalizePrCycleTeamKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "orchestration" || raw === "workers") return "workers";
    if (raw === "multi team" || raw === "multi-team" || raw === "multiteam") return "multiteam";
    return raw;
  }

  function getPrCycleTeamColor(teamKey) {
    const normalizedKey = normalizePrCycleTeamKey(teamKey);
    const baseMap = buildTeamColorMap([normalizedKey]);
    return baseMap[normalizedKey] || "#4f8fcb";
  }

  function renderProductCycleCard(
    containerId,
    {
      className = "",
      teamKey = "",
      teamColor = "",
      headerMarkup = "",
      rowsMarkup = "",
      footerMarkup = ""
    }
  ) {
    const container = document.getElementById(containerId);
    if (!container) return false;
    const classNames = ["pr-cycle-stage-card", className].filter(Boolean).join(" ");
    const attrs = [];
    if (teamKey) attrs.push(`data-team="${escapeHtml(teamKey)}"`);
    if (teamColor) attrs.push(`style="--pr-cycle-accent:${escapeHtml(teamColor)};"`);
    container.innerHTML = `
      <div class="product-cycle-team-card-wrap">
        <article class="${classNames}"${attrs.length > 0 ? ` ${attrs.join(" ")}` : ""}>
          <div class="pr-cycle-stage-card__header">
            <div class="pr-cycle-stage-card__meta">
              ${headerMarkup}
            </div>
          </div>
          <div class="pr-cycle-stage-list">${rowsMarkup}</div>
          ${footerMarkup}
        </article>
      </div>
    `;
    return true;
  }

  function buildRowMarkup({
    rowClassName = "",
    trackClassName = "",
    fillClassName = "",
    valueClassName = "",
    valueFrameClassName = "",
    wrapValueFrame = true,
    stage = "",
    label = "",
    sampleMarkup = "",
    width = 0,
    valueMarkup = "",
    fillStyle = ""
  }) {
    const rowClasses = ["pr-cycle-stage-row", rowClassName].filter(Boolean).join(" ");
    const trackClasses = ["pr-cycle-stage-row__track", trackClassName].filter(Boolean).join(" ");
    const fillClasses = ["pr-cycle-stage-row__fill", fillClassName].filter(Boolean).join(" ");
    const valueClasses = ["pr-cycle-stage-row__value", valueClassName].filter(Boolean).join(" ");
    const valueFrameClasses = ["pr-cycle-stage-row__value-frame", valueFrameClassName]
      .filter(Boolean)
      .join(" ");
    const fillStyleText = fillStyle ? `;${fillStyle}` : "";
    const labelDetailMarkup = sampleMarkup
      ? `<span class="pr-cycle-stage-row__sample">${sampleMarkup}</span>`
      : "";
    const renderedValueMarkup = wrapValueFrame
      ? `<span class="${valueFrameClasses}">${valueMarkup}</span>`
      : valueMarkup;
    return `
      <div class="${rowClasses}" data-stage="${escapeHtml(stage)}">
        <div class="pr-cycle-stage-row__label">
          <span class="pr-cycle-stage-row__label-text">${escapeHtml(label)}</span>
          ${labelDetailMarkup}
        </div>
        <div class="${trackClasses}" aria-hidden="true">
          <div class="${fillClasses}" style="width:${width}%${fillStyleText}"></div>
        </div>
        <div class="${valueClasses}">${renderedValueMarkup}</div>
      </div>
    `;
  }

  function linearScale(value, domainMin, domainMax, rangeMin, rangeMax) {
    const safeValue = toNumber(value);
    if (!Number.isFinite(safeValue)) return rangeMin;
    if (!Number.isFinite(domainMax) || domainMax === domainMin) return rangeMin;
    const ratio = (safeValue - domainMin) / (domainMax - domainMin);
    return rangeMin + ratio * (rangeMax - rangeMin);
  }

  function withAlpha(color, alpha) {
    const safeColor = String(color || "").trim();
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(safeColor);
    if (!match) return safeColor;
    const hex = match[1];
    const fullHex =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : hex;
    const red = Number.parseInt(fullHex.slice(0, 2), 16);
    const green = Number.parseInt(fullHex.slice(2, 4), 16);
    const blue = Number.parseInt(fullHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function SvgLegend({ items }) {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    if (safeItems.length === 0) return null;
    return h(
      "div",
      { className: "svg-chart-legend", role: "presentation" },
      ...safeItems.map((item, index) =>
        h(
          "div",
          { key: item.key || `legend-item-${index}`, className: "svg-chart-legend__item" },
          h("span", {
            className: "svg-chart-legend__swatch",
            style: {
              background: item.swatchBackground || item.color || "rgba(31, 51, 71, 0.2)",
              borderColor: item.borderColor || withAlpha(item.color, 0.36)
            }
          }),
          h("span", { className: "svg-chart-legend__label" }, String(item.label || ""))
        )
      )
    );
  }

  function SvgTooltipCard({ colors, content }) {
    if (!content) return null;
    return h(
      "div",
      {
        className: "svg-chart-tooltip",
        style: {
          borderColor: colors?.tooltip?.border || "rgba(31, 51, 71, 0.22)",
          background: colors?.tooltip?.bg || "rgba(255,255,255,0.98)",
          color: colors?.tooltip?.text || "#1f3347"
        }
      },
      content
    );
  }

  function SvgChartShell({ width, height, legendItems = [], colors, tooltipContent = null, children }) {
    return h(
      "div",
      {
        className: "svg-chart-shell",
        style: { minHeight: `${height}px` }
      },
      h(SvgLegend, { items: legendItems }),
      h(
        "svg",
        {
          className: "svg-chart-shell__svg",
          viewBox: `0 0 ${width} ${height}`,
          width: "100%",
          height: height,
          preserveAspectRatio: "xMidYMid meet"
        },
        children
      ),
      h(SvgTooltipCard, { colors, content: tooltipContent })
    );
  }

  function renderSvgChart(containerId, canRender, elementFactory) {
    renderWithRoot(containerId, canRender, (root) => {
      root.render(elementFactory());
    });
  }

  function renderWithRoot(containerId, canRender, renderFn) {
    const root = ensureRoot(containerId);
    if (!root) return;
    if (!canRender) {
      root.render(null);
      return;
    }
    renderFn(root);
  }

  const dashboardSvgCore = {
    linearScale,
    renderSvgChart,
    withAlpha,
    SvgChartShell
  };

  window.DashboardChartCore = {
    React,
    buildRowMarkup,
    h,
    getPrCycleTeamColor,
    TEAM_CONFIG,
    TREND_LONG_LINES,
    TREND_TEAM_LINES,
    computeYUpper,
    formatDateShort,
    isCompactViewport,
    renderProductCycleCard,
    renderWithRoot,
    toNumber,
    toWhole,
    viewportWidthPx
  };
  window.DashboardSvgCore = dashboardSvgCore;
  window.DashboardDataUtils = {
    buildTeamColorMap,
    buildTintMap,
    orderProductCycleTeams,
    toCount
  };
  window.DashboardCharts = { ...(window.DashboardCharts || {}), clearChart };
})();
