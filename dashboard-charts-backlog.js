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
  const TEAM_BUG_JQL = {
    api: "project = TFC AND type = Bug AND labels = API",
    legacy: "project = TFC AND type = Bug AND labels = Frontend",
    react: 'project = TFC AND type = Bug AND labels = "NewFrontend"',
    bc: "project = TFC AND type = Bug AND labels = Broadcast",
    workers: "project = TFO AND type = Bug AND labels = Workers",
    titanium: 'project = MESO AND type = Bug AND labels = "READY"'
  };

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
    if (!Number.isFinite(value) || value <= 0) return blankZero ? "" : "0%";
    return `${Math.round(value)}%`;
  }

  function formatSignedCount(value) {
    const safeValue = Math.round(Number(value) || 0);
    if (safeValue > 0) return `+${safeValue}`;
    return String(safeValue);
  }

  function buildBugTeamSearchUrl(teamKey) {
    const jql = TEAM_BUG_JQL[String(teamKey || "").trim().toLowerCase()];
    if (!jql) return "";
    return `https://nepgroup.atlassian.net/issues/?jql=${encodeURIComponent(`${jql} ORDER BY priority DESC, updated DESC`)}`;
  }

  function getPriorityShare(row, priorityKey) {
    return toNumber(row?.segments?.find((segment) => segment.key === priorityKey)?.share);
  }

  function getPriorityActionTone(row, priorityKey) {
    const share = getPriorityShare(row, priorityKey);
    if (priorityKey === "highest") {
      return share > 0 ? "critical" : "";
    }
    if (priorityKey === "high" && share > 30) {
      return "warning";
    }
    return "";
  }

  function shouldShowPriorityAction(row, priorityKey) {
    const share = getPriorityShare(row, priorityKey);
    if (priorityKey === "highest") return share > 0;
    if (priorityKey === "high") return share > 30;
    return false;
  }

  function shouldHighlightPriorityCell(row, priorityKey) {
    return Boolean(getPriorityActionTone(row, priorityKey));
  }

  function CompositionTableView({ rows }) {
    function renderChangeItems(row) {
      return [
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
          h("span", { className: "composition-table__change-value" }, formatSignedCount(change.delta))
        )
      );
    }

    function renderPriorityPrimary(row, priorityKey) {
      const alertLevel = getPriorityActionTone(row, priorityKey);
      const priorityShare = getPriorityShare(row, priorityKey);
      const showAction = shouldShowPriorityAction(row, priorityKey);
      const href = showAction ? buildBugTeamSearchUrl(row.teamKey) : "";
      return h(
        "span",
        {
          className: `composition-table__urgent-primary${
            showAction ? " composition-table__urgent-primary--actionable" : ""
          }`
        },
        alertLevel
          ? h("span", {
              className: `composition-table__alert composition-table__alert--${alertLevel}`,
              "aria-hidden": "true"
            })
          : null,
        formatPercent(priorityShare, { blankZero: true }),
        href
          ? h(
              "a",
              {
                className: "composition-table__urgent-link",
                href,
                target: "_blank",
                rel: "noopener noreferrer",
                "aria-label": `Open ${row.teamLabel} bug backlog in Jira`,
                title: "Open Jira search in new tab"
              },
              h(
                "svg",
                {
                  viewBox: "0 0 16 16",
                  width: 13,
                  height: 13,
                  "aria-hidden": "true",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.6,
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                },
                h("path", { d: "M9.5 2.5h4v4" }),
                h("path", { d: "M13.5 2.5L7.75 8.25" }),
                h("path", { d: "M6 4.5H3.5v8h8V10" })
              )
            )
          : null
      );
    }

    return h(
      "div",
      { className: "composition-table-shell" },
      h(
        "div",
        { className: "composition-cards" },
        rows.map((row) =>
          h(
            "article",
            { key: `${row.teamKey}-card`, className: "composition-card" },
            h(
              "div",
              { className: "composition-card__top" },
              h(
                "div",
                { className: "composition-card__team" },
                h(
                  "span",
                  {
                    className: "composition-card__team-label composition-table__team-name",
                    style: { color: row.teamColor || undefined }
                  },
                  row.teamLabel
                )
              ),
              h(
                "div",
                { className: "composition-card__total" },
                h("span", { className: "composition-card__eyebrow" }, "Total"),
                h("strong", null, String(row.total))
              )
            ),
            h(
              "div",
              { className: "composition-card__primary" },
              h(
                "div",
                {
                  className: `composition-card__block composition-card__block--urgent${
                    getPriorityActionTone(row, "highest")
                      ? ` composition-card__block--${getPriorityActionTone(row, "highest")}`
                      : ""
                  }`
                },
                h("span", { className: "composition-card__eyebrow" }, "Highest"),
                renderPriorityPrimary(row, "highest")
              ),
              h(
                "div",
                { className: "composition-card__block" },
                h("span", { className: "composition-card__eyebrow" }, "High"),
                renderPriorityPrimary(row, "high")
              ),
              h(
                "div",
                { className: "composition-card__block composition-card__block--change" },
                h("span", { className: "composition-card__eyebrow" }, "Change"),
                ...renderChangeItems(row)
              )
            ),
            h(
              "div",
              { className: "composition-card__secondary" },
              null
            )
          )
        )
      ),
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
                h(
                  "th",
                  { className: "composition-table__team-header composition-table__cell-divider", scope: "col" },
                  "Team"
                ),
                h(
                  "th",
                  { className: "composition-table__header composition-table__cell-divider", scope: "col" },
                  "Total"
                ),
                h("th", { className: "composition-table__header", scope: "col" }, "Highest"),
                h(
                  "th",
                  { className: "composition-table__header composition-table__cell-divider", scope: "col" },
                  "High"
                ),
                h("th", { className: "composition-table__header", scope: "col" }, "Change")
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
                    className: "composition-table__team-cell composition-table__cell-divider",
                    "data-label": "Team"
                  },
                  h(
                    "span",
                    {
                      className: "composition-table__team-name",
                      style: { color: row.teamColor || undefined }
                    },
                    row.teamLabel
                  )
                ),
                h(
                  "td",
                  {
                    className: "composition-table__total-cell composition-table__cell-divider",
                    "data-label": "Total"
                  },
                  String(row.total)
                ),
                h(
                  "td",
                  {
                    className: "composition-table__urgent-cell",
                    "data-label": "Highest"
                  },
                  renderPriorityPrimary(row, "highest")
                ),
                h(
                  "td",
                  {
                    className: "composition-table__metric-cell composition-table__metric-cell--high composition-table__cell-divider",
                    "data-label": "High"
                  },
                  renderPriorityPrimary(row, "high")
                ),
                h(
                  "td",
                  { className: "composition-table__change-cell", "data-label": "Change" },
                  ...renderChangeItems(row)
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
