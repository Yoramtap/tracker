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
    LabelList,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend
  } = Recharts;

  const TEAM_CONFIG = [{ key: "api", label: "API" }, { key: "legacy", label: "Legacy FE" }, { key: "react", label: "React FE" }, { key: "bc", label: "BC" }];
  const PRIORITY_CONFIG = [{ key: "highest", label: "Highest" }, { key: "high", label: "High" }, { key: "medium", label: "Medium" }, { key: "low", label: "Low" }, { key: "lowest", label: "Lowest" }];
  const PRIORITY_STACK_ORDER = [...PRIORITY_CONFIG].reverse();
  const BAR_LAYOUT = { categoryGap: "18%", groupGap: 2, denseMax: 12, normalMax: 22 };
  const CHART_HEIGHTS = { standard: 460, dense: 560 };
  const BAR_CURSOR_FILL = "rgba(31,51,71,0.12)";
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
    productCycle: null,
    doneWork: null,
    lifecycleDays: null
  };
  const rootContainerIds = {};

  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
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
    const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
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

  function makeTooltipLine(key, text, colors, { margin = "2px 0", fontSize = "12px", fontWeight, color } = {}) {
    const style = { margin, color: color || colors.text };
    if (fontSize) style.fontSize = fontSize;
    if (fontWeight) style.fontWeight = fontWeight;
    return h("p", { key, style }, text);
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
    return makeTooltipLine(key, text, colors, { margin: "0 0 6px", fontWeight: 600, fontSize: null });
  }

  function createTooltipContent(colors, buildLines) {
    return function renderTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      return renderTooltipCard(colors, buildLines(row, payload));
    };
  }


  function toggleLegendKey(prevSet, key) {
    const next = new Set(prevSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function renderTooltipCard(colors, blocks) {
    return h(
      "div",
      {
        style: {
          border: `1px solid ${colors.tooltip.border}`,
          background: colors.tooltip.bg,
          color: colors.tooltip.text,
          borderRadius: "6px",
          padding: "8px 10px",
          boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
        }
      },
      blocks
    );
  }

  function renderLegendNode({ colors, defs, type, hiddenKeys, setHiddenKeys }) {
    return h(
      Legend,
      {
        verticalAlign: "top",
        height: 36,
        wrapperStyle: { color: colors.text, cursor: "pointer" },
        payload: defs.map((item) => ({
          value: item.name,
          type,
          color: item.stroke || item.fill,
          dataKey: item.dataKey
        })),
        onClick: (entry) => {
          const key = entry?.dataKey || entry?.payload?.dataKey || null;
          if (!key) return;
          setHiddenKeys((prev) => toggleLegendKey(prev, key));
        },
        formatter: (value, entry) =>
          h(
            "span",
            {
              style: {
                color: "var(--text, #1f3347)",
                opacity: hiddenKeys.has(entry?.dataKey) ? 0.45 : 1,
                textDecoration: hiddenKeys.has(entry?.dataKey) ? "line-through" : "none"
              }
            },
            value
          )
      }
    );
  }

  function axisTick(colors) {
    return { fill: colors.text, fontSize: 11 };
  }

  function twoLineCategoryTickFactory(colors) {
    return function twoLineCategoryTick(props) {
      const { x, y, payload } = props || {};
      const raw = String(payload?.value || "");
      const splitIndex = raw.indexOf(" (n=");
      const line1 = splitIndex > 0 ? raw.slice(0, splitIndex) : raw;
      const line2 = splitIndex > 0 ? raw.slice(splitIndex + 1) : "";
      return h(
        "g",
        { transform: `translate(${x},${y})` },
        h(
          "text",
          {
            x: 0,
            y: 0,
            dy: 3,
            textAnchor: "end",
            fill: colors.text,
            fontSize: 12
          },
          h("tspan", { x: 0, dy: 0 }, line1),
          line2 ? h("tspan", { x: 0, dy: 14, fill: "rgba(31,51,71,0.75)", fontSize: 11 }, line2) : null
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
    legendNode,
    barNodes
  }) {
    return h(
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
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, xAxisProps),
        h(YAxis, yAxisProps),
        h(Tooltip, tooltipProps),
        legendNode,
        ...barNodes
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

  function buildNiceNumberAxis(_maxValue) {
    return { upper: 300, ticks: [0, 50, 100, 150, 200, 250, 300] };
  }

  function groupedBarGeometry(rowsCount, seriesCount = 2) {
    const safeSeriesCount = Math.max(1, Math.floor(toNumber(seriesCount) || 1));
    let categoryGap = BAR_LAYOUT.categoryGap;
    let targetGroupWidth = 68;
    if (rowsCount <= 8) {
      categoryGap = "2%";
      targetGroupWidth = 120;
    } else if (rowsCount <= 14) {
      categoryGap = "8%";
      targetGroupWidth = 92;
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
      stroke: colors.text,
      strokeOpacity: 0.42,
      strokeWidth: 1.15
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

    return h(
      ResponsiveContainer,
      { width: "100%", height: CHART_HEIGHTS.standard },
      h(
        LineChart,
        {
          data: rows,
          margin: { top: 18, right: 20, bottom: 42, left: 20 }
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "dateShort",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          tickMargin: 8
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
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
        renderLegendNode({ colors, defs: lineDefs, type: "line", hiddenKeys, setHiddenKeys }),
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
    height = CHART_HEIGHTS.standard,
    margin = { top: 18, right: 20, bottom: 52, left: 20 }
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
    const barNodes = defs.map((def) =>
      h(Bar, {
        key: def.dataKey,
        dataKey: def.dataKey,
        name: def.name,
        fill: def.fill,
        stackId: def.stackId,
        barSize: Number.isFinite(geometry.barSize) ? geometry.barSize : undefined,
        ...barBaseStyle(colors),
        activeBar: ACTIVE_BAR_STYLE,
        hide: hiddenKeys.has(def.dataKey),
        isAnimationActive: false
      }, def.showValueLabel
        ? h(LabelList, {
            dataKey: def.dataKey,
            position: chartLayout === "vertical" ? "right" : "top",
            formatter: (value, entry) => {
              const numericValue = Number(value);
              const roundedValue = Number.isFinite(numericValue)
                ? Number(numericValue.toFixed(1))
                : 0;
              const sampleCount = Number(entry?.payload?.[`meta_${def.dataKey}`]?.n);
              const n = Number.isFinite(sampleCount) ? sampleCount : 0;
              return `${roundedValue}d · n=${n}`;
            },
            fill: colors.text,
            fontSize: 11,
            offset: 8
          })
        : null)
    );
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
      legendNode: showLegend
        ? renderLegendNode({ colors, defs, type: "rect", hiddenKeys, setHiddenKeys })
        : null,
      barNodes
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
      height: CHART_HEIGHTS.dense,
      margin: { top: 18, right: 20, bottom: 52, left: 20 },
      layout: { categoryGap, maxBarSize: isAllTeams ? BAR_LAYOUT.denseMax : singleTeamMaxBarSize },
      xAxisProps: {
        dataKey: "bucketLabel",
        stroke: colors.text,
        tick: axisTick(colors),
        angle: isAllTeams ? -90 : -25,
        textAnchor: "end",
        interval: 0,
        minTickGap: isAllTeams ? 0 : 16,
        height: isAllTeams ? 92 : 56,
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
      legendNode: renderLegendNode({ colors, defs: priorityDefs, type: "rect", hiddenKeys, setHiddenKeys }),
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
    const sampleByBucket = Object.fromEntries(
      chartRows.map((row) => [String(row.bucketLabel || ""), toNumber(row.total)])
    );
    const prioritySeries = ["medium", "high", "highest"].map((key) => ({
      dataKey: key,
      name: PRIORITY_CONFIG.find((item) => item.key === key)?.label || key,
      fill: colors.priorities?.[key] || colors.teams.bc
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
        defs: prioritySeries.map((series) => ({ ...series, stackId: "uatAging" })),
        colors,
        yUpper,
        xAxisProps: {
          dataKey: "bucketLabel",
          interval: 0,
          height: 60,
          tickFormatter: (value) => {
            const key = String(value || "");
            const sample = toNumber(sampleByBucket[key]);
            return `${key}\n(n=${sample})`;
          }
        },
        tooltipProps: {
          content: createTooltipContent(colors, (row, payload) => [
            tooltipTitleLine("title", row.bucketLabel || "", colors),
            makeTooltipLine("total", `Total: ${toNumber(row.total)}`, colors, { margin: "0 0 6px" }),
            ...payload.map((item) =>
              makeTooltipLine(
                item.dataKey,
                `${item.name}: ${toNumber(item.value)}`,
                colors
              )
            )
          ]),
          cursor: { fill: BAR_CURSOR_FILL }
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
        { dataKey: "devMedian", name: "Median Dev", fill: devColor },
        { dataKey: "uatMedian", name: "Median UAT", fill: uatColor }
      ],
      colors,
      yUpper,
      yAxisProps:
        Array.isArray(yTicks) && yTicks.length > 1
          ? { domain: [0, yTicks[yTicks.length - 1]], ticks: yTicks, allowDecimals: false }
          : undefined,
      xAxisProps: {
        dataKey: "label",
        interval: 0,
        height: 40
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => [
          tooltipTitleLine("label", row.label || "", colors),
          ...payload.map((item) => {
            const isDev = item?.dataKey === "devMedian";
            const count = isDev ? toNumber(row.devCount) : toNumber(row.uatCount);
            const avg = isDev ? toNumber(row.devAvg) : toNumber(row.uatAvg);
            return makeTooltipLine(
              item.dataKey,
              `${item.name}: ${toNumber(item.value).toFixed(2)} days (avg ${avg.toFixed(2)}, n ${count})`,
              colors
            );
          })
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderDoneWorkByTeamChart({ containerId, rows, colors, yUpper, yTicks, measureLabel }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const twoLineCategoryTick = twoLineCategoryTickFactory(colors);
    renderGroupedBars("doneWork", containerId, chartRows.length > 0, {
      rows: chartRows,
      defs: [
        { dataKey: "value", name: measureLabel || "Done", fill: colors.teams.api }
      ],
      colors,
      yUpper,
      height: CHART_HEIGHTS.dense,
      margin: { top: 30, right: 20, bottom: 52, left: 20 },
      xAxisProps: {
        type: "number",
        domain: [0, yUpper],
        ticks: Array.isArray(yTicks) && yTicks.length > 1 ? yTicks : undefined,
        allowDecimals: false
      },
      chartLayout: "vertical",
      showLegend: false,
      yAxisProps: {
        dataKey: "teamWithSample",
        type: "category",
        width: 190,
        tick: twoLineCategoryTick
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row) => [
          tooltipTitleLine("team", row.team || "", colors),
          makeTooltipLine("value", `${measureLabel || "Done"}: ${toNumber(row.value)}`, colors),
          makeTooltipLine("count", `done ideas: ${toNumber(row.doneCount)}`, colors, {
            color: "rgba(31,51,71,0.75)"
          })
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderMultiSeriesBars({
    kind,
    containerId,
    rows,
    defs,
    colors,
    metricLabel = "Median",
    yUpperOverride = null,
    showLegend = true,
    timeWindowLabel = "",
    orientation = "columns",
    categoryKey = "team",
    categoryTickTwoLine = false
  }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const seriesDefs = (Array.isArray(defs) ? defs : []).map((def) => ({
      key: def.key,
      name: def.name || def.label || def.key,
      color: def.color
    }));
    const yValues = seriesDefs.flatMap((series) => chartRows.map((row) => toNumber(row?.[series.key])));
    const yUpper =
      Number.isFinite(yUpperOverride) && yUpperOverride > 0
        ? Math.ceil(yUpperOverride)
        : computeYUpper(yValues, { min: 1, pad: 1.15 });
    const isHorizontal = orientation === "horizontal";
    const niceAxis = isHorizontal ? buildNiceNumberAxis(yUpper) : null;
    const niceYAxis = !isHorizontal ? buildNiceNumberAxis(yUpper) : null;
    const twoLineCategoryTick = twoLineCategoryTickFactory(colors);

    renderGroupedBars(kind, containerId, chartRows.length > 0 && seriesDefs.length > 0, {
      rows: chartRows,
      defs: seriesDefs.map((series) => ({
        dataKey: series.key,
        name: series.name,
        fill: series.color,
        showValueLabel: Boolean(series.showValueLabel)
      })),
      colors,
      yUpper,
      showLegend,
      height: CHART_HEIGHTS.dense,
      margin: { top: 30, right: 20, bottom: 52, left: 20 },
      xAxisProps: {
        ...(isHorizontal
          ? {
              type: "number",
              domain: [0, niceAxis.upper],
              ticks: niceAxis.ticks,
              allowDecimals: false
            }
          : { dataKey: categoryKey, interval: 0, height: 40 })
      },
      yAxisProps: isHorizontal
        ? {
            dataKey: categoryKey,
            type: "category",
            width: categoryTickTwoLine ? 190 : 150,
            tick: categoryTickTwoLine ? twoLineCategoryTick : undefined
          }
        : { domain: [0, niceYAxis.upper], ticks: niceYAxis.ticks, allowDecimals: false },
      chartLayout: isHorizontal ? "vertical" : "horizontal",
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => [
          tooltipTitleLine(
            "team",
            `${row.team || "Team"} • ${timeWindowLabel || metricLabel}`,
            colors
          ),
          ...payload.map((item) => {
            const key = item?.dataKey;
            const meta = row?.[`meta_${key}`] || {};
            const medianDays = toNumber(meta.median).toFixed(2);
            const avgDays = toNumber(meta.average).toFixed(2);
            return makeTooltipLine(
              key,
              `${item.name}: median ${medianDays} days, avg ${avgDays} days, n ${toNumber(meta.n)}`,
              colors
            );
          })
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderNamedMultiSeriesBars(kind, defs) {
    return ({
      containerId,
      rows,
      colors,
      metricLabel = "Median",
      yUpperOverride = null,
      showLegend = true,
      timeWindowLabel = "",
      orientation = "columns",
      categoryKey = "team",
      categoryTickTwoLine = false
    }) =>
      renderMultiSeriesBars({
        kind,
        containerId,
        rows,
        defs,
        colors,
        metricLabel,
        yUpperOverride,
        showLegend,
        timeWindowLabel,
        orientation,
        categoryKey,
        categoryTickTwoLine
      });
  }

  const renderCycleTimeParkingLotToDoneChart = ({ seriesDefs, ...rest }) =>
    renderNamedMultiSeriesBars("productCycle", seriesDefs)(rest);
  const renderLifecycleTimeSpentPerPhaseChart = ({ phaseDefs, ...rest }) =>
    renderNamedMultiSeriesBars("lifecycleDays", phaseDefs)(rest);

  window.DashboardCharts = {
    renderBugTrendAcrossTeamsChart,
    renderBugCompositionByPriorityChart,
    renderUatPriorityAgingChart,
    renderDevelopmentTimeVsUatTimeChart,
    renderDoneWorkByTeamChart,
    renderCycleTimeParkingLotToDoneChart,
    renderLifecycleTimeSpentPerPhaseChart,
    clearChart
  };
})();
