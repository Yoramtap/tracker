"use strict";

(function initDashboardProductCharts() {
  const React = window.React;
  const core = window.DashboardChartCore;
  const svgCore = window.DashboardSvgCore;
  if (!React || !core) {
    throw new Error("Dashboard chart core not loaded.");
  }
  if (!svgCore) {
    throw new Error("Dashboard SVG core not loaded.");
  }

  const { h, isCompactViewport, toNumber, toWhole } = core;
  const {
    SvgChartShell,
    createBandLayout,
    formatTooltipDuration,
    linearScale,
    renderSvgChart,
    teamColorForLabel,
    withAlpha
  } = svgCore;

  function monthValueFromDays(value) {
    return toNumber(value) / 30.4375;
  }

  function axisLabel(text, x, y, options = {}) {
    return h(
      "text",
      {
        x,
        y,
        fill: options.fill || "rgba(31, 51, 71, 0.92)",
        fontSize: options.fontSize || 11,
        fontWeight: options.fontWeight || 700,
        textAnchor: options.textAnchor || "middle",
        transform: options.transform
      },
      text
    );
  }

  function buildLifecycleTicks(upper) {
    const safeUpper = Math.max(1, Math.ceil(toNumber(upper)));
    if (safeUpper <= 6) return Array.from({ length: safeUpper + 1 }, (_, index) => index);
    const step = safeUpper <= 12 ? 2 : 3;
    const ticks = [];
    for (let tick = 0; tick <= safeUpper; tick += step) ticks.push(tick);
    if (ticks[ticks.length - 1] !== safeUpper) ticks.push(safeUpper);
    return ticks;
  }

  function formatLifecycleTick(value) {
    const months = toWhole(value);
    if (months <= 0) return "0";
    if (months === 12) return "1 year";
    if (months > 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (remainingMonths === 0) return years === 1 ? "1 year" : `${years} years`;
      return `${years}y ${remainingMonths}m`;
    }
    return `${months}m`;
  }

  function LifecycleSvgChart({ rows, seriesDefs, colors, categorySecondaryLabels, yUpperOverride }) {
    const compactViewport = isCompactViewport();
    const [tooltipContent, setTooltipContent] = React.useState(null);
    const width = 960;
    const height = compactViewport ? 440 : 490;
    const margin = compactViewport
      ? { top: 26, right: 18, bottom: 72, left: 58 }
      : { top: 28, right: 18, bottom: 78, left: 64 };
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const filteredSeries = (Array.isArray(seriesDefs) ? seriesDefs : []).filter(Boolean);
    const yUpperMonths = Math.max(1, Math.ceil(monthValueFromDays(yUpperOverride)));
    const yTicks = buildLifecycleTicks(yUpperMonths);
    const groupLayout = createBandLayout(
      rows.map((row) => String(row?.phaseLabel || "")),
      { start: plotLeft, end: plotRight, gap: compactViewport ? 0.32 : 0.24, paddingOuter: 0.05 }
    );
    const innerGap = compactViewport ? 2 : 3;
    const barWidth = Math.max(
      6,
      (groupLayout.bandwidth - innerGap * Math.max(0, filteredSeries.length - 1)) /
        Math.max(1, filteredSeries.length)
    );

    const showTooltip = (row, seriesDef) => {
      const meta = row?.[`meta_${seriesDef.key}`] || {};
      setTooltipContent(
        h(
          "div",
          null,
          h("p", null, h("strong", null, `${row?.phaseLabel || ""} • ${seriesDef.name || ""}`)),
          h(
            "p",
            null,
            `Average time: ${formatTooltipDuration(toNumber(meta?.average), "months")}`
          ),
          h("p", null, `n=${toWhole(meta?.n)}`)
        )
      );
    };

    return h(
      SvgChartShell,
      { width, height, colors, tooltipContent },
      h(
        "g",
        null,
        ...yTicks.map((tick) => {
          const y = linearScale(tick, 0, yUpperMonths, plotBottom, plotTop);
          return h(
            "g",
            { key: `tick-${tick}` },
            h("line", {
              x1: plotLeft,
              x2: plotRight,
              y1: y,
              y2: y,
              stroke: colors.grid,
              strokeWidth: tick === 0 ? 1.25 : 1
            }),
            axisLabel(formatLifecycleTick(tick), plotLeft - 8, y + 4, {
              textAnchor: "end",
              fontSize: compactViewport ? 10 : 11,
              fontWeight: 600
            })
          );
        }),
        ...groupLayout.positions.flatMap((position, rowIndex) => {
          const row = rows[rowIndex];
          const secondaryLabel = categorySecondaryLabels?.[row?.phaseLabel] || "";
          const bars = filteredSeries.map((seriesDef, seriesIndex) => {
            const valueMonths = monthValueFromDays(row?.[seriesDef.key]);
            const barHeight = Math.max(
              0,
              plotBottom - linearScale(valueMonths, 0, yUpperMonths, plotBottom, plotTop)
            );
            const x = position.x + seriesIndex * (barWidth + innerGap);
            const y = plotBottom - barHeight;
            const color = teamColorForLabel(colors, seriesDef?.name || seriesDef?.team);
            return h("rect", {
              key: `bar-${position.label}-${seriesDef.key}`,
              x,
              y,
              width: barWidth,
              height: barHeight,
              rx: 5,
              fill: color,
              stroke: withAlpha(color, 0.5),
              strokeWidth: 1,
              opacity: valueMonths > 0 ? 0.96 : 0.12,
              onMouseEnter: () => showTooltip(row, seriesDef),
              onMouseLeave: () => setTooltipContent(null)
            });
          });
          return [
            ...bars,
            axisLabel(String(row?.phaseLabel || ""), position.center, plotBottom + 18, {
              fontSize: compactViewport ? 10 : 11,
              fontWeight: 600
            }),
            axisLabel(String(secondaryLabel), position.center, plotBottom + 33, {
              fontSize: compactViewport ? 9 : 10,
              fontWeight: 600,
              fill: "rgba(31, 51, 71, 0.58)"
            })
          ];
        }),
        axisLabel("Average time (months)", plotLeft - 48, plotTop + (plotBottom - plotTop) / 2, {
          fontSize: compactViewport ? 10 : 11,
          transform: `rotate(-90 ${plotLeft - 48} ${plotTop + (plotBottom - plotTop) / 2})`
        })
      )
    );
  }

  function renderLifecycleTimeSpentPerStageChart({
    containerId,
    rows,
    seriesDefs,
    colors,
    categorySecondaryLabels,
    yUpperOverride
  }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    return renderSvgChart(containerId, chartRows.length > 0, () =>
      h(LifecycleSvgChart, {
        rows: chartRows,
        seriesDefs,
        colors,
        categorySecondaryLabels,
        yUpperOverride
      })
    );
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderLifecycleTimeSpentPerStageChart
  });
})();
