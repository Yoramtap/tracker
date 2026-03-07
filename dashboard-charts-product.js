"use strict";

(function initDashboardProductCharts() {
  const core = window.DashboardChartCore;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }

  const { renderMultiSeriesBars } = core;

  function renderLeadAndCycleTimeByTeamChart({ seriesDefs, ...rest }) {
    return renderMultiSeriesBars({
      modeKey: "product-cycle",
      defs: seriesDefs,
      valueUnit: "months",
      ...rest
    });
  }

  function renderLifecycleTimeSpentPerStageChart({ seriesDefs, ...rest }) {
    return renderMultiSeriesBars({
      modeKey: "lifecycle-days",
      defs: seriesDefs,
      valueUnit: "months",
      ...rest
    });
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderLeadAndCycleTimeByTeamChart,
    renderLifecycleTimeSpentPerStageChart
  });
})();
