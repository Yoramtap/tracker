"use strict";

(function initDashboardBacklogCharts() {
  const core = window.DashboardChartCore;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }

  const {
    ACTIVE_BAR_STYLE,
    BAR_CURSOR_FILL,
    BAR_LAYOUT,
    CHART_HEIGHTS,
    PRIORITY_STACK_ORDER,
    TEAM_CONFIG,
    TREND_LONG_LINES,
    TREND_TEAM_LINES,
    React,
    ResponsiveContainer,
    LineChart,
    Line,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    activeLineDot,
    axisTick,
    barBaseStyle,
    baseYAxisProps,
    buildAxisLabel,
    buildNiceNumberAxis,
    computeYUpper,
    createTooltipContent,
    formatDateShort,
    h,
    isCompactViewport,
    makeTooltipLine,
    renderBarChartShell,
    renderLegendNode,
    renderWithRoot,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    tooltipTitleLine,
    trendLayoutForViewport,
    withSafeTooltipProps
  } = core;

  function totalForPoint(point) {
    return (
      toNumber(point?.highest) +
      toNumber(point?.high) +
      toNumber(point?.medium) +
      toNumber(point?.low) +
      toNumber(point?.lowest)
    );
  }

  function buildPriorityMetricsRow(point, teamLabel, metrics) {
    const safeMetrics = metrics || {};
    return {
      bucketLabel: teamLabel ? `${point.date} ${teamLabel}`.trim() : point.date,
      team: teamLabel,
      date: point.date,
      dateShort: formatDateShort(point.date),
      highest: toNumber(safeMetrics.highest),
      high: toNumber(safeMetrics.high),
      medium: toNumber(safeMetrics.medium),
      low: toNumber(safeMetrics.low),
      lowest: toNumber(safeMetrics.lowest),
      total: totalForPoint(safeMetrics)
    };
  }

  function buildTrendData(snapshot, maxPoints) {
    const allPoints = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const points = allPoints.slice(-maxPoints);
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

  function buildCompositionData(snapshot, scope, maxPoints) {
    const allPoints = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const points = allPoints.slice(-maxPoints);

    if (scope === "all") {
      const rows = [];
      points.forEach((point) => {
        TEAM_CONFIG.forEach((team) => {
          const metrics = point?.[team.key];
          if (!metrics) return;
          rows.push(buildPriorityMetricsRow(point, team.label, metrics));
        });
      });
      return rows;
    }

    const teamLabel =
      TEAM_CONFIG.find((team) => team.key === scope)?.label || String(scope || "").toUpperCase();
    return points.map((point) => buildPriorityMetricsRow(point, teamLabel, point?.[scope] || {}));
  }

  function trendLineDefs(colors) {
    return [
      ...TREND_TEAM_LINES.map(([dataKey, name, colorKey]) => ({
        dataKey,
        name,
        stroke: colors.teams[colorKey],
        strokeWidth: 2.5,
        dot: false
      })),
      ...TREND_LONG_LINES.map((line) => ({
        ...line,
        strokeWidth: 2,
        dot: false
      }))
    ];
  }

  function TrendChartView({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const lineDefs = trendLineDefs(colors);
    const layout = trendLayoutForViewport(rows.length);
    const niceYAxis = buildNiceNumberAxis(yUpper);

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
            minTickGap: layout.minTickGap,
            label: buildAxisLabel("Sprint start")
          }),
          h(YAxis, {
            stroke: colors.text,
            tick: { fill: colors.text, fontSize: layout.yTickFontSize },
            domain: [0, niceYAxis.upper],
            ticks: niceYAxis.ticks,
            label: buildAxisLabel("Open bugs", { axis: "y", offset: 6 })
          }),
          h(
            Tooltip,
            withSafeTooltipProps({
              content: createTooltipContent(colors, (row, payload) => [
                tooltipTitleLine("date", row.date || "", colors),
                ...payload.map((item) =>
                  makeTooltipLine(item.dataKey, `${item.name}: ${toNumber(item.value)}`, colors)
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
              strokeDasharray: lineDef.strokeDasharray,
              strokeWidth: lineDef.strokeWidth,
              dot: lineDef.dot,
              activeDot: activeLineDot(colors),
              hide: hiddenKeys.has(lineDef.dataKey),
              isAnimationActive: false
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
    const yUpper = computeYUpper(
      rows.map((row) => toNumber(row?.total)),
      { min: 1, pad: 1.08 }
    );
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
        angle: isAllTeams ? -90 : compactViewport ? 0 : -25,
        textAnchor: isAllTeams ? "end" : compactViewport ? "middle" : "end",
        interval: xInterval,
        minTickGap: isAllTeams ? (compactViewport ? 8 : 0) : compactViewport ? 10 : 16,
        height: isAllTeams ? (compactViewport ? 86 : 78) : compactViewport ? 34 : 48,
        label: buildAxisLabel("Sprint start"),
        tickFormatter: (value, index) => {
          const row = rows[index] || {};
          if (compactViewport && !isAllTeams) return row.dateShort || value;
          if (!isAllTeams) return value;
          return row.team || "";
        }
      },
      yAxisProps: {
        ...baseYAxisProps(colors, [0, niceYAxis.upper]),
        ticks: niceYAxis.ticks,
        label: buildAxisLabel("Open bugs", { axis: "y", offset: 6 })
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
      legendDrawerNode: renderLegendNode({
        colors,
        defs: priorityDefs,
        hiddenKeys,
        setHiddenKeys,
        compact: compactViewport
      }),
      barNodes
    });
  }

  function renderBugBacklogTrendByTeamChart({ containerId, snapshot, colors }) {
    const rows = buildTrendData(snapshot, core.MAX_SPRINT_POINTS);
    renderWithRoot(containerId, rows.length > 0, (root) => {
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
    const rows = buildCompositionData(snapshot, scope, core.MAX_SPRINT_POINTS);
    renderWithRoot(containerId, rows.length > 0, (root) => {
      root.render(h(CompositionChartView, { rows, colors, scope }));
    });
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderBugBacklogTrendByTeamChart,
    renderBugCompositionByPriorityChart
  });
})();
