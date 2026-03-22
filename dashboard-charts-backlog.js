"use strict";

(function initDashboardBacklogCharts() {
  const RECENT_TREND_POINTS = 10;
  const core = window.DashboardChartCore;
  const svgCore = window.DashboardSvgCore;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }
  if (!svgCore) {
    throw new Error("Dashboard SVG core not loaded.");
  }

  const {
    TEAM_CONFIG,
    TREND_TEAM_LINES,
    React,
    computeYUpper,
    formatDateShort,
    h,
    isCompactViewport,
    renderWithRoot,
    toNumber,
    toWhole
  } = core;
  const { SvgChartShell, linearScale, renderSvgChart, withAlpha } = svgCore;

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
        bc: totalForPoint(bc)
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
    return TREND_TEAM_LINES.map(([dataKey, name, colorKey]) => ({
      dataKey,
      name,
      stroke: colors.teams[colorKey],
      strokeWidth: 2.5,
      dot: true
    }));
  }

  function buildTrendTicks(yUpper) {
    const safeUpper = Math.max(10, Math.ceil(toNumber(yUpper)));
    const roughStep = safeUpper <= 40 ? 10 : safeUpper <= 80 ? 20 : 25;
    const ticks = [];
    for (let tick = 0; tick <= safeUpper; tick += roughStep) ticks.push(tick);
    if (ticks[ticks.length - 1] !== safeUpper) ticks.push(safeUpper);
    return ticks;
  }

  function buildTrendPath(points) {
    if (!Array.isArray(points) || points.length === 0) return "";
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }

  function TrendSvgChart({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const [tooltipContent, setTooltipContent] = React.useState(null);
    const lineDefs = trendLineDefs(colors);
    const compactViewport = isCompactViewport();
    const width = 960;
    const height = compactViewport ? 290 : 340;
    const margin = compactViewport
      ? { top: 16, right: 14, bottom: 54, left: 46 }
      : { top: 20, right: 18, bottom: 60, left: 54 };
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const safeUpper = Math.max(10, Math.ceil(toNumber(yUpper)));
    const yTicks = buildTrendTicks(safeUpper);
    const legendItems = lineDefs.map((lineDef) => ({
      key: lineDef.dataKey,
      label: lineDef.name,
      color: lineDef.stroke
    }));
    const visibleLineDefs = lineDefs.filter((lineDef) => !hiddenKeys.has(lineDef.dataKey));
    const seriesRows = visibleLineDefs.map((lineDef) => ({
      ...lineDef,
      points: rows.map((row, index) => ({
        key: `${lineDef.dataKey}-${row.date}`,
        date: row.date,
        label: row.dateShort,
        value: toNumber(row?.[lineDef.dataKey]),
        x:
          rows.length <= 1
            ? (plotLeft + plotRight) / 2
            : linearScale(index, 0, rows.length - 1, plotLeft, plotRight),
        y: linearScale(toNumber(row?.[lineDef.dataKey]), 0, safeUpper, plotBottom, plotTop),
        lineDef
      }))
    }));

    function toggleLine(dataKey) {
      setHiddenKeys((previous) => {
        const next = new Set(previous);
        if (next.has(dataKey)) next.delete(dataKey);
        else next.add(dataKey);
        return next;
      });
    }

    function showTooltip(point) {
      setTooltipContent(
        h(
          "div",
          null,
          h("p", null, h("strong", null, point.lineDef.name)),
          h("p", null, point.date || ""),
          h("p", null, `Open bugs: ${toWhole(point.value)}`)
        )
      );
    }

    return h(
      "div",
      { className: "chart-series-shell" },
      h(
        "div",
        { className: "svg-chart-legend", role: "group", "aria-label": "Trend line toggles" },
        ...legendItems.map((item) => {
          const hidden = hiddenKeys.has(item.key);
          return h(
            "button",
            {
              key: `trend-legend-${item.key}`,
              type: "button",
              className: `svg-chart-legend__button${hidden ? " svg-chart-legend__button--off" : ""}`,
              onClick: () => toggleLine(item.key),
              "aria-pressed": hidden ? "false" : "true"
            },
            h("span", {
              className: "svg-chart-legend__swatch",
              style: { background: hidden ? withAlpha(item.color, 0.28) : item.color }
            }),
            h("span", { className: "svg-chart-legend__label" }, item.label)
          );
        })
      ),
      h(
        SvgChartShell,
        { width, height, colors, tooltipContent, legendItems: [] },
        h(
          "g",
          null,
          ...yTicks.map((tick) => {
            const y = linearScale(tick, 0, safeUpper, plotBottom, plotTop);
            return h(
              "g",
              { key: `trend-y-${tick}` },
              h("line", {
                x1: plotLeft,
                x2: plotRight,
                y1: y,
                y2: y,
                stroke: colors.grid,
                strokeWidth: tick === 0 ? 1.2 : 1
              }),
              h(
                "text",
                {
                  x: plotLeft - 8,
                  y: y + 4,
                  fill: colors.text,
                  fontSize: compactViewport ? 10 : 11,
                  fontWeight: 600,
                  textAnchor: "end"
                },
                String(tick)
              )
            );
          }),
          ...rows.map((row, index) => {
            const x =
              rows.length <= 1
                ? (plotLeft + plotRight) / 2
                : linearScale(index, 0, rows.length - 1, plotLeft, plotRight);
            return h(
              "text",
              {
                key: `trend-x-${row.date}`,
                x,
                y: plotBottom + 20,
                fill: colors.text,
                fontSize: compactViewport ? 10 : 11,
                fontWeight: 600,
                textAnchor: "middle"
              },
              row.dateShort || ""
            );
          }),
          ...seriesRows.flatMap((series) => [
            h("path", {
              key: `trend-line-${series.dataKey}`,
              d: buildTrendPath(series.points),
              fill: "none",
              stroke: series.stroke,
              strokeWidth: series.strokeWidth,
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }),
            ...series.points.map((point) =>
              h("circle", {
                key: point.key,
                cx: point.x,
                cy: point.y,
                r: compactViewport ? 3 : 3.5,
                fill: series.stroke,
                stroke: "#ffffff",
                strokeWidth: 1.25,
                onMouseEnter: () => showTooltip(point),
                onMouseLeave: () => setTooltipContent(null)
              })
            )
          ]),
          h(
            "text",
            {
              x: plotLeft - 42,
              y: plotTop + (plotBottom - plotTop) / 2,
              fill: "rgba(31, 51, 71, 0.92)",
              fontSize: compactViewport ? 10 : 11,
              fontWeight: 700,
              textAnchor: "middle",
              transform: `rotate(-90 ${plotLeft - 42} ${plotTop + (plotBottom - plotTop) / 2})`
            },
            "Open bugs"
          ),
          h(
            "text",
            {
              x: plotLeft + (plotRight - plotLeft) / 2,
              y: plotBottom + 42,
              fill: "rgba(31, 51, 71, 0.92)",
              fontSize: compactViewport ? 10 : 11,
              fontWeight: 700,
              textAnchor: "middle"
            },
            "Sprint start"
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
    const yUpper = computeYUpper(
      [
        ...rows.map((row) => row.api),
        ...rows.map((row) => row.legacy),
        ...rows.map((row) => row.react),
        ...rows.map((row) => row.bc)
      ],
      { min: 10, pad: 1.08 }
    );
    renderSvgChart(containerId, rows.length > 0, () => h(TrendSvgChart, { rows, colors, yUpper }));
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
