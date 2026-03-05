/* global React, ReactDOM, Recharts */
"use strict";

(function initDashboardCharts() {
  if (!window.React || !window.ReactDOM || !window.Recharts) {
    window.DashboardCharts = null;
    return;
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

  const TEAM_CONFIG = [{ key: "api", label: "API" }, { key: "legacy", label: "Legacy FE" }, { key: "react", label: "React FE" }, { key: "bc", label: "BC" }];
  const PRIORITY_CONFIG = [{ key: "highest", label: "Highest" }, { key: "high", label: "High" }, { key: "medium", label: "Medium" }, { key: "low", label: "Low" }, { key: "lowest", label: "Lowest" }];
  const PRIORITY_STACK_ORDER = [...PRIORITY_CONFIG].reverse();
  const MAX_SPRINT_POINTS = 10;
  const BAR_LAYOUT = { categoryGap: "14%", groupGap: 2, denseMax: 14, normalMax: 20 };
  const CHART_HEIGHTS = { standard: 280, dense: 320 };
  const HORIZONTAL_CATEGORY_AXIS_WIDTH = 190;
  const BAR_CURSOR_FILL = "rgba(31,51,71,0.04)";
  const SHARED_CATEGORY_BLUE_TINTS = ["#CFE0F8", "#9EBAE3", "#6D95D1", "#3F73B8", "#295996"];
  const TREND_TEAM_LINES = [
    ["api", "API", "api"],
    ["legacy", "Legacy FE", "legacy"],
    ["react", "React FE", "react"],
    ["bc", "BC", "bc"]
  ];
  const TREND_LONG_LINES = [
    { dataKey: "bcLong30", name: "BC long-standing (30d+)", stroke: "#8e9aaa", strokeDasharray: "4 3" },
    { dataKey: "bcLong60", name: "BC long-standing (60d+)", stroke: "#6f7f92", strokeDasharray: "7 4" }
  ];

  const roots = {
    trend: null,
    composition: null,
    uat: null,
    management: null,
    managementFacility: null,
    contributors: null,
    productCycle: null,
    lifecycleDays: null
  };
  const rootContainerIds = {};

  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function toWhole(value) {
    return Math.round(toNumber(value));
  }

  function toWeeks(valueInDays) {
    return toNumber(valueInDays) / 7;
  }

  function toWholeWeeksForChart(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return 0;
    if (days < 7) return 1;
    return Math.max(1, Math.round(toWeeks(days)));
  }

  function formatWeeksFromDays(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return "0 weeks";
    if (days < 7) return "<1 week";
    const weeks = Math.max(1, Math.round(toWeeks(days)));
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }

  function buildWeekAxis(maxValueWeeks, options = {}) {
    const majorStep = Math.max(1, toWhole(options?.majorStep || 0));
    const fixedStep = Number.isFinite(majorStep) && majorStep > 0 ? majorStep : null;
    const maxWeeks = Math.max(1, Math.ceil(toNumber(maxValueWeeks)));
    const axisWeeks = fixedStep ? Math.max(fixedStep, Math.ceil(maxWeeks / fixedStep) * fixedStep) : maxWeeks <= 4 ? maxWeeks : Math.ceil(maxWeeks / 2) * 2;
    const ticks = [0];
    if (fixedStep) {
      for (let week = fixedStep; week <= axisWeeks; week += fixedStep) ticks.push(week);
      return { upper: axisWeeks, ticks };
    }
    [1, 2, 3, 4, 6, 8, 10, 12, 14].forEach((week) => {
      if (week <= axisWeeks) ticks.push(week);
    });
    for (let week = 16; week <= axisWeeks; week += 2) ticks.push(week);
    return { upper: axisWeeks, ticks };
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

  function viewportHeightPx() {
    if (typeof window === "undefined") return 900;
    const direct = Number(window.innerHeight);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fallback = Number(document?.documentElement?.clientHeight);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 900;
  }

  function chartModeFromUrl() {
    if (typeof window === "undefined") return "all";
    const params = new URLSearchParams(window.location.search);
    const chart = String(params.get("chart") || "").toLowerCase();
    if (chart === "trend") return "trend";
    if (chart === "composition") return "composition";
    if (chart === "uat") return "uat";
    if (chart === "dev-uat-ratio") return "management";
    if (chart === "dev-uat-facility" || chart === "management-facility") return "management-facility";
    if (chart === "contributors") return "contributors";
    if (chart === "product-cycle" || chart === "cycle-time") return "product-cycle";
    if (chart === "lifecycle-days") return "lifecycle-days";
    return "all";
  }

  function singleChartHeightForMode(modeKey, baseHeight) {
    if (chartModeFromUrl() !== modeKey) return baseHeight;
    const width = viewportWidthPx();
    const viewportHeight = viewportHeightPx();
    const smallMin = Math.max(300, Math.round(baseHeight * 1.05));
    const mediumMin = Math.max(340, Math.round(baseHeight * 1.1));
    const largeMin = Math.max(360, Math.round(baseHeight * 1.15));

    if (width <= 680) {
      return Math.max(smallMin, Math.min(680, Math.round(viewportHeight * 0.5)));
    }
    if (width <= 1024) {
      return Math.max(mediumMin, Math.min(760, Math.round(viewportHeight * 0.56)));
    }
    return Math.max(largeMin, Math.min(920, Math.round(viewportHeight * 0.62)));
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
        chartHeight: singleChartHeightForMode("trend", 224),
        margin: { top: 10, right: 8, bottom: 24, left: 8 },
        xTickFontSize: 10,
        yTickFontSize: 10,
        xTickMargin: 4,
        minTickGap: 8,
        legendCompact: true,
        xAxisInterval: trendTickInterval(pointsCount)
      };
    }
    if (width <= 1024) {
      return {
        chartHeight: singleChartHeightForMode("trend", 252),
        margin: { top: 12, right: 10, bottom: 28, left: 10 },
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
      margin: { top: 12, right: 12, bottom: 32, left: 12 },
      xTickFontSize: 11,
      yTickFontSize: 11,
      xTickMargin: 6,
      minTickGap: 4,
      legendCompact: false,
      xAxisInterval: 0
    };
  }

  function totalForPoint(point) {
    return (
      toNumber(point?.highest) +
      toNumber(point?.high) +
      toNumber(point?.medium) +
      toNumber(point?.low) +
      toNumber(point?.lowest)
    );
  }

  function formatDateShort(date) {
    const [year, month, day] = String(date || "").split("-");
    if (!year || !month || !day) return String(date || "");
    return `${month}/${day}`;
  }

  function ensureRoot(kind, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    rootContainerIds[kind] = containerId;
    if (!roots[kind]) {
      roots[kind] = ReactDOM.createRoot(container);
    }
    return roots[kind];
  }

  function clearChart({ containerId }) {
    if (!containerId) return;
    for (const [kind, id] of Object.entries(rootContainerIds)) {
      if (id === containerId && roots[kind]) {
        roots[kind].render(null);
        return;
      }
    }

    const container = document.getElementById(containerId);
    if (container) container.innerHTML = "";
  }

  function renderWithRoot(kind, containerId, canRender, renderFn) {
    const root = ensureRoot(kind, containerId);
    if (!root) return;
    if (!canRender) {
      root.render(null);
      return;
    }
    renderFn(root);
  }

  function buildTrendData(snapshot) {
    const allPoints = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const points = allPoints.slice(-MAX_SPRINT_POINTS);
    return points.map((point) => {
      const api = point?.api || {};
      const legacy = point?.legacy || {};
      const react = point?.react || {};
      const bc = point?.bc || {};
      return {
        date: point.date,
        dateShort: formatDateShort(point.date),
        api: totalForPoint(api),
        legacy: totalForPoint(legacy),
        react: totalForPoint(react),
        bc: totalForPoint(bc),
        bcLong30: toNumber(bc.longstanding_30d_plus),
        bcLong60: toNumber(bc.longstanding_60d_plus)
      };
    });
  }

  function buildCompositionData(snapshot, scope) {
    const allPoints = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const points = allPoints.slice(-MAX_SPRINT_POINTS);
    const selectedTeams =
      scope === "all" ? TEAM_CONFIG : TEAM_CONFIG.filter((team) => team.key === scope);
    const isSingleTeam = scope !== "all";

    const rows = [];
    for (const point of points) {
      selectedTeams.forEach((team) => {
        const teamPoint = point?.[team.key] || {};
        const shortDate = formatDateShort(point.date);
        rows.push({
          bucketLabel: isSingleTeam ? shortDate : `${shortDate} • ${team.label}`,
          date: point.date,
          team: team.label,
          highest: toNumber(teamPoint.highest),
          high: toNumber(teamPoint.high),
          medium: toNumber(teamPoint.medium),
          low: toNumber(teamPoint.low),
          lowest: toNumber(teamPoint.lowest),
          total: totalForPoint(teamPoint)
        });
      });
    }
    return rows;
  }

  function makeTooltipLine(
    key,
    text,
    colors,
    { margin = "2px 0", fontSize = "12px", fontWeight, color, lineHeight = "1.4", subItems = null, isTitle = false } = {}
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
      isTitle: Boolean(isTitle)
    };
  }

  function trendLineDefs(colors) {
    return [
      ...TREND_TEAM_LINES.map(([dataKey, name, colorKey]) => ({
        dataKey,
        name,
        stroke: colors.teams[colorKey],
        strokeWidth: 2.5,
        dot: { r: 3 }
      })),
      ...TREND_LONG_LINES.map((line) => ({
        ...line,
        strokeWidth: 2,
        dot: { r: 3 }
      }))
    ];
  }

  function tooltipTitleLine(key, text, colors) {
    return makeTooltipLine(key, text, colors, {
      margin: "0 0 6px",
      fontWeight: 700,
      fontSize: null,
      isTitle: true
    });
  }

  function createTooltipContent(colors, buildLines) {
    return function renderTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      return renderTooltipCard(colors, buildLines(row, payload));
    };
  }

  function isCoarsePointerDevice() {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  function dismissTooltipFromTap(node) {
    if (!node || typeof node.closest !== "function" || typeof window === "undefined") return;
    const wrapper = node.closest(".recharts-wrapper");
    if (!wrapper) return;
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

  function renderTooltipCard(colors, blocks) {
    const suppressHoverPropagation = (event) => {
      if (!event) return;
      event.stopPropagation();
    };
    const suppressHoverPropagationCapture = (event) => {
      if (!event) return;
      event.stopPropagation();
      if (typeof event.preventDefault === "function") event.preventDefault();
    };
    const normalizeLine = (entry, index) => {
      if (!entry) return null;
      if (typeof entry === "string") return { key: `line-${index}`, text: entry, subItems: null, isTitle: false, style: {} };
      if (typeof entry === "object" && "text" in entry) return entry;
      return null;
    };
    const asSubItems = (line) => {
      if (!line || line.isTitle) return [];
      if (Array.isArray(line.subItems) && line.subItems.length > 0) {
        return line.subItems
          .map((item) => {
            if (typeof item === "string") return item.trim();
            return item;
          })
          .filter((item) => {
            if (item === null || item === undefined) return false;
            if (typeof item === "string") return item.length > 0;
            return true;
          });
      }
      const text = String(line.text || "").trim();
      const colonIndex = text.indexOf(":");
      if (colonIndex > 0) {
        const label = text.slice(0, colonIndex).trim();
        const detail = text.slice(colonIndex + 1).trim();
        const parts = detail.split(",").map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) {
          line.text = label;
          return parts;
        }
      }
      return [];
    };

    const normalizeMainText = (line) => {
      if (!line || line.isTitle) return String(line?.text || "");
      const text = String(line.text || "").trim();
      const colonIndex = text.indexOf(":");
      if (colonIndex > 0) {
        const label = text.slice(0, colonIndex).trim();
        const detail = text.slice(colonIndex + 1).trim();
        const parts = detail.split(",").map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) return label;
      }
      return text;
    };
    const lines = (Array.isArray(blocks) ? blocks : [])
      .map(normalizeLine)
      .filter(Boolean);

    return h(
      "div",
      {
        style: {
          border: `1px solid ${colors.tooltip.border}`,
          background: colors.tooltip.bg,
          color: colors.tooltip.text,
          borderRadius: "6px",
          padding: "8px 10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)"
        },
        onMouseEnter: suppressHoverPropagation,
        onMouseMove: suppressHoverPropagation,
        onMouseOver: suppressHoverPropagation,
        onMouseEnterCapture: suppressHoverPropagationCapture,
        onMouseMoveCapture: suppressHoverPropagationCapture,
        onMouseOverCapture: suppressHoverPropagationCapture,
        onPointerEnter: suppressHoverPropagation,
        onPointerMove: suppressHoverPropagation,
        onPointerEnterCapture: suppressHoverPropagationCapture,
        onPointerMoveCapture: suppressHoverPropagationCapture,
        onClick: (event) => {
          if (!isCoarsePointerDevice()) return;
          event.preventDefault();
          event.stopPropagation();
          const node = event.currentTarget;
          if (node && node.style) node.style.display = "none";
          dismissTooltipFromTap(node);
        }
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

        const subItems = asSubItems(line);
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
            h("span", null, normalizeMainText(line)),
            subItems.length > 0
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
  }

  function renderLegendNode({ colors, defs, hiddenKeys, setHiddenKeys, compact = false }) {
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
        className: "series-drawer",
        open: true
      },
      h(
        "summary",
        { className: "series-drawer__summary" },
        "Series"
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
        // Keep primary category where default x-axis labels normally sit; place meta line below.
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
            margin,
            barCategoryGap: layout.categoryGap,
            barGap: BAR_LAYOUT.groupGap,
            maxBarSize: layout.maxBarSize
          },
          h(CartesianGrid, { stroke: colors.grid, vertical: gridVertical, horizontal: gridHorizontal }),
          h(XAxis, xAxisProps),
          h(YAxis, yAxisProps),
          h(Tooltip, tooltipProps),
          ...barNodes,
          ...overlayNodes
        )
      )
    );
  }

  function computeYUpper(values, { min = 1, pad = 1.12 } = {}) {
    const finiteValues = (Array.isArray(values) ? values : []).filter((value) =>
      Number.isFinite(value)
    );
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
    const rawBarSize = (targetGroupWidth - BAR_LAYOUT.groupGap * (safeSeriesCount - 1)) / safeSeriesCount;
    const barSize = Math.max(12, Math.round(rawBarSize));
    return {
      categoryGap,
      barSize,
      maxBarSize: Math.max(barSize, Math.round(barSize * 1.25))
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

  function TrendChartView({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const lineDefs = trendLineDefs(colors);
    const layout = trendLayoutForViewport(rows.length);

    return h(
      "div",
      { className: "chart-series-shell" },
      renderLegendNode({
        colors,
        defs: lineDefs,
        hiddenKeys,
        setHiddenKeys,
        compact: layout.legendCompact
      }),
      h(
        ResponsiveContainer,
        { width: "100%", height: layout.chartHeight },
        h(
          LineChart,
          {
            data: rows,
            margin: layout.margin
          },
          h(CartesianGrid, { stroke: colors.grid, vertical: false }),
          h(XAxis, {
            dataKey: "dateShort",
            stroke: colors.text,
            tick: { fill: colors.text, fontSize: layout.xTickFontSize },
            tickMargin: layout.xTickMargin,
            interval: layout.xAxisInterval,
            minTickGap: layout.minTickGap
          }),
          h(YAxis, {
            stroke: colors.text,
            tick: { fill: colors.text, fontSize: layout.yTickFontSize },
            domain: [0, yUpper]
          }),
          h(Tooltip, {
            content: createTooltipContent(colors, (row, payload) => [
              tooltipTitleLine("date", row.date || "", colors),
              ...payload.map((item) =>
                makeTooltipLine(item.dataKey, `${item.name}: ${toNumber(item.value)}`, colors)
              )
            ]),
            cursor: { stroke: colors.active, strokeWidth: 1.5, strokeDasharray: "3 3" }
          }),
          lineDefs.map((line) =>
            h(Line, {
              key: line.dataKey,
              type: "monotone",
              dataKey: line.dataKey,
              name: line.name,
              stroke: line.stroke,
              strokeDasharray: line.strokeDasharray,
              strokeWidth: line.strokeWidth,
              dot: line.dot,
              activeDot: activeLineDot(colors),
              hide: hiddenKeys.has(line.dataKey)
            })
          )
        )
      )
    );
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
    const stackIds = defs
      .map((def) => String(def?.stackId || "").trim())
      .filter(Boolean);
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
              const roundedValue = Number.isFinite(numericValue)
                ? Math.round(numericValue)
                : 0;
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
            formatter: (value) => (toWhole(value) > 0 ? String(def.seriesLabel || def.name || "") : ""),
            fill: "rgba(31,51,71,0.75)",
            fontSize: 9,
            offset: 2
          })
        );
      }
      const shouldColorByCategory = !isFullyStacked && colorByCategoryKey && effectiveCategoryColors;
      if (shouldColorByCategory) {
        rows.forEach((row, index) => {
          const categoryValue = String(row?.[colorByCategoryKey] || "");
          const fill =
            def?.categoryColors?.[categoryValue] ||
            effectiveCategoryColors?.[categoryValue] ||
            def.fill;
          barChildren.push(
            h(Cell, {
              key: `cell-${def.dataKey}-${index}`,
              fill
            })
          );
        });
      } else if (def?.metaTeamColorMap && typeof def.metaTeamColorMap === "object") {
        rows.forEach((row, index) => {
          const metaTeam = String(row?.[`meta_${def.dataKey}`]?.team || "");
          const fill = def.metaTeamColorMap?.[metaTeam] || def.fill;
          barChildren.push(
            h(Cell, {
              key: `cell-meta-team-${def.dataKey}-${index}`,
              fill
            })
          );
        });
      }
      return h(Bar, {
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
      }, ...barChildren);
    });
    const overlayNodes = chartLayout === "horizontal"
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
                segment: [{ x, y: yBase }, { x, y }],
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

  function renderGroupedBars(kind, containerId, canRender, props) {
    renderWithRoot(kind, containerId, canRender, (root) => {
      root.render(h(GroupedBarChartView, props));
    });
  }

  function CompositionChartView({ rows, colors, scope }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const isAllTeams = scope === "all";
    const compactViewport = isCompactViewport();
    const xInterval = compactViewport ? tickIntervalForMobileLabels(rows.length) : 0;
    const categoryGap =
      isAllTeams || rows.length > 14 ? BAR_LAYOUT.categoryGap : rows.length <= 8 ? "2%" : "8%";
    const singleTeamMaxBarSize = rows.length <= 12 ? 34 : rows.length <= 20 ? 28 : BAR_LAYOUT.normalMax;
    const priorityDefs = PRIORITY_STACK_ORDER.map((priority) => ({
      dataKey: priority.key,
      name: priority.label,
      fill: colors.priorities[priority.key]
    }));
    const barNodes = priorityDefs.map((priority) =>
      h(Bar, {
        key: priority.dataKey,
        dataKey: priority.dataKey,
        name: priority.name,
        stackId: "backlog",
        fill: priority.fill,
        ...barBaseStyle(colors),
        activeBar: ACTIVE_BAR_STYLE,
        hide: hiddenKeys.has(priority.dataKey),
        isAnimationActive: false
      })
    );
    return renderBarChartShell({
      rows,
      colors,
      height: singleChartHeightForMode("composition", CHART_HEIGHTS.dense),
      margin: { top: 12, right: 12, bottom: 38, left: 12 },
      layout: { categoryGap, maxBarSize: isAllTeams ? BAR_LAYOUT.denseMax : singleTeamMaxBarSize },
      xAxisProps: {
        dataKey: "bucketLabel",
        stroke: colors.text,
        tick: { ...axisTick(colors), fontSize: compactViewport ? 11 : 12 },
        angle: isAllTeams ? -90 : -25,
        textAnchor: "end",
        interval: xInterval,
        minTickGap: isAllTeams ? (compactViewport ? 8 : 0) : compactViewport ? 10 : 16,
        height: isAllTeams ? (compactViewport ? 86 : 78) : compactViewport ? 44 : 48,
        tickFormatter: (value, index) => {
          if (!isAllTeams) return value;
          const row = rows[index] || {};
          const team = row.team || "";
          return team || "";
        }
      },
      yAxisProps: baseYAxisProps(colors),
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => [
          tooltipTitleLine("title", `${row.team || ""} · ${row.date || ""}`, colors),
          makeTooltipLine("total", `Total: ${toNumber(row.total)}`, colors, { margin: "0 0 6px" }),
          ...payload.map((item) =>
            makeTooltipLine(item.dataKey, `${item.name}: ${toNumber(item.value)}`, colors)
          )
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      },
      legendDrawerNode: renderLegendNode({ colors, defs: priorityDefs, hiddenKeys, setHiddenKeys }),
      barNodes
    });
  }

  function renderBugTrendAcrossTeamsChart({ containerId, snapshot, colors }) {
    const rows = buildTrendData(snapshot);
    renderWithRoot("trend", containerId, rows.length > 0, (root) => {
      const yUpper = computeYUpper(
        [
          ...rows.map((row) => row.api),
          ...rows.map((row) => row.legacy),
          ...rows.map((row) => row.react),
          ...rows.map((row) => row.bc),
          ...rows.map((row) => row.bcLong30),
          ...rows.map((row) => row.bcLong60)
        ],
        { min: 10, pad: 1.08 }
      );
      root.render(h(TrendChartView, { rows, colors, yUpper }));
    });
  }

  function renderBugCompositionByPriorityChart({ containerId, snapshot, colors, scope = "bc" }) {
    const rows = buildCompositionData(snapshot, scope);
    renderWithRoot("composition", containerId, rows.length > 0, (root) => {
      root.render(h(CompositionChartView, { rows, colors, scope }));
    });
  }

  function renderUatPriorityAgingChart({ containerId, rows, buckets: _buckets, colors }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const compactViewport = isCompactViewport();
    const bucketShortLabels = {
      "1-2 weeks": "1-2w",
      "1 month": "1m",
      "2 months": "2m",
      "More than 2 months": "2m+"
    };
    const prioritySeries = ["medium", "high", "highest"].map((key) => ({
      dataKey: key,
      name: PRIORITY_CONFIG.find((item) => item.key === key)?.label || key,
      fill: colors.priorities?.[key] || colors.teams.bc,
      stackId: "uat-priority"
    }));
    const yUpper = computeYUpper(
      chartRows.map((row) => toNumber(row?.total)),
      { min: 1, pad: 1.12 }
    );
    renderGroupedBars(
      "uat",
      containerId,
      chartRows.length > 0 && prioritySeries.length > 0,
      {
        rows: chartRows,
        defs: prioritySeries,
        colors,
        yUpper,
        height: singleChartHeightForMode("uat", CHART_HEIGHTS.standard),
        showLegend: true,
        colorByCategoryKey: "bucketLabel",
        xAxisProps: {
          dataKey: "bucketLabel",
          interval: 0,
          height: compactViewport ? 42 : 52,
          tick: { ...axisTick(colors), fontSize: compactViewport ? 11 : 12 },
          tickFormatter: (value) => {
            const key = String(value || "");
            if (!compactViewport) return key;
            return bucketShortLabels[key] || key;
          }
        },
        tooltipProps: {
          content: createTooltipContent(colors, (row, payload) => {
            const groups =
              row?.facilityPriorityGroups && typeof row.facilityPriorityGroups === "object"
                ? row.facilityPriorityGroups
                : {};
            const priorityOrder = ["Highest", "High", "Medium", "Low", "Lowest"];
            const facilityEntries = Object.entries(groups)
              .map(([facility, byPriority]) => {
                const map = byPriority && typeof byPriority === "object" ? byPriority : {};
                const priorityCounts = priorityOrder
                  .map((priority) => [priority, toWhole(map[priority])])
                  .filter(([, count]) => count > 0);
                const items = priorityCounts.map(([priority, count]) => `${priority}: ${count}`);
                const total = priorityCounts.reduce((sum, [, count]) => sum + count, 0);
                return [String(facility || "").trim(), total, items];
              })
              .filter(([facility, total]) => facility && total > 0)
              .sort((left, right) => {
                const leftIsUnspecified = left[0] === "Unspecified";
                const rightIsUnspecified = right[0] === "Unspecified";
                if (leftIsUnspecified && !rightIsUnspecified) return 1;
                if (!leftIsUnspecified && rightIsUnspecified) return -1;
                if (right[1] !== left[1]) return right[1] - left[1];
                return left[0].localeCompare(right[0]);
              });

            return [
              tooltipTitleLine("title", row.bucketLabel || "", colors),
              tooltipTitleLine("total", `Total: ${toWhole(row.total)}`, colors),
              ...facilityEntries.map(([facility, _total, items], index) =>
                makeTooltipLine(`facility-${index}`, facility, colors, {
                  margin: "0 0 4px",
                  subItems: items
                })
              ),
              ...(facilityEntries.length === 0
                ? payload
                    .filter((item) => toWhole(item?.value) > 0)
                    .map((item) =>
                      makeTooltipLine(
                        item.dataKey,
                        `${item.name}: ${toWhole(item.value)}`,
                        colors
                      )
                    )
                : [])
            ];
          }),
          cursor: { fill: "rgba(31,51,71,0.05)" }
        }
      }
    );
  }

  function renderDevelopmentTimeVsUatTimeChart({ containerId, rows, colors, devColor, uatColor, yTicks }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const yUpper = computeYUpper(
      [
        ...chartRows.map((row) => toNumber(row.devMedian)),
        ...chartRows.map((row) => toNumber(row.uatMedian))
      ],
      { min: 1, pad: 1.12 }
    );
    renderGroupedBars("management", containerId, chartRows.length > 0, {
      rows: chartRows,
      defs: [
        { dataKey: "devMedian", name: "Days in Development", fill: devColor },
        { dataKey: "uatMedian", name: "Days in UAT", fill: uatColor }
      ],
      colors,
      yUpper,
      height: singleChartHeightForMode("management", CHART_HEIGHTS.standard),
      yAxisProps:
        Array.isArray(yTicks) && yTicks.length > 1
          ? { domain: [0, yTicks[yTicks.length - 1]], ticks: yTicks, allowDecimals: false }
          : undefined,
      xAxisProps: {
        dataKey: "label",
        interval: 0,
        height: 36
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => [
          tooltipTitleLine("label", row.label || "", colors),
          ...payload.map((item) => {
            const isDev = item?.dataKey === "devMedian";
            const countRaw = Number(isDev ? row.devCount : row.uatCount);
            const avg = isDev ? toNumber(row.devAvg) : toNumber(row.uatAvg);
            return makeTooltipLine(
              item.dataKey,
              String(item.name || ""),
              colors,
              {
                subItems: [
                  `median = ${toWhole(item.value)} days`,
                  `average = ${toWhole(avg)} days`,
                  `n = ${Number.isFinite(countRaw) && countRaw >= 0 ? toWhole(countRaw) : "-"}`
                ]
              }
            );
          }).filter(Boolean)
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderDevelopmentVsUatByFacilityChart({
    containerId,
    rows,
    colors,
    devColor,
    uatColor,
    jiraBrowseBase = "https://nepgroup.atlassian.net/browse/"
  }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const compactViewport = isCompactViewport();
    const weekRows = chartRows.map((row) => ({
      ...row,
      devWeeks: toWholeWeeksForChart(row?.devAvg),
      uatWeeks: toWholeWeeksForChart(row?.uatAvg)
    }));
    const categorySecondaryLabels = Object.fromEntries(
      chartRows.map((row) => [String(row?.label || ""), `n=${toWhole(row?.sampleCount)}`])
    );
    const yUpper = computeYUpper(
      [...weekRows.map((row) => toNumber(row?.devWeeks)), ...weekRows.map((row) => toNumber(row?.uatWeeks))],
      { min: 1, pad: 1.15 }
    );
    const weekAxis = buildWeekAxis(yUpper);
    const axisUpper = weekAxis.upper;
    const yTicks = weekAxis.ticks;
    const xInterval = compactViewport ? tickIntervalForMobileLabels(chartRows.length) : 0;
    renderGroupedBars("managementFacility", containerId, chartRows.length > 0, {
      rows: weekRows,
      defs: [
        {
          dataKey: "devWeeks",
          name: "Weeks in Development",
          fill: devColor
        },
        {
          dataKey: "uatWeeks",
          name: "Weeks in UAT",
          fill: uatColor
        }
      ],
      colors,
      yUpper: axisUpper,
      height: singleChartHeightForMode("management-facility", CHART_HEIGHTS.standard),
      yAxisProps: {
        domain: [0, axisUpper],
        ticks: yTicks,
        allowDecimals: false,
        tickFormatter: (value) => String(toWhole(value))
      },
      xAxisProps: {
        dataKey: "label",
        interval: xInterval,
        minTickGap: compactViewport ? 10 : 6,
        height: 56,
        tick: twoLineCategoryTickFactory(colors, {
          textAnchor: "middle",
          secondaryLabels: categorySecondaryLabels
        })
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row) => {
          const devAvg = toNumber(row?.devAvg);
          const uatAvg = toNumber(row?.uatAvg);
          const issueIds = Array.isArray(row?.issueIds) ? row.issueIds : [];
          const issueDisplayLimit = 8;
          const issueSubItems = issueIds
            .slice(0, issueDisplayLimit)
            .map((issueId, index) => {
              const key = String(issueId || "").trim();
              if (!key) return null;
              const url = `${String(jiraBrowseBase || "").replace(/\/$/, "")}/${encodeURIComponent(key)}`;
              return h(
                "a",
                {
                  key: `issue-link-${key}-${index}`,
                  href: url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: {
                    color: colors.text,
                    textDecoration: "underline"
                  }
                },
                key
              );
            })
            .filter(Boolean);
          if (issueIds.length > issueDisplayLimit) {
            issueSubItems.push(`+${issueIds.length - issueDisplayLimit} more`);
          }
          return [
            tooltipTitleLine("label", row?.label || "", colors),
            makeTooltipLine("dev", `Average weeks in Development: ${formatWeeksFromDays(devAvg)}`, colors),
            makeTooltipLine("uat", `Average weeks in UAT: ${formatWeeksFromDays(uatAvg)}`, colors),
            makeTooltipLine("issues", "Issues", colors, {
              margin: "6px 0 0",
              subItems: issueSubItems.length > 0 ? issueSubItems : ["-"]
            })
          ];
        }),
        wrapperStyle: { pointerEvents: "auto" },
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderMultiSeriesBars({
    kind,
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
    gridVertical = false,
    tooltipCursor = { fill: BAR_CURSOR_FILL },
    valueUnit = "days"
  }) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const compactViewport = isCompactViewport();
    const seriesDefs = (Array.isArray(defs) ? defs : []).map((def) => ({
      key: def.key,
      name: def.name || def.label || def.key,
      color: def.color,
      stackId: def.stackId,
      categoryColors: def.categoryColors,
      showValueLabel: Boolean(def.showValueLabel),
      showSeriesLabel: Boolean(def.showSeriesLabel),
      seriesLabel: def.seriesLabel || def.name || def.label || def.key,
      metaTeamColorMap: def.metaTeamColorMap
    }));
    const displayInWeeks = String(valueUnit || "").toLowerCase() === "weeks";
    const chartRows = displayInWeeks
      ? sourceRows.map((row) => {
          const next = { ...row };
          seriesDefs.forEach((series) => {
            next[series.key] = toWholeWeeksForChart(row?.[series.key]);
          });
          return next;
        })
      : sourceRows;
    const yValues = seriesDefs.flatMap((series) => chartRows.map((row) => toNumber(row?.[series.key])));
    const normalizedYUpperOverride =
      Number.isFinite(yUpperOverride) && yUpperOverride > 0
        ? displayInWeeks
          ? toWholeWeeksForChart(yUpperOverride)
          : yUpperOverride
        : null;
    const yUpper =
      Number.isFinite(normalizedYUpperOverride) && normalizedYUpperOverride > 0
        ? Math.ceil(normalizedYUpperOverride)
        : computeYUpper(yValues, { min: 1, pad: 1.15 });
    const isHorizontal = orientation === "horizontal";
    const effectiveCategoryTickTwoLine = categoryTickTwoLine && !compactViewport;
    const weeklyAxis = displayInWeeks ? buildWeekAxis(yUpper, { majorStep: 4 }) : null;
    const niceAxis = isHorizontal
      ? displayInWeeks
        ? weeklyAxis
        : buildNiceNumberAxis(yUpper)
      : null;
    const niceYAxis = !isHorizontal
      ? displayInWeeks
        ? weeklyAxis
        : buildNiceNumberAxis(yUpper)
      : null;
    const twoLineCategoryTickHorizontal = twoLineCategoryTickFactory(colors, {
      textAnchor: "end",
      dy: 3,
      line2Dy: 14
    });
    const twoLineCategoryTickColumns = twoLineCategoryTickFactory(colors, {
      textAnchor: "middle",
      dy: 0,
      line2Dy: 0,
      secondaryLabels: categorySecondaryLabels
    });
    renderGroupedBars(kind, containerId, chartRows.length > 0 && seriesDefs.length > 0, {
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
        metaTeamColorMap: series.metaTeamColorMap
      })),
      colors,
      yUpper,
      showLegend,
      colorByCategoryKey,
      categoryColors,
      overlayDots,
      gridVertical,
      height: singleChartHeightForMode(modeKey, CHART_HEIGHTS.dense),
      margin: { top: 14, right: 12, bottom: 34, left: 12 },
      xAxisProps: {
        ...(isHorizontal
          ? {
              type: "number",
              domain: [0, niceAxis.upper],
              ticks: niceAxis.ticks,
              allowDecimals: false,
              tickFormatter: displayInWeeks ? (value) => String(toWhole(value)) : undefined
            }
          : {
              dataKey: categoryKey,
              interval: compactViewport ? tickIntervalForMobileLabels(chartRows.length) : 0,
              angle: compactViewport ? -28 : 0,
              textAnchor: compactViewport ? "end" : "middle",
              height: effectiveCategoryTickTwoLine ? 72 : compactViewport ? 52 : 34,
              minTickGap: compactViewport ? 10 : 4,
              tick: effectiveCategoryTickTwoLine
                ? twoLineCategoryTickColumns
                : { ...axisTick(colors), fontSize: compactViewport ? 11 : 12 }
            })
      },
      yAxisProps: isHorizontal
        ? {
            dataKey: categoryKey,
            type: "category",
            width: HORIZONTAL_CATEGORY_AXIS_WIDTH,
            tick: effectiveCategoryTickTwoLine ? twoLineCategoryTickHorizontal : undefined
          }
        : {
            domain: [0, niceYAxis.upper],
            ticks: niceYAxis.ticks,
            allowDecimals: false,
            tickFormatter: displayInWeeks ? (value) => String(toWhole(value)) : undefined
          },
      chartLayout: isHorizontal ? "vertical" : "horizontal",
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => {
          const categoryLabel = row?.teamWithSampleBase || row?.[categoryKey] || row.team || "Category";
          const teamLabel = String(categoryLabel).replace(/\s*\(.*\)\s*$/, "");
          const nMatch = String(categoryLabel).match(/\(n=(\d+)\)/);
          const teamSample = nMatch ? toWhole(Number(nMatch[1])) : null;
          const hasDone = Number.isFinite(row?.doneCount);
          const lines = [
            tooltipTitleLine(
              "team",
              hasDone ? teamLabel : (timeWindowLabel ? `${categoryLabel} • ${timeWindowLabel}` : `${categoryLabel}`),
              colors
            )
          ];
          if (hasDone) {
            const teamSampleText = Number.isFinite(teamSample) ? String(toWhole(teamSample)) : "-";
            lines.push(
              makeTooltipLine(
                "sample",
                "Sample",
                colors,
                {
                  margin: "2px 0 6px",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  subItems: [`n = ${teamSampleText}`, `done = ${toWhole(row.doneCount)}`]
                }
              )
            );
          }
          payload.forEach((item) => {
            const key = item?.dataKey;
            const meta = row?.[`meta_${key}`] || {};
            const valueDays = toWhole(item?.value);
            if (valueDays <= 0) return;
            const sampleRaw = Number(meta.n);
            const sampleText = Number.isFinite(sampleRaw) && sampleRaw >= 0 ? String(toWhole(sampleRaw)) : "-";
            const avgDays = toWhole(meta.average);
            const seriesName = meta.team || item.name;
            lines.push(
              makeTooltipLine(
                key,
                String(seriesName),
                colors,
                {
                  margin: "2px 0",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  subItems: [
                    displayInWeeks
                      ? `average = ${formatWeeksFromDays(meta.average)}`
                      : `average = ${avgDays} days`,
                    `n = ${sampleText}`
                  ]
                }
              )
            );
          });
          return lines;
        }),
        cursor: tooltipCursor
      }
    });
  }

  function renderTopContributorsChart({ containerId, rows, colors, barColor }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const fillColor = String(barColor || "").trim() || colors.teams.react;
    const contributorMetaLabels = Object.fromEntries(
      chartRows.map((row) => [
        String(row?.contributor || ""),
        `n=${toWhole(row?.totalIssues)}, done=${toWhole(row?.doneIssues)}`
      ])
    );
    const yValues = chartRows.map((row) => toNumber(row?.totalIssues));
    const yUpper = computeYUpper(yValues, { min: 1, pad: 1.12 });
    const nice = buildNiceNumberAxis(yUpper);
    renderGroupedBars("contributors", containerId, chartRows.length > 0, {
      rows: chartRows,
      defs: [
        {
          dataKey: "totalIssues",
          name: "Ticket totals",
          fill: fillColor
        }
      ],
      colors,
      yUpper: nice.upper,
      showLegend: false,
      height: singleChartHeightForMode("contributors", CHART_HEIGHTS.dense),
      margin: { top: 14, right: 12, bottom: 30, left: 12 },
      chartLayout: "vertical",
      xAxisProps: {
        type: "number",
        domain: [0, nice.upper],
        ticks: nice.ticks,
        allowDecimals: false
      },
      yAxisProps: {
        dataKey: "contributor",
        type: "category",
        width: HORIZONTAL_CATEGORY_AXIS_WIDTH,
        tick: twoLineCategoryTickFactory(colors, {
          textAnchor: "end",
          dy: 3,
          line2Dy: 14,
          secondaryLabels: contributorMetaLabels
        })
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row) => {
          return [
            tooltipTitleLine("name", row?.contributor || "Contributor", colors),
            makeTooltipLine("totals", `Ticket totals = ${toWhole(row?.totalIssues)}`, colors, {
              margin: "2px 0 6px",
              subItems: [
                ...(Array.isArray(row?.ticketStateItems) && row.ticketStateItems.length > 0
                  ? row.ticketStateItems
                  : [`Done = ${toWhole(row?.doneIssues)}`, `Not done = ${toWhole(row?.notDoneIssues ?? row?.activeIssues)}`])
              ]
            })
          ];
        }),
        cursor: { fill: BAR_CURSOR_FILL }
      },
      gridHorizontal: false
    });
  }

  window.DashboardCharts = {
    renderBugTrendAcrossTeamsChart,
    renderBugCompositionByPriorityChart,
    renderUatPriorityAgingChart,
    renderDevelopmentTimeVsUatTimeChart,
    renderDevelopmentVsUatByFacilityChart,
    renderTopContributorsChart,
    renderCycleTimeParkingLotToDoneChart: ({ seriesDefs, ...rest }) =>
      renderMultiSeriesBars({
        kind: "productCycle",
        modeKey: "product-cycle",
        defs: seriesDefs,
        valueUnit: "weeks",
        ...rest
      }),
    renderLifecycleTimeSpentPerPhaseChart: ({ seriesDefs, ...rest }) =>
      renderMultiSeriesBars({
        kind: "lifecycleDays",
        modeKey: "lifecycle-days",
        defs: seriesDefs,
        valueUnit: "weeks",
        ...rest
      }),
    clearChart
  };
})();
