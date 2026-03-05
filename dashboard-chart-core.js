/* global React, ReactDOM, Recharts */
"use strict";

(function initDashboardChartCore() {
  if (!window.React || !window.ReactDOM || !window.Recharts) {
    window.DashboardChartCore = null;
    return;
  }

  const dashboardUiUtils = window.DashboardViewUtils;
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }
  const dashboardChartPrimitives = window.DashboardChartPrimitives;
  if (!dashboardChartPrimitives) {
    throw new Error("Dashboard chart primitives not loaded.");
  }
  const dashboardChartLayout = window.DashboardChartLayout;
  if (!dashboardChartLayout) {
    throw new Error("Dashboard chart layout helpers not loaded.");
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
  const { toNumber, formatDateShort } = dashboardUiUtils;
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
  const {
    axisTick,
    baseYAxisProps,
    buildCategoryColorsFromRows,
    createTooltipContent,
    makeTooltipLine,
    renderLegendNode,
    twoLineCategoryTickFactory,
    tooltipTitleLine
  } = dashboardChartPrimitives;
  const {
    BAR_CURSOR_FILL,
    BAR_LAYOUT,
    CHART_HEIGHTS,
    HORIZONTAL_CATEGORY_AXIS_WIDTH,
    buildNiceNumberAxis,
    buildWeekAxis,
    computeYUpper,
    formatWeeksFromDays,
    groupedBarGeometry,
    isCompactViewport,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toWhole,
    toWholeWeeksForChart,
    trendLayoutForViewport
  } = dashboardChartLayout;

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
    const stackIds = defs.map((def) => String(def?.stackId || "").trim()).filter(Boolean);
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
              const roundedValue = Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
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
          barChildren.push(h(Cell, { key: `cell-${def.dataKey}-${index}`, fill }));
        });
      } else if (def?.metaTeamColorMap && typeof def.metaTeamColorMap === "object") {
        rows.forEach((row, index) => {
          const metaTeam = String(row?.[`meta_${def.dataKey}`]?.team || "");
          const fill = def.metaTeamColorMap?.[metaTeam] || def.fill;
          barChildren.push(h(Cell, { key: `cell-meta-team-${def.dataKey}-${index}`, fill }));
        });
      }
      return h(
        Bar,
        {
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
        },
        ...barChildren
      );
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
    categoryAxisHeight = null,
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
              height:
                Number.isFinite(categoryAxisHeight) && categoryAxisHeight > 0
                  ? categoryAxisHeight
                  : effectiveCategoryTickTwoLine
                    ? 72
                    : compactViewport
                      ? 52
                      : 34,
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
              hasDone ? teamLabel : timeWindowLabel ? `${categoryLabel} • ${timeWindowLabel}` : `${categoryLabel}`,
              colors
            )
          ];
          if (hasDone) {
            const teamSampleText = Number.isFinite(teamSample) ? String(toWhole(teamSample)) : "-";
            lines.push(
              makeTooltipLine("sample", "Sample", colors, {
                margin: "2px 0 6px",
                fontSize: "12px",
                lineHeight: "1.45",
                subItems: [`n = ${teamSampleText}`, `done = ${toWhole(row.doneCount)}`]
              })
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
              makeTooltipLine(key, String(seriesName), colors, {
                margin: "2px 0",
                fontSize: "12px",
                lineHeight: "1.45",
                subItems: [
                  displayInWeeks ? `average = ${formatWeeksFromDays(meta.average)}` : `average = ${avgDays} days`,
                  `n = ${sampleText}`
                ]
              })
            );
          });
          return lines;
        }),
        cursor: tooltipCursor
      }
    });
  }

  window.DashboardChartCore = {
    ACTIVE_BAR_STYLE,
    BAR_CURSOR_FILL,
    BAR_LAYOUT,
    CHART_HEIGHTS,
    HORIZONTAL_CATEGORY_AXIS_WIDTH,
    ResponsiveContainer,
    LineChart,
    Line,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    h,
    activeLineDot,
    axisTick,
    barBaseStyle,
    baseYAxisProps,
    buildNiceNumberAxis,
    buildWeekAxis,
    clearChart,
    computeYUpper,
    createTooltipContent,
    formatDateShort,
    formatWeeksFromDays,
    isCompactViewport,
    makeTooltipLine,
    renderBarChartShell,
    renderGroupedBars,
    renderLegendNode,
    renderMultiSeriesBars,
    renderWithRoot,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    toWhole,
    toWholeWeeksForChart,
    tooltipTitleLine,
    trendLayoutForViewport,
    twoLineCategoryTickFactory
  };
})();
