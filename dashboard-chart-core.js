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
  const {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    ReferenceDot,
    ReferenceLine,
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
    trend: 400,
    composition: 420,
    uat: 380,
    management: 380,
    "management-facility": 420,
    contributors: 360,
    "product-cycle": 400,
    "lifecycle-days": 420
  };
  const SINGLE_CHART_EMBED_HEIGHTS = {
    trend: 520,
    composition: 560,
    uat: 460,
    management: 440,
    "management-facility": 520,
    contributors: 520,
    "product-cycle": 560,
    "lifecycle-days": 560
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
    trend: 320,
    composition: 340,
    uat: 300,
    management: 300,
    "management-facility": 300,
    contributors: 250,
    "product-cycle": 270,
    "lifecycle-days": 290
  };
  const HORIZONTAL_CATEGORY_AXIS_WIDTH = 190;
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
    { key: "bc", label: "BC" }
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
    ["bc", "BC", "bc"]
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

  function formatWeeksFromDays(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return "0 weeks";
    if (days < 7) return "<1 week";
    const weeks = Math.max(1, Math.round(toWeeks(days)));
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }

  function formatWeekAxisLabel(value) {
    const weeks = toWhole(value);
    if (weeks <= 0) return "0";
    if (weeks % 4 !== 0) return String(weeks);
    const months = Math.floor(weeks / 4);
    return months === 1 ? "1 month" : `${months} months`;
  }

  function formatMonthsFromDays(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return "0 months";
    if (days < 30.4375) return "<1 month";
    const months = Math.max(1, Math.round(toMonths(days)));
    return months === 1 ? "1 month" : `${months} months`;
  }

  function formatMonthAxisLabel(value) {
    const months = toWhole(value);
    if (months <= 11) return String(months);
    if (months === 12) return "1 year";
    if (months < 24) return "+1 year";
    const years = Math.floor(months / 12);
    return years === 1 ? "1 year" : `${years} years`;
  }

  function formatAverageLabel(value, unit = "days") {
    if (unit === "weeks") {
      const text = formatWeeksFromDays(value).replace("<1 week", "< 1 week");
      return `${text} avg`;
    }
    if (unit === "months") {
      const text = formatMonthsFromDays(value).replace("<1 month", "< 1 month");
      return `${text} avg`;
    }
    return `${toWhole(value)} ${unit} avg`;
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
    if (count <= 8) return 0;
    if (count <= 16) return 1;
    return 2;
  }

  function viewportWidthPx() {
    if (typeof window === "undefined") return 1280;
    const direct = Number(window.innerWidth);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fallback = Number(document?.documentElement?.clientWidth);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 1280;
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
    if (count <= 8) return 0;
    if (count <= 12) return 1;
    if (count <= 18) return 2;
    return 3;
  }

  function trendLayoutForViewport(pointsCount) {
    const width = viewportWidthPx();
    if (width <= 680) {
      return {
        chartHeight: singleChartHeightForMode("trend", 360),
        margin: { top: 4, right: 14, bottom: 20, left: 20 },
        xTickFontSize: 9,
        yTickFontSize: 10,
        xTickMargin: 0,
        minTickGap: 6,
        legendCompact: true,
        xAxisInterval: trendTickInterval(pointsCount)
      };
    }
    if (width <= 1024) {
      return {
        chartHeight: singleChartHeightForMode("trend", 252),
        margin: { top: 12, right: 10, bottom: 60, left: 60 },
        xTickFontSize: 11,
        yTickFontSize: 11,
        xTickMargin: 5,
        minTickGap: 6,
        legendCompact: false,
        xAxisInterval: pointsCount > 14 ? 1 : 0
      };
    }
    return {
      chartHeight: singleChartHeightForMode("trend", CHART_HEIGHTS.standard),
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

  function groupedBarGeometry(rowsCount, seriesCount = 2) {
    const safeSeriesCount = Math.max(1, Math.floor(toNumber(seriesCount) || 1));
    let categoryGap = BAR_LAYOUT.categoryGap;
    let targetGroupWidth = 68;
    if (rowsCount <= 8) {
      categoryGap = "30%";
      targetGroupWidth = 88;
    } else if (rowsCount <= 14) {
      categoryGap = "14%";
      targetGroupWidth = 102;
    }
    const rawBarSize =
      (targetGroupWidth - BAR_LAYOUT.groupGap * (safeSeriesCount - 1)) / safeSeriesCount;
    const barSize = Math.max(12, Math.round(rawBarSize));
    return {
      categoryGap,
      barSize,
      maxBarSize: Math.max(barSize, Math.round(barSize * 1.25))
    };
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
    const suppressHoverPropagation = (event) => {
      if (!event) return;
      event.stopPropagation();
    };
    const suppressHoverPropagationCapture = (event) => {
      if (!event) return;
      event.stopPropagation();
      if (typeof event.preventDefault === "function") event.preventDefault();
    };
    const lines = (Array.isArray(blocks) ? blocks : []).map(normalizeTooltipLine).filter(Boolean);
    const cardStyle = options && typeof options.cardStyle === "object" ? options.cardStyle : null;

    return h(
      "div",
      {
        ref,
        style: {
          border: `1px solid ${colors.tooltip.border}`,
          background: colors.tooltip.bg,
          color: colors.tooltip.text,
          borderRadius: "6px",
          padding: isCompactViewport() ? "7px 9px" : "8px 10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          maxWidth: "min(88vw, 320px)",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          pointerEvents: "auto",
          ...(cardStyle || {}),
          ...(surfaceStyle || {})
        },
        onMouseEnter: suppressHoverPropagation,
        onMouseMove: suppressHoverPropagation,
        onMouseOver: suppressHoverPropagation,
        onMouseEnterCapture: suppressHoverPropagationCapture,
        onMouseMoveCapture: suppressHoverPropagationCapture,
        onMouseOverCapture: suppressHoverPropagationCapture,
        onPointerEnter: (event) => {
          suppressHoverPropagation(event);
          if (typeof onPointerEnter === "function") onPointerEnter(event);
        },
        onPointerMove: suppressHoverPropagation,
        onPointerEnterCapture: suppressHoverPropagationCapture,
        onPointerMoveCapture: suppressHoverPropagationCapture,
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
                fontSize: line?.style?.fontSize || "12px",
                fontWeight: line?.style?.fontWeight || 700,
                lineHeight: line?.style?.lineHeight || "1.4"
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
              paddingLeft: "18px",
              listStyleType: "disc"
            }
          },
          h(
            "li",
            {
              style: {
                margin: "2px 0",
                color: line?.style?.color || colors.text,
                fontSize: line?.style?.fontSize || "12px",
                fontWeight: 500,
                lineHeight: line?.style?.lineHeight || "1.4"
              }
            },
            h("span", null, flattenedText),
            showNestedItems
              ? h(
                  "ul",
                  {
                    style: {
                      margin: "4px 0 0",
                      paddingLeft: "16px",
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
                          fontSize: "11px",
                          fontWeight: 500,
                          lineHeight: "1.35",
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
    const snapshotRef = React.useRef(null);
    const [portalRoot, setPortalRoot] = React.useState(null);
    const [portalHovered, setPortalHovered] = React.useState(false);
    const [snapshot, setSnapshot] = React.useState(null);
    const [position, setPosition] = React.useState(null);
    const coarsePointer = isCoarsePointerDevice();
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
      snapshotRef.current = snapshot;
    }, [snapshot]);

    React.useEffect(() => {
      if (!hasPayload) return;
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = 0;
      }
      const row = payload[0]?.payload || {};
      setSnapshot((previous) => ({
        chartWrapper:
          anchorRef.current?.closest?.(".recharts-wrapper") || previous?.chartWrapper || null,
        panelElement:
          anchorRef.current?.closest?.(".panel") ||
          anchorRef.current?.closest?.(".recharts-wrapper")?.closest?.(".panel") ||
          previous?.panelElement ||
          null,
        coordinate:
          coordinate &&
          Number.isFinite(toNumber(coordinate.x)) &&
          Number.isFinite(toNumber(coordinate.y))
            ? { x: toNumber(coordinate.x), y: toNumber(coordinate.y) }
            : previous?.coordinate || null,
        blocks: buildLines(row, payload)
      }));
    }, [buildLines, coordinate, hasPayload, payload]);

    React.useEffect(() => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = 0;
      }
      if (hasPayload) return;
      if (!snapshotRef.current) return;
      if (!coarsePointer && portalHovered) return;

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
      const dismissOnScroll = () => {
        setPortalHovered(false);
        setSnapshot(null);
        setPosition(null);
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
                    width: "min(calc(100vw - 24px), 360px)",
                    maxWidth: "min(calc(100vw - 24px), 360px)",
                    maxHeight: position ? `${position.maxHeight}px` : "calc(100vh - 24px)",
                    overflow: "hidden",
                    pointerEvents: "none",
                    visibility: position ? "visible" : "hidden"
                  }
                : {
                    position: "fixed",
                    left: position ? `${position.left}px` : "-9999px",
                    top: position ? `${position.top}px` : "-9999px",
                    visibility: position ? "visible" : "hidden"
                  },
              onPointerEnter: () => {
                if (dockedTooltip || coarsePointer) return;
                if (hideTimerRef.current) {
                  window.clearTimeout(hideTimerRef.current);
                  hideTimerRef.current = 0;
                }
                setPortalHovered(true);
              },
              onPointerLeave: () => {
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
    const collapsible =
      compact &&
      defs.length > 3 &&
      typeof dashboardUiUtils.isEmbedMode === "function" &&
      dashboardUiUtils.isEmbedMode() &&
      getModeFromUrl() === "all";
    const shortLabel = (value) => {
      const raw = String(value || "");
      if (!compact) return raw;
      if (raw === "BC long-standing (30d+)") return "BC 30d+";
      if (raw === "BC long-standing (60d+)") return "BC 60d+";
      if (raw === "Median Dev") return "Dev";
      if (raw === "Median UAT") return "UAT";
      return raw;
    };
    return h(
      "details",
      {
        className: `series-drawer${collapsible ? " series-drawer--collapsible" : ""}`,
        open: !collapsible
      },
      h(
        "summary",
        { className: "series-drawer__summary" },
        collapsible ? `Series (${defs.length})` : "Series"
      ),
      h(
        "div",
        { className: "series-drawer__items" },
        defs.map((item) => {
          const key = item?.dataKey || "";
          const hidden = hiddenKeys.has(key);
          const swatchColor = item?.stroke || item?.fill || colors.text;
          return h(
            "button",
            {
              type: "button",
              className: "series-drawer__item",
              "aria-pressed": hidden ? "false" : "true",
              title: hidden ? `Show ${item.name}` : `Hide ${item.name}`,
              onClick: () => setHiddenKeys((prev) => toggleLegendKey(prev, key))
            },
            h("span", {
              className: "series-drawer__swatch",
              style: { background: swatchColor, opacity: hidden ? 0.35 : 1 }
            }),
            h(
              "span",
              {
                className: "series-drawer__label",
                style: {
                  color: "var(--text, #1f3347)",
                  opacity: hidden ? 0.45 : 1,
                  textDecoration: hidden ? "line-through" : "none",
                  fontSize: compact ? 11 : 12
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
    return { fill: colors.text, fontSize: 12, fontWeight: 500 };
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
              fontSize: 12
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
                  fontSize: 11
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
            fontSize: 12
          },
          h("tspan", { x: 0, dy: 0 }, line1),
          line2
            ? h("tspan", { x: 0, dy: line2Dy, fill: "rgba(31,51,71,0.75)", fontSize: 11 }, line2)
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
      fontSize: 12,
      fontWeight: 600,
      stroke: "none",
      letterSpacing: "0.01em",
      ...axisDefaults,
      ...rest
    };
  }

  function axisLabelLines(label) {
    if (!label || typeof label !== "object") return 0;
    return String(label.value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }

  function createMultilineAxisLabelContent(label) {
    const lines = String(label?.value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length <= 1) return null;
    const lineHeight = Math.max(14, toNumber(label?.lineHeight) || 16);
    return (props) => {
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
    };
  }

  function resolveChartMargin(margin, xAxisProps, yAxisProps) {
    const safeMargin = margin && typeof margin === "object" ? margin : {};
    const compactViewport = isCompactViewport();
    const resolved = {
      top: toNumber(safeMargin.top),
      right: toNumber(safeMargin.right),
      bottom: toNumber(safeMargin.bottom),
      left: toNumber(safeMargin.left)
    };
    if (xAxisProps?.label && typeof xAxisProps.label === "object") {
      const lineCount = Math.max(1, axisLabelLines(xAxisProps.label));
      resolved.bottom = Math.max(
        resolved.bottom,
        compactViewport ? 22 + lineCount * 10 : 46 + lineCount * 16
      );
    }
    if (yAxisProps?.label && typeof yAxisProps.label === "object") {
      resolved.left = Math.max(resolved.left, compactViewport ? 18 : 46);
    }
    return resolved;
  }

  function withSafeTooltipProps(tooltipProps = {}) {
    const safeTooltipProps = tooltipProps && typeof tooltipProps === "object" ? tooltipProps : {};
    const wrapperStyle =
      safeTooltipProps.wrapperStyle && typeof safeTooltipProps.wrapperStyle === "object"
        ? safeTooltipProps.wrapperStyle
        : {};
    const allowEscapeViewBox =
      safeTooltipProps.allowEscapeViewBox && typeof safeTooltipProps.allowEscapeViewBox === "object"
        ? safeTooltipProps.allowEscapeViewBox
        : {};
    return {
      ...safeTooltipProps,
      allowEscapeViewBox: {
        x: true,
        y: true,
        ...allowEscapeViewBox
      },
      wrapperStyle: {
        zIndex: 40,
        pointerEvents: "auto",
        maxWidth: "min(88vw, 320px)",
        ...wrapperStyle
      }
    };
  }

  function renderBarChartShell({
    rows,
    colors,
    height,
    margin,
    chartLayout,
    layout,
    xAxisProps,
    yAxisProps,
    tooltipProps,
    legendDrawerNode,
    barNodes,
    overlayNodes = [],
    gridVertical = false,
    gridHorizontal = true
  }) {
    const normalizedXAxisProps = normalizeAxisLabelProps(xAxisProps);
    const normalizedYAxisProps = normalizeAxisLabelProps(yAxisProps);
    const resolvedMargin = resolveChartMargin(margin, normalizedXAxisProps, normalizedYAxisProps);
    return h(
      "div",
      { className: "chart-series-shell" },
      legendDrawerNode,
      h(
        ResponsiveContainer,
        { width: "100%", height },
        h(
          BarChart,
          {
            data: rows,
            layout: chartLayout,
            margin: resolvedMargin,
            barCategoryGap: layout.categoryGap,
            barGap: BAR_LAYOUT.groupGap,
            maxBarSize: layout.maxBarSize
          },
          h(CartesianGrid, {
            stroke: colors.grid,
            vertical: gridVertical,
            horizontal: gridHorizontal
          }),
          h(XAxis, normalizedXAxisProps),
          h(YAxis, normalizedYAxisProps),
          h(Tooltip, withSafeTooltipProps(tooltipProps)),
          ...barNodes,
          ...overlayNodes
        )
      )
    );
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

  function normalizeAxisLabelProps(axisProps) {
    if (!axisProps || typeof axisProps !== "object") return axisProps;
    const label = axisProps.label;
    if (!label || typeof label !== "object") return axisProps;
    const multilineContent = createMultilineAxisLabelContent(label);
    return {
      ...axisProps,
      label: {
        ...label,
        fontWeight: 700,
        content: multilineContent || label.content
      }
    };
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
        : groupedBarGeometry(rows.length, defs.length);
    const effectiveCategoryColors =
      colorByCategoryKey && (!categoryColors || Object.keys(categoryColors).length === 0)
        ? buildCategoryColorsFromRows(rows, colorByCategoryKey)
        : categoryColors;
    const barNodes = defs.map((def) => {
      const barChildren = [];
      if (def.showValueLabel) {
        barChildren.push(
          h(LabelList, {
            key: `value-label-${def.dataKey}`,
            dataKey: def.dataKey,
            position: chartLayout === "vertical" ? "right" : "top",
            formatter: (value, entry) => {
              const numericValue = Number(value);
              const roundedValue = Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
              const sampleCount = Number(entry?.payload?.[`meta_${def.dataKey}`]?.n);
              const n = Number.isFinite(sampleCount) ? sampleCount : 0;
              return `${roundedValue}d · n=${n}`;
            },
            fill: colors.text,
            fontSize: 11,
            offset: 8
          })
        );
      }
      if (def.showSeriesLabel) {
        barChildren.push(
          h(LabelList, {
            key: `series-label-${def.dataKey}`,
            dataKey: def.dataKey,
            position: chartLayout === "vertical" ? "right" : "top",
            formatter: (value) =>
              toWhole(value) > 0 ? String(def.seriesLabel || def.name || "") : "",
            fill: "rgba(31,51,71,0.75)",
            fontSize: 9,
            offset: 2
          })
        );
      }
      const endLabelRenderer =
        typeof def.endLabelAccessor === "function"
          ? (labelProps) => {
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
                  key: `end-label-${def.dataKey}-${String(payload?.team || payload?.phaseLabel || "")}`
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
                    fontSize: 11,
                    fontWeight: 600,
                    dominantBaseline: "middle",
                    textAnchor: "start"
                  },
                  text
                )
              );
            }
          : null;
      if (endLabelRenderer) {
        barChildren.push(
          h(LabelList, {
            key: `end-label-${def.dataKey}`,
            dataKey: def.dataKey,
            content: endLabelRenderer
          })
        );
      }
      const shouldColorByCategory =
        !isFullyStacked && colorByCategoryKey && effectiveCategoryColors;
      if (shouldColorByCategory) {
        rows.forEach((row, index) => {
          const categoryValue = String(row?.[colorByCategoryKey] || "");
          const fill =
            def?.categoryColors?.[categoryValue] ||
            effectiveCategoryColors?.[categoryValue] ||
            def.fill;
          barChildren.push(h(Cell, { key: `cell-${def.dataKey}-${index}`, fill }));
        });
      } else if (def?.metaTeamColorMap && typeof def.metaTeamColorMap === "object") {
        rows.forEach((row, index) => {
          const metaTeam = String(row?.[`meta_${def.dataKey}`]?.team || "");
          const fill = def.metaTeamColorMap?.[metaTeam] || def.fill;
          barChildren.push(h(Cell, { key: `cell-meta-team-${def.dataKey}-${index}`, fill }));
        });
      }
      return h(
        Bar,
        {
          key: def.dataKey,
          dataKey: def.dataKey,
          name: def.name,
          fill: def.fill,
          stackId: def.stackId,
          barSize: Number.isFinite(geometry.barSize) ? geometry.barSize : undefined,
          radius: isFullyStacked
            ? undefined
            : chartLayout === "vertical"
              ? [0, 4, 4, 0]
              : [4, 4, 0, 0],
          ...barBaseStyle(colors),
          activeBar: ACTIVE_BAR_STYLE,
          hide: hiddenKeys.has(def.dataKey),
          isAnimationActive: false
        },
        ...barChildren
      );
    });
    const overlayNodes =
      chartLayout === "horizontal"
        ? (Array.isArray(overlayDots) ? overlayDots : []).flatMap((dot, index) => {
            const keyBase = `overlay-dot-${index}`;
            const x = dot?.x;
            const y = toNumber(dot?.y);
            const yBase = toNumber(dot?.yBase);
            const r = Math.max(2, toNumber(dot?.r));
            const haloR = Math.max(r + 3, toNumber(dot?.haloR));
            const fill = dot?.fill || colors.teams.api;
            const stem = Number.isFinite(yBase) && Number.isFinite(y) && y > yBase;
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
          })
        : chartLayout === "vertical"
          ? (Array.isArray(overlayDots) ? overlayDots : [])
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
                      toNumber(viewBox?.x) +
                      (Number.isFinite(toNumber(dot?.labelDx)) ? toNumber(dot?.labelDx) : 10);
                    const labelY = toNumber(viewBox?.y);
                    const isMuted = Boolean(dot?.muted);
                    const labelPrefix = String(dot?.labelPrefix || "").trim();
                    const labelFill = isMuted
                      ? "rgba(31,51,71,0.62)"
                      : String(dot?.labelColor || "rgba(31,51,71,0.84)");
                    const accentFill = String(
                      dot?.accentColor ||
                        (isMuted ? "rgba(113,128,150,0.7)" : "rgba(56,161,105,0.95)")
                    );
                    return h(
                      "text",
                      {
                        key: `${keyBase}-label`,
                        x: labelX,
                        y: labelY,
                        fontSize: Number.isFinite(toNumber(dot?.fontSize))
                          ? toNumber(dot?.fontSize)
                          : 11,
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
              .filter(Boolean)
          : [];
    return renderBarChartShell({
      rows,
      colors,
      height,
      margin,
      chartLayout,
      layout: geometry,
      xAxisProps: {
        ...xAxisProps,
        stroke: colors.text,
        tick: xAxisProps?.tick || axisTick(colors)
      },
      yAxisProps: yAxisProps
        ? {
            ...yAxisProps,
            stroke: colors.text,
            tick: yAxisProps?.tick || axisTick(colors)
          }
        : baseYAxisProps(colors, yUpper ? [0, yUpper] : null),
      tooltipProps,
      legendDrawerNode: showLegend
        ? renderLegendNode({ colors, defs, hiddenKeys, setHiddenKeys })
        : null,
      barNodes,
      overlayNodes,
      gridVertical,
      gridHorizontal
    });
  }

  function renderGroupedBars(containerId, canRender, props) {
    renderWithRoot(containerId, canRender, (root) => {
      root.render(h(GroupedBarChartView, props));
    });
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
    tooltipLayout = "default"
  }) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const compactViewport = isCompactViewport();
    const providedXAxisProps = xAxisProps && typeof xAxisProps === "object" ? xAxisProps : {};
    const providedYAxisProps = yAxisProps && typeof yAxisProps === "object" ? yAxisProps : {};
    const seriesDefs = (Array.isArray(defs) ? defs : []).map((def) => ({
      key: def.key,
      name: def.name || def.label || def.key,
      color: def.color,
      stackId: def.stackId,
      categoryColors: def.categoryColors,
      showValueLabel: Boolean(def.showValueLabel),
      showSeriesLabel: Boolean(def.showSeriesLabel),
      seriesLabel: def.seriesLabel || def.name || def.label || def.key,
      metaTeamColorMap: def.metaTeamColorMap,
      endLabelAccessor: typeof def.endLabelAccessor === "function" ? def.endLabelAccessor : null,
      endLabelColor: String(def.endLabelColor || "").trim()
    }));
    const normalizedUnit = String(valueUnit || "").toLowerCase();
    const displayInWeeks = normalizedUnit === "weeks";
    const displayInMonths = normalizedUnit === "months";
    const chartRows = displayInWeeks
      ? sourceRows.map((row) => {
          const next = { ...row };
          seriesDefs.forEach((series) => {
            next[series.key] = toWholeWeeksForChart(row?.[series.key]);
          });
          return next;
        })
      : displayInMonths
        ? sourceRows.map((row) => {
            const next = { ...row };
            seriesDefs.forEach((series) => {
              next[series.key] = toMonthsForChart(row?.[series.key]);
            });
            return next;
          })
        : sourceRows;
    const yValues = seriesDefs.flatMap((series) =>
      chartRows.map((row) => toNumber(row?.[series.key]))
    );
    const normalizedYUpperOverride =
      Number.isFinite(yUpperOverride) && yUpperOverride > 0
        ? displayInWeeks
          ? toWholeWeeksForChart(yUpperOverride)
          : displayInMonths
            ? toMonthsForChart(yUpperOverride)
            : yUpperOverride
        : null;
    const yUpper =
      Number.isFinite(normalizedYUpperOverride) && normalizedYUpperOverride > 0
        ? Math.ceil(normalizedYUpperOverride)
        : computeYUpper(yValues, { min: 1, pad: 1.15 });
    const isHorizontal = orientation === "horizontal";
    const effectiveCategoryTickTwoLine = categoryTickTwoLine && !compactViewport;
    const weeklyAxis = displayInWeeks ? buildWeekAxis(yUpper, { majorStep: 1 }) : null;
    const monthlyAxis = displayInMonths ? buildMonthAxis(yUpper, { majorStep: 1 }) : null;
    const niceAxis = isHorizontal
      ? displayInWeeks
        ? weeklyAxis
        : displayInMonths
          ? monthlyAxis
          : buildNiceNumberAxis(yUpper)
      : null;
    const niceYAxis = !isHorizontal
      ? displayInWeeks
        ? weeklyAxis
        : displayInMonths
          ? monthlyAxis
          : buildNiceNumberAxis(yUpper)
      : null;
    const normalizedValueTicks =
      Array.isArray(valueTicks) && valueTicks.length > 1
        ? valueTicks.map((value) => toNumber(value))
        : null;
    const resolvedChartMargin =
      chartMargin && typeof chartMargin === "object"
        ? {
            top: Number.isFinite(chartMargin.top) ? chartMargin.top : 14,
            right: Number.isFinite(chartMargin.right) ? chartMargin.right : 12,
            bottom: Number.isFinite(chartMargin.bottom) ? chartMargin.bottom : 34,
            left: Number.isFinite(chartMargin.left) ? chartMargin.left : 12
          }
        : { top: 14, right: 12, bottom: 34, left: 12 };
    const numericTickFormatter =
      typeof valueTickFormatter === "function"
        ? valueTickFormatter
        : displayInWeeks
          ? formatWeekAxisLabel
          : displayInMonths
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
    renderGroupedBars(containerId, chartRows.length > 0 && seriesDefs.length > 0, {
      rows: chartRows,
      defs: seriesDefs.map((series) => ({
        dataKey: series.key,
        name: series.name,
        fill: series.color,
        stackId: series.stackId,
        categoryColors: series.categoryColors,
        showValueLabel: Boolean(series.showValueLabel),
        showSeriesLabel: Boolean(series.showSeriesLabel),
        seriesLabel: series.seriesLabel || series.name,
        metaTeamColorMap: series.metaTeamColorMap,
        endLabelAccessor: series.endLabelAccessor,
        endLabelColor: series.endLabelColor
      })),
      colors,
      yUpper,
      showLegend,
      colorByCategoryKey,
      categoryColors,
      overlayDots,
      gridVertical,
      gridHorizontal,
      height: singleChartHeightForMode(modeKey, CHART_HEIGHTS.dense),
      margin: resolvedChartMargin,
      xAxisProps: {
        ...providedXAxisProps,
        ...(isHorizontal
          ? {
              type: "number",
              domain: normalizedValueTicks ? [0, normalizedValueTicks.at(-1)] : [0, niceAxis.upper],
              ticks: normalizedValueTicks || niceAxis.ticks,
              interval: 0,
              allowDecimals: false,
              tickFormatter: numericTickFormatter
            }
          : {
              dataKey: categoryKey,
              interval: compactViewport ? tickIntervalForMobileLabels(chartRows.length) : 0,
              angle: compactViewport ? -28 : 0,
              textAnchor: compactViewport ? "end" : "middle",
              height:
                Number.isFinite(categoryAxisHeight) && categoryAxisHeight > 0
                  ? categoryAxisHeight
                  : effectiveCategoryTickTwoLine
                    ? 72
                    : compactViewport
                      ? 52
                      : 34,
              minTickGap: compactViewport ? 10 : 4,
              tick:
                providedXAxisProps.tick ||
                (effectiveCategoryTickTwoLine
                  ? twoLineCategoryTickColumns
                  : { ...axisTick(colors), fontSize: compactViewport ? 11 : 12 })
            })
      },
      yAxisProps: isHorizontal
        ? {
            ...providedYAxisProps,
            dataKey: categoryKey,
            type: "category",
            width: Number.isFinite(providedYAxisProps.width)
              ? providedYAxisProps.width
              : HORIZONTAL_CATEGORY_AXIS_WIDTH,
            tick:
              providedYAxisProps.tick ||
              (effectiveCategoryTickTwoLine ? twoLineCategoryTickHorizontal : undefined)
          }
        : {
            ...providedYAxisProps,
            domain: normalizedValueTicks ? [0, normalizedValueTicks.at(-1)] : [0, niceYAxis.upper],
            ticks: normalizedValueTicks || niceYAxis.ticks,
            interval: 0,
            allowDecimals: false,
            tickFormatter: numericTickFormatter
          },
      chartLayout: isHorizontal ? "vertical" : "horizontal",
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => {
          const categoryLabel =
            row?.teamWithSampleBase || row?.[categoryKey] || row.team || "Category";
          const teamLabel = String(categoryLabel).replace(/\s*\(.*\)\s*$/, "");
          const hasDone = Number.isFinite(row?.doneCount);
          if (tooltipLayout === "summary_n_average") {
            const item = payload[0];
            const key = item?.dataKey;
            const meta = row?.[`meta_${key}`] || {};
            const seriesName = String(meta.team || item?.name || "").trim();
            const durationText = displayInWeeks
              ? formatWeeksFromDays(meta.average).replace("<1 week", "< 1 week")
              : displayInMonths
                ? formatMonthsFromDays(meta.average).replace("<1 month", "< 1 month")
                : `${toWhole(meta.average)} days`;
            return [
              tooltipTitleLine(
                "team",
                `${teamLabel}${seriesName ? ` • ${seriesName}` : ""}`,
                colors
              ),
              makeTooltipLine(
                "average",
                `Team takes on average ${durationText} to ship an idea`,
                colors,
                {
                  margin: "2px 0",
                  fontSize: "12px",
                  lineHeight: "1.45"
                }
              ),
              makeTooltipLine(
                "sample",
                Object.prototype.hasOwnProperty.call(row || {}, "cycleDoneCount")
                  ? `Ideas shipped through cycle = ${toWhole(row?.cycleDoneCount)}`
                  : `n = ${toWhole(meta.n)}`,
                colors,
                {
                  margin: "2px 0",
                  fontSize: "12px",
                  lineHeight: "1.45"
                }
              )
            ];
          }
          if (tooltipLayout === "stage_team_breakdown") {
            const orderedItems = payload
              .map((item) => {
                const key = item?.dataKey;
                const meta = row?.[`meta_${key}`] || {};
                return { item, meta };
              })
              .filter(({ meta }) => toWhole(meta?.n) > 0);
            const totalText =
              stageSampleCountFromRow(row) > 0 ? `n = ${stageSampleCountFromRow(row)}` : "";
            const lines = [
              tooltipTitleLine(
                "team",
                `${teamLabel}${timeWindowLabel ? ` • ${timeWindowLabel}` : ""}`,
                colors
              )
            ];
            if (totalText) {
              lines.push(
                makeTooltipLine("stage-total", totalText, colors, {
                  margin: "0 0 6px",
                  fontSize: "12px",
                  lineHeight: "1.4"
                })
              );
            }
            orderedItems.forEach(({ item, meta }) => {
              const seriesName = String(meta.team || item?.name || "").trim();
              const sampleCount = toWhole(meta.n);
              lines.push(
                makeTooltipLine(seriesName, `${seriesName} (n=${sampleCount})`, colors, {
                  margin: "2px 0",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  preserveSubItems: true,
                  subItems: [
                    displayInWeeks
                      ? `${formatWeeksFromDays(meta.average).replace("<1 week", "< 1 week")} average`
                      : displayInMonths
                        ? `${formatMonthsFromDays(meta.average).replace("<1 month", "< 1 month")} average`
                        : `${toWhole(meta.average)} days average`
                  ]
                })
              );
            });
            return lines;
          }
          const lines = [
            tooltipTitleLine(
              "team",
              hasDone
                ? teamLabel
                : timeWindowLabel
                  ? `${categoryLabel} • ${timeWindowLabel}`
                  : `${categoryLabel}`,
              colors
            )
          ];
          payload.forEach((item) => {
            const key = item?.dataKey;
            const meta = row?.[`meta_${key}`] || {};
            const valueDays = toWhole(item?.value);
            if (valueDays <= 0) return;
            const sampleRaw = Number(meta.n);
            const sampleText =
              Number.isFinite(sampleRaw) && sampleRaw >= 0 ? String(toWhole(sampleRaw)) : "-";
            const seriesName = meta.team || item.name;
            const customSubItems =
              Array.isArray(meta.subItems) && meta.subItems.length > 0 ? meta.subItems : null;
            lines.push(
              makeTooltipLine(key, `${String(seriesName)} n=${sampleText}`, colors, {
                margin: "2px 0",
                fontSize: "12px",
                lineHeight: "1.45",
                subItems: customSubItems || [
                  displayInWeeks
                    ? formatAverageLabel(meta.average, "weeks")
                    : displayInMonths
                      ? formatAverageLabel(meta.average, "months")
                      : formatAverageLabel(meta.average, "days")
                ]
              })
            );
          });
          return lines;
        }),
        cursor: tooltipCursor
      }
    });
  }

  window.DashboardChartCore = {
    React,
    h,
    ResponsiveContainer,
    LineChart,
    Line,
    Bar,
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
    activeLineDot,
    axisTick,
    buildAxisLabel,
    barBaseStyle,
    baseYAxisProps,
    buildNiceNumberAxis,
    buildWeekAxis,
    computeYUpper,
    createTooltipContent,
    formatAverageLabel,
    formatDateShort,
    isCompactViewport,
    makeTooltipLine,
    renderBarChartShell,
    renderGroupedBars,
    renderLegendNode,
    renderMultiSeriesBars,
    renderWithRoot,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    toMonthsForChart,
    toWhole,
    toWholeWeeksForChart,
    tooltipTitleLine,
    trendLayoutForViewport,
    twoLineCategoryTickFactory,
    withSafeTooltipProps
  };
  window.DashboardCharts = { ...(window.DashboardCharts || {}), clearChart };
})();
