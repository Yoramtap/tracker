"use strict";

(function initDashboardDeliveryCharts() {
  const core = window.DashboardChartCore;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }

  const {
    BAR_CURSOR_FILL,
    CHART_HEIGHTS,
    PRIORITY_CONFIG,
    axisTick,
    buildAxisLabel,
    buildWeekAxis,
    computeYUpper,
    createTooltipContent,
    formatAverageLabel,
    h,
    isCompactViewport,
    makeTooltipLine,
    renderGroupedBars,
    renderMultiSeriesBars,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    toWhole,
    toWholeWeeksForChart,
    tooltipTitleLine,
    twoLineCategoryTickFactory
  } = core;

  function toChartRows(rows) {
    return Array.isArray(rows) ? rows : [];
  }

  function buildManagementRows(rows) {
    return toChartRows(rows).map((row) => ({
      ...row,
      dev: toNumber(row?.devMedian),
      uat: toNumber(row?.uatMedian),
      meta_dev: {
        n: toNumber(row?.devCount),
        average: toNumber(row?.devAvg),
        team: "Days in Development",
        subItems: [
          `median = ${toWhole(row?.devMedian)} days`,
          `${formatAverageLabel(row?.devAvg, "days")} • n=${toWhole(row?.devCount)}`
        ]
      },
      meta_uat: {
        n: toNumber(row?.uatCount),
        average: toNumber(row?.uatAvg),
        team: "Days in UAT",
        subItems: [
          `median = ${toWhole(row?.uatMedian)} days`,
          `${formatAverageLabel(row?.uatAvg, "days")} • n=${toWhole(row?.uatCount)}`
        ]
      }
    }));
  }

  function buildPriorityFacilityEntries(groups) {
    const safeGroups = groups && typeof groups === "object" ? groups : {};
    const priorityOrder = ["Highest", "High", "Medium", "Low", "Lowest"];
    return Object.entries(safeGroups)
      .map(([facility, byPriority]) => {
        const map = byPriority && typeof byPriority === "object" ? byPriority : {};
        const priorityCounts = priorityOrder
          .map((priority) => [priority, toWhole(map[priority])])
          .filter(([, count]) => count > 0);
        return [
          String(facility || "").trim(),
          priorityCounts.reduce((sum, [, count]) => sum + count, 0),
          priorityCounts.map(([priority, count]) => `${priority}: ${count}`)
        ];
      })
      .filter(([facility, total]) => facility && total > 0)
      .sort((left, right) => {
        const leftIsUnspecified = left[0] === "Unspecified";
        const rightIsUnspecified = right[0] === "Unspecified";
        if (leftIsUnspecified && !rightIsUnspecified) return 1;
        if (!leftIsUnspecified && rightIsUnspecified) return -1;
        if (right[1] !== left[1]) return right[1] - left[1];
        return left[0].localeCompare(right[0]);
      });
  }

  function buildIssueSubItems(issueIds, jiraBrowseBase, colors) {
    const safeIssueIds = Array.isArray(issueIds) ? issueIds : [];
    const issueDisplayLimit = 8;
    const browseBase = String(jiraBrowseBase || "").replace(/\/$/, "");
    const items = safeIssueIds
      .slice(0, issueDisplayLimit)
      .map((issueId, index) => {
        const key = String(issueId || "").trim();
        if (!key) return null;
        return h(
          "a",
          {
            key: `issue-link-${key}-${index}`,
            href: `${browseBase}/${encodeURIComponent(key)}`,
            target: "_blank",
            rel: "noopener noreferrer",
            style: {
              color: colors.text,
              textDecoration: "underline"
            }
          },
          key
        );
      })
      .filter(Boolean);
    if (safeIssueIds.length > issueDisplayLimit) {
      items.push(`+${safeIssueIds.length - issueDisplayLimit} more`);
    }
    return items.length > 0 ? items : ["-"];
  }

  function renderUatPriorityAgingChart({ containerId, rows, buckets: _buckets, colors }) {
    const chartRows = toChartRows(rows);
    const compactViewport = isCompactViewport();
    const bucketShortLabels = {
      "1-2 weeks": "1-2w",
      "1 month": "1m",
      "2 months": "2m",
      "More than 2 months": "2m+"
    };
    const prioritySeries = PRIORITY_CONFIG.map((priority) => ({
      dataKey: priority.key,
      name: priority.label,
      fill: colors.priorities?.[priority.key] || colors.teams.bc,
      stackId: "uat-priority"
    }));
    const yUpper = computeYUpper(chartRows.map((row) => toNumber(row?.total)), { min: 1, pad: 1.12 });
    renderGroupedBars(containerId, chartRows.length > 0 && prioritySeries.length > 0, {
      rows: chartRows,
      defs: prioritySeries,
      colors,
      yUpper,
      height: singleChartHeightForMode("uat", CHART_HEIGHTS.standard),
      showLegend: true,
      colorByCategoryKey: "bucketLabel",
      xAxisProps: {
        dataKey: "bucketLabel",
        interval: 0,
        height: compactViewport ? 42 : 52,
        label: buildAxisLabel("Time open in UAT"),
        tick: { ...axisTick(colors), fontSize: compactViewport ? 11 : 12 },
        tickFormatter: (value) => {
          const key = String(value || "");
          if (!compactViewport) return key;
          return bucketShortLabels[key] || key;
        }
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => {
          const facilityEntries = buildPriorityFacilityEntries(row?.facilityPriorityGroups);

          return [
            tooltipTitleLine("title", row.bucketLabel || "", colors),
            tooltipTitleLine("total", `Total: ${toWhole(row.total)}`, colors),
            ...facilityEntries.map(([facility, _total, items], index) =>
              makeTooltipLine(`facility-${index}`, facility, colors, {
                margin: "0 0 4px",
                subItems: items
              })
            ),
            ...(facilityEntries.length === 0
              ? payload
                  .filter((item) => toWhole(item?.value) > 0)
                  .map((item) =>
                    makeTooltipLine(item.dataKey, `${item.name}: ${toWhole(item.value)}`, colors)
                  )
              : [])
          ];
        }),
        cursor: { fill: "rgba(31,51,71,0.05)" }
      }
    });
  }

  function renderDevelopmentTimeVsUatTimeChart({
    containerId,
    rows,
    colors,
    devColor,
    uatColor,
    yTicks
  }) {
    const chartRows = buildManagementRows(rows);
    renderMultiSeriesBars({
      modeKey: "management",
      containerId,
      rows: chartRows,
      defs: [
        { key: "dev", name: "Days in Development", color: devColor },
        { key: "uat", name: "Days in UAT", color: uatColor }
      ],
      colors,
      categoryKey: "label",
      categoryAxisHeight: 36,
      xAxisProps: {
        label: buildAxisLabel("Facility")
      },
      valueTicks: Array.isArray(yTicks) && yTicks.length > 1 ? yTicks : null,
      tooltipCursor: { fill: BAR_CURSOR_FILL }
    });
  }

  function renderDevelopmentVsUatByFacilityChart({
    containerId,
    rows,
    colors,
    devColor,
    uatColor,
    jiraBrowseBase = "https://nepgroup.atlassian.net/browse/"
  }) {
    const chartRows = toChartRows(rows);
    const compactViewport = isCompactViewport();
    const weekRows = chartRows.map((row) => ({
      ...row,
      devWeeks: toWholeWeeksForChart(row?.devAvg),
      uatWeeks: toWholeWeeksForChart(row?.uatAvg)
    }));
    const categorySecondaryLabels = Object.fromEntries(
      chartRows.map((row) => [String(row?.label || ""), `n=${toWhole(row?.sampleCount)}`])
    );
    const yUpper = computeYUpper(
      [...weekRows.map((row) => toNumber(row?.devWeeks)), ...weekRows.map((row) => toNumber(row?.uatWeeks))],
      { min: 1, pad: 1.15 }
    );
    const weekAxis = buildWeekAxis(yUpper, { majorStep: yUpper <= 12 ? 2 : 4 });
    const xInterval = compactViewport ? tickIntervalForMobileLabels(chartRows.length) : 0;
    renderGroupedBars(containerId, chartRows.length > 0, {
      rows: weekRows,
      defs: [
        {
          dataKey: "devWeeks",
          name: "Weeks in Development",
          fill: devColor
        },
        {
          dataKey: "uatWeeks",
          name: "Weeks in UAT",
          fill: uatColor
        }
      ],
      colors,
      yUpper: weekAxis.upper,
      height: singleChartHeightForMode("management-facility", CHART_HEIGHTS.standard),
      yAxisProps: {
        domain: [0, weekAxis.upper],
        ticks: weekAxis.ticks,
        allowDecimals: false,
        tickFormatter: (value) => String(toWhole(value))
      },
      xAxisProps: {
        dataKey: "label",
        interval: xInterval,
        minTickGap: compactViewport ? 14 : 6,
        height: compactViewport ? 44 : 56,
        angle: compactViewport ? -28 : 0,
        textAnchor: compactViewport ? "end" : "middle",
        label: buildAxisLabel("Facility"),
        tick: compactViewport
          ? { ...axisTick(colors), fontSize: 11 }
          : twoLineCategoryTickFactory(colors, {
              textAnchor: "middle",
              secondaryLabels: categorySecondaryLabels
            })
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row) => {
          const devAvg = toNumber(row?.devAvg);
          const uatAvg = toNumber(row?.uatAvg);
          return [
            tooltipTitleLine("label", row?.label || "", colors),
            makeTooltipLine("sample", `Sample n=${toWhole(row?.sampleCount)}`, colors),
            makeTooltipLine("dev", `Weeks in Development n=${toWhole(row?.devCount)}`, colors, {
              subItems: [formatAverageLabel(devAvg, "weeks")]
            }),
            makeTooltipLine("uat", `Weeks in UAT n=${toWhole(row?.uatCount)}`, colors, {
              subItems: [formatAverageLabel(uatAvg, "weeks")]
            }),
            makeTooltipLine("issues", "Issues", colors, {
              margin: "6px 0 0",
              subItems: buildIssueSubItems(row?.issueIds, jiraBrowseBase, colors)
            })
          ];
        }),
        wrapperStyle: { pointerEvents: "auto" },
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderTopContributorsChart({ containerId, rows, colors, barColor }) {
    const chartRows = toChartRows(rows);
    const fillColor = String(barColor || "").trim() || colors.teams.react;
    const overlayDots = chartRows
      .map((row) => {
        const totalContributions = toNumber(row?.totalIssues);
        const doneContributions = toWhole(row?.doneIssues);
        if (totalContributions <= 0 && doneContributions <= 0) return null;
        return {
          x: totalContributions,
          y: String(row?.contributor || ""),
          labelPrefix: doneContributions > 0 ? "✓" : "",
          accentColor: "rgba(56,161,105,0.95)",
          labelText: `${doneContributions} ${doneContributions === 1 ? "contribution" : "contributions"} done`
        };
      })
      .filter(Boolean);
    renderMultiSeriesBars({
      modeKey: "contributors",
      containerId,
      rows: chartRows.map((row) => ({
        ...row,
        total: toNumber(row?.totalIssues),
        meta_total: {
          n: toNumber(row?.totalIssues),
          average: toNumber(row?.totalIssues),
          team: "Contribution totals",
          subItems:
            Array.isArray(row?.ticketStateItems) && row.ticketStateItems.length > 0
              ? row.ticketStateItems
              : [`Done = ${toWhole(row?.doneIssues)}`, `Not done = ${toWhole(row?.notDoneIssues ?? row?.activeIssues)}`]
        }
      })),
      defs: [{ key: "total", name: "Contribution totals", color: fillColor }],
      colors,
      showLegend: false,
      orientation: "horizontal",
      categoryKey: "contributor",
      chartMargin: { top: 14, right: 180, bottom: 72, left: 12 },
      xAxisProps: {
        label: buildAxisLabel("Total contributions")
      },
      overlayDots,
      gridVertical: false,
      gridHorizontal: false,
      tooltipCursor: { fill: BAR_CURSOR_FILL }
    });
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderUatPriorityAgingChart,
    renderDevelopmentTimeVsUatTimeChart,
    renderDevelopmentVsUatByFacilityChart,
    renderTopContributorsChart
  });
})();
