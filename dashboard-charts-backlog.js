/* global React */
"use strict";

(function initDashboardBacklogCharts() {
  const chartCore = window.DashboardChartCore;
  if (!window.React || !chartCore) {
    window.DashboardBacklogCharts = null;
    return;
  }

  const {
    ACTIVE_BAR_STYLE,
    BAR_CURSOR_FILL,
    BAR_LAYOUT,
    CHART_HEIGHTS,
    Bar,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    activeLineDot,
    axisTick,
    barBaseStyle,
    baseYAxisProps,
    buildNiceNumberAxis,
    computeYUpper,
    createTooltipContent,
    formatDateShort,
    h,
    isCompactViewport,
    makeTooltipLine,
    renderBarChartShell,
    renderGroupedBars,
    renderLegendNode,
    renderWithRoot,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    toWhole,
    tooltipTitleLine,
    trendLayoutForViewport
  } = chartCore;

  const TEAM_CONFIG = [
    { key: "api", label: "API" },
    { key: "legacy", label: "Legacy FE" },
    { key: "react", label: "React FE" },
    { key: "bc", label: "BC" }
  ];
  const PRIORITY_CONFIG = [
    { key: "highest", label: "Highest" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" }
  ];
  const PRIORITY_STACK_ORDER = [
    { key: "lowest", label: "Lowest" },
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
    { key: "highest", label: "Highest" }
  ].reverse();
  const MAX_SPRINT_POINTS = 10;
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

  function totalForPoint(point) {
    return (
      toNumber(point?.highest) +
      toNumber(point?.high) +
      toNumber(point?.medium) +
      toNumber(point?.low) +
      toNumber(point?.lowest)
    );
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

    if (scope === "all") {
      const rows = [];
      points.forEach((point) => {
        TEAM_CONFIG.forEach((team) => {
          const metrics = point?.[team.key];
          if (!metrics) return;
          rows.push({
            bucketLabel: `${point.date} ${team.label}`.trim(),
            team: team.label,
            date: point.date,
            highest: toNumber(metrics.highest),
            high: toNumber(metrics.high),
            medium: toNumber(metrics.medium),
            low: toNumber(metrics.low),
            lowest: toNumber(metrics.lowest),
            total: totalForPoint(metrics)
          });
        });
      });
      return rows;
    }

    return points.map((point) => {
      const metrics = point?.[scope] || {};
      return {
        bucketLabel: point.date,
        team:
          TEAM_CONFIG.find((team) => team.key === scope)?.label ||
          String(scope || "").toUpperCase(),
        date: point.date,
        highest: toNumber(metrics.highest),
        high: toNumber(metrics.high),
        medium: toNumber(metrics.medium),
        low: toNumber(metrics.low),
        lowest: toNumber(metrics.lowest),
        total: totalForPoint(metrics)
      };
    });
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
          lineDefs.map((lineDef) =>
            h(Line, {
              key: lineDef.dataKey,
              type: "monotone",
              dataKey: lineDef.dataKey,
              name: lineDef.name,
              stroke: lineDef.stroke,
              strokeDasharray: lineDef.strokeDasharray,
              strokeWidth: lineDef.strokeWidth,
              dot: lineDef.dot,
              activeDot: activeLineDot(colors),
              hide: hiddenKeys.has(lineDef.dataKey)
            })
          )
        )
      )
    );
  }

  function CompositionChartView({ rows, colors, scope }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const isAllTeams = scope === "all";
    const compactViewport = isCompactViewport();
    const yUpper = computeYUpper(rows.map((row) => toNumber(row?.total)), { min: 1, pad: 1.08 });
    const niceYAxis = buildNiceNumberAxis(yUpper);
    const xInterval = compactViewport ? tickIntervalForMobileLabels(rows.length) : 0;
    const categoryGap =
      isAllTeams || rows.length > 14 ? BAR_LAYOUT.categoryGap : rows.length <= 8 ? "2%" : "8%";
    const singleTeamMaxBarSize =
      rows.length <= 12 ? 34 : rows.length <= 20 ? 28 : BAR_LAYOUT.normalMax;
    const priorityDefs = PRIORITY_STACK_ORDER.map((priority) => ({
      dataKey: priority.key,
      name: priority.label,
      fill: colors.priorities[priority.key],
      stackId: "backlog"
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
          return row.team || "";
        }
      },
      yAxisProps: {
        ...baseYAxisProps(colors, [0, niceYAxis.upper]),
        ticks: niceYAxis.ticks
      },
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

  function renderBugBacklogTrendByTeamChart({ containerId, snapshot, colors }) {
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
    const prioritySeries = PRIORITY_CONFIG.map((priority) => ({
      dataKey: priority.key,
      name: priority.label,
      fill: colors.priorities?.[priority.key] || colors.teams.bc,
      stackId: "uat-priority"
    }));
    const yUpper = computeYUpper(chartRows.map((row) => toNumber(row?.total)), { min: 1, pad: 1.12 });
    renderGroupedBars("uat", containerId, chartRows.length > 0 && prioritySeries.length > 0, {
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
                    makeTooltipLine(item.dataKey, `${item.name}: ${toWhole(item.value)}`, colors)
                  )
              : [])
          ];
        }),
        cursor: { fill: "rgba(31,51,71,0.05)" }
      }
    });
  }

  window.DashboardBacklogCharts = {
    renderBugBacklogTrendByTeamChart,
    renderBugCompositionByPriorityChart,
    renderUatPriorityAgingChart
  };
})();
