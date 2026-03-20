"use strict";

(function initDashboardDeliveryCharts() {
  const core = window.DashboardChartCore;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }

  const {
    BAR_CURSOR_FILL,
    CHART_HEIGHTS,
    ReferenceLine,
    axisTick,
    buildAxisLabel,
    createTooltipContent,
    formatAverageLabel,
    formatTooltipDuration,
    h,
    isCompactViewport,
    makeTooltipLine,
    renderGroupedBars,
    renderMultiSeriesBars,
    singleChartHeightForMode,
    tickIntervalForMobileLabels,
    toMonthsForChart,
    toNumber,
    toWhole,
    tooltipTitleLine,
    twoLineCategoryTickFactory
  } = core;

  function toChartRows(rows) {
    return Array.isArray(rows) ? rows : [];
  }

  function computeFacilityMonthAxis(rows) {
    const maxMonths = rows.reduce((highest, row) => {
      return Math.max(highest, toNumber(row?.devTime), toNumber(row?.uatTime));
    }, 0);
    const upper = maxMonths <= 3 ? 3 : 5;
    return {
      upper,
      ticks: Array.from({ length: upper + 1 }, (_, index) => index)
    };
  }

  function formatFacilityTooltipAverage(valueInDays) {
    const days = toNumber(valueInDays);
    if (days < 28) return String(formatAverageLabel(days, "weeks")).replace(/\s+avg$/, "");
    return formatTooltipDuration(days, "months");
  }

  function formatFacilityTooltipSummary(valueInDays, sampleCount) {
    const duration = formatFacilityTooltipAverage(valueInDays);
    return toWhole(sampleCount) === 1 ? duration : `${duration} average`;
  }

  function buildIssueSubItems(issueItems, jiraBrowseBase, colors) {
    const safeIssueItems = Array.isArray(issueItems) ? issueItems : [];
    const issueDisplayLimit = isCompactViewport() ? 5 : 8;
    const browseBase = String(jiraBrowseBase || "").replace(/\/$/, "");
    const items = safeIssueItems
      .slice(0, issueDisplayLimit)
      .map((item, index) => {
        const key = String(item?.issueId || item || "").trim();
        if (!key) return null;
        const facilityLabel = String(item?.facilityLabel || "").trim();
        return h(
          "span",
          { key: `issue-item-${key}-${index}` },
          h(
            "a",
            {
              href: `${browseBase}/${encodeURIComponent(key)}`,
              target: "_blank",
              rel: "noopener noreferrer",
              style: {
                color: colors.text,
                textDecoration: "underline"
              }
            },
            key
          ),
          facilityLabel ? ` (${facilityLabel})` : ""
        );
      })
      .filter(Boolean);
    if (safeIssueItems.length > issueDisplayLimit) {
      items.push(`+${safeIssueItems.length - issueDisplayLimit} more`);
    }
    return items.length > 0 ? items : ["-"];
  }

  function renderDevelopmentVsUatByFacilityChart({
    containerId,
    rows,
    groupingLabel = "facility",
    colors,
    devColor,
    uatColor,
    jiraBrowseBase = "https://nepgroup.atlassian.net/browse/"
  }) {
    const chartRows = toChartRows(rows).slice();
    const compactViewport = isCompactViewport();
    const UAT_ALERT_MONTH_THRESHOLD = 1;
    const uatWithinGoalFill = "#a7cfb4";
    const uatWatchFill = "#d8bf93";
    const uatRiskFill = "#c98b84";
    const UAT_RISK_MONTH_THRESHOLD = 2;
    const displayRows = chartRows.map((row) => ({
      ...row,
      devTime: toMonthsForChart(row?.devAvg),
      uatTime: toMonthsForChart(row?.uatAvg)
    }));
    const monthAxis = computeFacilityMonthAxis(displayRows);
    const categorySecondaryLabels = Object.fromEntries(
      chartRows.map((row) => [String(row?.label || ""), `n=${toWhole(row?.sampleCount)}`])
    );
    const isBusinessUnitGrouping =
      String(groupingLabel || "")
        .trim()
        .toLowerCase() === "business unit";
    const xInterval = compactViewport ? tickIntervalForMobileLabels(chartRows.length) : 0;
    renderGroupedBars(containerId, chartRows.length > 0, {
      rows: displayRows,
      categoryKey: "label",
      valueUnit: "months",
      referenceNodes: [
        h(ReferenceLine, {
          y: UAT_ALERT_MONTH_THRESHOLD,
          stroke: "rgba(0, 0, 0, 0.9)",
          strokeDasharray: "7 5",
          strokeWidth: 1.8,
          ifOverflow: "extendDomain",
          label: {
            value: "UAT goal",
            position: "insideTopRight",
            offset: 8,
            fill: "rgba(0, 0, 0, 0.95)",
            fontSize: 11,
            fontWeight: 600
          }
        })
      ],
      defs: [
        {
          dataKey: "devTime",
          name: "Time in Development",
          fill: devColor
        },
        {
          dataKey: "uatTime",
          name: "Time in UAT",
          fill: uatColor,
          legendSwatchBackground: `linear-gradient(90deg, ${uatWithinGoalFill} 0 33%, ${uatWatchFill} 33% 66%, ${uatRiskFill} 66% 100%)`,
          cellFillAccessor: (row) => {
            const uatMonths = toNumber(row?.uatTime);
            if (uatMonths >= UAT_RISK_MONTH_THRESHOLD) return uatRiskFill;
            if (uatMonths >= UAT_ALERT_MONTH_THRESHOLD) return uatWatchFill;
            return uatWithinGoalFill;
          }
        }
      ],
      colors,
      yUpper: monthAxis.upper,
      height: singleChartHeightForMode("management-facility", CHART_HEIGHTS.standard),
      yAxisProps: {
        width: 76,
        domain: [0, monthAxis.upper],
        ticks: monthAxis.ticks,
        tickFormatter: (value) => {
          const months = toWhole(value);
          if (months <= 0) return "0";
          return months === 1 ? "1 month" : `${months} months`;
        },
        label: buildAxisLabel("Average time", { axis: "y", offset: 6 })
      },
      xAxisProps: {
        dataKey: "label",
        interval: xInterval,
        minTickGap: compactViewport ? 14 : 6,
        height: compactViewport ? 44 : 56,
        angle: compactViewport ? -28 : 0,
        textAnchor: compactViewport ? "end" : "middle",
        label: buildAxisLabel(isBusinessUnitGrouping ? "Business Unit" : "Facility"),
        tick: compactViewport
          ? { ...axisTick(colors), fontSize: 11 }
          : twoLineCategoryTickFactory(colors, {
              textAnchor: "middle",
              secondaryLabels: categorySecondaryLabels
            })
      },
      tooltipProps: {
        content: createTooltipContent(
          colors,
          (row) => {
            const devAvg = toNumber(row?.devAvg);
            const uatAvg = toNumber(row?.uatAvg);
            return [
              tooltipTitleLine("label", row?.label || "", colors),
              makeTooltipLine("sample", `n=${toWhole(row?.sampleCount)}`, colors, {
                margin: "0 0 6px"
              }),
              makeTooltipLine("dev", "Time in Development", colors, {
                margin: "2px 0",
                preserveSubItems: true,
                subItems: [formatFacilityTooltipSummary(devAvg, row?.devCount)]
              }),
              makeTooltipLine("uat", "Time in UAT", colors, {
                margin: "2px 0",
                preserveSubItems: true,
                subItems: [formatFacilityTooltipSummary(uatAvg, row?.uatCount)]
              }),
              makeTooltipLine("issues", "Issues", colors, {
                margin: "6px 0 0",
                subItems: buildIssueSubItems(
                  isBusinessUnitGrouping ? row?.issueItems : row?.issueIds,
                  jiraBrowseBase,
                  colors
                )
              })
            ];
          },
          {
            cardStyle: {
              maxWidth: "240px"
            },
            interactive: true,
            trackPointer: false
          }
        ),
        cursor: { fill: BAR_CURSOR_FILL }
      }
    });
  }

  function renderTopContributorsChart({ containerId, rows, colors, barColor }) {
    const chartRows = toChartRows(rows);
    const compactViewport = isCompactViewport();
    const fillColor = String(barColor || "").trim() || colors.teams.react;
    const overlayDots = chartRows
      .map((row) => {
        const totalContributions = toNumber(row?.totalIssues);
        const doneContributions = toWhole(row?.doneIssues);
        if (totalContributions <= 0 && doneContributions <= 0) return null;
        return {
          x: totalContributions,
          y: String(row?.contributor || ""),
          labelPrefix: compactViewport ? "" : doneContributions > 0 ? "✓" : "",
          accentColor: "rgba(56,161,105,0.95)",
          labelText: compactViewport
            ? String(doneContributions)
            : `${doneContributions} ${
                doneContributions === 1 ? "contribution" : "contributions"
              } done`,
          fontSize: compactViewport ? 10 : 11,
          labelDx: compactViewport ? 6 : 10
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
              : [
                  `Done = ${toWhole(row?.doneIssues)}`,
                  `Not done = ${toWhole(row?.notDoneIssues ?? row?.activeIssues)}`
                ]
        }
      })),
      defs: [{ key: "total", name: "Contribution totals", color: fillColor }],
      colors,
      showLegend: false,
      valueUnit: "count",
      orientation: "horizontal",
      categoryKey: "contributor",
      chartMargin: compactViewport
        ? { top: 14, right: 44, bottom: 60, left: 12 }
        : { top: 14, right: 180, bottom: 72, left: 12 },
      yAxisProps: compactViewport
        ? {
            width: 108,
            tick: {
              fill: colors.text,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "var(--font-ui)"
            }
          }
        : null,
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
    renderDevelopmentVsUatByFacilityChart,
    renderTopContributorsChart
  });
})();
