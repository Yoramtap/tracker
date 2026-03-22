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
    TREND_LONG_LINES,
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

  function isoDateOnlyFromTimestamp(value) {
    const parsed = new Date(String(value || ""));
    if (!Number.isFinite(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function capDateToSnapshot(dateText, snapshotUpdatedAt) {
    const safeDate = String(dateText || "").trim();
    const ceilingDate = isoDateOnlyFromTimestamp(snapshotUpdatedAt);
    if (!safeDate) return "";
    if (!ceilingDate) return safeDate;
    return safeDate > ceilingDate ? ceilingDate : safeDate;
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

  function buildTrendData(snapshot, maxPoints) {
    const allPoints = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const points = allPoints.slice(-maxPoints);
    const snapshotUpdatedAt = snapshot?.updatedAt;
    return points.map((point) => {
      const api = point?.api || {};
      const legacy = point?.legacy || {};
      const react = point?.react || {};
      const bc = point?.bc || {};
      const workers = point?.workers || {};
      const titanium = point?.titanium || {};
      const displayDate = capDateToSnapshot(point?.date, snapshotUpdatedAt) || point?.date;
      return {
        date: displayDate,
        dateShort: formatDateShort(displayDate),
        api: totalForPoint(api),
        legacy: totalForPoint(legacy),
        react: totalForPoint(react),
        bc: totalForPoint(bc),
        workers: totalForPoint(workers),
        titanium: totalForPoint(titanium),
        bcLong30: toNumber(bc?.longstanding_30d_plus),
        bcLong60: toNumber(bc?.longstanding_60d_plus)
      };
    });
  }

  function buildLatestCompositionRows(snapshot, colors) {
    const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const latestPoint = points.length > 0 ? points[points.length - 1] : null;
    if (!latestPoint) return [];
    const snapshotUpdatedAt = snapshot?.updatedAt;
    const latestDate = capDateToSnapshot(latestPoint?.date, snapshotUpdatedAt) || latestPoint?.date;
    const latestMs = new Date(`${latestDate}T00:00:00Z`).getTime();

    function findLookbackPoint(days) {
      const targetMs = latestMs - days * 24 * 60 * 60 * 1000;
      return (
        points.find((point) => {
          const pointDate = capDateToSnapshot(point?.date, snapshotUpdatedAt) || point?.date;
          return new Date(`${pointDate}T00:00:00Z`).getTime() >= targetMs;
        }) ||
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
      ...TREND_LONG_LINES.map((lineDef) => ({
        ...lineDef,
        strokeWidth: 1.9,
        dot: false
      }))
    ];
  }

  function buildTrendAxis(yUpper) {
    const safeUpper = Math.max(10, Math.ceil(toNumber(yUpper)));
    const step = safeUpper <= 40 ? 10 : safeUpper <= 80 ? 20 : 25;
    const upper = Math.max(step, Math.ceil(safeUpper / step) * step);
    const ticks = [];
    for (let tick = 0; tick <= upper; tick += step) ticks.push(tick);
    return { upper, ticks };
  }

  function buildTrendPath(points) {
    if (!Array.isArray(points) || points.length === 0) return "";
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }

  function viewportWidthPx() {
    if (typeof window === "undefined") return 1024;
    const direct = Number(window.innerWidth);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fallback = Number(document?.documentElement?.clientWidth);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 1024;
  }

  function TrendSvgChart({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const [tooltipContent, setTooltipContent] = React.useState(null);
    const lineDefs = trendLineDefs(colors);
    const compactViewport = isCompactViewport();
    const width = compactViewport ? Math.max(300, Math.min(960, viewportWidthPx() - 32)) : 960;
    const height = compactViewport ? 258 : 340;
    const margin = compactViewport
      ? { top: 14, right: 12, bottom: 42, left: 40 }
      : { top: 20, right: 18, bottom: 60, left: 54 };
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const yAxis = buildTrendAxis(yUpper);
    const safeUpper = yAxis.upper;
    const yTicks = yAxis.ticks;
    const xLabelStride = compactViewport && rows.length > 5 ? 2 : 1;
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

    function hideTooltip() {
      setTooltipContent(null);
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
              title: `Toggle ${item.label}`,
              onClick: () => toggleLine(item.key),
              "aria-pressed": hidden ? "false" : "true",
              style: compactViewport ? { minHeight: "36px", padding: "8px 10px" } : undefined
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
          ...rows.flatMap((row, index) => {
            const shouldRenderLabel =
              !compactViewport || rows.length <= 5 || index % xLabelStride === 0 || index === rows.length - 1;
            if (!shouldRenderLabel) return [];
            const x =
              rows.length <= 1
                ? (plotLeft + plotRight) / 2
                : linearScale(index, 0, rows.length - 1, plotLeft, plotRight);
            return h(
              "text",
              {
                key: `trend-x-${row.date}`,
                x,
                y: plotBottom + 18,
                fill: colors.text,
                fontSize: compactViewport ? 11 : 11,
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
              strokeDasharray: series.strokeDasharray || undefined,
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }),
              ...(series.dot === false
              ? []
              : series.points.map((point) =>
                  h("circle", {
                    key: point.key,
                    cx: point.x,
                    cy: point.y,
                    r: compactViewport ? 3.75 : 3.5,
                    fill: series.stroke,
                    stroke: "#ffffff",
                    strokeWidth: compactViewport ? 1.4 : 1.25,
                    onMouseEnter: () => showTooltip(point),
                    onMouseLeave: hideTooltip,
                    onClick: () => showTooltip(point),
                    onFocus: () => showTooltip(point),
                    onBlur: hideTooltip,
                    onKeyDown: (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        showTooltip(point);
                      }
                    },
                    tabIndex: 0,
                    role: "button",
                    "aria-label": `${point.lineDef.name} on ${point.dateShort}: ${toWhole(point.value)} open bugs`,
                    style: { cursor: "pointer" }
                  })
                ))
          ]),
          h(
            "text",
            {
              x: plotLeft - 34,
              y: plotTop + (plotBottom - plotTop) / 2,
              fill: "rgba(31, 51, 71, 0.92)",
              fontSize: compactViewport ? 11 : 11,
              fontWeight: 700,
              textAnchor: "middle",
              transform: `rotate(-90 ${plotLeft - 34} ${plotTop + (plotBottom - plotTop) / 2})`
            },
            "Open bugs"
          ),
          h(
            "text",
            {
              x: plotLeft + (plotRight - plotLeft) / 2,
              y: plotBottom + 38,
              fill: "rgba(31, 51, 71, 0.92)",
              fontSize: compactViewport ? 11 : 11,
              fontWeight: 700,
              textAnchor: "middle"
            },
            "Sprint bucket"
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
    const compactViewport = isCompactViewport();

    function renderChangeItems(row) {
      const changeItems = [
        ["30d", row.change30d],
        ["90d", row.change90d],
        ["6m", row.change180d]
      ];
      if (compactViewport) {
        return [
          h(
            "div",
            {
              key: "compact-change",
              className: "composition-table__change-item composition-table__change-item--flat",
              style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 10px",
                alignItems: "baseline"
              }
            },
            ...changeItems.map(([label, change]) =>
              h(
                "span",
                {
                  key: label,
                  style: {
                    display: "inline-flex",
                    gap: "4px",
                    alignItems: "baseline"
                  }
                },
                h("span", { className: "composition-table__change-label" }, label),
                h("span", { className: "composition-table__change-value" }, formatSignedCount(change.delta))
              )
            )
          )
        ];
      }
      return changeItems.map(([label, change]) =>
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

    function renderPrioritySummary(row) {
      if (!compactViewport) return null;
      const mediumShare = getPriorityShare(row, "medium");
      const lowShare = getPriorityShare(row, "low");
      const lowestShare = getPriorityShare(row, "lowest");
      return h(
        "div",
        {
          className: "composition-card__secondary-summary",
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 10px",
            alignItems: "baseline",
            fontSize: "0.74rem",
            lineHeight: 1.25,
            color: "rgba(31, 51, 71, 0.72)"
          }
        },
        h(
          "span",
          null,
          "Med ",
          h("strong", null, formatPercent(mediumShare))
        ),
        h(
          "span",
          null,
          "Low ",
          h("strong", null, formatPercent(lowShare))
        ),
        h(
          "span",
          null,
          "Lowest ",
          h("strong", null, formatPercent(lowestShare))
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
              renderPrioritySummary(row)
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
        ...rows.map((row) => row.bc),
        ...rows.map((row) => row.workers),
        ...rows.map((row) => row.titanium),
        ...rows.map((row) => row.bcLong30),
        ...rows.map((row) => row.bcLong60)
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
