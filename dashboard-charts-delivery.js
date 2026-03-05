"use strict";

(function initDashboardDeliveryCharts() {
  const chartCore = window.DashboardChartCore;
  if (!window.React || !chartCore) {
    window.DashboardDeliveryCharts = null;
    return;
  }

  const {
    BAR_CURSOR_FILL,
    CHART_HEIGHTS,
    HORIZONTAL_CATEGORY_AXIS_WIDTH,
    axisTick,
    buildNiceNumberAxis,
    buildWeekAxis,
    computeYUpper,
    createTooltipContent,
    formatWeeksFromDays,
    h,
    isCompactViewport,
    makeTooltipLine,
    renderGroupedBars,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toNumber,
    toWhole,
    toWholeWeeksForChart,
    tooltipTitleLine,
    twoLineCategoryTickFactory
  } = chartCore;

  function renderDevelopmentTimeVsUatTimeChart({
    containerId,
    rows,
    colors,
    devColor,
    uatColor,
    yTicks
  }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const yUpper = computeYUpper(
      [
        ...chartRows.map((row) => toNumber(row.devMedian)),
        ...chartRows.map((row) => toNumber(row.uatMedian))
      ],
      { min: 1, pad: 1.12 }
    );
    renderGroupedBars("management", containerId, chartRows.length > 0, {
      rows: chartRows,
      defs: [
        { dataKey: "devMedian", name: "Days in Development", fill: devColor },
        { dataKey: "uatMedian", name: "Days in UAT", fill: uatColor }
      ],
      colors,
      yUpper,
      height: singleChartHeightForMode("management", CHART_HEIGHTS.standard),
      yAxisProps:
        Array.isArray(yTicks) && yTicks.length > 1
          ? { domain: [0, yTicks[yTicks.length - 1]], ticks: yTicks, allowDecimals: false }
          : undefined,
      xAxisProps: {
        dataKey: "label",
        interval: 0,
        height: 36
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row, payload) => [
          tooltipTitleLine("label", row.label || "", colors),
          ...payload
            .map((item) => {
              const isDev = item?.dataKey === "devMedian";
              const countRaw = Number(isDev ? row.devCount : row.uatCount);
              const avg = isDev ? toNumber(row.devAvg) : toNumber(row.uatAvg);
              return makeTooltipLine(item.dataKey, String(item.name || ""), colors, {
                subItems: [
                  `median = ${toWhole(item.value)} days`,
                  `average = ${toWhole(avg)} days`,
                  `n = ${Number.isFinite(countRaw) && countRaw >= 0 ? toWhole(countRaw) : "-"}`
                ]
              });
            })
            .filter(Boolean)
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      }
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
    const chartRows = Array.isArray(rows) ? rows : [];
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
    renderGroupedBars("managementFacility", containerId, chartRows.length > 0, {
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
          const issueIds = Array.isArray(row?.issueIds) ? row.issueIds : [];
          const issueDisplayLimit = 8;
          const issueSubItems = issueIds
            .slice(0, issueDisplayLimit)
            .map((issueId, index) => {
              const key = String(issueId || "").trim();
              if (!key) return null;
              const url = `${String(jiraBrowseBase || "").replace(/\/$/, "")}/${encodeURIComponent(key)}`;
              return h(
                "a",
                {
                  key: `issue-link-${key}-${index}`,
                  href: url,
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
          if (issueIds.length > issueDisplayLimit) {
            issueSubItems.push(`+${issueIds.length - issueDisplayLimit} more`);
          }
          return [
            tooltipTitleLine("label", row?.label || "", colors),
            makeTooltipLine("sample", `n = ${toWhole(row?.sampleCount)}`, colors),
            makeTooltipLine("dev", `Weeks in Development: ${formatWeeksFromDays(devAvg)} (avg)`, colors),
            makeTooltipLine("uat", `Weeks in UAT: ${formatWeeksFromDays(uatAvg)} (avg)`, colors),
            makeTooltipLine("issues", "Issues", colors, {
              margin: "6px 0 0",
              subItems: issueSubItems.length > 0 ? issueSubItems : ["-"]
            })
          ];
        }),
        wrapperStyle: { pointerEvents: "auto" },
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderTopContributorsChart({ containerId, rows, colors, barColor }) {
    const chartRows = Array.isArray(rows) ? rows : [];
    const compactViewport = isCompactViewport();
    const fillColor = String(barColor || "").trim() || colors.teams.react;
    const contributorAxisWidth = compactViewport ? 132 : HORIZONTAL_CATEGORY_AXIS_WIDTH;
    const contributorMetaLabels = Object.fromEntries(
      chartRows.map((row) => [
        String(row?.contributor || ""),
        `n=${toWhole(row?.totalIssues)}, done=${toWhole(row?.doneIssues)}`
      ])
    );
    const yUpper = computeYUpper(chartRows.map((row) => toNumber(row?.totalIssues)), { min: 1, pad: 1.12 });
    const nice = buildNiceNumberAxis(yUpper);
    renderGroupedBars("contributors", containerId, chartRows.length > 0, {
      rows: chartRows,
      defs: [
        {
          dataKey: "totalIssues",
          name: "Ticket totals",
          fill: fillColor
        }
      ],
      colors,
      yUpper: nice.upper,
      showLegend: false,
      height: singleChartHeightForMode("contributors", CHART_HEIGHTS.dense),
      margin: { top: 14, right: 12, bottom: 30, left: 12 },
      chartLayout: "vertical",
      xAxisProps: {
        type: "number",
        domain: [0, nice.upper],
        ticks: nice.ticks,
        allowDecimals: false
      },
      yAxisProps: {
        dataKey: "contributor",
        type: "category",
        width: contributorAxisWidth,
        tick: twoLineCategoryTickFactory(colors, {
          textAnchor: "end",
          dy: 3,
          line2Dy: 14,
          secondaryLabels: contributorMetaLabels
        })
      },
      tooltipProps: {
        content: createTooltipContent(colors, (row) => [
          tooltipTitleLine("name", row?.contributor || "Contributor", colors),
          makeTooltipLine("totals", `Ticket totals = ${toWhole(row?.totalIssues)}`, colors, {
            margin: "2px 0 6px",
            subItems: [
              ...(Array.isArray(row?.ticketStateItems) && row.ticketStateItems.length > 0
                ? row.ticketStateItems
                : [`Done = ${toWhole(row?.doneIssues)}`, `Not done = ${toWhole(row?.notDoneIssues ?? row?.activeIssues)}`])
            ]
          })
        ]),
        cursor: { fill: BAR_CURSOR_FILL }
      },
      gridHorizontal: false
    });
  }

  window.DashboardDeliveryCharts = {
    renderDevelopmentTimeVsUatTimeChart,
    renderDevelopmentVsUatByFacilityChart,
    renderTopContributorsChart
  };
})();
