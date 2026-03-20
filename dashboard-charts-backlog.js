"use strict";

(function initDashboardBacklogCharts() {
  const RECENT_TREND_POINTS = 5;
  const core = window.DashboardChartCore;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }

  const {
    TEAM_CONFIG,
    TREND_LONG_LINES,
    TREND_TEAM_LINES,
    React,
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    activeLineDot,
    buildAxisLabel,
    buildNiceNumberAxis,
    computeYUpper,
    createTooltipContent,
    formatDateShort,
    h,
    isCompactViewport,
    makeTooltipLine,
    renderLegendNode,
    renderWithRoot,
    toNumber,
    tooltipTitleLine,
    trendLayoutForViewport,
    withSafeTooltipProps
  } = core;

  const PRIORITY_TABLE_ORDER = [
    { key: "highest", label: "Highest" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
    { key: "lowest", label: "Lowest" }
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

  function buildLatestCompositionRows(snapshot, colors) {
    const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const latestPoint = points.length > 0 ? points[points.length - 1] : null;
    if (!latestPoint) return [];
    const latestMs = new Date(`${latestPoint.date}T00:00:00Z`).getTime();

    function findLookbackPoint(days) {
      const targetMs = latestMs - days * 24 * 60 * 60 * 1000;
      return (
        points.find((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= targetMs) ||
        points[0] ||
        latestPoint
      );
    }

    function buildChangeMetrics(total, previousTotal) {
      const delta = total - previousTotal;
      const deltaPercent = previousTotal > 0 ? (delta / previousTotal) * 100 : null;
      return {
        previousTotal,
        delta,
        deltaPercent
      };
    }

    const comparisonPoint90d = findLookbackPoint(90);
    const comparisonPoint180d = findLookbackPoint(180);
    const comparisonPoint30d = findLookbackPoint(30);

    return TEAM_CONFIG.map((team) => {
      const metrics = latestPoint?.[team.key] || {};
      const previousMetrics30d = comparisonPoint30d?.[team.key] || {};
      const previousMetrics90d = comparisonPoint90d?.[team.key] || {};
      const previousMetrics180d = comparisonPoint180d?.[team.key] || {};
      const total = totalForPoint(metrics);
      const previousTotal30d = totalForPoint(previousMetrics30d);
      const previousTotal90d = totalForPoint(previousMetrics90d);
      const previousTotal180d = totalForPoint(previousMetrics180d);
      const segments = PRIORITY_TABLE_ORDER.map((priority) => {
        const count = toNumber(metrics?.[priority.key]);
        const share = total > 0 ? (count / total) * 100 : 0;
        return {
          key: priority.key,
          label: priority.label,
          count,
          share,
          fill: colors.priorities[priority.key]
        };
      });
      return {
        teamKey: team.key,
        teamLabel: team.label,
        teamColor: colors.teams[team.key],
        total,
        change30d: buildChangeMetrics(total, previousTotal30d),
        change90d: buildChangeMetrics(total, previousTotal90d),
        change180d: buildChangeMetrics(total, previousTotal180d),
        urgentShare:
          total > 0 ? ((toNumber(metrics?.highest) + toNumber(metrics?.high)) / total) * 100 : 0,
        segments
      };
    }).sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      return left.teamLabel.localeCompare(right.teamLabel);
    });
  }

  function trendLineDefs(colors) {
    return [
      ...TREND_TEAM_LINES.map(([dataKey, name, colorKey]) => ({
        dataKey,
        name,
        stroke: colors.teams[colorKey],
        strokeWidth: 2.5,
        dot: true
      })),
      ...TREND_LONG_LINES.map((line) => ({
        ...line,
        strokeWidth: 2,
        dot: true
      }))
    ];
  }

  function TrendChartView({ rows, colors, yUpper, supporting = false }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const lineDefs = trendLineDefs(colors);
    const layout = trendLayoutForViewport(rows.length);
    const compactViewport = isCompactViewport();
    const niceYAxis = buildNiceNumberAxis(yUpper);
    const chartHeight = supporting ? Math.max(224, layout.chartHeight - 96) : layout.chartHeight;
    const chartMargin = supporting
      ? {
          top: 4,
          right: 8,
          bottom: 50,
          left: compactViewport ? 44 : 52
        }
      : layout.margin;

    return h(
      "div",
      {
        className: `chart-series-shell${supporting ? " chart-series-shell--supporting" : ""}`
      },
      renderLegendNode({
        colors,
        defs: lineDefs,
        hiddenKeys,
        setHiddenKeys,
        compact: supporting || layout.legendCompact
      }),
      h(
        ResponsiveContainer,
        { width: "100%", height: chartHeight },
        h(
          LineChart,
          {
            data: rows,
            margin: chartMargin
          },
          h(CartesianGrid, { stroke: colors.grid, vertical: false }),
          h(XAxis, {
            dataKey: "dateShort",
            stroke: colors.text,
            tick: {
              fill: colors.text,
              fontSize: layout.xTickFontSize,
              fontFamily: "var(--font-ui)"
            },
            tickMargin: layout.xTickMargin,
            interval: layout.xAxisInterval,
            minTickGap: layout.minTickGap,
            label: buildAxisLabel("Sprint start")
          }),
          h(YAxis, {
            stroke: colors.text,
            tick: {
              fill: colors.text,
              fontSize: layout.yTickFontSize,
              fontFamily: "var(--font-ui)"
            },
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
              dot: lineDef.dot
                ? {
                    r: compactViewport ? 2.75 : 3.25,
                    fill: lineDef.stroke,
                    stroke: "#ffffff",
                    strokeWidth: 1.25
                  }
                : false,
              activeDot: activeLineDot(colors),
              hide: hiddenKeys.has(lineDef.dataKey),
              isAnimationActive: false
            })
          )
        )
      )
    );
  }

  function formatPercent(value, { blankZero = false } = {}) {
    if (!Number.isFinite(value) || value <= 0) return blankZero ? "-" : "0%";
    return `${Math.round(value)}%`;
  }

  function formatSignedCount(value) {
    const safeValue = Math.round(Number(value) || 0);
    if (safeValue > 0) return `+${safeValue}`;
    return String(safeValue);
  }

  function formatSignedPercent(value, previousTotal, currentTotal) {
    if (!Number.isFinite(value)) {
      if (previousTotal <= 0 && currentTotal > 0) return "new";
      return "0%";
    }
    const rounded = Math.round(value);
    const prefix = rounded > 0 ? "+" : "";
    return `${prefix}${String(rounded)}%`;
  }

  function formatUrgentBreakdown(row) {
    const highestShare = toNumber(
      row?.segments?.find((segment) => segment.key === "highest")?.share
    );
    const highShare = toNumber(row?.segments?.find((segment) => segment.key === "high")?.share);
    const hasHigh = highShare > 0;
    const hasHighest = highestShare > 0;
    if (hasHigh && hasHighest) {
      return `${formatPercent(highShare)} high • ${formatPercent(highestShare)} highest`;
    }
    if (hasHigh) return "high";
    if (hasHighest) return "highest";
    return "";
  }

  function CompositionTableView({ rows }) {
    return h(
      "div",
      { className: "composition-table-shell" },
      h(
        "div",
        { className: "composition-table-scroll" },
        h(
          "table",
          { className: "composition-table" },
          h(
            "thead",
            null,
            h(
              "tr",
              null,
              h("th", { className: "composition-table__team-header", scope: "col" }, "Team"),
              h("th", { className: "composition-table__header", scope: "col" }, "Total"),
              h("th", { className: "composition-table__header", scope: "col" }, "Change"),
              h("th", { className: "composition-table__header", scope: "col" }, "High + Highest"),
              h("th", { className: "composition-table__header", key: "medium", scope: "col" }, "Medium"),
              h("th", { className: "composition-table__header", key: "low", scope: "col" }, "Low"),
              h("th", { className: "composition-table__header", key: "lowest", scope: "col" }, "Lowest")
            )
          ),
          h(
            "tbody",
            null,
            rows.map((row) =>
              h(
                "tr",
                { key: row.teamKey },
                h(
                  "th",
                  {
                    scope: "row",
                    className: "composition-table__team-cell",
                    "data-label": "Team"
                  },
                  h(
                    "span",
                    {
                      className: "composition-table__team-dot",
                      style: { backgroundColor: row.teamColor }
                    },
                    ""
                  ),
                  h("span", null, row.teamLabel)
                ),
                h(
                  "td",
                  { className: "composition-table__total-cell", "data-label": "Total" },
                  String(row.total)
                ),
                h(
                  "td",
                  { className: "composition-table__change-cell", "data-label": "Change" },
                  [
                    ["30d", row.change30d],
                    ["90d", row.change90d],
                    ["6m", row.change180d]
                  ].map(([label, change]) =>
                    h(
                      "div",
                      {
                        key: label,
                        className: `composition-table__change-item ${
                          change.delta > 0
                            ? "composition-table__change-item--up"
                            : change.delta < 0
                              ? "composition-table__change-item--down"
                              : "composition-table__change-item--flat"
                        }`
                      },
                      h("span", { className: "composition-table__change-label" }, label),
                      h("span", { className: "composition-table__change-value" }, formatSignedCount(change.delta)),
                      h(
                        "span",
                        { className: "composition-table__change-meta" },
                        `(${formatSignedPercent(change.deltaPercent, change.previousTotal, row.total)})`
                      )
                    )
                  )
                ),
                h(
                  "td",
                  {
                    className: "composition-table__urgent-cell",
                    "data-label": "High + Highest"
                  },
                  h(
                    "span",
                    { className: "composition-table__urgent-primary" },
                    formatPercent(row.urgentShare, { blankZero: true })
                  ),
                  h(
                    "span",
                    { className: "composition-table__urgent-meta" },
                    formatUrgentBreakdown(row)
                  )
                ),
                ...row.segments
                  .filter((segment) => segment.key !== "highest" && segment.key !== "high")
                  .map((segment) =>
                  h(
                    "td",
                    {
                      key: segment.key,
                      className: `composition-table__metric-cell composition-table__metric-cell--${segment.key}`,
                      "data-label": segment.label
                    },
                    formatPercent(segment.share, { blankZero: true })
                      ? h(
                          "span",
                          {
                            className: "composition-table__metric-value",
                            style: {
                              color:
                                segment.share >= 18
                                  ? "rgba(31, 51, 71, 0.96)"
                                  : "rgba(31, 51, 71, 0.82)"
                            }
                          },
                          formatPercent(segment.share, { blankZero: true })
                        )
                      : ""
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  function renderBugBacklogTrendByTeamChart({ containerId, snapshot, colors }) {
    const rows = buildTrendData(snapshot, RECENT_TREND_POINTS);
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
      root.render(h(TrendChartView, { rows, colors, yUpper, supporting: true }));
    });
  }

  function renderBugCompositionByPriorityChart({ containerId, snapshot, colors }) {
    const rows = buildLatestCompositionRows(snapshot, colors);
    renderWithRoot(containerId, rows.length > 0, (root) => {
      root.render(h(CompositionTableView, { rows }));
    });
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderBugBacklogTrendByTeamChart,
    renderBugCompositionByPriorityChart
  });
})();
