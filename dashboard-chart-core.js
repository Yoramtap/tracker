/* global React, ReactDOM, Recharts */
"use strict";

(function initDashboardChartCore() {
  if (!window.React || !window.ReactDOM || !window.Recharts) {
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
  const {
    ResponsiveContainer,
    LineChart,
    Line,
    ScatterChart,
    Scatter,
    BarChart,
    Bar,
    ReferenceDot,
    ReferenceLine,
    ReferenceArea,
    Cell,
    LabelList,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip
  } = Recharts;
  const { toNumber, formatDateShort, getModeFromUrl } = dashboardUiUtils;
  const SHARED_CATEGORY_BLUE_TINTS = ["#CFE0F8", "#9EBAE3", "#6D95D1", "#3F73B8", "#295996"];
  const BAR_LAYOUT = { categoryGap: "14%", groupGap: 2, denseMax: 14, normalMax: 20 };
  const CHART_HEIGHTS = { standard: 280, dense: 320 };
  const MOBILE_COMPACT_CHART_HEIGHTS = {
    trend: 280,
    composition: 280,
    uat: 300,
    management: 290,
    "management-facility": 300,
    contributors: 270,
    "product-cycle": 280,
    "lifecycle-days": 280
  };
  const SINGLE_CHART_EMBED_HEIGHTS = {
    trend: 360,
    composition: 390,
    uat: 330,
    management: 320,
    "management-facility": 360,
    contributors: 340,
    "product-cycle": 360,
    "lifecycle-days": 380
  };
  const DASHBOARD_EMBED_CHART_HEIGHTS = {
    trend: 340,
    composition: 360,
    uat: 320,
    management: 320,
    "management-facility": 330,
    contributors: 300,
    "product-cycle": 320,
    "lifecycle-days": 330
  };
  const MOBILE_DASHBOARD_EMBED_CHART_HEIGHTS = {
    trend: 290,
    composition: 300,
    uat: 280,
    management: 280,
    "management-facility": 290,
    contributors: 240,
    "product-cycle": 250,
    "lifecycle-days": 270
  };
  const HORIZONTAL_CATEGORY_AXIS_WIDTH = 172;
  const BAR_CURSOR_FILL = "rgba(31,51,71,0.04)";
  const TOOLTIP_PORTAL_ROOT_ID = "dashboard-tooltip-layer";
  const TOOLTIP_VIEWPORT_PADDING = 10;
  const TOOLTIP_PORTAL_GAP = 14;
  const TOOLTIP_HIDE_DELAY_MS = 160;
  const roots = new Map();
  const TEAM_CONFIG = [
    { key: "api", label: "API" },
    { key: "legacy", label: "Legacy FE" },
    { key: "react", label: "React FE" },
    { key: "bc", label: "BC" },
    { key: "workers", label: "Workers" },
    { key: "titanium", label: "Titanium" }
  ];
  const PRIORITY_CONFIG = [
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
    { key: "highest", label: "Highest" }
  ];
  const PRIORITY_STACK_ORDER = [
    { key: "lowest", label: "Lowest" },
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
    { key: "highest", label: "Highest" }
  ];
  const MAX_SPRINT_POINTS = 10;
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

  function toWeeks(valueInDays) {
    return toNumber(valueInDays) / 7;
  }

  function toMonths(valueInDays) {
    return toNumber(valueInDays) / 30.4375;
  }

  function toWholeWeeksForChart(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return 0;
    if (days < 7) return 1;
    return Math.max(1, Math.round(toWeeks(days)));
  }

  function toMonthsForChart(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return 0;
    return Number(toMonths(days).toFixed(2));
  }

  function formatWeekAxisLabel(value) {
    const weeks = toWhole(value);
    if (weeks <= 0) return "0";
    if (weeks % 4 !== 0) return String(weeks);
    const months = Math.floor(weeks / 4);
    return months === 1 ? "1 month" : `${months} months`;
  }

  function formatTooltipDuration(valueInDays, unit = "days") {
    const days = toNumber(valueInDays);
    if (unit === "weeks") {
      if (days <= 0) return "0 weeks";
      if (days < 7) return "< 1 week";
      const exactWeeks = toWeeks(days);
      const roundedWeeks = Math.max(1, Math.round(exactWeeks));
      const prefix = Math.abs(exactWeeks - roundedWeeks) > 0.01 ? "\u2248 " : "";
      const text = roundedWeeks === 1 ? "1 week" : `${roundedWeeks} weeks`;
      return `${prefix}${text}`;
    }
    if (unit === "months") {
      if (days <= 0) return "0 months";
      if (days < 30.4375) return "< 1 month";
      const exactMonths = toMonths(days);
      const roundedMonths = Math.max(1, Math.round(exactMonths));
      const prefix = Math.abs(exactMonths - roundedMonths) > 0.01 ? "\u2248 " : "";
      const text = roundedMonths === 1 ? "1 month" : `${roundedMonths} months`;
      return `${prefix}${text}`;
    }
    const roundedDays = toWhole(days);
    const prefix = Math.abs(days - roundedDays) > 0.01 ? "\u2248 " : "";
    return `${prefix}${roundedDays} ${unit}`;
  }

  function formatMonthAxisLabel(value) {
    const months = toWhole(value);
    if (months <= 11) return String(months);
    if (months === 12) return "1 year";
    if (months < 24) return "+1 year";
    const years = Math.floor(months / 12);
    return years === 1 ? "1 year" : `${years} years`;
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

  function buildWeekAxis(maxValueWeeks, options = {}) {
    const majorStep = Math.max(1, toWhole(options?.majorStep || 0));
    const fixedStep = Number.isFinite(majorStep) && majorStep > 0 ? majorStep : null;
    const maxWeeks = Math.max(1, Math.ceil(toNumber(maxValueWeeks)));
    if (fixedStep) {
      const axisWeeks = Math.max(fixedStep, Math.ceil(maxWeeks / fixedStep) * fixedStep);
      const ticks = [0];
      for (let week = fixedStep; week <= axisWeeks; week += fixedStep) ticks.push(week);
      return { upper: axisWeeks, ticks };
    }

    const targetSteps = 6;
    const roughStep = maxWeeks / targetSteps;
    let step = 1;
    if (roughStep > 1 && roughStep <= 2) step = 2;
    else if (roughStep > 2 && roughStep <= 5) step = 5;
    else if (roughStep > 5) step = 10;

    const upper = Math.max(step, Math.ceil(maxWeeks / step) * step);
    const ticks = [];
    for (let week = 0; week <= upper; week += step) ticks.push(week);
    return { upper, ticks };
  }

  function buildMonthAxis(maxValueMonths, options = {}) {
    const majorStep = Math.max(1, toWhole(options?.majorStep || 0));
    const fixedStep = Number.isFinite(majorStep) && majorStep > 0 ? majorStep : null;
    const maxMonths = Math.max(1, Math.ceil(toNumber(maxValueMonths)));
    if (fixedStep) {
      const axisMonths = Math.max(fixedStep, Math.ceil(maxMonths / fixedStep) * fixedStep);
      const ticks = [0];
      for (let month = fixedStep; month <= axisMonths; month += fixedStep) ticks.push(month);
      return { upper: axisMonths, ticks };
    }

    const targetSteps = 6;
    const roughStep = maxMonths / targetSteps;
    let step = 1;
    if (roughStep > 1 && roughStep <= 2) step = 2;
    else if (roughStep > 2 && roughStep <= 3) step = 3;
    else if (roughStep > 3 && roughStep <= 6) step = 6;
    else if (roughStep > 6) step = 12;

    const upper = Math.max(step, Math.ceil(maxMonths / step) * step);
    const ticks = [];
    for (let month = 0; month <= upper; month += step) ticks.push(month);
    return { upper, ticks };
  }

  function trendTickInterval(pointsCount) {
    const count = Math.max(0, toWhole(pointsCount));
    if (count <= 6) return 0;
    if (count <= 12) return 1;
    if (count <= 18) return 2;
    return 3;
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

  function singleChartHeightForMode(modeKey, baseHeight) {
    const mode = getModeFromUrl();
    const embedMode =
      typeof dashboardUiUtils.isEmbedMode === "function" && dashboardUiUtils.isEmbedMode();
    const compactHeightFloor = isCompactViewport() ? MOBILE_COMPACT_CHART_HEIGHTS[modeKey] : null;
    if (mode === modeKey) {
      const singleModeHeight = SINGLE_CHART_EMBED_HEIGHTS[modeKey] || baseHeight;
      return compactHeightFloor ? Math.max(singleModeHeight, compactHeightFloor) : singleModeHeight;
    }
    if (!embedMode || mode !== "all") {
      return compactHeightFloor ? Math.max(baseHeight, compactHeightFloor) : baseHeight;
    }
    const embedHeights = isCompactViewport()
      ? MOBILE_DASHBOARD_EMBED_CHART_HEIGHTS
      : DASHBOARD_EMBED_CHART_HEIGHTS;
    const embedHeight = embedHeights[modeKey] || baseHeight;
    return compactHeightFloor ? Math.max(embedHeight, compactHeightFloor) : embedHeight;
  }

  function isCompactViewport() {
    return viewportWidthPx() <= 680;
  }

  function tickIntervalForMobileLabels(pointsCount) {
    const count = Math.max(0, toWhole(pointsCount));
    if (count <= 6) return 0;
    if (count <= 10) return 1;
    if (count <= 14) return 2;
    if (count <= 18) return 3;
    return 4;
  }

  function trendLayoutForViewport(pointsCount) {
    const width = viewportWidthPx();
    if (width <= 680) {
      return {
        chartHeight: singleChartHeightForMode("trend", 300),
        margin: { top: 2, right: 10, bottom: 16, left: 16 },
        xTickFontSize: 8,
        yTickFontSize: 9,
        xTickMargin: 0,
        minTickGap: 4,
        legendCompact: true,
        xAxisInterval: trendTickInterval(pointsCount)
      };
    }
    if (width <= 1024) {
      return {
        chartHeight: singleChartHeightForMode("trend", 290),
        margin: { top: 8, right: 10, bottom: 54, left: 54 },
        xTickFontSize: 11,
        yTickFontSize: 11,
        xTickMargin: 5,
        minTickGap: 6,
        legendCompact: false,
        xAxisInterval: pointsCount > 14 ? 1 : 0
      };
    }
    return {
      chartHeight: singleChartHeightForMode("trend", 340),
      margin: { top: 12, right: 12, bottom: 64, left: 62 },
      xTickFontSize: 11,
      yTickFontSize: 11,
      xTickMargin: 6,
      minTickGap: 4,
      legendCompact: false,
      xAxisInterval: 0
    };
  }

  function computeYUpper(values, { min = 1, pad = 1.12 } = {}) {
    const finiteValues = (Array.isArray(values) ? values : []).filter(Number.isFinite);
    if (finiteValues.length === 0) return min;
    return Math.max(min, Math.ceil(Math.max(...finiteValues) * pad));
  }

  function buildNiceNumberAxis(maxValue) {
    const max = Math.max(0, toNumber(maxValue));
    if (max <= 1) return { upper: 1, ticks: [0, 1] };
    const targetSteps = 6;
    const roughStep = max / targetSteps;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / magnitude;
    const niceBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const step = niceBase * magnitude;
    const upper = Math.max(step, Math.ceil(max / step) * step);
    const ticks = [];
    for (let value = 0; value <= upper; value += step) ticks.push(value);
    return { upper, ticks };
  }

  function makeTooltipLine(
    key,
    text,
    colors,
    {
      margin = "2px 0",
      fontSize = "12px",
      fontWeight,
      color,
      lineHeight = "1.4",
      subItems = null,
      isTitle = false,
      preserveSubItems = false
    } = {}
  ) {
    return {
      key,
      text: String(text ?? ""),
      style: {
        margin,
        color: color || colors.text,
        fontSize: fontSize || undefined,
        fontWeight: fontWeight || undefined,
        lineHeight: lineHeight || undefined
      },
      subItems: Array.isArray(subItems) ? subItems : null,
      isTitle: Boolean(isTitle),
      preserveSubItems: Boolean(preserveSubItems)
    };
  }

  function tooltipTitleLine(key, text, colors) {
    return makeTooltipLine(key, text, colors, {
      margin: "0 0 6px",
      fontWeight: 700,
      fontSize: null,
      isTitle: true
    });
  }

  function ensureTooltipPortalRoot() {
    if (typeof document === "undefined" || !document.body) return null;
    let root = document.getElementById(TOOLTIP_PORTAL_ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = TOOLTIP_PORTAL_ROOT_ID;
      root.style.position = "fixed";
      root.style.inset = "0";
      root.style.pointerEvents = "none";
      root.style.zIndex = "80";
      document.body.appendChild(root);
    }
    return root;
  }

  function normalizeTooltipLine(entry, index) {
    if (!entry) return null;
    if (typeof entry === "string") {
      return { key: `line-${index}`, text: entry, subItems: null, isTitle: false, style: {} };
    }
    if (typeof entry === "object" && "text" in entry) return entry;
    return null;
  }

  function tooltipLineSubItems(line) {
    if (!line || line.isTitle) return [];
    if (Array.isArray(line.subItems) && line.subItems.length > 0) {
      return line.subItems
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => {
          if (item === null || item === undefined) return false;
          if (typeof item === "string") return item.length > 0;
          return true;
        });
    }
    const rawText = String(line.text || "").trim();
    const colonIndex = rawText.indexOf(":");
    if (colonIndex > 0) {
      const label = rawText.slice(0, colonIndex).trim();
      const detail = rawText.slice(colonIndex + 1).trim();
      const parts = detail
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        line.text = label;
        return parts;
      }
    }
    return [];
  }

  function tooltipMainText(line) {
    if (!line || line.isTitle) return String(line?.text || "");
    const rawText = String(line.text || "").trim();
    const colonIndex = rawText.indexOf(":");
    if (colonIndex > 0) {
      const label = rawText.slice(0, colonIndex).trim();
      const detail = rawText.slice(colonIndex + 1).trim();
      const parts = detail
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) return label;
    }
    return rawText;
  }

  function flattenTooltipText(line, subItems) {
    if (!line || line.isTitle) return String(line?.text || "");
    if (line.preserveSubItems) return tooltipMainText(line);
    if (!Array.isArray(subItems) || subItems.length !== 1) return tooltipMainText(line);
    const [onlyItem] = subItems;
    if (typeof onlyItem !== "string") return tooltipMainText(line);
    return `${tooltipMainText(line)}, ${onlyItem}`;
  }

  function computeTooltipPortalPosition(anchorRect, cardRect) {
    if (!anchorRect || !cardRect || typeof window === "undefined") return null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const anchorX = anchorRect.left + anchorRect.width / 2;
    const anchorY = anchorRect.top + anchorRect.height / 2;

    let left = anchorX + TOOLTIP_PORTAL_GAP;
    if (left + cardRect.width > viewportWidth - TOOLTIP_VIEWPORT_PADDING) {
      left = anchorX - cardRect.width - TOOLTIP_PORTAL_GAP;
    }
    left = Math.max(
      TOOLTIP_VIEWPORT_PADDING,
      Math.min(left, viewportWidth - TOOLTIP_VIEWPORT_PADDING - cardRect.width)
    );

    let top = anchorY - cardRect.height / 2;
    top = Math.max(
      TOOLTIP_VIEWPORT_PADDING,
      Math.min(top, viewportHeight - TOOLTIP_VIEWPORT_PADDING - cardRect.height)
    );

    return {
      left: Math.round(left),
      top: Math.round(top)
    };
  }

  function resolveTooltipAnchorRect(chartWrapper, coordinate, fallbackNode) {
    const x = toNumber(coordinate?.x);
    const y = toNumber(coordinate?.y);
    if (chartWrapper && Number.isFinite(x) && Number.isFinite(y)) {
      const rootRect = chartWrapper.getBoundingClientRect();
      return {
        left: rootRect.left + x,
        right: rootRect.left + x,
        top: rootRect.top + y,
        bottom: rootRect.top + y,
        width: 0,
        height: 0
      };
    }

    const tooltipWrapper = fallbackNode?.closest?.(".recharts-tooltip-wrapper");
    if (tooltipWrapper && typeof tooltipWrapper.getBoundingClientRect === "function") {
      return tooltipWrapper.getBoundingClientRect();
    }
    if (fallbackNode && typeof fallbackNode.getBoundingClientRect === "function") {
      return fallbackNode.getBoundingClientRect();
    }
    return null;
  }

  function computePanelDockedTooltipPosition(panelRect, cardRect) {
    if (!panelRect || !cardRect || typeof window === "undefined") return null;
    const viewportWidth = window.innerWidth;
    const left = Math.max(
      TOOLTIP_VIEWPORT_PADDING,
      Math.min(
        panelRect.left + (panelRect.width - cardRect.width) / 2,
        viewportWidth - TOOLTIP_VIEWPORT_PADDING - cardRect.width
      )
    );
    const top = Math.max(TOOLTIP_VIEWPORT_PADDING, panelRect.top + 10);
    return {
      left: Math.round(left),
      top: Math.round(top),
      maxHeight: Math.max(120, Math.floor(window.innerHeight - top - TOOLTIP_VIEWPORT_PADDING))
    };
  }

  const TooltipCardSurface = React.forwardRef(function TooltipCardSurface(
    { colors, blocks, options = {}, surfaceStyle = null, onPointerEnter, onPointerLeave, onClick },
    ref
  ) {
    const compactViewport = isCompactViewport();
    const suppressHoverPropagation = (event) => event?.stopPropagation?.();
    const lines = (Array.isArray(blocks) ? blocks : []).map(normalizeTooltipLine).filter(Boolean);
    const cardStyle = options && typeof options.cardStyle === "object" ? options.cardStyle : null;
    const interactive = options?.interactive !== false;

    return h(
      "div",
      {
        ref,
        style: {
          border: `1px solid ${colors.tooltip.border}`,
          background: colors.tooltip.bg,
          color: colors.tooltip.text,
          fontFamily: "var(--font-ui)",
          borderRadius: "6px",
          padding: compactViewport ? "6px 8px" : "8px 10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          maxWidth: compactViewport ? "min(92vw, 300px)" : "min(88vw, 320px)",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          pointerEvents: interactive ? "auto" : "none",
          ...(cardStyle || {}),
          ...(surfaceStyle || {})
        },
        onMouseEnter: suppressHoverPropagation,
        onMouseMove: suppressHoverPropagation,
        onMouseOver: suppressHoverPropagation,
        onMouseEnterCapture: suppressHoverPropagation,
        onMouseMoveCapture: suppressHoverPropagation,
        onMouseOverCapture: suppressHoverPropagation,
        onPointerEnter: (event) => {
          suppressHoverPropagation(event);
          if (typeof onPointerEnter === "function") onPointerEnter(event);
        },
        onPointerMove: suppressHoverPropagation,
        onPointerEnterCapture: suppressHoverPropagation,
        onPointerMoveCapture: suppressHoverPropagation,
        onPointerLeave: (event) => {
          suppressHoverPropagation(event);
          if (typeof onPointerLeave === "function") onPointerLeave(event);
        },
        onClick
      },
      ...lines.map((line, index) => {
        if (line.isTitle) {
          return h(
            "p",
            {
              key: line.key || `tooltip-title-${index}`,
              style: {
                margin: "0 0 6px",
                color: line?.style?.color || colors.text,
                fontSize: line?.style?.fontSize || (compactViewport ? "11px" : "12px"),
                fontWeight: line?.style?.fontWeight || 700,
                lineHeight: line?.style?.lineHeight || (compactViewport ? "1.35" : "1.4")
              }
            },
            String(line.text || "")
          );
        }

        const subItems = tooltipLineSubItems(line);
        const flattenedText = flattenTooltipText(line, subItems);
        const showNestedItems =
          subItems.length > 1 ||
          (subItems.length === 1 && !flattenedText.includes(String(subItems[0])));
        return h(
          "ul",
          {
            key: line.key || `tooltip-ul-${index}`,
            style: {
              margin: 0,
              paddingLeft: compactViewport ? "16px" : "18px",
              listStyleType: "disc"
            }
          },
          h(
            "li",
            {
              style: {
                margin: "2px 0",
                color: line?.style?.color || colors.text,
                fontSize: line?.style?.fontSize || (compactViewport ? "11px" : "12px"),
                fontWeight: 500,
                lineHeight: line?.style?.lineHeight || (compactViewport ? "1.35" : "1.4")
              }
            },
            h("span", null, flattenedText),
            showNestedItems
              ? h(
                  "ul",
                  {
                    style: {
                      margin: "4px 0 0",
                      paddingLeft: compactViewport ? "14px" : "16px",
                      listStyleType: "circle"
                    }
                  },
                  subItems.map((sub, subIndex) =>
                    h(
                      "li",
                      {
                        key: `${line.key || index}-sub-${subIndex}`,
                        style: {
                          margin: "1px 0",
                          fontSize: compactViewport ? "10px" : "11px",
                          fontWeight: 500,
                          lineHeight: compactViewport ? "1.3" : "1.35",
                          color: "rgba(31,51,71,0.9)"
                        }
                      },
                      React.isValidElement(sub) ? sub : String(sub)
                    )
                  )
                )
              : null
          )
        );
      })
    );
  });

  function createTooltipContent(colors, buildLines, options = {}) {
    return h(ViewportTooltipContent, { colors, buildLines, options });
  }

  function stageSampleCountFromRow(row) {
    const secondary = String(row?.secondaryLabel || "").trim();
    const match = /n\s*=\s*(\d+)/i.exec(secondary);
    return match ? toWhole(match[1]) : 0;
  }

  function isCoarsePointerDevice() {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  function dismissTooltipFromChartWrapper(wrapper) {
    if (!wrapper || typeof window === "undefined") return;
    try {
      wrapper.dispatchEvent(
        new MouseEvent("mouseleave", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
    } catch {
      // no-op
    }
    try {
      wrapper.dispatchEvent(
        new Event("touchend", {
          bubbles: true,
          cancelable: true
        })
      );
    } catch {
      // no-op
    }
  }

  function toggleLegendKey(prevSet, key) {
    const next = new Set(prevSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function tooltipRowSignature(row, payload) {
    const safeRow = row && typeof row === "object" ? row : {};
    const primaryLabel =
      safeRow.label ??
      safeRow.bucketLabel ??
      safeRow.phaseLabel ??
      safeRow.team ??
      safeRow.contributor ??
      "";
    const payloadSignature = (Array.isArray(payload) ? payload : [])
      .map((item) => `${String(item?.dataKey || "")}:${String(item?.value ?? "")}`)
      .join("|");
    return `${String(primaryLabel)}::${payloadSignature}`;
  }

  function ViewportTooltipContent({
    active,
    payload,
    coordinate,
    colors,
    buildLines,
    options = {}
  }) {
    const anchorRef = React.useRef(null);
    const cardRef = React.useRef(null);
    const hideTimerRef = React.useRef(0);
    const frameRef = React.useRef(0);
    const [portalRoot, setPortalRoot] = React.useState(null);
    const [portalHovered, setPortalHovered] = React.useState(false);
    const [snapshot, setSnapshot] = React.useState(null);
    const [position, setPosition] = React.useState(null);
    const coarsePointer = isCoarsePointerDevice();
    const interactive = options?.interactive !== false;
    const trackPointer = options?.trackPointer !== false;
    const dockedTooltip = coarsePointer || isCompactViewport();
    const hasPayload = active && Array.isArray(payload) && payload.length > 0;

    React.useEffect(() => {
      setPortalRoot(ensureTooltipPortalRoot());
      return () => {
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
        if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      };
    }, []);

    React.useEffect(() => {
      if (!hasPayload) return;
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = 0;
      }
      const row = payload[0]?.payload || {};
      const rowSignature = tooltipRowSignature(row, payload);
      setSnapshot((previous) => ({
        chartWrapper:
          anchorRef.current?.closest?.(".recharts-wrapper") || previous?.chartWrapper || null,
        panelElement:
          anchorRef.current?.closest?.(".panel") ||
          anchorRef.current?.closest?.(".recharts-wrapper")?.closest?.(".panel") ||
          previous?.panelElement ||
          null,
        coordinate:
          !trackPointer && previous?.rowSignature === rowSignature && previous?.coordinate
            ? previous.coordinate
            : coordinate &&
                Number.isFinite(toNumber(coordinate.x)) &&
                Number.isFinite(toNumber(coordinate.y))
              ? { x: toNumber(coordinate.x), y: toNumber(coordinate.y) }
              : previous?.coordinate || null,
        rowSignature,
        blocks: buildLines(row, payload)
      }));
    }, [buildLines, coordinate, hasPayload, payload, trackPointer]);

      React.useEffect(() => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = 0;
      }
      if (hasPayload) return;
      if (!snapshot) return;
      if (interactive && !coarsePointer && portalHovered) return;

      hideTimerRef.current = window.setTimeout(
        () => {
          setSnapshot(null);
          setPosition(null);
          hideTimerRef.current = 0;
        },
        coarsePointer ? 0 : TOOLTIP_HIDE_DELAY_MS
      );
    }, [coarsePointer, hasPayload, portalHovered, snapshot]);

    React.useLayoutEffect(() => {
      if (!snapshot || !portalRoot) return undefined;

      const updatePosition = () => {
        const anchorNode = anchorRef.current;
        const cardNode = cardRef.current;
        if (!anchorNode || !cardNode) return;
        const cardRect = cardNode.getBoundingClientRect();
        const nextPosition = dockedTooltip
          ? computePanelDockedTooltipPosition(
              snapshot.panelElement?.getBoundingClientRect?.(),
              cardRect
            )
          : computeTooltipPortalPosition(
              resolveTooltipAnchorRect(snapshot.chartWrapper, snapshot.coordinate, anchorNode),
              cardRect
            );
        if (!nextPosition) return;
        setPosition((previous) => {
          if (
            previous &&
            previous.left === nextPosition.left &&
            previous.top === nextPosition.top &&
            previous.maxHeight === nextPosition.maxHeight
          ) {
            return previous;
          }
          return nextPosition;
        });
      };

      const requestUpdate = () => {
        if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = window.requestAnimationFrame(updatePosition);
      };

      requestUpdate();
      window.addEventListener("resize", requestUpdate);
      window.addEventListener("scroll", requestUpdate, true);
      return () => {
        window.removeEventListener("resize", requestUpdate);
        window.removeEventListener("scroll", requestUpdate, true);
        if (frameRef.current) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
      };
    }, [dockedTooltip, portalRoot, snapshot]);

    const hideNow = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = 0;
      }
      setPortalHovered(false);
      setSnapshot(null);
      setPosition(null);
    };

    React.useEffect(() => {
      if (!dockedTooltip || !snapshot) return undefined;
      const dismissOnScroll = (event) => {
        if (
          cardRef.current &&
          event?.target instanceof Node &&
          cardRef.current.contains(event.target)
        ) {
          return;
        }
        hideNow();
      };
      window.addEventListener("scroll", dismissOnScroll, true);
      return () => {
        window.removeEventListener("scroll", dismissOnScroll, true);
      };
    }, [dockedTooltip, snapshot]);

    return h(
      React.Fragment,
      null,
      h("span", {
        ref: anchorRef,
        "aria-hidden": "true",
        style: {
          display: "block",
          width: 0,
          height: 0,
          pointerEvents: "none"
        }
      }),
      snapshot && portalRoot
        ? ReactDOM.createPortal(
            h(TooltipCardSurface, {
              ref: cardRef,
              colors,
              blocks: snapshot.blocks,
              options,
              surfaceStyle: dockedTooltip
                ? {
                    position: "fixed",
                    left: position ? `${position.left}px` : "-9999px",
                    top: position ? `${position.top}px` : "-9999px",
                    width: "min(calc(100vw - 20px), 320px)",
                    maxWidth: "min(calc(100vw - 20px), 320px)",
                    maxHeight: position ? `${position.maxHeight}px` : "calc(100vh - 24px)",
                    overflowX: "hidden",
                    overflowY: "auto",
                    visibility: position ? "visible" : "hidden"
                  }
                : {
                    position: "fixed",
                    left: position ? `${position.left}px` : "-9999px",
                    top: position ? `${position.top}px` : "-9999px",
                    visibility: position ? "visible" : "hidden"
                  },
              onPointerEnter: () => {
                if (!interactive) return;
                if (dockedTooltip || coarsePointer) return;
                if (hideTimerRef.current) {
                  window.clearTimeout(hideTimerRef.current);
                  hideTimerRef.current = 0;
                }
                setPortalHovered(true);
              },
              onPointerLeave: () => {
                if (!interactive) return;
                if (dockedTooltip || coarsePointer || hasPayload) {
                  setPortalHovered(false);
                  return;
                }
                hideNow();
              },
              onClick: (event) => {
                if (!coarsePointer) return;
                event.preventDefault();
                event.stopPropagation();
                dismissTooltipFromChartWrapper(snapshot.chartWrapper);
                hideNow();
              }
            }),
            portalRoot
          )
        : null
    );
  }

  function renderLegendNode({ colors, defs, hiddenKeys, setHiddenKeys, compact = false }) {
    const compactViewport = isCompactViewport();
    const useCompactLayout = compact || compactViewport;
    const embeddedMode =
      typeof dashboardUiUtils.isEmbedMode === "function" && dashboardUiUtils.isEmbedMode();
    const collapsible = useCompactLayout && defs.length > 4 && (!embeddedMode || getModeFromUrl() === "all");
    const shortLabels = {
      "BC long-standing (30d+)": "BC 30d+",
      "BC long-standing (60d+)": "BC 60d+",
      "Median Dev": "Dev",
      "Median UAT": "UAT"
    };
    const shortLabel = (value) => (useCompactLayout ? shortLabels[String(value || "")] || String(value || "") : String(value || ""));
    return h(
      "details",
      {
        className: `series-drawer${collapsible ? " series-drawer--collapsible" : ""}`,
        open: !collapsible
      },
      h(
        "summary",
        {
          className: "series-drawer__summary",
          style: useCompactLayout
            ? {
                minHeight: "32px",
                padding: "2px 6px"
              }
            : null
        },
        collapsible ? `Series (${defs.length})` : "Series"
      ),
      h(
        "div",
        {
          className: "series-drawer__items",
          style: useCompactLayout
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "6px 8px",
                justifyItems: "stretch",
                alignItems: "stretch"
              }
            : null
        },
        defs.map((item) => {
          const key = item?.dataKey || "";
          const hidden = hiddenKeys.has(key);
          const swatchColor =
            item?.legendSwatchBackground || item?.stroke || item?.fill || colors.text;
          return h(
            "button",
            {
              type: "button",
              className: "series-drawer__item",
              "aria-pressed": hidden ? "false" : "true",
              title: hidden ? `Show ${item.name}` : `Hide ${item.name}`,
              style: useCompactLayout
                ? {
                    width: "100%",
                    minHeight: "34px",
                    padding: "6px 8px",
                    justifyContent: "flex-start"
                  }
                : null,
              onClick: () => setHiddenKeys((prev) => toggleLegendKey(prev, key))
            },
            h("span", {
              className: "series-drawer__swatch",
              style: {
                background: swatchColor,
                opacity: hidden ? 0.35 : 1,
                width: useCompactLayout ? "8px" : "10px",
                height: useCompactLayout ? "8px" : "10px"
              }
            }),
            h(
              "span",
              {
                className: "series-drawer__label",
                style: {
                  color: "var(--text, #1f3347)",
                  opacity: hidden ? 0.45 : 1,
                  textDecoration: hidden ? "line-through" : "none",
                  fontSize: useCompactLayout ? 11 : 12,
                  whiteSpace: useCompactLayout ? "normal" : "nowrap",
                  lineHeight: useCompactLayout ? "1.05" : "1.2",
                  overflowWrap: useCompactLayout ? "anywhere" : "normal"
                }
              },
              shortLabel(item.name)
            )
          );
        })
      )
    );
  }

  function axisTick(colors) {
    return {
      fill: colors.text,
      fontSize: 12,
      fontWeight: 500,
      fontFamily: "var(--font-ui)"
    };
  }

  function buildCategoryColorsFromRows(rows, categoryKey) {
    const uniqueLabels = [];
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const label = String(row?.[categoryKey] || "");
      if (!label || seen.has(label)) return;
      seen.add(label);
      uniqueLabels.push(label);
    });
    const mapped = {};
    uniqueLabels.forEach((label, index) => {
      mapped[label] = SHARED_CATEGORY_BLUE_TINTS[index % SHARED_CATEGORY_BLUE_TINTS.length];
    });
    return mapped;
  }

  function twoLineCategoryTickFactory(
    colors,
    { textAnchor = "end", dy = 3, line2Dy = 14, secondaryLabels = null } = {}
  ) {
    return function twoLineCategoryTick(props) {
      const { x, y, payload } = props || {};
      const raw = String(payload?.value || "");
      const splitIndex = raw.indexOf(" (n=");
      const fallbackLine2 = splitIndex > 0 ? raw.slice(splitIndex + 1) : "";
      const mappedLine2 =
        secondaryLabels && typeof secondaryLabels === "object"
          ? String(secondaryLabels[raw] || "")
          : "";
      const line1 = raw;
      const line2 = mappedLine2 || fallbackLine2;
      if (secondaryLabels && textAnchor === "middle") {
        return h(
          "g",
          { transform: `translate(${x},${y})` },
          h(
            "text",
            {
              x: 0,
              y: 12,
              textAnchor: "middle",
              fill: colors.text,
              fontSize: 12,
              fontFamily: "var(--font-ui)"
            },
            line1
          ),
          line2
            ? h(
                "text",
                {
                  x: 0,
                  y: 28,
                  textAnchor: "middle",
                  fill: "rgba(31,51,71,0.78)",
                  fontSize: 11,
                  fontFamily: "var(--font-ui)"
                },
                line2
              )
            : null
        );
      }
      return h(
        "g",
        { transform: `translate(${x},${y})` },
        h(
          "text",
          {
            x: 0,
            y: 0,
            dy,
            textAnchor,
            fill: colors.text,
            fontSize: 12,
            fontFamily: "var(--font-ui)"
          },
          h("tspan", { x: 0, dy: 0, fontFamily: "var(--font-ui)" }, line1),
          line2
            ? h(
                "tspan",
                {
                  x: 0,
                  dy: line2Dy,
                  fill: "rgba(31,51,71,0.75)",
                  fontSize: 11,
                  fontFamily: "var(--font-ui)"
                },
                line2
              )
            : null
        )
      );
    };
  }

  function baseYAxisProps(colors, domain = null) {
    return {
      stroke: colors.text,
      tick: axisTick(colors),
      allowDecimals: false,
      ...(domain ? { domain } : {})
    };
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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function linearScale(value, domainMin, domainMax, rangeMin, rangeMax) {
    const safeValue = toNumber(value);
    if (!Number.isFinite(safeValue)) return rangeMin;
    if (!Number.isFinite(domainMax) || domainMax === domainMin) return rangeMin;
    const ratio = (safeValue - domainMin) / (domainMax - domainMin);
    return rangeMin + ratio * (rangeMax - rangeMin);
  }

  function createBandLayout(labels, { start, end, gap = 0.2, paddingOuter = 0.08 } = {}) {
    const safeLabels = Array.isArray(labels) ? labels : [];
    const total = Math.max(0, toNumber(end) - toNumber(start));
    if (safeLabels.length === 0 || total <= 0) {
      return { bandwidth: 0, gapWidth: 0, positions: [] };
    }
    const outerUnits = paddingOuter * 2;
    const step = total / (safeLabels.length + outerUnits);
    const bandwidth = step * (1 - gap);
    const gapWidth = step - bandwidth;
    const base = toNumber(start) + step * paddingOuter;
    return {
      bandwidth,
      gapWidth,
      positions: safeLabels.map((label, index) => ({
        label,
        x: base + index * step + gapWidth / 2,
        center: base + index * step + step / 2
      }))
    };
  }

  function axisLabel(text, x, y, options = {}) {
    return h(
      "text",
      {
        x,
        y,
        fill: options.fill || "rgba(31, 51, 71, 0.92)",
        fontSize: options.fontSize || 11,
        fontWeight: options.fontWeight || 700,
        textAnchor: options.textAnchor || "middle",
        transform: options.transform
      },
      text
    );
  }

  function buildLifecycleTicks(upper) {
    const safeUpper = Math.max(1, Math.ceil(toNumber(upper)));
    if (safeUpper <= 6) return Array.from({ length: safeUpper + 1 }, (_, index) => index);
    const step = safeUpper <= 12 ? 2 : 3;
    const ticks = [];
    for (let tick = 0; tick <= safeUpper; tick += step) ticks.push(tick);
    if (ticks[ticks.length - 1] !== safeUpper) ticks.push(safeUpper);
    return ticks;
  }

  function formatLifecycleTick(value) {
    const months = toWhole(value);
    if (months <= 0) return "0";
    if (months === 12) return "1 year";
    if (months > 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (remainingMonths === 0) return years === 1 ? "1 year" : `${years} years`;
      return `${years}y ${remainingMonths}m`;
    }
    return `${months}m`;
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

  function teamColorForLabel(colors, label) {
    const safeLabel = String(label || "")
      .trim()
      .toLowerCase();
    if (!colors?.teams) return "#6f9fc6";
    if (safeLabel === "all" || safeLabel === "all teams" || safeLabel === "all teams avg") {
      return colors.teams.all || "#98a4b3";
    }
    if (safeLabel === "api") return colors.teams.api;
    if (safeLabel === "legacy fe" || safeLabel === "frontend") return colors.teams.legacy;
    if (safeLabel === "react fe" || safeLabel === "newfrontend") return colors.teams.react;
    if (safeLabel === "bc" || safeLabel === "broadcast") return colors.teams.bc;
    if (safeLabel === "multi team" || safeLabel === "multi-team" || safeLabel === "multiteam") {
      return colors.teams.multiteam || "#667a4d";
    }
    if (safeLabel === "workers" || safeLabel === "orchestration") return colors.teams.workers;
    if (safeLabel === "titanium" || safeLabel === "media") return colors.teams.titanium;
    return colors.teams.api;
  }

  function estimateTextWidth(text, fontSize = 11) {
    const safeText = String(text || "");
    return safeText.length * fontSize * 0.58;
  }

  function truncateTextToWidth(text, maxWidth, fontSize = 11) {
    const safeText = String(text || "");
    const safeMaxWidth = Math.max(0, toNumber(maxWidth));
    if (!safeText || safeMaxWidth <= 0) return "";
    if (estimateTextWidth(safeText, fontSize) <= safeMaxWidth) return safeText;
    if (estimateTextWidth("…", fontSize) > safeMaxWidth) return "";
    let output = safeText;
    while (output.length > 1 && estimateTextWidth(`${output}…`, fontSize) > safeMaxWidth) {
      output = output.slice(0, -1);
    }
    return `${output}…`;
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

  function buildAxisLabel(value, overrides = {}) {
    const text = String(value || "").trim();
    if (!text) return null;
    const {
      axis = "x",
      offset,
      ...rest
    } = overrides && typeof overrides === "object" ? overrides : {};
    const compactViewport = isCompactViewport();
    const safeOffset = Number.isFinite(Number(offset))
      ? Number(offset)
      : axis === "y"
        ? compactViewport
          ? 1
          : 8
        : compactViewport
          ? 8
          : 18;
    const axisDefaults =
      axis === "y"
        ? {
            position: "left",
            offset: safeOffset,
            content: ({ viewBox }) => {
              const safeViewBox = viewBox && typeof viewBox === "object" ? viewBox : {};
              const x = toNumber(safeViewBox.x) - (compactViewport ? 7 : 16);
              const y = toNumber(safeViewBox.y) + toNumber(safeViewBox.height) / 2;
              return h(
                "text",
                {
                  x,
                  y,
                  fill: "rgba(31, 51, 71, 0.82)",
                  fontFamily: "var(--font-ui)",
                  fontSize: compactViewport ? 10 : 12,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  textAnchor: "middle",
                  dominantBaseline: "central",
                  transform: `rotate(-90 ${x} ${y})`,
                  stroke: "none"
                },
                text
              );
            }
          }
        : compactViewport
          ? {
              position: "bottom",
              offset: safeOffset,
              content: ({ viewBox }) => {
                const safeViewBox = viewBox && typeof viewBox === "object" ? viewBox : {};
                const x = toNumber(safeViewBox.x) + toNumber(safeViewBox.width) / 2;
                const y = toNumber(safeViewBox.y) + toNumber(safeViewBox.height) + 10;
                return h(
                  "text",
                  {
                    x,
                    y,
                    fill: "rgba(31, 51, 71, 0.82)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    textAnchor: "middle",
                    dominantBaseline: "hanging",
                    stroke: "none"
                  },
                  text
                );
              }
            }
          : {
              position: "bottom",
              offset: safeOffset
            };
    return {
      value: text,
      fill: "rgba(31, 51, 71, 0.82)",
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 600,
      stroke: "none",
      letterSpacing: "0.01em",
      ...axisDefaults,
      ...rest
    };
  }

  const ACTIVE_BAR_STYLE = { fillOpacity: 1 };

  function barBaseStyle(colors) {
    return {
      stroke: colors.barBorder || "#111111",
      strokeOpacity: 1,
      strokeWidth: 0.7
    };
  }

  function activeLineDot(colors) {
    return {
      r: 6,
      stroke: colors.tooltip.bg,
      strokeWidth: 2.2
    };
  }

  function buildGroupedBarChildren({
    def,
    rows,
    chartLayout,
    colors,
    isFullyStacked,
    colorByCategoryKey,
    effectiveCategoryColors
  }) {
    const dataKey = def.dataKey || def.key || "",
      name = def.name || def.label || def.key || dataKey,
      fill = def.fill || def.color || colors.text,
      seriesLabel = def.seriesLabel || name;
    const children = [];
    if (def.showValueLabel) {
      children.push(
        h(LabelList, {
          key: `value-label-${dataKey}`,
          dataKey,
          position: chartLayout === "vertical" ? "right" : "top",
          formatter: (value, entry) => {
            const numericValue = Number(value);
            const roundedValue = Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
            const sampleCount = Number(entry?.payload?.[`meta_${dataKey}`]?.n);
            const n = Number.isFinite(sampleCount) ? sampleCount : 0;
            return `${roundedValue}d · n=${n}`;
          },
          fill,
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          offset: 8
        })
      );
    }
    if (def.showSeriesLabel) {
      children.push(
        h(LabelList, {
          key: `series-label-${dataKey}`,
          dataKey,
          position: chartLayout === "vertical" ? "right" : "top",
          formatter: (value) => (toWhole(value) > 0 ? String(seriesLabel || "") : ""),
          fill: "rgba(31,51,71,0.75)",
          fontFamily: "var(--font-ui)",
          fontSize: 9,
          offset: 2
        })
      );
    }
    if (typeof def.endLabelAccessor === "function") {
      children.push(
        h(LabelList, {
          key: `end-label-${dataKey}`,
          dataKey,
          content: (labelProps) => {
            const payload = labelProps?.payload || {};
            const text = String(def.endLabelAccessor(payload) || "").trim();
            if (!text) return null;
            const x = toNumber(labelProps?.x);
            const y = toNumber(labelProps?.y);
            const width = toNumber(labelProps?.width);
            const height = toNumber(labelProps?.height);
            const badgeX = x + width + 10;
            const badgeY = y + Math.max(0, height / 2 - 9);
            const badgeWidth = Math.max(34, text.length * 6.5 + 12);
            return h(
              "g",
              {
                key: `end-label-${dataKey}-${String(payload?.team || payload?.phaseLabel || "")}`
              },
              h("rect", {
                x: badgeX,
                y: badgeY,
                width: badgeWidth,
                height: 18,
                rx: 9,
                ry: 9,
                fill: "rgba(255,255,255,0.94)",
                stroke: "rgba(31,51,71,0.22)",
                strokeWidth: 1
              }),
              h(
                "text",
                {
                  x: badgeX + 6,
                  y: badgeY + 9,
                  fill: def.endLabelColor || "rgba(31,51,71,0.84)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  fontWeight: 600,
                  dominantBaseline: "middle",
                  textAnchor: "start"
                },
                text
              )
            );
          }
        })
      );
    }
    rows.forEach((row, index) => {
      const categoryValue = String(row?.[colorByCategoryKey] || "");
      const fillInfo =
        !isFullyStacked && colorByCategoryKey && effectiveCategoryColors
          ? {
              keyPrefix: "cell",
              fill:
                def?.categoryColors?.[categoryValue] ||
                effectiveCategoryColors?.[categoryValue] ||
                fill
            }
          : typeof def?.cellFillAccessor === "function"
            ? {
                keyPrefix: "cell-fill",
                fill: String(def.cellFillAccessor(row, index) || "").trim() || fill
              }
            : def?.metaTeamColorMap && typeof def.metaTeamColorMap === "object"
              ? {
                  keyPrefix: "cell-meta-team",
                  fill: def.metaTeamColorMap?.[String(row?.[`meta_${dataKey}`]?.team || "")] || fill
                }
              : null;
      if (!fillInfo) return;
      children.push(h(Cell, { key: `${fillInfo.keyPrefix}-${dataKey}-${index}`, fill: fillInfo.fill }));
    });
    return children;
  }

  function buildOverlayNodes(overlayDots, chartLayout, colors) {
    const sourceDots = Array.isArray(overlayDots) ? overlayDots : [];
    if (chartLayout === "horizontal") {
      return sourceDots.flatMap((dot, index) => {
        const keyBase = `overlay-dot-${index}`;
        const x = dot?.x,
          y = toNumber(dot?.y),
          yBase = toNumber(dot?.yBase),
          r = Math.max(2, toNumber(dot?.r)),
          haloR = Math.max(r + 3, toNumber(dot?.haloR)),
          fill = dot?.fill || colors.teams.api,
          stem = Number.isFinite(yBase) && Number.isFinite(y) && y > yBase;
        const nodes = [];
        if (stem) {
          nodes.push(
            h(ReferenceLine, {
              key: `${keyBase}-stem`,
              segment: [
                { x, y: yBase },
                { x, y }
              ],
              stroke: dot?.stemColor || "rgba(31,51,71,0.5)",
              strokeWidth: Number.isFinite(dot?.stemWidth) ? dot.stemWidth : 1
            })
          );
        }
        nodes.push(
          h(ReferenceDot, {
            key: `${keyBase}-halo`,
            x,
            y,
            r: haloR,
            fill,
            fillOpacity: Number.isFinite(dot?.haloOpacity) ? dot.haloOpacity : 0.22,
            stroke: "none",
            isFront: true
          })
        );
        nodes.push(
          h(ReferenceDot, {
            key: `${keyBase}-core`,
            x,
            y,
            r,
            fill,
            stroke: dot?.stroke || "rgba(255,255,255,0.95)",
            strokeWidth: Number.isFinite(dot?.strokeWidth) ? dot.strokeWidth : 1.4,
            isFront: true
          })
        );
        return nodes;
      });
    }
    if (chartLayout !== "vertical") return [];
    return sourceDots
      .map((dot, index) => {
        const keyBase = `overlay-label-${index}`;
        const x = toNumber(dot?.x);
        const y = String(dot?.y || "");
        const labelText = String(dot?.labelText || "").trim();
        if (!Number.isFinite(x) || !y || !labelText) return null;
        return h(ReferenceDot, {
          key: keyBase,
          x,
          y,
          r: 0,
          fill: "transparent",
          stroke: "none",
          isFront: true,
          ifOverflow: "extendDomain",
          label: ({ viewBox }) => {
            const labelX =
              toNumber(viewBox?.x) + (Number.isFinite(toNumber(dot?.labelDx)) ? toNumber(dot?.labelDx) : 10);
            const labelY = toNumber(viewBox?.y);
            const isMuted = Boolean(dot?.muted);
            const labelPrefix = String(dot?.labelPrefix || "").trim();
            const labelFill = isMuted ? "rgba(31,51,71,0.62)" : String(dot?.labelColor || "rgba(31,51,71,0.84)");
            const accentFill = String(dot?.accentColor || (isMuted ? "rgba(113,128,150,0.7)" : "rgba(56,161,105,0.95)"));
            return h(
              "text",
              {
                key: `${keyBase}-label`,
                x: labelX,
                y: labelY,
                fontFamily: "var(--font-ui)",
                fontSize: Number.isFinite(toNumber(dot?.fontSize)) ? toNumber(dot?.fontSize) : 11,
                fontWeight: 600,
                dominantBaseline: "middle",
                textAnchor: "start"
              },
              h(
                "tspan",
                {
                  fill: accentFill
                },
                labelPrefix
              ),
              h(
                "tspan",
                {
                  fill: labelFill,
                  dx: labelPrefix ? 4 : 0
                },
                labelText
              )
            );
          }
        });
      })
      .filter(Boolean);
  }

  function buildMultiSeriesTooltipLines({ row, payload, colors, categoryKey, timeWindowLabel, tooltipLayout, formatDurationValue }) {
    const categoryLabel =
      row?.teamWithSampleBase || row?.[categoryKey] || row.team || "Category";
    const teamLabel = String(categoryLabel).replace(/\s*\(.*\)\s*$/, "");
    const hasDone = Number.isFinite(row?.doneCount);

    if (tooltipLayout === "summary_n_average") {
      const item = payload[0];
      const key = item?.dataKey;
      const meta = row?.[`meta_${key}`] || {};
      const seriesName = String(meta.team || item?.name || "").trim();
      const durationText = formatDurationValue(meta.average);
      return [
        tooltipTitleLine("team", `${teamLabel}${seriesName ? ` • ${seriesName}` : ""}`, colors),
        makeTooltipLine("average", `Team takes on average ${durationText} to ship an idea`, colors, {
          margin: "2px 0",
          fontSize: "12px",
          lineHeight: "1.45"
        }),
        makeTooltipLine("sample", Object.prototype.hasOwnProperty.call(row || {}, "cycleDoneCount") ? `Ideas shipped through cycle = ${toWhole(row?.cycleDoneCount)}` : `n = ${toWhole(meta.n)}`, colors, {
          margin: "2px 0",
          fontSize: "12px",
          lineHeight: "1.45"
        })
      ];
    }

    if (tooltipLayout === "stage_team_breakdown") {
      const orderedItems = payload.map((item) => {
        const key = item?.dataKey;
        const meta = row?.[`meta_${key}`] || {};
        return { item, meta };
      }).filter(({ meta }) => toWhole(meta?.n) > 0);
      const totalText = stageSampleCountFromRow(row) > 0 ? `n = ${stageSampleCountFromRow(row)}` : "";
      const lines = [tooltipTitleLine("team", `${teamLabel}${timeWindowLabel ? ` • ${timeWindowLabel}` : ""}`, colors)];
      if (totalText) {
        lines.push(makeTooltipLine("stage-total", totalText, colors, { margin: "0 0 6px", fontSize: "12px", lineHeight: "1.4" }));
      }
      orderedItems.forEach(({ item, meta }) => {
        const seriesName = String(meta.team || item?.name || "").trim();
        const sampleCount = toWhole(meta.n);
        lines.push(makeTooltipLine(seriesName, `${seriesName} (n=${sampleCount})`, colors, {
          margin: "2px 0",
          fontSize: "12px",
          lineHeight: "1.45",
          preserveSubItems: true,
          subItems: [`${formatDurationValue(meta.average)} average`]
        }));
      });
      return lines;
    }

    const lines = [tooltipTitleLine("team", hasDone ? teamLabel : timeWindowLabel ? `${categoryLabel} • ${timeWindowLabel}` : `${categoryLabel}`, colors)];
    payload.forEach((item) => {
      const key = item?.dataKey;
      const meta = row?.[`meta_${key}`] || {};
      const valueDays = toWhole(item?.value);
      if (valueDays <= 0) return;
      const sampleRaw = Number(meta.n);
      const sampleText =
        Number.isFinite(sampleRaw) && sampleRaw >= 0 ? String(toWhole(sampleRaw)) : "-";
      const seriesName = meta.team || item.name;
      const customSubItems = Array.isArray(meta.subItems) && meta.subItems.length > 0 ? meta.subItems : null;
      lines.push(makeTooltipLine(key, `${String(seriesName)} n=${sampleText}`, colors, {
        margin: "2px 0",
        fontSize: "12px",
        lineHeight: "1.45",
        subItems: customSubItems || [`${formatDurationValue(meta.average)} avg`]
      }));
    });
    return lines;
  }

  function buildMultiSeriesAxisProps({ colors, chartRowsLength, categoryKey, compactViewport, effectiveCategoryTickTwoLine, isHorizontal, categoryAxisHeight, normalizedValueTicks, numericTickFormatter, providedXAxisProps, providedYAxisProps, niceAxis, niceYAxis, twoLineCategoryTickHorizontal, twoLineCategoryTickColumns }) {
    const xAxisProps = {
      ...providedXAxisProps,
      ...(isHorizontal
        ? { type: "number", domain: normalizedValueTicks ? [0, normalizedValueTicks.at(-1)] : [0, niceAxis.upper], ticks: normalizedValueTicks || niceAxis.ticks, interval: 0, allowDecimals: false, tickFormatter: numericTickFormatter }
        : {
            dataKey: categoryKey,
            interval: compactViewport ? tickIntervalForMobileLabels(chartRowsLength) : 0,
            angle: compactViewport ? -28 : 0,
            textAnchor: compactViewport ? "end" : "middle",
            height: Number.isFinite(categoryAxisHeight) && categoryAxisHeight > 0 ? categoryAxisHeight : effectiveCategoryTickTwoLine ? 72 : compactViewport ? 46 : 34,
            minTickGap: compactViewport ? 8 : 4,
            tick: providedXAxisProps.tick || (effectiveCategoryTickTwoLine ? twoLineCategoryTickColumns : { ...axisTick(colors), fontSize: compactViewport ? 11 : 12 })
          })
    };
    const yAxisProps = isHorizontal
      ? {
          ...providedYAxisProps,
          dataKey: categoryKey,
          type: "category",
          width: Number.isFinite(providedYAxisProps.width) ? providedYAxisProps.width : compactViewport ? 144 : HORIZONTAL_CATEGORY_AXIS_WIDTH,
          tick: providedYAxisProps.tick || (effectiveCategoryTickTwoLine ? twoLineCategoryTickHorizontal : undefined)
        }
      : { ...providedYAxisProps, domain: normalizedValueTicks ? [0, normalizedValueTicks.at(-1)] : [0, niceYAxis.upper], ticks: normalizedValueTicks || niceYAxis.ticks, interval: 0, allowDecimals: false, tickFormatter: numericTickFormatter };
    return { xAxisProps, yAxisProps };
  }

  function GroupedBarChartView({
    rows,
    defs,
    colors,
    yUpper,
    xAxisProps,
    yAxisProps,
    tooltipProps,
    showLegend = true,
    chartLayout = "horizontal",
    colorByCategoryKey = "",
    categoryColors = null,
    referenceNodes = [],
    frontReferenceNodes = [],
    overlayDots = [],
    gridVertical = false,
    gridHorizontal = true,
    height = CHART_HEIGHTS.standard,
    margin = { top: 12, right: 12, bottom: 34, left: 12 }
  }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const stackIds = defs.map((def) => String(def?.stackId || "").trim()).filter(Boolean);
    const isFullyStacked = stackIds.length > 0 && new Set(stackIds).size === 1;
    const isHorizontalSingleSeries = chartLayout === "vertical" && defs.length === 1;
    const geometry = isFullyStacked
      ? { categoryGap: "10%", barSize: null, maxBarSize: 96 }
      : isHorizontalSingleSeries
        ? { categoryGap: "18%", barSize: 30, maxBarSize: 30 }
        : (() => {
            const compactViewport = isCompactViewport();
            const safeSeriesCount = Math.max(1, Math.floor(toNumber(defs.length) || 1));
            let categoryGap = compactViewport ? "10%" : BAR_LAYOUT.categoryGap;
            let targetGroupWidth = compactViewport ? 60 : 68;
            if (rows.length <= 8) {
              categoryGap = compactViewport ? "20%" : "30%";
              targetGroupWidth = compactViewport ? 80 : 88;
            } else if (rows.length <= 14) {
              categoryGap = compactViewport ? "12%" : "14%";
              targetGroupWidth = compactViewport ? 92 : 102;
            } else if (compactViewport) {
              categoryGap = "8%";
              targetGroupWidth = 56;
            }
            const rawBarSize =
              (targetGroupWidth - BAR_LAYOUT.groupGap * (safeSeriesCount - 1)) / safeSeriesCount;
            const barSize = Math.max(compactViewport ? 10 : 12, Math.round(rawBarSize));
            return {
              categoryGap,
              barSize,
              maxBarSize: Math.max(barSize, Math.round(barSize * (compactViewport ? 1.15 : 1.25)))
            };
          })();
    const effectiveCategoryColors =
      colorByCategoryKey && (!categoryColors || Object.keys(categoryColors).length === 0)
        ? buildCategoryColorsFromRows(rows, colorByCategoryKey)
        : categoryColors;
    const barNodes = defs.map((def) => {
      const dataKey = def.dataKey || def.key || "";
      const name = def.name || def.label || def.key || dataKey;
      const fill = def.fill || def.color || colors.text;
      return h(
        Bar,
        {
          key: dataKey,
          dataKey,
          name,
          fill,
          stackId: def.stackId,
          barSize: Number.isFinite(geometry.barSize) ? geometry.barSize : undefined,
          radius: isFullyStacked
            ? undefined
            : chartLayout === "vertical"
              ? [0, 4, 4, 0]
              : [4, 4, 0, 0],
          ...barBaseStyle(colors),
          activeBar: ACTIVE_BAR_STYLE,
          hide: hiddenKeys.has(dataKey),
          isAnimationActive: false
        },
        ...buildGroupedBarChildren({
          def,
          rows,
          chartLayout,
          colors,
          isFullyStacked,
          colorByCategoryKey,
          effectiveCategoryColors
        })
      );
    });
    const overlayNodes = buildOverlayNodes(overlayDots, chartLayout, colors);
    const normalizeAxisProps = (axisProps) => {
      if (!axisProps || typeof axisProps !== "object") return axisProps;
      const label = axisProps.label;
      if (!label || typeof label !== "object") return axisProps;
      const lines = String(label.value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const normalizedLabel = {
        ...label,
        fontWeight: 700
      };
      if (lines.length <= 1) {
        return {
          ...axisProps,
          label: normalizedLabel
        };
      }
      const lineHeight = Math.max(14, toNumber(label?.lineHeight) || 16);
      return {
        ...axisProps,
        label: {
          ...normalizedLabel,
          content: (props) => {
            const viewBox = props?.viewBox || {};
            const width = toNumber(viewBox?.width);
            const height = toNumber(viewBox?.height);
            const x = toNumber(viewBox?.x) + width / 2;
            const y = toNumber(viewBox?.y) + height + Math.max(22, toNumber(label?.offset) || 18);
            return h(
              "text",
              {
                x,
                y,
                fill: label?.fill || "rgba(31, 51, 71, 0.82)",
                fontSize: label?.fontSize || 12,
                fontWeight: label?.fontWeight || 700,
                textAnchor: "middle"
              },
              lines.map((line, index) =>
                h(
                  "tspan",
                  {
                    key: `axis-label-line-${index}`,
                    x,
                    dy: index === 0 ? 0 : lineHeight
                  },
                  line
                )
              )
            );
          }
        }
      };
    };
    const normalizedXAxisProps = normalizeAxisProps({
      ...xAxisProps,
      stroke: colors.text,
      tick: xAxisProps?.tick || axisTick(colors)
    });
    const normalizedYAxisProps = normalizeAxisProps(
      yAxisProps
        ? {
            ...yAxisProps,
            stroke: colors.text,
            tick: yAxisProps?.tick || axisTick(colors)
          }
        : baseYAxisProps(colors, yUpper ? [0, yUpper] : null)
    );
    const safeMargin = margin && typeof margin === "object" ? margin : {};
    const resolvedMargin = {
      top: toNumber(safeMargin.top),
      right: toNumber(safeMargin.right),
      bottom: toNumber(safeMargin.bottom),
      left: toNumber(safeMargin.left)
    };
    const compactViewport = isCompactViewport();
    if (normalizedXAxisProps?.label && typeof normalizedXAxisProps.label === "object") {
      const lineCount = String(normalizedXAxisProps.label.value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean).length;
      resolvedMargin.bottom = Math.max(
        resolvedMargin.bottom,
        compactViewport ? 18 + Math.max(1, lineCount) * 8 : 46 + Math.max(1, lineCount) * 16
      );
    }
    if (normalizedYAxisProps?.label && typeof normalizedYAxisProps.label === "object") {
      resolvedMargin.left = Math.max(resolvedMargin.left, compactViewport ? 16 : 46);
    }
    const safeTooltipProps = tooltipProps && typeof tooltipProps === "object" ? tooltipProps : {};
    const wrapperStyle =
      safeTooltipProps.wrapperStyle && typeof safeTooltipProps.wrapperStyle === "object"
        ? safeTooltipProps.wrapperStyle
        : {};
    const allowEscapeViewBox =
      safeTooltipProps.allowEscapeViewBox && typeof safeTooltipProps.allowEscapeViewBox === "object"
        ? safeTooltipProps.allowEscapeViewBox
        : {};
    return h(
      "div",
      { className: "chart-series-shell" },
      showLegend ? renderLegendNode({ colors, defs, hiddenKeys, setHiddenKeys }) : null,
      h(
        ResponsiveContainer,
        { width: "100%", height },
        h(
          BarChart,
          {
            data: rows,
            layout: chartLayout,
            margin: resolvedMargin,
            barCategoryGap: geometry.categoryGap,
            barGap: BAR_LAYOUT.groupGap,
            maxBarSize: geometry.maxBarSize
          },
          h(CartesianGrid, {
            stroke: colors.grid,
            vertical: gridVertical,
            horizontal: gridHorizontal
          }),
          h(XAxis, normalizedXAxisProps),
          h(YAxis, normalizedYAxisProps),
          ...referenceNodes,
          h(Tooltip, {
            ...safeTooltipProps,
            allowEscapeViewBox: {
              x: true,
              y: true,
              ...allowEscapeViewBox
            },
            wrapperStyle: {
              zIndex: 40,
              pointerEvents: "auto",
              maxWidth: compactViewport ? "min(92vw, 300px)" : "min(88vw, 320px)",
              ...wrapperStyle
            }
          }),
          ...barNodes,
          ...frontReferenceNodes,
          ...overlayNodes
        )
      )
    );
  }

  function renderMultiSeriesBars({
    modeKey = "all",
    containerId,
    rows,
    defs,
    colors,
    yUpperOverride = null,
    showLegend = true,
    timeWindowLabel = "",
    orientation = "columns",
    categoryKey = "team",
    categoryTickTwoLine = false,
    categorySecondaryLabels = null,
    referenceNodes = [],
    frontReferenceNodes = [],
    overlayDots = [],
    colorByCategoryKey = "",
    categoryColors = null,
    categoryAxisHeight = null,
    xAxisProps = null,
    yAxisProps = null,
    chartMargin = null,
    gridVertical = false,
    gridHorizontal = true,
    valueTicks = null,
    valueTickFormatter = null,
    tooltipCursor = { fill: BAR_CURSOR_FILL },
    valueUnit = "days",
    tooltipLayout = "default",
    chartHeight = null
  }) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const compactViewport = isCompactViewport();
    const providedXAxisProps = xAxisProps && typeof xAxisProps === "object" ? xAxisProps : {};
    const providedYAxisProps = yAxisProps && typeof yAxisProps === "object" ? yAxisProps : {};
    const seriesDefs = Array.isArray(defs) ? defs : [];
    const normalizedUnit = String(valueUnit || "").toLowerCase();
    const durationUnit =
      normalizedUnit === "weeks" ? "weeks" : normalizedUnit === "months" ? "months" : "days";
    const convertDurationValue =
      durationUnit === "weeks"
        ? toWholeWeeksForChart
        : durationUnit === "months"
          ? toMonthsForChart
          : null;
    const formatDurationValue = (valueInDays) => formatTooltipDuration(valueInDays, durationUnit);
    const chartRows = convertDurationValue
      ? sourceRows.map((row) => {
          const next = { ...row };
          seriesDefs.forEach((series) => {
            const seriesKey = series.key || series.dataKey;
            next[seriesKey] = convertDurationValue(row?.[seriesKey]);
          });
          return next;
        })
      : sourceRows;
    const yValues = seriesDefs.flatMap((series) =>
      chartRows.map((row) => toNumber(row?.[series.key || series.dataKey]))
    );
    const normalizedYUpperOverride =
      Number.isFinite(yUpperOverride) && yUpperOverride > 0
        ? convertDurationValue
          ? convertDurationValue(yUpperOverride)
          : yUpperOverride
        : null;
    const yUpper =
      Number.isFinite(normalizedYUpperOverride) && normalizedYUpperOverride > 0
        ? Math.ceil(normalizedYUpperOverride)
        : computeYUpper(yValues, { min: 1, pad: 1.15 });
    const isHorizontal = orientation === "horizontal";
    const effectiveCategoryTickTwoLine = categoryTickTwoLine && !compactViewport;
    const unitAxis =
      durationUnit === "weeks"
        ? buildWeekAxis(yUpper, { majorStep: 1 })
        : durationUnit === "months"
          ? buildMonthAxis(yUpper, { majorStep: 1 })
          : buildNiceNumberAxis(yUpper);
    const normalizedValueTicks =
      Array.isArray(valueTicks) && valueTicks.length > 1
        ? valueTicks.map((value) => toNumber(value))
        : null;
    const numericTickFormatter =
      typeof valueTickFormatter === "function"
        ? valueTickFormatter
        : durationUnit === "weeks"
          ? formatWeekAxisLabel
          : durationUnit === "months"
            ? formatMonthAxisLabel
            : undefined;
    const twoLineCategoryTickHorizontal = twoLineCategoryTickFactory(colors, {
      textAnchor: "end",
      dy: 3,
      line2Dy: 14,
      secondaryLabels: categorySecondaryLabels
    });
    const twoLineCategoryTickColumns = twoLineCategoryTickFactory(colors, {
      textAnchor: "middle",
      dy: 0,
      line2Dy: 0,
      secondaryLabels: categorySecondaryLabels
    });
    const { xAxisProps: resolvedXAxisProps, yAxisProps: resolvedYAxisProps } =
      buildMultiSeriesAxisProps({
        colors,
        chartRowsLength: chartRows.length,
        categoryKey,
        compactViewport,
        effectiveCategoryTickTwoLine,
        isHorizontal,
        categoryAxisHeight,
        normalizedValueTicks,
        numericTickFormatter,
        providedXAxisProps,
        providedYAxisProps,
        niceAxis: unitAxis,
        niceYAxis: unitAxis,
        twoLineCategoryTickHorizontal,
        twoLineCategoryTickColumns
      });
    renderWithRoot(containerId, chartRows.length > 0 && seriesDefs.length > 0, (root) => {
      root.render(
        h(GroupedBarChartView, {
          rows: chartRows,
          defs: seriesDefs,
          colors,
          yUpper,
          showLegend,
          colorByCategoryKey,
          categoryColors,
          referenceNodes,
          frontReferenceNodes,
          overlayDots,
          gridVertical,
          gridHorizontal,
          height:
            Number.isFinite(chartHeight) && chartHeight > 0
              ? chartHeight
              : singleChartHeightForMode(modeKey, CHART_HEIGHTS.dense),
          margin: chartMargin,
          xAxisProps: resolvedXAxisProps,
          yAxisProps: resolvedYAxisProps,
          chartLayout: isHorizontal ? "vertical" : "horizontal",
          tooltipProps: {
            content: createTooltipContent(colors, (row, payload) =>
              buildMultiSeriesTooltipLines({
                row,
                payload,
                colors,
                categoryKey,
                timeWindowLabel,
                tooltipLayout,
                formatDurationValue
              })
            ),
            cursor: tooltipCursor
          }
        })
      );
    });
  }

  const dashboardSvgCore = {
    h,
    clamp,
    createBandLayout,
    axisLabel,
    buildLifecycleTicks,
    formatLifecycleTick,
    formatTooltipDuration,
    isCompactViewport,
    linearScale,
    renderSvgChart,
    renderWithRoot,
    teamColorForLabel,
    truncateTextToWidth,
    toNumber,
    toWhole,
    estimateTextWidth,
    withAlpha,
    SvgChartShell,
    SvgLegend,
    SvgTooltipCard
  };

  window.DashboardChartCore = {
    React,
    h,
    ResponsiveContainer,
    BarChart,
    LineChart,
    Line,
    ScatterChart,
    Scatter,
    Bar,
    Cell,
    ReferenceArea,
    ReferenceLine,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ACTIVE_BAR_STYLE,
    BAR_CURSOR_FILL,
    BAR_LAYOUT,
    CHART_HEIGHTS,
    HORIZONTAL_CATEGORY_AXIS_WIDTH,
    MAX_SPRINT_POINTS,
    PRIORITY_CONFIG,
    PRIORITY_STACK_ORDER,
    TEAM_CONFIG,
    TREND_LONG_LINES,
    TREND_TEAM_LINES,
    buildTeamColorMap,
    buildTintMap,
    activeLineDot,
    axisTick,
    buildAxisLabel,
    barBaseStyle,
    baseYAxisProps,
    buildNiceNumberAxis,
    buildWeekAxis,
    computeYUpper,
    createTooltipContent,
    formatDateShort,
    formatTooltipDuration,
    isCompactViewport,
    makeTooltipLine,
    renderLegendNode,
    renderMultiSeriesBars,
    renderWithRoot,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    toCount,
    toMonthsForChart,
    orderProductCycleTeams,
    toWhole,
    toWholeWeeksForChart,
    tooltipTitleLine,
    viewportWidthPx,
    trendLayoutForViewport,
    twoLineCategoryTickFactory,
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
