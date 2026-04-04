export function createWorkflowPanels(deps) {
  const {
    state,
    constants: {
      ALL_TEAM_SCOPE_KEY,
      THIRTY_DAY_WINDOW_KEY,
      DEVELOPMENT_WORKFLOW_WINDOWS,
      MANAGEMENT_FLOW_SCOPES
    },
    prActivityLineDefs,
    accessors: {
      getConfig,
      getManagementFacilitySnapshot,
      getPrActivitySnapshot,
      getPrActivityWindowedPoints
    },
    ui: {
      isPretextLayoutActive,
      getDashboardPretextLayout
    },
    helpers: {
      buildIssueItemsSearchUrl,
      buildRowMarkup,
      clearChartContainer,
      clearPanelLead,
      escapeHtml,
      formatContextWithFreshness,
      getBroadcastScopeLabel,
      getPrCycleTeamColor,
      getSnapshotContextTimestamp,
      getThemeColors,
      normalizeDisplayTeamName,
      normalizeOption,
      renderDashboardChartState,
      renderNamedChart,
      renderPanelLead,
      renderProductCycleCard,
      setPanelContext,
      showPanelStatus,
      syncControlValue,
      syncRadioAvailability,
      toCount,
      toNumber,
      withChart
    }
  } = deps;

  function compareBusinessUnitLabels(left, right) {
    const leftLabel = String(left || "").trim();
    const rightLabel = String(right || "").trim();
    const leftIsTechDebt = leftLabel.toLowerCase() === "tech debt";
    const rightIsTechDebt = rightLabel.toLowerCase() === "tech debt";
    if (leftIsTechDebt && !rightIsTechDebt) return 1;
    if (!leftIsTechDebt && rightIsTechDebt) return -1;
    return leftLabel.localeCompare(rightLabel);
  }

  function buildEmptyBusinessUnitRow(label) {
    return {
      label,
      devAvg: 0,
      uatAvg: 0,
      devCount: 0,
      uatCount: 0,
      sampleCount: 0,
      issueIds: [],
      issueItems: [],
      facilities: []
    };
  }

  function getAlignedBusinessUnitRows(scope) {
    const byScope = getManagementFacilitySnapshot()?.chartData?.managementBusinessUnit?.byScope;
    const ongoingRows = Array.isArray(byScope?.ongoing?.rows) ? byScope.ongoing.rows : [];
    const doneRows = Array.isArray(byScope?.done?.rows) ? byScope.done.rows : [];
    const labels = Array.from(
      new Set(
        [...ongoingRows, ...doneRows].map((row) => String(row?.label || "").trim()).filter(Boolean)
      )
    ).sort(compareBusinessUnitLabels);
    const targetRows = scope === "done" ? doneRows : ongoingRows;
    const rowMap = new Map(targetRows.map((row) => [String(row?.label || "").trim(), row]));
    return labels.map((label) => rowMap.get(label) || buildEmptyBusinessUnitRow(label));
  }

  function formatCycleMonthsText(valueInDays, { short = false } = {}) {
    const months = Math.max(0, toNumber(valueInDays) / 30.4375);
    const rounded = months === 0 ? "0" : months.toFixed(1);
    const unit = Math.abs(months - 1) < 0.05 ? "month" : "months";
    if (short) return `${rounded} ${unit}`;
    return `${rounded} ${unit}`;
  }

  function getPretextFillWidth(value, upperBound) {
    const safeUpper = Math.max(1, toNumber(upperBound));
    const safeValue = Math.max(0, toNumber(value));
    if (safeValue <= 0) return 0;
    return Math.max(12, Math.round((safeValue / safeUpper) * 100));
  }

  function buildManagementFacilityLeadModel(scopeLabel, rows) {
    const safeRows = (Array.isArray(rows) ? rows : []).filter(
      (row) => toCount(row?.sampleCount) > 0
    );
    if (safeRows.length === 0) return null;
    const weightedUatAverage =
      safeRows.reduce((sum, row) => sum + toNumber(row?.uatAvg) * toCount(row?.sampleCount), 0) /
      Math.max(
        1,
        safeRows.reduce((sum, row) => sum + toCount(row?.sampleCount), 0)
      );
    const slowestRow = [...safeRows].sort((left, right) => {
      if (toNumber(right?.uatAvg) !== toNumber(left?.uatAvg)) {
        return toNumber(right?.uatAvg) - toNumber(left?.uatAvg);
      }
      return String(left?.label || "").localeCompare(String(right?.label || ""));
    })[0];
    const sampleCount = safeRows.reduce((sum, row) => sum + toCount(row?.sampleCount), 0);

    return {
      summaryText: `${scopeLabel} work is averaging ${formatCycleMonthsText(
        weightedUatAverage
      )} in UAT, with ${String(
        slowestRow?.label || "the slowest business unit"
      ).trim()} currently waiting the longest.`,
      calloutLabel: "UAT average",
      calloutValue: formatCycleMonthsText(weightedUatAverage, { short: true }),
      calloutSubtext: slowestRow ? `Slowest: ${String(slowestRow.label || "").trim()}` : scopeLabel,
      chips: [scopeLabel, `${sampleCount} issues sampled`, `${getBroadcastScopeLabel()} scope`],
      accentColor: "rgba(79, 123, 155, 0.22)"
    };
  }

  function buildPretextManagementFacilityModel(scopeLabel, rows, scopeKey = "ongoing") {
    const safeRows = (Array.isArray(rows) ? rows : []).filter(
      (row) => toCount(row?.sampleCount) > 0
    );
    if (safeRows.length === 0) return null;
    const sampleCount = safeRows.reduce((sum, row) => sum + toCount(row?.sampleCount), 0);
    const weightedUatAverage =
      safeRows.reduce((sum, row) => sum + toNumber(row?.uatAvg) * toCount(row?.sampleCount), 0) /
      Math.max(1, sampleCount);
    const sortedRows = [...safeRows].sort((left, right) => {
      if (toNumber(right?.uatAvg) !== toNumber(left?.uatAvg)) {
        return toNumber(right?.uatAvg) - toNumber(left?.uatAvg);
      }
      return String(left?.label || "").localeCompare(String(right?.label || ""));
    });
    const slowestRow = sortedRows[0] || null;
    const maxUatDays = Math.max(1, ...sortedRows.map((row) => toNumber(row?.uatAvg)));

    return {
      teamKey: "uat",
      teamColor: "var(--chart-active)",
      accentColor: "var(--chart-active)",
      stats: [
        { label: "UAT average", value: formatCycleMonthsText(weightedUatAverage, { short: true }) },
        ...(scopeKey === "done"
          ? []
          : [
              {
                label: "Action needed",
                value: String(slowestRow?.label || "").trim() || scopeLabel
              }
            ]),
        { label: "Slowest avg", value: formatCycleMonthsText(slowestRow?.uatAvg, { short: true }) },
        { label: "Sample", value: `${sampleCount} issues` }
      ],
      columnStartLabel: "Business unit",
      columnEndLabel: "Avg time in UAT",
      rows: sortedRows.map((row) => ({
        label: String(row?.label || "").trim(),
        rowHref: buildIssueItemsSearchUrl(row?.issueItems),
        linkAriaLabel: `Open ${String(row?.label || "").trim()} Jira issues in new tab`,
        metaBits: [
          `${toCount(row?.sampleCount)} ${toCount(row?.sampleCount) === 1 ? "issue" : "issues"}`
        ],
        valueText: formatCycleMonthsText(row?.uatAvg, { short: true }),
        width: getPretextFillWidth(row?.uatAvg, maxUatDays),
        color: "var(--chart-active)"
      }))
    };
  }

  function getPrCycleStageDisplayLabel(stage) {
    const key = String(stage?.key || "").trim();
    if (key === "coding") return "Progress";
    if (key === "review") return "Review";
    if (key === "merge") return "QA";
    return String(stage?.label || "").trim();
  }

  function formatStackedCycleDaysValueMarkup(valueInDays) {
    const days = Math.max(0, toNumber(valueInDays));
    const rounded = days.toFixed(1);
    const unit = Math.abs(days - 1) < 0.05 ? "day" : "days";
    return `<span class="stacked-duration"><span class="stacked-duration__value">${rounded}</span><span class="stacked-duration__unit">${unit}</span></span>`;
  }

  function formatWorkflowBreakdownMetricMarkup(value, modifierClass = "") {
    return `
    <span class="workflow-breakdown-metric${modifierClass ? ` ${modifierClass}` : ""}">
      <span class="workflow-breakdown-metric__value">${escapeHtml(value)}</span>
    </span>
  `;
  }

  function formatWorkflowBreakdownDurationMetricMarkup(valueInDays) {
    const days = Math.max(0, toNumber(valueInDays));
    const rounded = days.toFixed(1);
    return formatWorkflowBreakdownMetricMarkup(rounded, "workflow-breakdown-metric--days");
  }

  function formatWorkflowBreakdownInflowMetricMarkup(value) {
    const inflow = toNumber(value);
    if (!Number.isFinite(inflow) || inflow <= 0) return "";
    const rounded = String(Math.max(0, Math.round(inflow)));
    return formatWorkflowBreakdownMetricMarkup(rounded, "workflow-breakdown-metric--inflow");
  }

  function formatWorkflowBreakdownValueMarkup(totalCycleDays, avgPrInflow) {
    return `
    <span class="workflow-breakdown-metrics">
      ${formatWorkflowBreakdownDurationMetricMarkup(totalCycleDays)}
      ${formatWorkflowBreakdownInflowMetricMarkup(avgPrInflow)}
    </span>
  `;
  }

  function formatWorkflowBreakdownHeaderMarkup() {
    return `
    <div class="workflow-breakdown-card__header-main">
      <div class="pr-cycle-stage-card__team">All teams</div>
    </div>
  `;
  }

  function formatWorkflowDaysText(value) {
    const days = Math.max(0, toNumber(value));
    return `${days.toFixed(1)} ${Math.abs(days - 1) < 0.05 ? "day" : "days"}`;
  }

  function normalizeWorkflowBottleneckLabel(value) {
    const raw = String(value || "").trim();
    const normalized = raw.toLowerCase();
    if (normalized === "in progress") return "Progress";
    if (normalized === "in review") return "Review";
    return raw;
  }

  function getRenderableWorkflowStages(stages) {
    return (Array.isArray(stages) ? stages : []).filter(
      (stage) => toCount(stage?.sampleCount) > 0 || toNumber(stage?.days) > 0
    );
  }

  function buildPretextWorkflowBreakdownModel(team, snapshot, footerSecondary) {
    const teamColor = getPrCycleTeamColor(team?.key);
    const stages = getRenderableWorkflowStages(team?.stages);
    const maxDays =
      stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
    const issueCount = toCount(team?.issueCount || team?.pullRequestCount);
    const inflow = toNumber(team?.avgPrInflow);
    const bottleneckLabel = normalizeWorkflowBottleneckLabel(team?.bottleneckLabel);

    return {
      teamKey: String(team?.key || ""),
      teamColor,
      accentColor: teamColor,
      stats: [
        { label: "Cycle time", value: formatWorkflowDaysText(team?.totalCycleDays) },
        { label: "Main blocker", value: bottleneckLabel || "None" },
        { label: "Sample", value: `${issueCount} ${issueCount === 1 ? "issue" : "issues"}` },
        inflow > 0
          ? { label: "PRs / sprint", value: `≈ ${Math.round(inflow)}` }
          : { label: "Window", value: String(snapshot?.windowLabel || "").trim() }
      ],
      columnStartLabel: "Stage",
      columnEndLabel: "Avg time",
      footerBits: [footerSecondary].filter(Boolean),
      rows: stages.map((stage) => ({
        label: getPrCycleStageDisplayLabel(stage),
        metaBits: [
          `${toCount(stage?.sampleCount)} ${toCount(stage?.sampleCount) === 1 ? "issue" : "issues"}`
        ],
        valueText: formatWorkflowDaysText(stage?.days),
        width: Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100)),
        color: teamColor
      }))
    };
  }

  function buildPretextAllTeamsBreakdownModel(team, snapshot, footerPrimary, footerSecondary) {
    const orderedRows = [...(Array.isArray(team?.teamRows) ? team.teamRows : [])].sort(
      (left, right) => {
        if (toNumber(left?.totalCycleDays) !== toNumber(right?.totalCycleDays)) {
          return toNumber(left?.totalCycleDays) - toNumber(right?.totalCycleDays);
        }
        return String(left?.label || "").localeCompare(String(right?.label || ""));
      }
    );
    const maxDays =
      orderedRows.reduce((highest, row) => Math.max(highest, toNumber(row?.totalCycleDays)), 0) ||
      1;
    const inflowSummary =
      toNumber(team?.avgPrInflow) > 0
        ? `≈ ${Math.round(toNumber(team?.avgPrInflow))} PRs per sprint`
        : "";

    return {
      teamKey: ALL_TEAM_SCOPE_KEY,
      teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
      accentColor: "var(--chart-active)",
      stats: [
        { label: "Cycle time", value: formatWorkflowDaysText(team?.totalCycleDays) },
        {
          label: "Main blocker",
          value: normalizeWorkflowBottleneckLabel(team?.bottleneckLabel) || "None"
        },
        { label: "Teams", value: `${toCount(team?.teamCount)} teams` },
        inflowSummary
          ? { label: "PRs / sprint", value: `≈ ${Math.round(toNumber(team?.avgPrInflow))}` }
          : { label: "Sample", value: footerPrimary }
      ],
      columnStartLabel: "Team",
      columnEndLabel: "Avg cycle",
      footerBits: [footerSecondary].filter(Boolean),
      rows: orderedRows.map((row) => {
        const bottleneck = normalizeWorkflowBottleneckLabel(row?.bottleneckLabel);
        const inflow = toNumber(row?.avgPrInflow);
        return {
          label: normalizeDisplayTeamName(row?.label || ""),
          metaBits: [
            `${toCount(row?.issueCount)} ${toCount(row?.issueCount) === 1 ? "issue" : "issues"}`,
            bottleneck ? `${bottleneck} blocker` : "",
            Number.isFinite(inflow) && inflow > 0 ? `≈ ${Math.round(inflow)} PRs / sprint` : ""
          ].filter(Boolean),
          valueText: formatWorkflowDaysText(row?.totalCycleDays),
          width: Math.max(12, Math.round((toNumber(row?.totalCycleDays) / maxDays) * 100)),
          color: getPrCycleTeamColor(row?.key)
        };
      })
    };
  }

  function formatWorkflowBreakdownColumnHeaderRowMarkup() {
    return `
    <div class="pr-cycle-stage-row workflow-breakdown-column-header" aria-hidden="true">
      <div class="pr-cycle-stage-row__label workflow-breakdown-column-header__placeholder"></div>
      <div class="workflow-breakdown-column-header__spacer"></div>
      <div class="pr-cycle-stage-row__value workflow-breakdown-column-header__value">
        <span class="workflow-breakdown-metrics workflow-breakdown-metrics--headings">
          <span class="workflow-breakdown-metric-heading">Days</span>
          <span class="workflow-breakdown-metric-heading">PR/sprint</span>
        </span>
      </div>
    </div>
  `;
  }

  function renderWorkflowBreakdownCard(containerId, team, snapshot) {
    if (!team) return;
    const compactViewport = deps.chart.isCompactViewport();
    const pretextWorkflowEnabled = isPretextLayoutActive();
    const pretextLayout = getDashboardPretextLayout();
    const isAllTeamsView =
      String(team?.key || "")
        .trim()
        .toLowerCase() === ALL_TEAM_SCOPE_KEY && Array.isArray(team?.teamRows);
    if (isAllTeamsView) {
      const teamRows = Array.isArray(team?.teamRows) ? team.teamRows : [];
      const maxDays =
        teamRows.reduce((highest, row) => Math.max(highest, toNumber(row?.totalCycleDays)), 0) || 1;
      const rowsMarkup = `${formatWorkflowBreakdownColumnHeaderRowMarkup()}${teamRows
        .map((row) => {
          const width = Math.max(12, Math.round((toNumber(row?.totalCycleDays) / maxDays) * 100));
          const sampleCount = toCount(row?.issueCount);
          return buildRowMarkup({
            stage: String(row?.key || ""),
            label: normalizeDisplayTeamName(row?.label || ""),
            sampleMarkup: sampleCount > 0 ? `n = ${sampleCount}` : "n = 0",
            width,
            wrapValueFrame: false,
            valueMarkup: formatWorkflowBreakdownValueMarkup(row?.totalCycleDays, row?.avgPrInflow),
            fillStyle: `background:${escapeHtml(getPrCycleTeamColor(row?.key))}`
          });
        })
        .join("")}`;
      const issueCount = toNumber(team?.issueCount);
      const footerPrimary =
        issueCount > 0
          ? compactViewport
            ? `${issueCount} sampled`
            : `${issueCount} issues sampled`
          : compactViewport
            ? "No samples"
            : "No sampled issues";
      const footerSecondary = String(snapshot?.windowLabel || "").trim();
      if (pretextWorkflowEnabled && pretextLayout) {
        const model = buildPretextAllTeamsBreakdownModel(
          team,
          snapshot,
          footerPrimary,
          footerSecondary
        );
        const rendered =
          pretextLayout.renderPretextCard?.(containerId, model) ||
          pretextLayout.renderWorkflowBreakdownCard?.(containerId, model);
        if (rendered) return;
      }
      renderProductCycleCard(containerId, {
        className: "workflow-breakdown-card",
        teamKey: ALL_TEAM_SCOPE_KEY,
        teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
        headerMarkup: formatWorkflowBreakdownHeaderMarkup(),
        rowsMarkup,
        footerMarkup: `
        <div class="pr-cycle-stage-card__footer">
          <span><strong>${escapeHtml(footerPrimary)}</strong>${footerSecondary ? ` • ${escapeHtml(footerSecondary)}` : ""}</span>
          <span>Sorted: <strong>Fastest to slowest</strong></span>
        </div>
      `
      });
      return;
    }

    const stages = getRenderableWorkflowStages(team?.stages);
    const teamColor = getPrCycleTeamColor(team?.key);
    const maxDays =
      stages.reduce((highest, stage) => Math.max(highest, toNumber(stage?.days)), 0) || 1;
    const rowsMarkup = stages
      .map((stage) => {
        const width = Math.max(12, Math.round((toNumber(stage?.days) / maxDays) * 100));
        const sampleCount = toCount(stage?.sampleCount);
        return buildRowMarkup({
          stage: String(stage?.key || ""),
          label: getPrCycleStageDisplayLabel(stage),
          sampleMarkup: sampleCount > 0 ? `n = ${sampleCount}` : "n = 0",
          width,
          valueMarkup: formatStackedCycleDaysValueMarkup(stage?.days)
        });
      })
      .join("");
    const issueCount = toNumber(team?.issueCount || team?.pullRequestCount);
    const footerPrimary =
      issueCount > 0
        ? compactViewport
          ? `${issueCount} sampled`
          : `${issueCount} issues sampled`
        : compactViewport
          ? "No samples"
          : "No sampled issues";
    const footerSecondary = String(snapshot?.windowLabel || "").trim();
    const inflow = toNumber(team?.avgPrInflow);
    const inflowSummary =
      Number.isFinite(inflow) && inflow > 0 ? `≈ ${Math.round(inflow)} PRs per sprint` : "";
    const footerLabel = compactViewport ? "Blocker" : "Bottleneck";
    if (pretextWorkflowEnabled && pretextLayout) {
      const model = buildPretextWorkflowBreakdownModel(team, snapshot, footerSecondary);
      const rendered =
        pretextLayout.renderPretextCard?.(containerId, model) ||
        pretextLayout.renderWorkflowBreakdownCard?.(containerId, model);
      if (rendered) return;
    }
    renderProductCycleCard(containerId, {
      className: "workflow-breakdown-card",
      teamKey: String(team?.key || ""),
      teamColor,
      headerMarkup: `
      <div class="pr-cycle-stage-card__team">${escapeHtml(String(team?.label || ""))}</div>
      <div class="pr-cycle-stage-card__total metric-duration"><span class="metric-duration__value">${toNumber(
        team?.totalCycleDays
      ).toFixed(1)}</span><span class="metric-duration__unit">${
        Math.abs(toNumber(team?.totalCycleDays) - 1) < 0.05 ? "day" : "days"
      }</span></div>
    `,
      rowsMarkup,
      footerMarkup: `
      <div class="pr-cycle-stage-card__footer">
        <span><strong>${escapeHtml(footerPrimary)}</strong>${footerSecondary ? ` • ${escapeHtml(footerSecondary)}` : ""}${
          inflowSummary ? ` • ${escapeHtml(inflowSummary)}` : ""
        }</span>
        <span>${footerLabel}: <strong>${escapeHtml(String(team?.bottleneckLabel || ""))}</strong></span>
      </div>
    `
    });
  }

  function buildPrActivityAverageInflowByTeam(points, prCycleWindowSnapshot) {
    const safePoints = Array.isArray(points) ? points : [];
    const availableTeamKeys = new Set(
      (Array.isArray(prCycleWindowSnapshot?.teams) ? prCycleWindowSnapshot.teams : [])
        .map((team) =>
          String(team?.key || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );
    return Object.fromEntries(
      prActivityLineDefs.map((lineDef) => {
        if (!availableTeamKeys.has(lineDef.dataKey)) return null;
        const inflowValues = safePoints
          .map((point) => toNumber(point?.[lineDef.dataKey]?.offered))
          .filter((value) => Number.isFinite(value));
        if (inflowValues.length === 0) return null;
        return [
          lineDef.dataKey,
          Number(
            (
              inflowValues.reduce((sum, value) => sum + value, 0) / Math.max(1, inflowValues.length)
            ).toFixed(1)
          )
        ];
      }).filter(Boolean)
    );
  }

  function buildPrCycleAllTeamsMetric(windowSnapshot, inflowByTeamKey = {}) {
    const teams = Array.isArray(windowSnapshot?.teams) ? windowSnapshot.teams : [];
    const weightedStageDaysByLabel = new Map();
    const teamRows = teams
      .map((team) => {
        const key = String(team?.key || "")
          .trim()
          .toLowerCase();
        const label = String(team?.label || "").trim();
        const issueCount = toCount(team?.issueCount || team?.pullRequestCount);
        const stageDays = Array.isArray(team?.stages)
          ? team.stages.reduce((sum, stage) => sum + toNumber(stage?.days), 0)
          : 0;
        if (Array.isArray(team?.stages) && issueCount > 0) {
          team.stages.forEach((stage) => {
            const stageLabel = getPrCycleStageDisplayLabel(stage);
            weightedStageDaysByLabel.set(
              stageLabel,
              (weightedStageDaysByLabel.get(stageLabel) || 0) + toNumber(stage?.days) * issueCount
            );
          });
        }
        const totalCycleDays = Number(
          (Number.isFinite(toNumber(team?.totalCycleDays))
            ? toNumber(team?.totalCycleDays)
            : stageDays
          ).toFixed(1)
        );
        return {
          key,
          label,
          issueCount,
          avgPrInflow: toNumber(inflowByTeamKey[key]),
          totalCycleDays,
          bottleneckLabel: String(team?.bottleneckLabel || "").trim()
        };
      })
      .filter((team) => team.key && team.label)
      .sort((left, right) => {
        if (left.totalCycleDays !== right.totalCycleDays) {
          return left.totalCycleDays - right.totalCycleDays;
        }
        return left.label.localeCompare(right.label);
      });
    const totalIssueCount = teamRows.reduce((sum, team) => sum + toCount(team?.issueCount), 0);
    const weightedCycleDaysTotal = teamRows.reduce(
      (sum, team) => sum + toNumber(team?.totalCycleDays) * toCount(team?.issueCount),
      0
    );
    const totalCycleDays = Number(
      (totalIssueCount > 0
        ? weightedCycleDaysTotal / totalIssueCount
        : teamRows.reduce((sum, team) => sum + toNumber(team?.totalCycleDays), 0) /
          Math.max(1, teamRows.length)
      ).toFixed(1)
    );
    const avgPrInflow = Number(
      teamRows.reduce((sum, team) => sum + Math.max(0, toNumber(team?.avgPrInflow)), 0).toFixed(1)
    );
    const slowestTeam = teamRows[teamRows.length - 1] || null;
    const fastestTeam = teamRows[0] || null;
    const bottleneckLabel =
      Array.from(weightedStageDaysByLabel.entries()).sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return String(left[0] || "").localeCompare(String(right[0] || ""));
      })[0]?.[0] || "";
    return {
      key: ALL_TEAM_SCOPE_KEY,
      label: "All teams",
      issueCount: totalIssueCount,
      totalCycleDays,
      avgPrInflow,
      bottleneckLabel,
      teamCount: teamRows.length,
      fastestTeamLabel: String(fastestTeam?.label || "").trim(),
      fastestTeamDays: toNumber(fastestTeam?.totalCycleDays),
      slowestTeamLabel: String(slowestTeam?.label || "").trim(),
      slowestTeamDays: toNumber(slowestTeam?.totalCycleDays),
      teamRows
    };
  }

  function renderWorkflowBreakdown() {
    withChart("workflow-breakdown", getConfig, ({ status, context, config }) => {
      const windows =
        state.prCycle?.windows && typeof state.prCycle.windows === "object"
          ? state.prCycle.windows
          : null;
      const availableWindowKeys = Object.keys(windows || {});
      const effectiveWindowKeys =
        availableWindowKeys.length > 0 ? availableWindowKeys : [THIRTY_DAY_WINDOW_KEY];
      const fallbackWindowKey =
        String(state.prCycle?.defaultWindow || "")
          .trim()
          .toLowerCase() || THIRTY_DAY_WINDOW_KEY;
      const desiredWindowKey = normalizeOption(
        state.developmentWorkflowWindow || state.prCycleWindow,
        DEVELOPMENT_WORKFLOW_WINDOWS,
        THIRTY_DAY_WINDOW_KEY
      );
      const selectedWindowKey = effectiveWindowKeys.includes(desiredWindowKey)
        ? desiredWindowKey
        : effectiveWindowKeys.includes(fallbackWindowKey)
          ? fallbackWindowKey
          : THIRTY_DAY_WINDOW_KEY;
      const selectedWindowSnapshot =
        windows?.[selectedWindowKey] && typeof windows[selectedWindowKey] === "object"
          ? windows[selectedWindowKey]
          : windows?.[fallbackWindowKey] && typeof windows[fallbackWindowKey] === "object"
            ? windows[fallbackWindowKey]
            : Object.values(windows || {}).find(
                (windowSnapshot) => windowSnapshot && typeof windowSnapshot === "object"
              ) || null;
      const teams = Array.isArray(selectedWindowSnapshot?.teams)
        ? selectedWindowSnapshot.teams
        : [];
      if (teams.length === 0) {
        clearChartContainer(config.containerId);
        showPanelStatus(status, config.missingMessage);
        return;
      }

      const availableKeys = [
        ALL_TEAM_SCOPE_KEY,
        ...teams.map((team) =>
          String(team?.key || "")
            .trim()
            .toLowerCase()
        )
      ];
      syncRadioAvailability("pr-cycle-window", effectiveWindowKeys);
      syncRadioAvailability("pr-cycle-team", availableKeys);
      const selectedKey = availableKeys.includes(state.prCycleTeam)
        ? state.prCycleTeam
        : ALL_TEAM_SCOPE_KEY;
      const inflowByTeamKeyFromSnapshot = Object.fromEntries(
        teams
          .map((team) => {
            const teamKey = String(team?.key || "")
              .trim()
              .toLowerCase();
            if (!teamKey || team?.avgPrInflow === null || team?.avgPrInflow === undefined)
              return null;
            return [teamKey, toNumber(team?.avgPrInflow)];
          })
          .filter(Boolean)
      );
      const prActivitySourcePoints = Array.isArray(getPrActivitySnapshot()?.prActivity?.points)
        ? getPrActivitySnapshot().prActivity.points
        : [];
      const { points: prActivityWindowPoints } = getPrActivityWindowedPoints(
        prActivitySourcePoints,
        selectedWindowKey
      );
      const inflowByTeamKey =
        Object.keys(inflowByTeamKeyFromSnapshot).length > 0
          ? inflowByTeamKeyFromSnapshot
          : state.loadedSources.prActivity === true
            ? buildPrActivityAverageInflowByTeam(prActivityWindowPoints, selectedWindowSnapshot)
            : {};
      const selectedTeam =
        selectedKey === ALL_TEAM_SCOPE_KEY
          ? buildPrCycleAllTeamsMetric(selectedWindowSnapshot, inflowByTeamKey)
          : (() => {
              const matchedTeam =
                teams.find(
                  (team) =>
                    String(team?.key || "")
                      .trim()
                      .toLowerCase() === selectedKey
                ) || teams[0];
              if (!matchedTeam) return null;
              return {
                ...matchedTeam,
                avgPrInflow: toNumber(
                  inflowByTeamKey[
                    String(matchedTeam?.key || "")
                      .trim()
                      .toLowerCase()
                  ]
                )
              };
            })();

      state.prCycleTeam = selectedKey;
      state.developmentWorkflowWindow = selectedWindowKey;
      state.prCycleWindow = selectedWindowKey;
      syncControlValue("pr-cycle-team", selectedKey);
      syncControlValue("pr-cycle-window", selectedWindowKey);
      setPanelContext(
        context,
        isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `${selectedTeam?.label || ""} • ${selectedWindowSnapshot?.windowLabel || ""} • ${toCount(selectedTeam?.issueCount)} issues sampled`,
              state.prCycle?.updatedAt
            )
      );
      renderWorkflowBreakdownCard(config.containerId, selectedTeam, selectedWindowSnapshot);
    });
  }

  function getManagementFlowScopeLabel(scope) {
    return scope === "done" ? "Completed after testing" : "In user testing";
  }

  function renderDevelopmentVsUatByFacilityChart() {
    renderDashboardChartState("management-facility", getConfig, ({ config }) => {
      const scope = normalizeOption(state.managementFlowScope, MANAGEMENT_FLOW_SCOPES, "ongoing");
      const scopeLabel = getManagementFlowScopeLabel(scope);
      const titleNode = document.getElementById("management-facility-title");
      syncControlValue("management-facility-flow-scope", scope);
      const rows = getAlignedBusinessUnitRows(scope);
      if (rows.length === 0) {
        clearPanelLead(config.panelId);
        return {
          error: `No ${scopeLabel.toLowerCase()} Business Unit chart data found in backlog-snapshot.json.`,
          clearContainer: true
        };
      }

      if (titleNode) titleNode.textContent = "User acceptance time by business unit";
      return {
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `${scopeLabel} • ${rows.reduce((sum, row) => sum + row.sampleCount, 0)} issues sampled`,
              getSnapshotContextTimestamp(state, { preferChartData: true }),
              "chart data updated"
            ),
        render: () => {
          const pretextLayout = getDashboardPretextLayout();
          if (isPretextLayoutActive() && pretextLayout) {
            clearPanelLead(config.panelId);
            const model = buildPretextManagementFacilityModel(scopeLabel, rows, scope);
            const rendered =
              pretextLayout.renderManagementAcceptancePanel?.(config.containerId, model) ||
              pretextLayout.renderPretextCard?.(config.containerId, model) ||
              pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
            if (rendered) return;
          } else {
            renderPanelLead(config.panelId, buildManagementFacilityLeadModel(scopeLabel, rows));
          }
          renderNamedChart(
            config,
            {
              containerId: config.containerId,
              rows,
              groupingLabel: "Business Unit",
              jiraBrowseBase: "https://nepgroup.atlassian.net/browse/",
              scope,
              colors: getThemeColors()
            },
            { missingMessage: "Development vs UAT chart unavailable: renderer missing." }
          );
        }
      };
    });
  }

  function summarizeContributorRows(rows) {
    return (Array.isArray(rows) ? rows : []).reduce(
      (summary, row) => ({
        totalIssues: summary.totalIssues + toCount(row?.totalIssues),
        doneIssues: summary.doneIssues + toCount(row?.doneIssues),
        activeIssues: summary.activeIssues + toCount(row?.activeIssues),
        totalContributors: summary.totalContributors + 1
      }),
      { totalIssues: 0, doneIssues: 0, activeIssues: 0, totalContributors: 0 }
    );
  }

  function buildContributorsLeadModel(rows, summary) {
    const topRow = (Array.isArray(rows) ? rows : [])[0] || null;
    if (!topRow) return null;
    return {
      summaryText: `${String(topRow?.contributor || "The top contributor").trim()} leads the community queue with ${toCount(
        topRow?.totalIssues
      )} included issues, while the wider contributor set is carrying ${toCount(
        summary?.activeIssues
      )} active issues in total.`,
      calloutLabel: "Top contributor",
      calloutValue: String(toCount(topRow?.totalIssues)),
      calloutSubtext: String(topRow?.contributor || "").trim(),
      chips: [
        `${toCount(summary?.totalContributors)} contributors`,
        `${toCount(summary?.doneIssues)} done`,
        `${toCount(summary?.activeIssues)} active`
      ],
      accentColor: "rgba(98, 153, 140, 0.22)"
    };
  }

  function buildPretextContributorsModel(rows, summary) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length === 0) return null;
    const topContributor = safeRows[0] || null;
    const totalIssues = toCount(summary?.totalIssues);
    const totalContributors = Math.max(toCount(summary?.totalContributors), safeRows.length);
    const maxTotal = Math.max(1, ...safeRows.map((row) => toCount(row?.totalIssues)));

    return {
      teamKey: "contributors",
      teamColor: "var(--team-react)",
      accentColor: "var(--team-react)",
      stats: [
        { label: "Included issues", value: `${totalIssues}` },
        {
          label: "Top contributor",
          value: String(topContributor?.contributor || "").trim() || `${totalContributors} ranked`
        },
        { label: "Active", value: `${toCount(summary?.activeIssues)}` },
        { label: "Done", value: `${toCount(summary?.doneIssues)}` }
      ],
      columnStartLabel: "Contributor",
      columnEndLabel: "Included issues",
      rows: safeRows.map((row) => ({
        label: String(row?.contributor || "").trim(),
        metaBits: [
          `${toCount(row?.doneIssues)} done`,
          toCount(row?.activeIssues) > 0 ? `${toCount(row?.activeIssues)} active` : ""
        ].filter(Boolean),
        valueText: String(toCount(row?.totalIssues)),
        width: getPretextFillWidth(row?.totalIssues, maxTotal),
        color: "var(--team-react)"
      }))
    };
  }

  function renderTopContributorsCard(containerId, rows, summary) {
    if (!containerId || !Array.isArray(rows)) return;
    const safeRows = Array.isArray(rows) ? rows : [];
    const totalIssues = toCount(summary?.totalIssues);
    const totalContributors = Math.max(toCount(summary?.totalContributors), safeRows.length);
    const maxTotal = Math.max(1, ...safeRows.map((row) => toCount(row?.totalIssues)));
    const rowsMarkup = safeRows
      .map((row) => {
        const total = toCount(row?.totalIssues);
        const done = toCount(row?.doneIssues);
        const active = toCount(row?.activeIssues);
        const width = total > 0 ? Math.max(10, Math.round((total / maxTotal) * 100)) : 0;
        return buildRowMarkup({
          rowClassName: "contributors-card__row",
          trackClassName: "contributors-card__track",
          fillClassName: "contributors-card__fill",
          label: String(row?.contributor || "").trim(),
          sampleMarkup: `done ${done}${active > 0 ? ` • active ${active}` : ""}`,
          width,
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
        <span><strong>${totalContributors} contributors ranked</strong> • ${totalIssues} included issues</span>
      </div>
    `
    });
  }

  function renderTopContributorsChart() {
    withChart("contributors", getConfig, ({ status, context, config }) => {
      const contributorsSnapshot = state.contributors;
      const rows = Array.isArray(contributorsSnapshot?.chartData?.rows)
        ? contributorsSnapshot.chartData.rows.slice().sort((left, right) => {
            const leftTotal = toNumber(left?.totalIssues);
            const rightTotal = toNumber(right?.totalIssues);
            if (rightTotal !== leftTotal) return rightTotal - leftTotal;
            const leftDone = toNumber(left?.doneIssues);
            const rightDone = toNumber(right?.doneIssues);
            if (rightDone !== leftDone) return rightDone - leftDone;
            return String(left?.contributor || "").localeCompare(String(right?.contributor || ""));
          })
        : [];
      if (rows.length === 0) {
        clearPanelLead(config.panelId);
        showPanelStatus(status, "No contributor chart data found in contributors-snapshot.json.", {
          containerId: config.containerId
        });
        return;
      }

      const displaySummary = summarizeContributorRows(rows);
      setPanelContext(context, "");
      const pretextLayout = getDashboardPretextLayout();
      if (isPretextLayoutActive() && pretextLayout) {
        clearPanelLead(config.panelId);
        const model = buildPretextContributorsModel(rows, displaySummary);
        const rendered =
          pretextLayout.renderPretextCard?.(config.containerId, model) ||
          pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
        if (rendered) return;
      } else {
        renderPanelLead(config.panelId, buildContributorsLeadModel(rows, displaySummary));
      }
      renderTopContributorsCard(config.containerId, rows, displaySummary);
    });
  }

  return {
    renderDevelopmentVsUatByFacilityChart,
    renderTopContributorsChart,
    renderWorkflowBreakdown
  };
}
