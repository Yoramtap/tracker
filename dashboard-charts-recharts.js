"use strict";

(function initDashboardCharts() {
  const chartCore = window.DashboardChartCore;
  const backlogCharts = window.DashboardBacklogCharts;
  const deliveryCharts = window.DashboardDeliveryCharts;
  if (!chartCore || !backlogCharts || !deliveryCharts) {
    window.DashboardCharts = null;
    return;
  }

  const { clearChart, renderMultiSeriesBars } = chartCore;

  window.DashboardCharts = {
    ...backlogCharts,
    ...deliveryCharts,
    renderLeadAndCycleTimeByTeamChart: ({ seriesDefs, ...rest }) =>
      renderMultiSeriesBars({
        kind: "productCycle",
        modeKey: "product-cycle",
        defs: seriesDefs,
        valueUnit: "weeks",
        ...rest
      }),
    renderLifecycleTimeSpentPerStageChart: ({ seriesDefs, ...rest }) =>
      renderMultiSeriesBars({
        kind: "lifecycleDays",
        modeKey: "lifecycle-days",
        defs: seriesDefs,
        valueUnit: "weeks",
        ...rest
      }),
    clearChart
  };
})();
