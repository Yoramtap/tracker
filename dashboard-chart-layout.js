"use strict";

(function initDashboardChartLayout() {
  const dashboardUiUtils = window.DashboardViewUtils;
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }

  const { toNumber, getModeFromUrl } = dashboardUiUtils;

  const BAR_LAYOUT = { categoryGap: "14%", groupGap: 2, denseMax: 14, normalMax: 20 };
  const CHART_HEIGHTS = { standard: 280, dense: 320 };
  const HORIZONTAL_CATEGORY_AXIS_WIDTH = 190;
  const BAR_CURSOR_FILL = "rgba(31,51,71,0.04)";

  function toWhole(value) {
    return Math.round(toNumber(value));
  }

  function toWeeks(valueInDays) {
    return toNumber(valueInDays) / 7;
  }

  function toWholeWeeksForChart(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return 0;
    if (days < 7) return 1;
    return Math.max(1, Math.round(toWeeks(days)));
  }

  function formatWeeksFromDays(valueInDays) {
    const days = toNumber(valueInDays);
    if (days <= 0) return "0 weeks";
    if (days < 7) return "<1 week";
    const weeks = Math.max(1, Math.round(toWeeks(days)));
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }

  function buildWeekAxis(maxValueWeeks, options = {}) {
    const majorStep = Math.max(1, toWhole(options?.majorStep || 0));
    const fixedStep = Number.isFinite(majorStep) && majorStep > 0 ? majorStep : null;
    const maxWeeks = Math.max(1, Math.ceil(toNumber(maxValueWeeks)));
    if (fixedStep) {
      const axisWeeks = Math.max(fixedStep, Math.ceil(maxWeeks / fixedStep) * fixedStep);
      const ticks = [0];
      for (let week = fixedStep; week <= axisWeeks; week += fixedStep) ticks.push(week);
      return { upper: axisWeeks, ticks };
    }

    const targetSteps = 6;
    const roughStep = maxWeeks / targetSteps;
    let step = 1;
    if (roughStep > 1 && roughStep <= 2) step = 2;
    else if (roughStep > 2 && roughStep <= 5) step = 5;
    else if (roughStep > 5) step = 10;

    const upper = Math.max(step, Math.ceil(maxWeeks / step) * step);
    const ticks = [];
    for (let week = 0; week <= upper; week += step) ticks.push(week);
    return { upper, ticks };
  }

  function trendTickInterval(pointsCount) {
    const count = Math.max(0, toWhole(pointsCount));
    if (count <= 8) return 0;
    if (count <= 16) return 1;
    return 2;
  }

  function viewportWidthPx() {
    if (typeof window === "undefined") return 1280;
    const direct = Number(window.innerWidth);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fallback = Number(document?.documentElement?.clientWidth);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 1280;
  }

  function viewportHeightPx() {
    if (typeof window === "undefined") return 900;
    const direct = Number(window.innerHeight);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fallback = Number(document?.documentElement?.clientHeight);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 900;
  }

  function singleChartHeightForMode(modeKey, baseHeight) {
    if (getModeFromUrl() !== modeKey) return baseHeight;
    const width = viewportWidthPx();
    const viewportHeight = viewportHeightPx();
    const smallMin = Math.max(300, Math.round(baseHeight * 1.05));
    const mediumMin = Math.max(340, Math.round(baseHeight * 1.1));
    const largeMin = Math.max(360, Math.round(baseHeight * 1.15));

    if (width <= 680) {
      return Math.max(smallMin, Math.min(680, Math.round(viewportHeight * 0.5)));
    }
    if (width <= 1024) {
      return Math.max(mediumMin, Math.min(760, Math.round(viewportHeight * 0.56)));
    }
    return Math.max(largeMin, Math.min(920, Math.round(viewportHeight * 0.62)));
  }

  function isCompactViewport() {
    return viewportWidthPx() <= 680;
  }

  function tickIntervalForMobileLabels(pointsCount) {
    const count = Math.max(0, toWhole(pointsCount));
    if (count <= 8) return 0;
    if (count <= 12) return 1;
    if (count <= 18) return 2;
    return 3;
  }

  function trendLayoutForViewport(pointsCount) {
    const width = viewportWidthPx();
    if (width <= 680) {
      return {
        chartHeight: singleChartHeightForMode("trend", 224),
        margin: { top: 10, right: 8, bottom: 24, left: 8 },
        xTickFontSize: 10,
        yTickFontSize: 10,
        xTickMargin: 4,
        minTickGap: 8,
        legendCompact: true,
        xAxisInterval: trendTickInterval(pointsCount)
      };
    }
    if (width <= 1024) {
      return {
        chartHeight: singleChartHeightForMode("trend", 252),
        margin: { top: 12, right: 10, bottom: 28, left: 10 },
        xTickFontSize: 11,
        yTickFontSize: 11,
        xTickMargin: 5,
        minTickGap: 6,
        legendCompact: false,
        xAxisInterval: pointsCount > 14 ? 1 : 0
      };
    }
    return {
      chartHeight: singleChartHeightForMode("trend", CHART_HEIGHTS.standard),
      margin: { top: 12, right: 12, bottom: 32, left: 12 },
      xTickFontSize: 11,
      yTickFontSize: 11,
      xTickMargin: 6,
      minTickGap: 4,
      legendCompact: false,
      xAxisInterval: 0
    };
  }

  function computeYUpper(values, { min = 1, pad = 1.12 } = {}) {
    const finiteValues = (Array.isArray(values) ? values : []).filter(Number.isFinite);
    if (finiteValues.length === 0) return min;
    return Math.max(min, Math.ceil(Math.max(...finiteValues) * pad));
  }

  function buildNiceNumberAxis(maxValue) {
    const max = Math.max(0, toNumber(maxValue));
    if (max <= 1) return { upper: 1, ticks: [0, 1] };
    const targetSteps = 6;
    const roughStep = max / targetSteps;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / magnitude;
    const niceBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const step = niceBase * magnitude;
    const upper = Math.max(step, Math.ceil(max / step) * step);
    const ticks = [];
    for (let value = 0; value <= upper; value += step) ticks.push(value);
    return { upper, ticks };
  }

  function groupedBarGeometry(rowsCount, seriesCount = 2) {
    const safeSeriesCount = Math.max(1, Math.floor(toNumber(seriesCount) || 1));
    let categoryGap = BAR_LAYOUT.categoryGap;
    let targetGroupWidth = 68;
    if (rowsCount <= 8) {
      categoryGap = "30%";
      targetGroupWidth = 88;
    } else if (rowsCount <= 14) {
      categoryGap = "14%";
      targetGroupWidth = 102;
    }
    const rawBarSize = (targetGroupWidth - BAR_LAYOUT.groupGap * (safeSeriesCount - 1)) / safeSeriesCount;
    const barSize = Math.max(12, Math.round(rawBarSize));
    return {
      categoryGap,
      barSize,
      maxBarSize: Math.max(barSize, Math.round(barSize * 1.25))
    };
  }

  window.DashboardChartLayout = {
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
  };
})();
