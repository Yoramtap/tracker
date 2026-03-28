"use strict";

(function initDashboardProductCharts() {
  const React = window.React;
  const core = window.DashboardChartCore;
  const svgCore = window.DashboardSvgCore;
  const dashboardUiUtils = window.DashboardViewUtils;
  const dataUtils = window.DashboardDataUtils;
  if (!React || !core) {
    throw new Error("Dashboard chart core not loaded.");
  }
  if (!svgCore) {
    throw new Error("Dashboard SVG core not loaded.");
  }
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }
  if (!dataUtils) {
    throw new Error("Dashboard data helpers not loaded.");
  }

  const {
    TEAM_CONFIG,
    TREND_LONG_LINES,
    TREND_TEAM_LINES,
    buildRowMarkup,
    computeYUpper,
    formatDateShort,
    getPrCycleTeamColor,
    h,
    isCompactViewport,
    renderProductCycleCard,
    renderWithRoot,
    toNumber,
    toWhole,
    viewportWidthPx
  } = core;
  const { toCount } = dataUtils;
  const { escapeHtml } = dashboardUiUtils;
  const { SvgChartShell, linearScale, renderSvgChart, withAlpha } = svgCore;

  function formatStackedCycleMonthsValueMarkup(valueInDays) {
    const months = Math.max(0, toNumber(valueInDays) / 30.4375);
    const rounded = months === 0 ? "0" : months.toFixed(1);
    const unit = Math.abs(months - 1) < 0.05 ? "month" : "months";
    return `<span class="stacked-duration"><span class="stacked-duration__value">${rounded}</span><span class="stacked-duration__unit">${unit}</span></span>`;
  }

  function formatTrendTickLabel(dateText) {
    const timestamp = new Date(`${String(dateText || "")}T00:00:00Z`).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }

  function getCycleFillWidth(value, upperBound) {
    const safeUpper = Math.max(1, toNumber(upperBound));
    const safeValue = Math.max(0, toNumber(value));
    if (safeValue <= 0) return 0;
    return Math.max(12, Math.round((safeValue / safeUpper) * 100));
  }

  function normalizeProductCycleTeamKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "orchestration" || raw === "workers") return "workers";
    if (raw === "multi team" || raw === "multi-team" || raw === "multiteam") {
      return "multiteam";
    }
    return raw;
  }

  function buildJiraSearchUrl(jiraBase, jql) {
    const safeJql = String(jql || "").trim();
    if (!safeJql) return "";
    const url = new URL("/issues/", String(jiraBase || "https://nepgroup.atlassian.net").trim());
    url.searchParams.set("jql", safeJql);
    return url.toString();
  }

  function normalizeDisplayTeamName(name) {
    const raw = String(name || "").trim();
    const key = normalizeProductCycleTeamKey(raw);
    if (key === "workers") return "Workers";
    if (key === "multiteam") return "Multi team";
    return raw;
  }

  const RECENT_TREND_POINTS = 10;
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
    if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    if (points.length === 2) {
      return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");
    }

    const deltas = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const dx = points[index + 1].x - points[index].x;
      const dy = points[index + 1].y - points[index].y;
      deltas.push(dx > 0 ? dy / dx : 0);
    }

    const tangents = new Array(points.length).fill(0);
    tangents[0] = deltas[0];
    tangents[tangents.length - 1] = deltas[deltas.length - 1];
    for (let index = 1; index < points.length - 1; index += 1) {
      const previousDelta = deltas[index - 1];
      const nextDelta = deltas[index];
      tangents[index] =
        previousDelta === 0 || nextDelta === 0 || previousDelta * nextDelta < 0
          ? 0
          : (previousDelta + nextDelta) / 2;
    }

    for (let index = 0; index < deltas.length; index += 1) {
      const delta = deltas[index];
      if (delta === 0) {
        tangents[index] = 0;
        tangents[index + 1] = 0;
        continue;
      }
      const leftRatio = tangents[index] / delta;
      const rightRatio = tangents[index + 1] / delta;
      const magnitude = Math.hypot(leftRatio, rightRatio);
      if (magnitude <= 3) continue;
      const scale = 3 / magnitude;
      tangents[index] = scale * leftRatio * delta;
      tangents[index + 1] = scale * rightRatio * delta;
    }

    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const dx = next.x - current.x;
      const control1X = current.x + dx / 3;
      const control1Y = current.y + (tangents[index] * dx) / 3;
      const control2X = next.x - dx / 3;
      const control2Y = next.y - (tangents[index + 1] * dx) / 3;
      path += ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)} ${control2X.toFixed(2)} ${control2Y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }
    return path;
  }

  function TrendSvgChart({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const [tooltipContent, setTooltipContent] = React.useState(null);
    const lineDefs = trendLineDefs(colors);
    const compactViewport = isCompactViewport();
    const width = compactViewport ? Math.max(300, Math.min(960, viewportWidthPx(1024) - 32)) : 960;
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
              formatTrendTickLabel(row.date) || row.dateShort || ""
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
            "Sprint start date"
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
    return buildJiraSearchUrl(
      "https://nepgroup.atlassian.net",
      `${jql} ORDER BY priority DESC, updated DESC`
    );
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

  function formatDoneTotalSampleMarkup(doneCount, totalCount) {
    const done = toCount(doneCount);
    const total = toCount(totalCount);
    return `${done}/${total} done`;
  }

  function FacilityUatListCard({ rows, groupingLabel, jiraBrowseBase }) {
    const displayRows = (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      uatMonths: toNumber(row?.uatAvg) / 30.4375
    }));
    const maxMonths = Math.max(1, ...displayRows.map((row) => toNumber(row?.uatMonths)));
    const jiraRoot = String(jiraBrowseBase || "https://nepgroup.atlassian.net/browse/").replace(
      /\/browse\/?$/,
      ""
    );

    return h(
      "div",
      { className: "product-cycle-team-card-wrap" },
      h(
        "article",
        { className: "pr-cycle-stage-card management-uat-card" },
        h(
          "div",
          { className: "pr-cycle-stage-card__header" },
          h(
            "div",
            { className: "pr-cycle-stage-card__meta" },
            h("div", { className: "pr-cycle-stage-card__team" }, "All business units"),
            h(
              "div",
              { className: "pr-cycle-stage-card__submeta" },
              `${String(groupingLabel || "Business Unit")} • Target: 1 month`
            )
          )
        ),
        h(
          "div",
          { className: "pr-cycle-stage-list" },
          ...displayRows.map((row) => {
            const uatMonths = toNumber(row?.uatMonths);
            const sampleCount = toWhole(row?.sampleCount);
            const hasLink = sampleCount > 0;
            const needsAction = hasLink;
            const alertLevel = uatMonths >= 2 ? "critical" : uatMonths > 1 ? "warning" : "";
            const safeMonths = Math.max(0, uatMonths);
            const monthParts = {
              value: safeMonths === 0 ? "0" : safeMonths.toFixed(1),
              unit: Math.abs(safeMonths - 1) < 0.05 ? "month" : "months"
            };
            const issueKeys = Array.from(
              new Set(
                (Array.isArray(row?.issueItems) ? row.issueItems : [])
                  .map((item) => String(item?.issueId || item || "").trim())
                  .filter(Boolean)
              )
            );
            const width = sampleCount > 0 ? Math.max(0, Math.round((uatMonths / maxMonths) * 100)) : 0;
            return h(
              "div",
              {
                key: `uat-row-${String(row?.label || "")}`,
                className: "pr-cycle-stage-row management-uat-row",
                "data-stage": "uat"
              },
              h(
                "div",
                { className: "pr-cycle-stage-row__label" },
                h("span", { className: "pr-cycle-stage-row__label-text" }, String(row?.label || "")),
                h("span", { className: "pr-cycle-stage-row__sample" }, `n=${sampleCount}`)
              ),
              h(
                "div",
                { className: "pr-cycle-stage-row__track", "aria-hidden": "true" },
                h("div", {
                  className: "pr-cycle-stage-row__fill",
                  style: {
                    width: `${width}%`,
                    background: "rgba(121, 136, 156, 0.5)"
                  }
                })
              ),
              h(
                "div",
                { className: "pr-cycle-stage-row__value management-uat-row__value" },
                needsAction
                  ? h(
                      "a",
                      {
                        className: `management-uat-row__action management-uat-row__action--inline${
                          alertLevel ? ` management-uat-row__action--${alertLevel}` : ""
                        }`,
                        href:
                          issueKeys.length === 0
                            ? ""
                            : buildJiraSearchUrl(
                                jiraRoot,
                                `issueKey in (${issueKeys.join(",")}) ORDER BY updated DESC`
                              ),
                        target: "_blank",
                        rel: "noopener noreferrer",
                        "aria-label": `Open ${String(row?.label || "")} Jira issues in new tab`,
                        title: "Open Jira search in new tab"
                      },
                      h(
                        "span",
                        { className: "management-uat-row__action-value" },
                        h("span", { className: "management-uat-row__value-text" }, monthParts.value),
                        h("span", { className: "management-uat-row__value-unit" }, monthParts.unit)
                      ),
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
                  : h(
                      "span",
                      {
                        className: `management-uat-row__plain-value${
                          alertLevel ? ` management-uat-row__plain-value--${alertLevel}` : ""
                        }`
                      },
                      h(
                        "span",
                        { className: "management-uat-row__action-value" },
                        h("span", { className: "management-uat-row__value-text" }, monthParts.value),
                        h("span", { className: "management-uat-row__value-unit" }, monthParts.unit)
                      ),
                      h("span", { className: "management-uat-row__icon-spacer", "aria-hidden": "true" })
                    )
              )
            );
          })
        )
      )
    );
  }

  function renderLifecycleTimeSpentPerStageChart({
    containerId,
    rows,
    seriesDefs,
    colors,
    categorySecondaryLabels
  }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const primarySeries = Array.isArray(seriesDefs) ? seriesDefs.find(Boolean) : null;
    if (!primarySeries || chartRows.length === 0) return false;

    const compactViewport = isCompactViewport();
    const maxValue = Math.max(
      1,
      ...chartRows.map((row) => toNumber(row?.[primarySeries.key || primarySeries.dataKey]))
    );
    const teamLabel = normalizeDisplayTeamName(primarySeries.team || primarySeries.name || "All teams");
    const rowsMarkup = chartRows
      .map((row) => {
        const value = toNumber(row?.[primarySeries.key || primarySeries.dataKey]);
        const sampleCount = toCount(row?.meta_slot_0?.n);
        const width = value > 0 ? getCycleFillWidth(value, maxValue) : 0;
        const months = value / 30.4375;
        const alertLevel = months >= 2 ? "critical" : months > 1 ? "warning" : "";
        return buildRowMarkup({
          rowClassName: "lifecycle-stage-row",
          trackClassName: "lifecycle-stage-row__track",
          fillClassName: "lifecycle-stage-row__fill",
          stage: String(row?.phaseKey || row?.phaseLabel || "").trim().toLowerCase(),
          label: String(row?.phaseLabel || "").trim(),
          sampleMarkup:
            categorySecondaryLabels?.[String(row?.phaseLabel || "")] ||
            (sampleCount > 0 ? `n=${sampleCount}` : "n=0"),
          width,
          fillStyle: "background:rgba(121, 136, 156, 0.68);",
          valueMarkup: formatStackedCycleMonthsValueMarkup(value),
          valueFrameClassName: alertLevel ? `pr-cycle-stage-row__value-frame--${alertLevel}` : ""
        });
      })
      .join("");

    return renderProductCycleCard(containerId, {
      className: "lifecycle-stage-card",
      teamKey: String(primarySeries.team || primarySeries.name || ""),
      teamColor: colors?.teams?.all || "#9aa8ba",
      headerMarkup: `
        <div class="pr-cycle-stage-card__team">${escapeHtml(teamLabel)}</div>
        <div class="pr-cycle-stage-card__submeta">${compactViewport ? "Target: 1 mo" : "Target: 1 month"}</div>
      `,
      rowsMarkup
    });
  }

  function renderDevelopmentVsUatByFacilityChart({
    containerId,
    rows,
    groupingLabel = "facility",
    jiraBrowseBase = "https://nepgroup.atlassian.net/browse/"
  }) {
    const chartRows = Array.isArray(rows) ? rows.slice() : [];
    renderSvgChart(containerId, chartRows.length > 0, () =>
      h(FacilityUatListCard, {
        rows: chartRows,
        groupingLabel,
        jiraBrowseBase
      })
    );
  }

  function renderProductCycleSingleTeamCard(containerId, row, allRows) {
    if (!row) return;
    const compactViewport = isCompactViewport();
    const teamColor = getPrCycleTeamColor(row?.team);
    const cycleSample = toCount(row?.meta_cycle?.n);
    const shippedCount = toCount(row?.cycleDoneCount);
    const ongoingCount = toCount(row?.cycleOngoingCount);
    const maxCycleDays = 5 * 30.4375;
    const maxShipped = Math.max(1, ...allRows.map((item) => toCount(item?.cycleDoneCount)));
    const maxOngoing = Math.max(1, ...allRows.map((item) => toCount(item?.cycleOngoingCount)));
    const cycleWidth = cycleSample > 0 ? getCycleFillWidth(row?.cycle, maxCycleDays) : 0;
    const shippedWidth = shippedCount > 0 ? getCycleFillWidth(shippedCount, maxShipped) : 0;
    const ongoingWidth = ongoingCount > 0 ? getCycleFillWidth(ongoingCount, maxOngoing) : 0;
    renderProductCycleCard(containerId, {
      className: "product-cycle-team-card",
      teamKey: String(row?.team || ""),
      teamColor,
      headerMarkup: `<div class="pr-cycle-stage-card__team">${escapeHtml(
        normalizeDisplayTeamName(row?.team || "")
      )}</div>`,
      rowsMarkup: [
        buildRowMarkup({
          rowClassName: "product-cycle-team-card__row",
          stage: "cycle",
          label: compactViewport ? "Cycle" : "Cycle time",
          sampleMarkup: cycleSample > 0 ? `n=${cycleSample}` : "n=0",
          width: cycleWidth,
          valueMarkup: formatStackedCycleMonthsValueMarkup(row?.cycle)
        }),
        buildRowMarkup({
          rowClassName: "product-cycle-team-card__row",
          stage: "shipped",
          label: compactViewport ? "Done" : "Shipped",
          sampleMarkup: compactViewport ? "finished ideas" : "done ideas",
          width: shippedWidth,
          valueMarkup: String(shippedCount)
        }),
        buildRowMarkup({
          rowClassName: "product-cycle-team-card__row",
          stage: "ongoing",
          label: compactViewport ? "Open" : "Ongoing",
          sampleMarkup: compactViewport ? "still in cycle" : "ideas still in cycle",
          width: ongoingWidth,
          valueMarkup: String(ongoingCount)
        })
      ].join(""),
      footerMarkup: `
        <div class="pr-cycle-stage-card__footer">
          <span><strong>${shippedCount} ${compactViewport ? "done" : "shipped"}</strong>${
            ongoingCount > 0 ? ` • ${ongoingCount} ${compactViewport ? "open" : "still in cycle"}` : ""
          }</span>
        </div>
      `
    });
  }

  function renderProductCycleComparisonCard(containerId, rows, scopeLabel) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const maxCycleDays = 5 * 30.4375;
    const rowsMarkup = rows
      .map((row) => {
        const cycleSample = toCount(row?.meta_cycle?.n);
        const shippedCount = toCount(row?.cycleDoneCount);
        const teamColor = getPrCycleTeamColor(row?.team);
        const cycleWidth = cycleSample > 0 ? getCycleFillWidth(row?.cycle, maxCycleDays) : 0;
        const cycleAlertLevel = toNumber(row?.cycle) / 30.4375 >= 2 ? "critical" : "";
        return buildRowMarkup({
          rowClassName: "product-cycle-compare-row",
          stage: "cycle",
          label: normalizeDisplayTeamName(row?.team || ""),
          sampleMarkup: formatDoneTotalSampleMarkup(shippedCount, cycleSample),
          width: cycleWidth,
          fillStyle: `background:${escapeHtml(teamColor)};`,
          valueMarkup: formatStackedCycleMonthsValueMarkup(row?.cycle),
          valueFrameClassName: cycleAlertLevel ? `pr-cycle-stage-row__value-frame--${cycleAlertLevel}` : ""
        });
      })
      .join("");

    renderProductCycleCard(containerId, {
      className: "product-cycle-compare-card",
      headerMarkup: `
        <div class="pr-cycle-stage-card__team">All teams</div>
        <div class="pr-cycle-stage-card__submeta">${
          scopeLabel ? `${escapeHtml(scopeLabel)} • ` : ""
        }${isCompactViewport() ? "Target: 1 mo" : "Target: 1 month"}</div>
      `,
      rowsMarkup
    });
  }

  function summarizeContributorRows(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.reduce(
      (summary, row) => ({
        totalIssues: summary.totalIssues + toNumber(row?.totalIssues),
        doneIssues: summary.doneIssues + toNumber(row?.doneIssues),
        activeIssues: summary.activeIssues + toNumber(row?.activeIssues),
        totalContributors: summary.totalContributors + 1
      }),
      { totalIssues: 0, doneIssues: 0, activeIssues: 0, totalContributors: 0 }
    );
  }

  function renderTopContributorsCard(containerId, rows, summary) {
    if (!Array.isArray(rows)) return;
    const compactViewport = isCompactViewport();
    const safeRows = Array.isArray(rows) ? rows : [];
    const maxTotal = Math.max(1, ...safeRows.map((row) => toNumber(row?.totalIssues)));
    const totalIssues = toNumber(summary?.totalIssues);
    const totalContributors = Math.max(toNumber(summary?.totalContributors), safeRows.length);

    const rowsMarkup = safeRows
      .map((row) => {
        const contributor = String(row?.contributor || "").trim();
        const total = toNumber(row?.totalIssues);
        const done = toNumber(row?.doneIssues);
        const active = toNumber(row?.activeIssues);
        const totalWidth = total > 0 ? Math.max(10, Math.round((total / maxTotal) * 100)) : 0;
        return buildRowMarkup({
          rowClassName: "contributors-card__row",
          trackClassName: "contributors-card__track",
          fillClassName: "contributors-card__fill",
          label: contributor,
          sampleMarkup: `done ${done}${active > 0 ? ` • active ${active}` : ""}`,
          width: totalWidth,
          valueMarkup: String(total)
        });
      })
      .join("");

    renderProductCycleCard(containerId, {
      className: "contributors-card",
      headerMarkup: `
        <div class="pr-cycle-stage-card__team">Community contributors</div>
        <div class="pr-cycle-stage-card__total">${totalIssues}</div>
      `,
      rowsMarkup,
      footerMarkup: `
        <div class="pr-cycle-stage-card__footer">
          <span><strong>${totalContributors} contributors ranked</strong>${
            compactViewport ? ` • ${totalIssues} issues` : ` • ${totalIssues} included issues`
          }</span>
        </div>
      `
    });
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderBugBacklogTrendByTeamChart,
    renderBugCompositionByPriorityChart,
    renderDevelopmentVsUatByFacilityChart,
    renderLifecycleTimeSpentPerStageChart,
    renderProductCycleSingleTeamCard,
    renderProductCycleComparisonCard,
    renderTopContributorsCard,
    summarizeContributorRows
  });
})();
