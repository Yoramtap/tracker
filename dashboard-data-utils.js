"use strict";

(function initDashboardDataUtils() {
  const dashboardUiUtils = window.DashboardViewUtils;
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }

  const { toNumber } = dashboardUiUtils;
  const UAT_PRIORITY_KEYS = ["medium", "high", "highest"];
  const PRODUCT_CYCLE_TEAM_ORDER = ["api", "frontend", "broadcast", "orchestration", "titanium", "shift"];
  const LIFECYCLE_STAGE_GROUPS = [
    { keys: ["parking_lot"], label: "Parking" },
    { keys: ["design"], label: "Design" },
    { keys: ["ready_for_development"], label: "Ready" },
    { keys: ["in_development", "feedback"], label: "Development" }
  ];
  const TEAM_FALLBACK_PALETTE = [
    "#4f8fcb",
    "#c78b2e",
    "#7b63c7",
    "#2f9fb4",
    "#5e6b84",
    "#b07aa1",
    "#8a6a4a",
    "#4a758e"
  ];
  const TEAM_FALLBACK_HUES = [208, 220, 232, 244, 256, 268, 282, 36, 30, 24];
  const DASHBOARD_TEAM_BASE_COLORS = {
    api: "#4f8fcb",
    frontend: "#c78b2e",
    legacy: "#c78b2e",
    react: "#2f9fb4",
    broadcast: "#7b63c7",
    bc: "#7b63c7",
    orchestration: "#5e6b84",
    titanium: "#b07aa1",
    shift: "#8a6a4a",
    unmapped: "#4a758e"
  };

  function uatBucketWeekLabel(bucket) {
    const id = String(bucket?.id || "").trim();
    if (id === "d0_7" || id === "d8_14") return "1-2 weeks";
    if (id === "d15_30") return "1 month";
    if (id === "d31_60") return "2 months";
    if (id === "d61_plus") return "More than 2 months";
    return String(bucket?.label || id || "Unknown");
  }

  function mergePriorityFacilityBreakdown(target, sourceByPriority) {
    if (!target || typeof target !== "object") return target;
    const safeSource = sourceByPriority && typeof sourceByPriority === "object" ? sourceByPriority : {};
    const priorityLabels = { highest: "Highest", high: "High", medium: "Medium" };
    for (const priorityKey of UAT_PRIORITY_KEYS) {
      const label = priorityLabels[priorityKey] || priorityKey;
      const counts =
        safeSource?.[priorityKey]?.by_facility && typeof safeSource[priorityKey].by_facility === "object"
          ? safeSource[priorityKey].by_facility
          : {};
      for (const [facility, count] of Object.entries(counts)) {
        const facilityName = String(facility || "").trim();
        if (!facilityName) continue;
        if (!target[facilityName] || typeof target[facilityName] !== "object") {
          target[facilityName] = {};
        }
        target[facilityName][label] = toNumber(target[facilityName][label]) + toNumber(count);
      }
    }
    return target;
  }

  function toFiniteMetric(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Number(number.toFixed(2));
  }

  function toCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.trunc(number);
  }

  function readCycleWindowStats(teamNode, windowScope) {
    if (!teamNode || typeof teamNode !== "object") return {};
    const byIdeaScope = teamNode?.idea_scopes?.full_backlog;
    if (byIdeaScope && typeof byIdeaScope === "object") {
      return byIdeaScope[windowScope] || {};
    }
    if (teamNode.lead || teamNode.cycle) {
      return teamNode[windowScope] || {};
    }
    return {};
  }

  function getLifecycleWindowStats(publicAggregates, year, team, windowScope) {
    const phasesNode = publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.teams?.[team] || {};
    const phaseKeys =
      windowScope === "lead"
        ? ["parking_lot", "design", "ready_for_development", "in_development", "feedback"]
        : ["in_development", "feedback"];
    const stats = phaseKeys.map((key) => phasesNode?.[key] || {});
    const medians = stats.map((item) => Number(item?.median)).filter(Number.isFinite);
    const averages = stats.map((item) => Number(item?.average)).filter(Number.isFinite);
    const counts = stats.map((item) => Number(item?.n)).filter(Number.isFinite);
    if (medians.length === 0 && averages.length === 0) return {};
    return {
      n: counts.length ? Math.min(...counts) : 0,
      median: medians.length ? Number(medians.reduce((sum, value) => sum + value, 0).toFixed(2)) : null,
      average: averages.length ? Number(averages.reduce((sum, value) => sum + value, 0).toFixed(2)) : null
    };
  }

  function readDoneCountForTeam(publicAggregates, year, team) {
    const teamNode = publicAggregates?.cycleTime?.byYear?.[year]?.all?.teams?.[team] || {};
    const leadN = toCount(teamNode?.idea_scopes?.finished_work?.lead?.n);
    const cycleN = toCount(teamNode?.idea_scopes?.finished_work?.cycle?.n);
    return Math.max(leadN, cycleN);
  }

  function orderProductCycleTeams(teams) {
    return [...teams].sort((left, right) => {
      const a = String(left || "").toLowerCase();
      const b = String(right || "").toLowerCase();
      const ai = PRODUCT_CYCLE_TEAM_ORDER.indexOf(a);
      const bi = PRODUCT_CYCLE_TEAM_ORDER.indexOf(b);
      const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b);
    });
  }

  function readMetricStats(source) {
    const median = toFiniteMetric(source?.median);
    const average = toFiniteMetric(source?.average);
    const count = toCount(source?.n);
    return {
      value: toNumber(average),
      n: count,
      median: toNumber(median),
      average: toNumber(average)
    };
  }

  function readProductCycleTeamWindowStats(publicAggregates, year, team, windowScope) {
    const teamNode = publicAggregates?.cycleTime?.byYear?.[year]?.all?.teams?.[team] || {};
    const directStats = readCycleWindowStats(teamNode, windowScope);
    if (directStats && Object.keys(directStats).length > 0) return directStats;
    return getLifecycleWindowStats(publicAggregates, year, team, windowScope);
  }

  function buildProductCycleStackedRowsForYear({ publicAggregates, teams, year }) {
    return teams.map((team) => {
      const leadStats = readMetricStats(readProductCycleTeamWindowStats(publicAggregates, year, team, "lead"));
      const cycleStats = readMetricStats(readProductCycleTeamWindowStats(publicAggregates, year, team, "cycle"));
      return {
        team,
        lead: toNumber(leadStats.value),
        cycle: toNumber(cycleStats.value),
        meta_lead: {
          n: leadStats.n,
          median: leadStats.median,
          average: leadStats.average,
          team: "Lead time"
        },
        meta_cycle: {
          n: cycleStats.n,
          median: cycleStats.median,
          average: cycleStats.average,
          team: "Cycle time"
        }
      };
    });
  }

  function combineLifecycleStats(nodes) {
    const valid = (Array.isArray(nodes) ? nodes : []).filter((node) => node && typeof node === "object");
    if (valid.length === 0) return {};
    const weighted = valid
      .map((node) => ({
        n: toCount(node?.n),
        median: Number(node?.median),
        average: Number(node?.average)
      }))
      .filter((item) => item.n > 0);
    if (weighted.length === 0) return {};
    const totalN = weighted.reduce((sum, item) => sum + item.n, 0);
    const weightedMedian = weighted
      .filter((item) => Number.isFinite(item.median))
      .reduce((sum, item) => sum + item.median * item.n, 0);
    const weightedAverage = weighted
      .filter((item) => Number.isFinite(item.average))
      .reduce((sum, item) => sum + item.average * item.n, 0);
    return {
      n: totalN,
      median: Number.isFinite(weightedMedian) ? Number((weightedMedian / totalN).toFixed(2)) : null,
      average: Number.isFinite(weightedAverage) ? Number((weightedAverage / totalN).toFixed(2)) : null
    };
  }

  function readLifecycleStatsForYear(publicAggregates, year, team, key) {
    return (
      publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.idea_scopes?.full_backlog?.byEffort?.all?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.idea_scopes?.full_backlog?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.byEffort?.all?.teams?.[team]?.[key] ||
      publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.teams?.[team]?.[key] ||
      {}
    );
  }

  function computeLockedProductCycleStackedYUpper(publicAggregates, teams, years) {
    let maxValue = 0;
    for (const year of Array.isArray(years) ? years : []) {
      const rows = buildProductCycleStackedRowsForYear({ publicAggregates, teams, year });
      const rowMax = rows.reduce((value, row) => Math.max(value, toNumber(row?.lead), toNumber(row?.cycle)), 0);
      maxValue = Math.max(maxValue, rowMax);
    }
    return Math.max(1, Math.ceil(maxValue));
  }

  function buildLifecycleRowsByPhaseAndTeam(publicAggregates, year, teams) {
    const orderedTeams = orderProductCycleTeams(teams);
    const rows = LIFECYCLE_STAGE_GROUPS.map((stage) => {
      const stageValues = [];
      orderedTeams.forEach((team) => {
        const combinedStats = combineLifecycleStats(
          stage.keys.map((stageKey) =>
            readLifecycleStatsForYear(publicAggregates, year, team, stageKey)
          )
        );
        const stats = readMetricStats(combinedStats);
        if (stats.value > 0) {
          stageValues.push({
            team,
            value: stats.value,
            n: stats.n,
            median: stats.median,
            average: stats.average
          });
        }
      });
      const row = {
        phaseLabel: stage.label,
        phaseKey: stage.keys.join("+")
      };
      stageValues.forEach((entry, index) => {
        const slotKey = `slot_${index}`;
        row[slotKey] = entry.value;
        row[`meta_${slotKey}`] = {
          team: entry.team,
          n: entry.n,
          median: entry.median,
          average: entry.average
        };
      });
      return row;
    });
    const maxSlots = rows.reduce((max, row) => {
      const slotCount = Object.keys(row).filter((key) => key.startsWith("slot_")).length;
      return Math.max(max, slotCount);
    }, 0);
    const teamDefs = Array.from({ length: maxSlots }, (_, index) => ({
      key: `slot_${index}`,
      name: `Team ${index + 1}`
    }));
    return { teamDefs, rows };
  }

  function computeLockedLifecycleYUpper(publicAggregates, teams, years) {
    const maxValues = [];
    for (const year of Array.isArray(years) ? years : []) {
      const { teamDefs, rows } = buildLifecycleRowsByPhaseAndTeam(publicAggregates, year, teams);
      const keys = teamDefs.map((def) => def?.key).filter(Boolean);
      let maxValue = 0;
      for (const row of rows) {
        for (const key of keys) {
          const value = Number(row?.[key]);
          if (Number.isFinite(value)) maxValue = Math.max(maxValue, value);
        }
      }
      maxValues.push(maxValue);
    }
    const maxValue = Math.max(0, ...maxValues);
    return Math.max(1, Math.ceil(maxValue * 1.15));
  }

  function readFlowMetricByBands(flow, bands, key) {
    return bands.map((band) => {
      const value = flow?.[band]?.[key];
      return Number.isFinite(value) ? value : null;
    });
  }

  function getProductCycleTeamsFromAggregates(publicAggregates, configuredTeams = []) {
    const preset = Array.isArray(configuredTeams)
      ? configuredTeams.filter((team) => typeof team === "string" && team.trim())
      : [];
    if (preset.length > 0) {
      return preset.filter((team) => team !== "UNMAPPED");
    }

    const found = new Set();
    for (const yearNode of Object.values(publicAggregates?.cycleTime?.byYear || {})) {
      for (const effortNode of Object.values(yearNode || {})) {
        for (const team of Object.keys(effortNode?.teams || {})) found.add(team);
      }
    }
    for (const yearNode of Object.values(publicAggregates?.lifecyclePhaseDays?.byYear || {})) {
      for (const team of Object.keys(yearNode?.teams || {})) found.add(team);
    }

    return Array.from(found)
      .sort((left, right) => left.localeCompare(right))
      .filter((team) => team !== "UNMAPPED");
  }

  function hashTeamName(teamName) {
    const text = String(teamName || "").trim().toLowerCase();
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function hexToRgb(hex) {
    const value = String(hex || "").trim();
    const full = /^#([0-9a-f]{6})$/i.exec(value);
    if (!full) return null;
    const parsed = full[1];
    return [
      Number.parseInt(parsed.slice(0, 2), 16),
      Number.parseInt(parsed.slice(2, 4), 16),
      Number.parseInt(parsed.slice(4, 6), 16)
    ];
  }

  function blendWithWhite(hex, factor) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const clamped = Math.max(0, Math.min(1, Number(factor) || 0));
    const [r, g, b] = rgb.map((channel) => Math.round(channel + (255 - channel) * clamped));
    const toHex = (value) => value.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function resolveTeamBaseColor(teamName, index = 0) {
    const raw = String(teamName || "").trim();
    const key = raw.toLowerCase();
    if (DASHBOARD_TEAM_BASE_COLORS[key]) return DASHBOARD_TEAM_BASE_COLORS[key];
    if (key.includes("api")) return DASHBOARD_TEAM_BASE_COLORS.api;
    if (key.includes("legacy") || key.includes("frontend")) return DASHBOARD_TEAM_BASE_COLORS.frontend;
    if (key.includes("react")) return DASHBOARD_TEAM_BASE_COLORS.react;
    if (key.includes("broadcast")) return DASHBOARD_TEAM_BASE_COLORS.broadcast;
    return TEAM_FALLBACK_PALETTE[hashTeamName(raw || `team-${index}`) % TEAM_FALLBACK_PALETTE.length];
  }

  function pickUniqueTeamColor(teamName, usedColors) {
    const start = hashTeamName(teamName) % TEAM_FALLBACK_PALETTE.length;
    for (let offset = 0; offset < TEAM_FALLBACK_PALETTE.length; offset += 1) {
      const candidate = TEAM_FALLBACK_PALETTE[(start + offset) % TEAM_FALLBACK_PALETTE.length];
      if (!usedColors.has(candidate)) return candidate;
    }
    const hash = hashTeamName(teamName);
    const hue = TEAM_FALLBACK_HUES[hash % TEAM_FALLBACK_HUES.length];
    const lightness = 44 + ((hash >> 3) % 14);
    return `hsl(${hue} 38% ${lightness}%)`;
  }

  function buildTeamColorMap(teams, { ensureUnique = false } = {}) {
    if (!ensureUnique) {
      return Object.fromEntries(teams.map((team, index) => [team, resolveTeamBaseColor(team, index)]));
    }

    const colorMap = {};
    const usedColors = new Set();
    teams.forEach((team, index) => {
      let color = resolveTeamBaseColor(team, index);
      if (usedColors.has(color)) {
        color = pickUniqueTeamColor(team, usedColors);
        if (usedColors.has(color)) {
          color = pickUniqueTeamColor(`${team}-unique`, usedColors);
        }
      }
      colorMap[team] = color;
      usedColors.add(color);
    });
    return colorMap;
  }

  function buildTintMap(teamColorMap, factor) {
    return Object.fromEntries(
      Object.entries(teamColorMap).map(([team, color]) => [team, blendWithWhite(color, factor)])
    );
  }

  window.DashboardDataUtils = {
    buildLifecycleRowsByPhaseAndTeam,
    buildProductCycleStackedRowsForYear,
    buildTeamColorMap,
    buildTintMap,
    computeLockedLifecycleYUpper,
    computeLockedProductCycleStackedYUpper,
    getProductCycleTeamsFromAggregates,
    mergePriorityFacilityBreakdown,
    orderProductCycleTeams,
    readDoneCountForTeam,
    readFlowMetricByBands,
    toCount,
    uatBucketWeekLabel
  };
})();
