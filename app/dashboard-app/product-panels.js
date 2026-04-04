export function createProductPanels(deps) {
  const {
    state,
    constants: {
      PRODUCT_CYCLE_SCOPE,
      PRODUCT_CYCLE_SCOPE_LABEL,
      PRODUCT_CYCLE_TEAM_ORDER,
      ALL_TEAM_SCOPE_KEY,
      ALL_TEAMS_LABEL,
      LIFECYCLE_TEAM_SCOPE_DEFAULT
    },
    accessors: { getConfig },
    ui: {
      getDashboardPretextLayout,
      isPretextLayoutActive
    },
    helpers: {
      buildTeamColorMap,
      buildTintMap,
      clearChartContainer,
      clearPanelLead,
      clearPanelStats,
      formatCompactMonthYear,
      formatCompactTeamTabLabel,
      formatContextWithFreshness,
      formatCountLabel,
      getPrCycleTeamColor,
      getSnapshotContextTimestamp,
      getThemeColors,
      normalizeDisplayTeamName,
      normalizeProductCycleTeamKey,
      renderDashboardChartState,
      renderPanelLead,
      renderPanelStats,
      syncControlValue,
      toCount,
      toNumber
    },
    getDashboardCharts
  } = deps;

  function productCycleTeamKey(value) {
    return normalizeProductCycleTeamKey(value);
  }

  function orderProductCycleTeamsForDisplay(teams) {
    const rankByTeam = new Map(PRODUCT_CYCLE_TEAM_ORDER.map((team, index) => [team, index]));
    const seenKeys = new Set();
    return (Array.isArray(teams) ? teams : [])
      .map((team) => String(team || "").trim())
      .filter(Boolean)
      .filter((team) => {
        const key = productCycleTeamKey(team);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((left, right) => {
        const leftRank = rankByTeam.has(productCycleTeamKey(left))
          ? rankByTeam.get(productCycleTeamKey(left))
          : Number.MAX_SAFE_INTEGER;
        const rightRank = rankByTeam.has(productCycleTeamKey(right))
          ? rankByTeam.get(productCycleTeamKey(right))
          : Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return String(left || "").localeCompare(String(right || ""));
      });
  }

  function buildRadioChartStateResult({
    containerId,
    name,
    options,
    selectedValue,
    stateKey,
    normalizeValue,
    onChangeRender,
    contextText,
    render,
    error,
    clearContainer = false
  }) {
    if (error) {
      return clearContainer ? { error, clearContainer: true } : { error };
    }
    return {
      controlGroup: {
        containerId,
        name,
        options,
        selectedValue,
        bindings: [{ name, stateKey, normalizeValue, onChangeRender }],
        state
      },
      contextText,
      render
    };
  }

  function getPretextFillWidth(value, upperBound) {
    const safeUpper = Math.max(1, toNumber(upperBound));
    const safeValue = Math.max(0, toNumber(value));
    if (safeValue <= 0) return 0;
    return Math.max(12, Math.round((safeValue / safeUpper) * 100));
  }

  function formatCycleMonthsText(valueInDays, { short = false } = {}) {
    const months = Math.max(0, toNumber(valueInDays) / 30.4375);
    const rounded = months === 0 ? "0" : months.toFixed(1);
    const unit = Math.abs(months - 1) < 0.05 ? "month" : "months";
    if (short) return `${rounded} ${unit}`;
    return `${rounded} ${unit}`;
  }

  function normalizeCurrentStageChartData(chartSnapshotData) {
    if (!chartSnapshotData || typeof chartSnapshotData !== "object") return null;
    const rows = (Array.isArray(chartSnapshotData.rows) ? chartSnapshotData.rows : []).map(
      (row) => {
        const phaseLabel = String(row?.phaseLabel || "");
        if (phaseLabel === "Development") {
          return {
            ...row,
            phaseLabel: "In Development"
          };
        }
        if (phaseLabel === "Feedback") {
          return {
            ...row,
            phaseLabel: "UAT"
          };
        }
        return row;
      }
    );
    const teamDefs = Array.isArray(chartSnapshotData.teamDefs)
      ? chartSnapshotData.teamDefs.map((teamDef) => ({
          ...teamDef,
          name: normalizeDisplayTeamName(teamDef?.name),
          team: normalizeDisplayTeamName(teamDef?.team)
        }))
      : [];
    const rawSecondaryLabels =
      chartSnapshotData.categorySecondaryLabels &&
      typeof chartSnapshotData.categorySecondaryLabels === "object"
        ? chartSnapshotData.categorySecondaryLabels
        : {};
    const categorySecondaryLabels = { ...rawSecondaryLabels };
    if (
      Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "Development") &&
      !Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "In Development")
    ) {
      categorySecondaryLabels["In Development"] = categorySecondaryLabels.Development;
      delete categorySecondaryLabels.Development;
    }
    if (
      Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "Feedback") &&
      !Object.prototype.hasOwnProperty.call(categorySecondaryLabels, "UAT")
    ) {
      categorySecondaryLabels.UAT = categorySecondaryLabels.Feedback;
      delete categorySecondaryLabels.Feedback;
    }
    return {
      ...chartSnapshotData,
      teamDefs,
      rows,
      categorySecondaryLabels
    };
  }

  function lifecycleTeamScopeKey(value) {
    return normalizeProductCycleTeamKey(value) || LIFECYCLE_TEAM_SCOPE_DEFAULT;
  }

  function totalLifecycleSampleCount(teamDef, rows) {
    const slotKey = String(teamDef?.slot || "");
    if (!slotKey) return 0;
    return (Array.isArray(rows) ? rows : []).reduce(
      (sum, row) => sum + toCount(row?.[`meta_${slotKey}`]?.n),
      0
    );
  }

  function getLifecycleTeamOptions(normalizedChartData) {
    const rows = Array.isArray(normalizedChartData?.rows) ? normalizedChartData.rows : [];
    const teamDefs = Array.isArray(normalizedChartData?.teamDefs)
      ? normalizedChartData.teamDefs
      : [];
    const orderedTeamDefs = orderProductCycleTeamsForDisplay(
      teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean)
    )
      .map((teamName) => teamDefs.find((teamDef) => String(teamDef?.team || "") === teamName))
      .filter(Boolean);
    const options = orderedTeamDefs
      .map((teamDef) => {
        const team = String(teamDef?.team || "");
        const key = lifecycleTeamScopeKey(team);
        const sampleCount = totalLifecycleSampleCount(teamDef, rows);
        if (!team || key === "unmapped") return null;
        return {
          key,
          label: formatCompactTeamTabLabel(team),
          team,
          sampleCount
        };
      })
      .filter(Boolean);
    return [
      {
        key: LIFECYCLE_TEAM_SCOPE_DEFAULT,
        label: formatCompactTeamTabLabel("all"),
        sampleCount: 0
      },
      ...options
    ];
  }

  function buildLifecycleFilteredView(normalizedChartData, selectedTeamKey) {
    const rows = Array.isArray(normalizedChartData?.rows) ? normalizedChartData.rows : [];
    const teamDefs = Array.isArray(normalizedChartData?.teamDefs)
      ? normalizedChartData.teamDefs
      : [];
    const selectedKey = lifecycleTeamScopeKey(selectedTeamKey);
    if (selectedKey === LIFECYCLE_TEAM_SCOPE_DEFAULT) {
      const includedTeamDefs = teamDefs.filter((teamDef) => {
        const key = lifecycleTeamScopeKey(teamDef?.team);
        return key !== "unmapped" && totalLifecycleSampleCount(teamDef, rows) > 0;
      });
      const aggregateRows = rows.map((row) => {
        const totals = includedTeamDefs.reduce(
          (acc, teamDef) => {
            const slotKey = String(teamDef?.slot || "");
            const meta = row?.[`meta_${slotKey}`] || {};
            const sampleCount = toCount(meta?.n);
            const average = toNumber(meta?.average);
            if (sampleCount <= 0 || !Number.isFinite(average) || average <= 0) return acc;
            acc.weightedValue += average * sampleCount;
            acc.sampleCount += sampleCount;
            return acc;
          },
          { weightedValue: 0, sampleCount: 0 }
        );
        const average =
          totals.sampleCount > 0
            ? Number((totals.weightedValue / totals.sampleCount).toFixed(2))
            : 0;
        return {
          phaseLabel: row?.phaseLabel,
          phaseKey: row?.phaseKey,
          slot_0: average,
          meta_slot_0: {
            team: ALL_TEAMS_LABEL,
            n: totals.sampleCount,
            average
          }
        };
      });
      return {
        rows: aggregateRows,
        teamDefs: [{ slot: "slot_0", name: ALL_TEAMS_LABEL, team: ALL_TEAMS_LABEL }],
        categorySecondaryLabels: Object.fromEntries(
          aggregateRows.map((row) => [
            String(row?.phaseLabel || ""),
            `n=${toCount(row?.meta_slot_0?.n)}`
          ])
        ),
        selectionLabel: ALL_TEAMS_LABEL,
        sampleSize: aggregateRows.reduce((sum, row) => sum + toCount(row?.meta_slot_0?.n), 0)
      };
    }

    const selectedTeamDef = teamDefs.find(
      (teamDef) => lifecycleTeamScopeKey(teamDef?.team) === selectedKey
    );
    if (!selectedTeamDef) return null;
    const slotKey = String(selectedTeamDef.slot || "");
    const filteredRows = rows.map((row) => {
      const value = toNumber(row?.[slotKey]);
      const meta = row?.[`meta_${slotKey}`] || {};
      return {
        phaseLabel: row?.phaseLabel,
        phaseKey: row?.phaseKey,
        slot_0: value,
        meta_slot_0: {
          team: normalizeDisplayTeamName(selectedTeamDef.team),
          n: toCount(meta?.n),
          average: Number.isFinite(toNumber(meta?.average)) ? toNumber(meta?.average) : value
        }
      };
    });
    return {
      rows: filteredRows,
      teamDefs: [
        {
          slot: "slot_0",
          name: normalizeDisplayTeamName(selectedTeamDef.name),
          team: normalizeDisplayTeamName(selectedTeamDef.team)
        }
      ],
      categorySecondaryLabels: Object.fromEntries(
        filteredRows.map((row) => [
          String(row?.phaseLabel || ""),
          `n=${toCount(row?.meta_slot_0?.n)}`
        ])
      ),
      selectionLabel: normalizeDisplayTeamName(selectedTeamDef.team),
      sampleSize: filteredRows.reduce((sum, row) => sum + toCount(row?.meta_slot_0?.n), 0)
    };
  }

  function buildPretextLifecycleStageModel(filteredView, selectedTeamKey) {
    const safeRows = Array.isArray(filteredView?.rows) ? filteredView.rows : [];
    if (safeRows.length === 0) return null;
    const sampleSize = toCount(filteredView?.sampleSize);
    const selectionLabel = String(filteredView?.selectionLabel || "All teams").trim();
    const rankedRows = [...safeRows].sort((left, right) => {
      if (toNumber(right?.slot_0) !== toNumber(left?.slot_0)) {
        return toNumber(right?.slot_0) - toNumber(left?.slot_0);
      }
      return String(left?.phaseLabel || "").localeCompare(String(right?.phaseLabel || ""));
    });
    const lifecycleStageOrder = new Map([
      ["parking", 0],
      ["parking lot", 0],
      ["design", 1],
      ["ready", 2],
      ["development", 3],
      ["in development", 3],
      ["feedback", 4],
      ["uat", 4]
    ]);
    const displayRows = [...safeRows].sort((left, right) => {
      const leftRank = lifecycleStageOrder.get(
        String(left?.phaseLabel || "")
          .trim()
          .toLowerCase()
      );
      const rightRank = lifecycleStageOrder.get(
        String(right?.phaseLabel || "")
          .trim()
          .toLowerCase()
      );
      if (leftRank !== undefined || rightRank !== undefined) {
        return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
      }
      return String(left?.phaseLabel || "").localeCompare(String(right?.phaseLabel || ""));
    });
    const longestRow = rankedRows[0] || null;
    const maxDays = Math.max(1, ...rankedRows.map((row) => toNumber(row?.slot_0)));
    const teamKey =
      lifecycleTeamScopeKey(selectedTeamKey) === LIFECYCLE_TEAM_SCOPE_DEFAULT
        ? ALL_TEAM_SCOPE_KEY
        : lifecycleTeamScopeKey(selectedTeamKey);
    const rowColor =
      teamKey === ALL_TEAM_SCOPE_KEY ? "var(--product-cycle-cycle)" : getPrCycleTeamColor(teamKey);
    const accentColor = teamKey === ALL_TEAM_SCOPE_KEY ? "var(--product-cycle-cycle)" : rowColor;

    return {
      teamKey,
      teamColor: rowColor,
      accentColor,
      stats: [
        {
          label: "Longest hold",
          value: formatCycleMonthsText(longestRow?.slot_0, { short: true })
        },
        {
          label: "Slowest stage",
          value: String(longestRow?.phaseLabel || "").trim() || selectionLabel
        },
        { label: "Sample", value: `${sampleSize} open ideas` },
        { label: "Scope", value: selectionLabel }
      ],
      columnStartLabel: "Stage",
      columnEndLabel: "Avg time",
      footerBits: ["Current workflow"],
      rows: displayRows.map((row) => ({
        label: String(row?.phaseLabel || "").trim(),
        metaBits: [`${toCount(row?.meta_slot_0?.n)} open ideas`],
        valueText: formatCycleMonthsText(row?.slot_0, { short: true }),
        width: getPretextFillWidth(row?.slot_0, maxDays),
        color: rowColor
      }))
    };
  }

  function buildPretextProductCycleComparisonModel(
    rows,
    scopeLabel,
    cycleSampleCount,
    fetchedCount
  ) {
    const safeRows = (Array.isArray(rows) ? rows : []).filter(
      (row) => toCount(row?.meta_cycle?.n) > 0
    );
    const maxCycleDays =
      safeRows.reduce((highest, row) => Math.max(highest, toNumber(row?.cycle)), 0) || 1;
    const weightedCycleDays =
      safeRows.reduce((sum, row) => sum + toNumber(row?.cycle) * toCount(row?.meta_cycle?.n), 0) /
      Math.max(
        1,
        safeRows.reduce((sum, row) => sum + toCount(row?.meta_cycle?.n), 0)
      );
    const rankedRows = [...safeRows].sort((left, right) => {
      if (toNumber(left?.cycle) !== toNumber(right?.cycle)) {
        return toNumber(left?.cycle) - toNumber(right?.cycle);
      }
      return String(left?.team || "").localeCompare(String(right?.team || ""));
    });
    const fastestRow = rankedRows[0] || null;

    return {
      teamKey: ALL_TEAM_SCOPE_KEY,
      teamColor: getPrCycleTeamColor(ALL_TEAM_SCOPE_KEY),
      accentColor: "var(--product-cycle-cycle)",
      stats: [
        { label: "Avg delivery", value: formatCycleMonthsText(weightedCycleDays, { short: true }) },
        {
          label: "Fastest team",
          value: normalizeDisplayTeamName(fastestRow?.team || "") || "N/A"
        },
        { label: "Teams", value: `${rankedRows.length}` },
        { label: "Sample", value: `${toCount(cycleSampleCount)} ideas` }
      ],
      columnStartLabel: "Team",
      columnEndLabel: "Avg delivery",
      footerBits: [
        String(scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL).trim(),
        fetchedCount > 0 ? `${toCount(fetchedCount)} fetched ideas` : ""
      ].filter(Boolean),
      rows: rankedRows.map((row) => {
        const doneCount = toCount(row?.cycleDoneCount);
        const ongoingCount = toCount(row?.cycleOngoingCount);
        return {
          label: normalizeDisplayTeamName(row?.team || ""),
          metaBits: [
            `${toCount(row?.meta_cycle?.n)} ideas`,
            doneCount > 0 ? `${doneCount} shipped` : "",
            ongoingCount > 0 ? `${ongoingCount} ongoing` : ""
          ].filter(Boolean),
          valueText: formatCycleMonthsText(row?.cycle, { short: true }),
          width: Math.max(12, Math.round((toNumber(row?.cycle) / maxCycleDays) * 100)),
          color: getPrCycleTeamColor(row?.team)
        };
      })
    };
  }

  function buildPretextProductCycleSingleTeamModel(row, allRows, scopeLabel) {
    const cycleSample = toCount(row?.meta_cycle?.n);
    const shippedCount = toCount(row?.cycleDoneCount);
    const ongoingCount = toCount(row?.cycleOngoingCount);
    const teamColor = getPrCycleTeamColor(row?.team);
    const maxCycleDays = 5 * 30.4375;
    const maxShipped = Math.max(
      1,
      ...(Array.isArray(allRows) ? allRows : []).map((item) => toCount(item?.cycleDoneCount))
    );
    const maxOngoing = Math.max(
      1,
      ...(Array.isArray(allRows) ? allRows : []).map((item) => toCount(item?.cycleOngoingCount))
    );

    return {
      teamKey: String(row?.team || ""),
      teamColor,
      accentColor: teamColor,
      stats: [
        { label: "Delivery time", value: formatCycleMonthsText(row?.cycle, { short: true }) },
        { label: "Sample", value: `${cycleSample} ideas` },
        { label: "Shipped", value: `${shippedCount}` },
        { label: "Ongoing", value: `${ongoingCount}` }
      ],
      columnStartLabel: "Measure",
      columnEndLabel: "Current",
      footerBits: [String(scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL).trim()].filter(Boolean),
      rows: [
        {
          label: "Delivery time",
          metaBits: [`${cycleSample} ideas`],
          valueText: formatCycleMonthsText(row?.cycle, { short: true }),
          width: getPretextFillWidth(row?.cycle, maxCycleDays),
          color: teamColor
        },
        {
          label: "Shipped",
          metaBits: ["completed ideas"],
          valueText: String(shippedCount),
          width: getPretextFillWidth(shippedCount, maxShipped),
          color: teamColor
        },
        {
          label: "Ongoing",
          metaBits: ["ongoing ideas"],
          valueText: String(ongoingCount),
          width: getPretextFillWidth(ongoingCount, maxOngoing),
          color: teamColor
        }
      ]
    };
  }

  function renderLifecycleTimeSpentPerStageChartFromChartData(
    chartSnapshotData,
    {
      configKey = "product-cycle",
      teamSwitchContainerId = "product-cycle-team-switch",
      teamControlName = "product-cycle-team",
      teamStateKey = "productCycleTeam",
      normalizeTeamValue = productCycleTeamKey,
      onChangeRender = renderLeadAndCycleTimeByTeamChart
    } = {}
  ) {
    const normalizedChartData = normalizeCurrentStageChartData(chartSnapshotData);
    if (!normalizedChartData) return;
    renderDashboardChartState(configKey, getConfig, ({ config }) => {
      const lifecycleTeamOptions = getLifecycleTeamOptions(normalizedChartData);
      const validTeamKeys = new Set(lifecycleTeamOptions.map((option) => option.key));
      const selectedTeamKey = validTeamKeys.has(lifecycleTeamScopeKey(state[teamStateKey]))
        ? lifecycleTeamScopeKey(state[teamStateKey])
        : LIFECYCLE_TEAM_SCOPE_DEFAULT;
      state[teamStateKey] = selectedTeamKey;

      const filteredView = buildLifecycleFilteredView(normalizedChartData, selectedTeamKey);
      if (!filteredView) {
        clearPanelLead(config.panelId);
        return { error: "No current lifecycle stage counts found.", clearContainer: true };
      }
      const teams = orderProductCycleTeamsForDisplay(
        filteredView.teamDefs.map((teamDef) => String(teamDef?.team || "")).filter(Boolean)
      );
      const rows = Array.isArray(filteredView.rows) ? filteredView.rows : [];
      const teamDefsBase = Array.isArray(filteredView.teamDefs) ? filteredView.teamDefs : [];
      if (teams.length === 0 || teamDefsBase.length === 0) {
        clearPanelLead(config.panelId);
        return { error: "No current lifecycle stage counts found.", clearContainer: true };
      }

      const themeColors = getThemeColors();
      const lifecycleTeamColorMap =
        selectedTeamKey === LIFECYCLE_TEAM_SCOPE_DEFAULT
          ? { [ALL_TEAMS_LABEL]: themeColors.teams.all }
          : buildTeamColorMap(teams);
      const lifecycleTintByTeam = buildTintMap(lifecycleTeamColorMap, 0.02);
      const teamDefs = teamDefsBase.map((teamDef, index) => ({
        key: String(teamDef?.slot || `slot_${index}`),
        ...teamDef,
        color:
          lifecycleTeamColorMap[String(teamDef?.team || "")] ||
          buildTeamColorMap([String(teamDef?.team || "")])[String(teamDef?.team || "")] ||
          themeColors.teams.api,
        showSeriesLabel: false,
        metaTeamColorMap: lifecycleTintByTeam
      }));
      const categorySecondaryLabels =
        filteredView.categorySecondaryLabels &&
        typeof filteredView.categorySecondaryLabels === "object"
          ? filteredView.categorySecondaryLabels
          : Object.fromEntries(rows.map((row) => [String(row.phaseLabel || ""), ""]));
      const sampleSize = toCount(filteredView.sampleSize);

      return buildRadioChartStateResult({
        containerId: teamSwitchContainerId,
        name: teamControlName,
        options: lifecycleTeamOptions.map((option) => ({
          value: option.key,
          label: option.label
        })),
        selectedValue: selectedTeamKey,
        stateKey: teamStateKey,
        normalizeValue: normalizeTeamValue,
        onChangeRender,
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `${filteredView.selectionLabel} • ${sampleSize} open ideas sampled`,
              getSnapshotContextTimestamp(state),
              "generated"
            ),
        render: () => {
          const pretextLayout = getDashboardPretextLayout();
          if (isPretextLayoutActive() && pretextLayout) {
            clearPanelLead(config.panelId);
            const model = buildPretextLifecycleStageModel(filteredView, selectedTeamKey);
            const rendered =
              pretextLayout.renderPretextCard?.(config.containerId, model) ||
              pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
            if (rendered) {
              return {
                clearError: true
              };
            }
          }
          getDashboardCharts().renderLifecycleTimeSpentPerStageChart?.({
            containerId: config.containerId,
            rows,
            seriesDefs: teamDefs,
            colors: themeColors,
            categorySecondaryLabels
          });
          return {
            clearError: true
          };
        }
      });
    });
  }

  function renderLeadAndCycleTimeByTeamChartFromChartData(
    chartScopeData,
    {
      configKey = "product-cycle",
      teamSwitchContainerId = "product-cycle-team-switch",
      teamControlName = "product-cycle-team",
      teamStateKey = "productCycleTeam",
      onChangeRender = renderLeadAndCycleTimeByTeamChart
    } = {}
  ) {
    if (!chartScopeData || typeof chartScopeData !== "object") return;
    renderDashboardChartState(configKey, getConfig, ({ config }) => {
      const rows = (Array.isArray(chartScopeData.rows) ? chartScopeData.rows.slice() : [])
        .map((row) => ({
          ...row,
          team: normalizeDisplayTeamName(row?.team)
        }))
        .filter(
          (row) => !(String(row?.team || "") === "UNMAPPED" && toCount(row?.meta_cycle?.n) === 0)
        )
        .sort((left, right) => {
          const leftN = toCount(left?.meta_cycle?.n);
          const rightN = toCount(right?.meta_cycle?.n);
          if (leftN === 0 && rightN > 0) return 1;
          if (rightN === 0 && leftN > 0) return -1;
          const cycleDiff = toNumber(left?.cycle) - toNumber(right?.cycle);
          if (cycleDiff !== 0) return cycleDiff;
          return String(left?.team || "").localeCompare(String(right?.team || ""));
        });
      const teams = orderProductCycleTeamsForDisplay(
        rows.map((row) => String(row?.team || "")).filter(Boolean)
      ).filter((team) => productCycleTeamKey(team) !== "unmapped");
      if (teams.length === 0) {
        return {
          error: `No product-cycle items found for ${PRODUCT_CYCLE_SCOPE_LABEL.toLowerCase()}.`,
          clearContainer: true
        };
      }

      const fallbackCycleSampleCount = rows.reduce(
        (sum, row) => sum + toCount(row?.meta_cycle?.n),
        0
      );
      const cycleSampleCount = toCount(chartScopeData.cycleSampleCount) || fallbackCycleSampleCount;
      const sampleCount = Math.max(toCount(chartScopeData.sampleCount), cycleSampleCount);
      const fetchedCount = Math.max(
        toCount(state.productCycle?.chartData?.fetchedCount),
        toCount(state.productCycle?.fetchedCount)
      );
      const scopeLabel = String(chartScopeData.scopeLabel || PRODUCT_CYCLE_SCOPE_LABEL);

      if (sampleCount === 0) {
        return {
          error: `No product-cycle items found for ${scopeLabel.toLowerCase()}.`,
          clearContainer: true
        };
      }

      const allowedTeamKeys = ["all", ...teams.map(productCycleTeamKey)];
      const selectedTeamKey = allowedTeamKeys.includes(productCycleTeamKey(state[teamStateKey]))
        ? productCycleTeamKey(state[teamStateKey])
        : productCycleTeamKey(teams[0]);
      state[teamStateKey] = selectedTeamKey;
      const selectedRow =
        rows.find((row) => productCycleTeamKey(row?.team) === selectedTeamKey) || rows[0];
      const selectedSampleCount = toCount(selectedRow?.meta_cycle?.n);

      return buildRadioChartStateResult({
        containerId: teamSwitchContainerId,
        name: teamControlName,
        options: ["all", ...teams.map(productCycleTeamKey)].map((key) => ({
          value: key,
          label:
            key === "all"
              ? formatCompactTeamTabLabel("all")
              : formatCompactTeamTabLabel(
                  teams.find((team) => productCycleTeamKey(team) === key) || key
                )
        })),
        selectedValue: selectedTeamKey,
        stateKey: teamStateKey,
        normalizeValue: productCycleTeamKey,
        onChangeRender,
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              selectedTeamKey === "all"
                ? fetchedCount > 0
                  ? `${cycleSampleCount} ideas with delivery data from ${fetchedCount} fetched ideas`
                  : `${cycleSampleCount} ideas with delivery data`
                : fetchedCount > 0
                  ? `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${selectedSampleCount} ideas with delivery data from ${fetchedCount} fetched ideas`
                  : `${normalizeDisplayTeamName(selectedRow?.team || "")} • ${selectedSampleCount} ideas with delivery data`,
              getSnapshotContextTimestamp(state),
              "generated"
            ),
        render: () => {
          const pretextLayout = getDashboardPretextLayout();
          clearChartContainer(config.containerId);
          if (selectedTeamKey === "all") {
            if (isPretextLayoutActive() && pretextLayout) {
              const model = buildPretextProductCycleComparisonModel(
                rows,
                scopeLabel,
                cycleSampleCount,
                fetchedCount
              );
              const rendered =
                pretextLayout.renderPretextCard?.(config.containerId, model) ||
                pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
              if (rendered) return;
            }
            getDashboardCharts().renderProductCycleComparisonCard?.(
              config.containerId,
              rows,
              scopeLabel
            );
            return;
          }

          if (isPretextLayoutActive() && pretextLayout) {
            const model = buildPretextProductCycleSingleTeamModel(selectedRow, rows, scopeLabel);
            const rendered =
              pretextLayout.renderPretextCard?.(config.containerId, model) ||
              pretextLayout.renderWorkflowBreakdownCard?.(config.containerId, model);
            if (rendered) return;
          }

          getDashboardCharts().renderProductCycleSingleTeamCard?.(
            config.containerId,
            selectedRow,
            rows
          );
        }
      });
    });
  }

  function getShipmentMonthsByYear(timelineSnapshot) {
    const safeMonths = Array.isArray(timelineSnapshot?.months) ? timelineSnapshot.months : [];
    const monthsByYear = new Map();
    for (const month of safeMonths) {
      const monthKey = String(month?.monthKey || "").trim();
      const yearKey = monthKey.slice(0, 4);
      if (!/^\d{4}$/.test(yearKey)) continue;
      if (!monthsByYear.has(yearKey)) monthsByYear.set(yearKey, []);
      monthsByYear.get(yearKey).push(month);
    }
    for (const months of monthsByYear.values()) {
      months.sort((left, right) =>
        String(left?.monthKey || "").localeCompare(String(right?.monthKey || ""))
      );
    }
    return monthsByYear;
  }

  function buildShipmentTimelineLeadModel(timelineSnapshot, selectedYear, selectedMonthKey) {
    const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
    const months = monthsByYear.get(selectedYear) || [];
    const selectedMonth =
      months.find(
        (month) => String(month?.monthKey || "").trim() === String(selectedMonthKey || "").trim()
      ) ||
      months[months.length - 1] ||
      null;
    if (!selectedMonth) return null;

    const topTeam = [...(Array.isArray(selectedMonth?.teams) ? selectedMonth.teams : [])].sort(
      (left, right) => {
        if (toCount(right?.shippedCount) !== toCount(left?.shippedCount)) {
          return toCount(right?.shippedCount) - toCount(left?.shippedCount);
        }
        return String(left?.team || "").localeCompare(String(right?.team || ""));
      }
    )[0];
    const monthLabel = formatCompactMonthYear(selectedMonth?.monthKey);

    return {
      summaryText: `${monthLabel} shipped ${toCount(selectedMonth?.totalShipped)} ideas across ${toCount(
        selectedMonth?.teamCount
      )} teams, led by ${normalizeDisplayTeamName(topTeam?.team || "the busiest team")}.`,
      calloutLabel: "Shipped",
      calloutValue: String(toCount(selectedMonth?.totalShipped)),
      calloutSubtext: monthLabel,
      chips: [
        `${toCount(timelineSnapshot?.totalShipped)} shipped total`,
        `${toCount(selectedMonth?.teamCount)} teams this month`,
        topTeam ? `Top team: ${normalizeDisplayTeamName(topTeam.team)}` : ""
      ].filter(Boolean),
      accentColor: "rgba(82, 131, 94, 0.22)"
    };
  }

  function buildShipmentTimelineStatsModel(timelineSnapshot, selectedYear, selectedMonthKey) {
    const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
    const months = monthsByYear.get(selectedYear) || [];
    const selectedMonth =
      months.find(
        (month) => String(month?.monthKey || "").trim() === String(selectedMonthKey || "").trim()
      ) ||
      months[months.length - 1] ||
      null;
    if (!selectedMonth) return null;

    const topTeam = [...(Array.isArray(selectedMonth?.teams) ? selectedMonth.teams : [])].sort(
      (left, right) => {
        if (toCount(right?.shippedCount) !== toCount(left?.shippedCount)) {
          return toCount(right?.shippedCount) - toCount(left?.shippedCount);
        }
        return String(left?.team || "").localeCompare(String(right?.team || ""));
      }
    )[0];
    const monthLabel = formatCompactMonthYear(selectedMonth?.monthKey);
    const yearTotal = months.reduce((sum, month) => sum + toCount(month?.totalShipped), 0);

    return {
      accentColor: "var(--team-react)",
      stats: [
        { label: "Month", value: monthLabel || String(selectedYear || "") },
        { label: "Shipped", value: formatCountLabel(selectedMonth?.totalShipped, "idea") },
        { label: "Top team", value: normalizeDisplayTeamName(topTeam?.team || "None") },
        { label: "Year total", value: formatCountLabel(yearTotal, "idea") }
      ]
    };
  }

  function renderProductCycleShipmentsTimeline() {
    renderDashboardChartState("product-cycle-shipments", getConfig, ({ config }) => {
      const timelineSnapshot = state.productCycleShipments?.chartData?.shippedTimeline;
      const monthsByYear = getShipmentMonthsByYear(timelineSnapshot);
      const availableYears = Array.from(monthsByYear.keys()).sort((left, right) =>
        left.localeCompare(right)
      );
      if (availableYears.length === 0) {
        clearPanelLead(config.panelId);
        clearPanelStats(config.summaryId);
        return {
          error: config.missingMessage,
          clearContainer: true
        };
      }

      const selectedYear = availableYears.includes(state.productCycleShipmentsYear)
        ? state.productCycleShipmentsYear
        : availableYears[availableYears.length - 1];
      const monthsInYear = monthsByYear.get(selectedYear) || [];
      const availableMonthKeys = new Set(
        monthsInYear.map((month) => String(month?.monthKey || "").trim()).filter(Boolean)
      );
      const selectedMonthKey = availableMonthKeys.has(state.productCycleShipmentsMonthKey)
        ? state.productCycleShipmentsMonthKey
        : String(monthsInYear[monthsInYear.length - 1]?.monthKey || "").trim();

      state.productCycleShipmentsYear = selectedYear;
      state.productCycleShipmentsMonthKey = selectedMonthKey;

      return {
        contextText: isPretextLayoutActive()
          ? ""
          : formatContextWithFreshness(
              `Shipment history • ${toCount(timelineSnapshot?.totalShipped)} shipped total • ${availableYears.join(", ")}`,
              state.productCycleShipments?.generatedAt,
              "generated"
            ),
        render: () => {
          if (isPretextLayoutActive()) {
            clearPanelLead(config.panelId);
            renderPanelStats(
              config.summaryId,
              buildShipmentTimelineStatsModel(timelineSnapshot, selectedYear, selectedMonthKey)
            );
          } else {
            clearPanelStats(config.summaryId);
            renderPanelLead(
              config.panelId,
              buildShipmentTimelineLeadModel(timelineSnapshot, selectedYear, selectedMonthKey)
            );
          }
          getDashboardCharts().renderProductCycleShipmentsTimeline?.({
            containerId: config.containerId,
            timelineSnapshot,
            selectedYear,
            selectedMonthKey
          });
          const container = document.getElementById(config.containerId);
          if (container) {
            container.onclick = (event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (!target) return;
              const yearButton = target.closest("[data-shipped-year-target]");
              if (yearButton instanceof HTMLButtonElement && !yearButton.disabled) {
                state.productCycleShipmentsYear =
                  String(yearButton.dataset.shippedYearTarget || "").trim() ||
                  state.productCycleShipmentsYear;
                state.productCycleShipmentsMonthKey = "";
                renderProductCycleShipmentsTimeline();
                return;
              }
              const monthButton = target.closest("[data-shipped-month-key]");
              if (monthButton instanceof HTMLButtonElement && !monthButton.disabled) {
                state.productCycleShipmentsMonthKey =
                  String(monthButton.dataset.shippedMonthKey || "").trim() ||
                  state.productCycleShipmentsMonthKey;
                renderProductCycleShipmentsTimeline();
              }
            };
          }
          return {
            clearError: true
          };
        }
      };
    });
  }

  function renderLeadAndCycleTimeByTeamChart() {
    const viewKey = state.productDeliveryWorkflowView === "workflow" ? "workflow" : "delivery";
    state.productDeliveryWorkflowView = viewKey;
    syncControlValue("product-delivery-workflow-view", viewKey);

    const chartDataValue = state.productCycle?.chartData;
    const chartData = chartDataValue && typeof chartDataValue === "object" ? chartDataValue : null;
    if (!chartData) {
      renderDashboardChartState("product-cycle", getConfig, ({ config }) => ({
        error: config.missingMessage,
        clearContainer: true
      }));
      return;
    }

    if (viewKey === "workflow") {
      const chartSnapshotData = chartData.currentStageSnapshot;
      if (!chartSnapshotData) {
        renderDashboardChartState("product-cycle", getConfig, () => ({
          error: "No current lifecycle chart data found in product-cycle-snapshot.json.",
          clearContainer: true
        }));
        return;
      }
      renderLifecycleTimeSpentPerStageChartFromChartData(chartSnapshotData, {
        configKey: "product-cycle",
        teamSwitchContainerId: "product-cycle-team-switch",
        teamControlName: "product-cycle-team",
        teamStateKey: "productCycleTeam",
        normalizeTeamValue: productCycleTeamKey,
        onChangeRender: renderLeadAndCycleTimeByTeamChart
      });
      return;
    }

    const chartScopeData = chartData.leadCycleByScope?.[PRODUCT_CYCLE_SCOPE];
    if (!chartScopeData) {
      renderDashboardChartState("product-cycle", getConfig, () => ({
        error: `No product cycle chart data found for ${PRODUCT_CYCLE_SCOPE_LABEL}.`,
        clearContainer: true
      }));
      return;
    }

    renderLeadAndCycleTimeByTeamChartFromChartData(chartScopeData, {
      configKey: "product-cycle",
      teamSwitchContainerId: "product-cycle-team-switch",
      teamControlName: "product-cycle-team",
      teamStateKey: "productCycleTeam",
      onChangeRender: renderLeadAndCycleTimeByTeamChart
    });
  }

  return {
    orderProductCycleTeamsForDisplay,
    productCycleTeamKey,
    renderLeadAndCycleTimeByTeamChart,
    renderProductCycleShipmentsTimeline
  };
}
