"use strict";

const PRIORITY_CONFIG = [
  { key: "highest", label: "Highest" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "lowest", label: "Lowest" }
];

const SPRINT_GOALS_LOOKBACK = 6;
const SPRINT_GOALS_TEAMS = [
  "API",
  "Frontend",
  "Broadcast",
  "Titanium",
  "Orchestration",
  "Shift"
];
const PRODUCT_CYCLE_COMPARE_YEARS = ["2025", "2026"];
const PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS = ["all", "single", "combined"];
const LIFECYCLE_YEAR_OPTIONS = ["2025", "2026"];
const PRODUCT_CYCLE_PHASES = [
  {
    key: "parking_lot",
    label: "Parking lot",
    color: "var(--uat-bucket-0-7)"
  },
  {
    key: "design",
    label: "Design",
    color: "var(--uat-bucket-8-14)"
  },
  {
    key: "ready_for_development",
    label: "Ready",
    color: "var(--uat-bucket-15-30)"
  },
  {
    key: "in_development",
    label: "In Development",
    color: "var(--uat-bucket-31-60)"
  },
  {
    key: "feedback",
    label: "Feedback",
    color: "var(--uat-bucket-61-plus)"
  }
];

const state = {
  snapshot: null,
  sprintGoals: null,
  productCycle: null,
  mode: "all",
  managementUatScope: "all",
  compositionTeamScope: "bc",
  sprintGoalsTeamScope: "API",
  productCycleEffortScope: "all",
  productCycleMetricScope: "median",
  lifecycleDaysYearScope: "2026",
  lifecycleDaysMetricScope: "median"
};

function formatUpdatedAt(value) {
  const parsed = new Date(String(value || ""));
  if (!Number.isFinite(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function setLastUpdatedSubtitles(snapshot) {
  const label = `Last updated: ${formatUpdatedAt(snapshot?.updatedAt)}`;
  for (const id of [
    "trend-updated",
    "composition-updated",
    "uat-updated",
    "sprint-goals-updated",
    "product-cycle-updated",
    "lifecycle-days-updated"
  ]) {
    const node = document.getElementById(id);
    if (node) node.textContent = label;
  }

  const managementNode = document.getElementById("management-updated");
  if (managementNode) {
    managementNode.textContent = label;
  }
}

function setProductCycleUpdatedSubtitles(productCycle, fallbackUpdatedAt = "") {
  const label = `Last updated: ${formatUpdatedAt(productCycle?.generatedAt || fallbackUpdatedAt)}`;
  for (const id of ["product-cycle-updated", "lifecycle-days-updated"]) {
    const node = document.getElementById(id);
    if (node) node.textContent = label;
  }
}

function readThemeColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function getThemeColors() {
  return {
    text: readThemeColor("--text", "#172b4d"),
    grid: readThemeColor("--chart-grid", "rgba(9,30,66,0.14)"),
    active: readThemeColor("--chart-active", "#0c66e4"),
    teams: {
      api: readThemeColor("--team-api", "#2f6ea8"),
      legacy: readThemeColor("--team-legacy", "#8d6f3f"),
      react: readThemeColor("--team-react", "#3f7f75"),
      bc: readThemeColor("--team-bc", "#76649a")
    },
    priorities: {
      highest: readThemeColor("--priority-highest", "#9f4d44"),
      high: readThemeColor("--priority-high", "#b48238"),
      medium: readThemeColor("--priority-medium", "#6f778d"),
      low: readThemeColor("--priority-low", "#3f73b8"),
      lowest: readThemeColor("--priority-lowest", "#2f7a67")
    },
    uatBuckets: {
      d0_7: readThemeColor("--uat-bucket-0-7", "#a8c6de"),
      d8_14: readThemeColor("--uat-bucket-8-14", "#87aecd"),
      d15_30: readThemeColor("--uat-bucket-15-30", "#5f8fb7"),
      d31_60: readThemeColor("--uat-bucket-31-60", "#3f6f99"),
      d61_plus: readThemeColor("--uat-bucket-61-plus", "#2a4f73")
    },
    tooltip: {
      bg: readThemeColor("--tooltip-bg", "rgba(255,255,255,0.98)"),
      border: readThemeColor("--tooltip-border", "rgba(31,51,71,0.25)"),
      text: readThemeColor("--tooltip-text", "#1f3347")
    },
    barBorder: readThemeColor("--bar-border", "rgba(25,39,58,0.35)")
  };
}

function clearChartContainer(containerId) {
  if (window.BugChartsRecharts?.clearChart) {
    window.BugChartsRecharts.clearChart({ containerId });
    return;
  }
  const root = document.getElementById(containerId);
  if (root) root.innerHTML = "";
}

function getModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const chart = (params.get("chart") || "").toLowerCase();
  if (chart === "trend") return "trend";
  if (chart === "composition") return "composition";
  if (chart === "uat") return "uat";
  if (chart === "dev-uat-ratio") return "management";
  if (chart === "sprint-goals") return "sprint-goals";
  if (chart === "product-cycle" || chart === "cycle-time") return "product-cycle";
  if (chart === "lifecycle-days") return "lifecycle-days";
  return "all";
}

function applyModeVisibility() {
  const trendPanel = document.getElementById("trend-panel");
  const compositionPanel = document.getElementById("composition-panel");
  const uatPanel = document.getElementById("uat-panel");
  const managementPanel = document.getElementById("management-panel");
  const sprintGoalsPanel = document.getElementById("sprint-goals-panel");
  const productCyclePanel = document.getElementById("product-cycle-panel");
  const lifecycleDaysPanel = document.getElementById("lifecycle-days-panel");
  if (
    !trendPanel ||
    !compositionPanel ||
    !uatPanel ||
    !managementPanel ||
    !sprintGoalsPanel ||
    !productCyclePanel ||
    !lifecycleDaysPanel
  )
    return;

  if (state.mode === "trend") {
    trendPanel.hidden = false;
    compositionPanel.hidden = true;
    uatPanel.hidden = true;
    managementPanel.hidden = true;
    sprintGoalsPanel.hidden = true;
    productCyclePanel.hidden = true;
    lifecycleDaysPanel.hidden = true;
    return;
  }

  if (state.mode === "composition") {
    trendPanel.hidden = true;
    compositionPanel.hidden = false;
    uatPanel.hidden = true;
    managementPanel.hidden = true;
    sprintGoalsPanel.hidden = true;
    productCyclePanel.hidden = true;
    lifecycleDaysPanel.hidden = true;
    return;
  }

  if (state.mode === "uat") {
    trendPanel.hidden = true;
    compositionPanel.hidden = true;
    uatPanel.hidden = false;
    managementPanel.hidden = true;
    sprintGoalsPanel.hidden = true;
    productCyclePanel.hidden = true;
    lifecycleDaysPanel.hidden = true;
    return;
  }

  if (state.mode === "management") {
    trendPanel.hidden = true;
    compositionPanel.hidden = true;
    uatPanel.hidden = true;
    managementPanel.hidden = false;
    sprintGoalsPanel.hidden = true;
    productCyclePanel.hidden = true;
    lifecycleDaysPanel.hidden = true;
    return;
  }

  if (state.mode === "sprint-goals") {
    trendPanel.hidden = true;
    compositionPanel.hidden = true;
    uatPanel.hidden = true;
    managementPanel.hidden = true;
    sprintGoalsPanel.hidden = false;
    productCyclePanel.hidden = true;
    lifecycleDaysPanel.hidden = true;
    return;
  }

  if (state.mode === "product-cycle") {
    trendPanel.hidden = true;
    compositionPanel.hidden = true;
    uatPanel.hidden = true;
    managementPanel.hidden = true;
    sprintGoalsPanel.hidden = true;
    productCyclePanel.hidden = false;
    lifecycleDaysPanel.hidden = true;
    return;
  }

  if (state.mode === "lifecycle-days") {
    trendPanel.hidden = true;
    compositionPanel.hidden = true;
    uatPanel.hidden = true;
    managementPanel.hidden = true;
    sprintGoalsPanel.hidden = true;
    productCyclePanel.hidden = true;
    lifecycleDaysPanel.hidden = false;
    return;
  }

  trendPanel.hidden = false;
  compositionPanel.hidden = false;
  uatPanel.hidden = false;
  managementPanel.hidden = false;
  sprintGoalsPanel.hidden = false;
  productCyclePanel.hidden = false;
  lifecycleDaysPanel.hidden = false;
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatDateShort(date) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${month}/${day}`;
}

function renderLineChart() {
  const trendStatus = document.getElementById("trend-status");
  if (trendStatus) trendStatus.hidden = true;
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  if (!window.BugChartsRecharts?.renderTrendChart) {
    if (trendStatus) {
      trendStatus.hidden = false;
      trendStatus.textContent =
        "Trend chart unavailable: Recharts did not load. Check local script paths.";
    }
    return;
  }

  window.BugChartsRecharts.renderTrendChart({
    containerId: "chart",
    snapshot: state.snapshot,
    colors: getThemeColors()
  });
}

function renderStackedBarChart() {
  const status = document.getElementById("status");
  if (status) status.hidden = true;
  if (!state.snapshot || !Array.isArray(state.snapshot.combinedPoints)) return;
  if (!window.BugChartsRecharts?.renderCompositionChart) {
    if (status) {
      status.hidden = false;
      status.textContent =
        "Composition chart unavailable: Recharts did not load. Check local script paths.";
    }
    return;
  }

  const scopeSelect = document.getElementById("composition-team-scope");
  const scope = state.compositionTeamScope || "bc";
  if (scopeSelect) scopeSelect.value = scope;

  window.BugChartsRecharts.renderCompositionChart({
    containerId: "stacked-chart",
    snapshot: state.snapshot,
    colors: getThemeColors(),
    scope
  });
}

function renderTrendChartPreferred() {
  renderLineChart();
}

function renderCompositionChartPreferred() {
  renderStackedBarChart();
}

function renderUatAgingChart() {
  const status = document.getElementById("uat-status");
  const root = document.getElementById("uat-chart");
  const context = document.getElementById("uat-context");
  if (!status || !root) return;

  status.hidden = true;
  if (!state.snapshot || !state.snapshot.uatAging) {
    status.hidden = false;
    status.textContent = "No UAT aging data found in snapshot.json.";
    return;
  }

  const uat = state.snapshot.uatAging;
  const scopeLabel = String(uat?.scope?.label || "Broadcast");
  if (context) context.textContent = `${scopeLabel}, ${toNumber(uat.totalIssues)} currently in UAT`;
  const allPriorities = PRIORITY_CONFIG.map((priority) => priority.key);
  const buckets = Array.isArray(uat.buckets) ? uat.buckets : [];
  const priorities = allPriorities.filter((priority) =>
    buckets.some((bucket) => toNumber(uat?.priorities?.[priority]?.buckets?.[bucket.id]) > 0)
  );

  if (buckets.length === 0) {
    status.hidden = false;
    status.textContent = "UAT aging buckets are missing from snapshot.json.";
    return;
  }

  const chartRows = buckets.map((bucket) => {
    const row = { bucketLabel: bucket.label, total: 0 };
    for (const priority of priorities) {
      const value = toNumber(uat?.priorities?.[priority]?.buckets?.[bucket.id]);
      row[priority] = value;
      row.total += value;
    }
    return row;
  });

  if (!window.BugChartsRecharts?.renderUatAgingChart) return;
  window.BugChartsRecharts.renderUatAgingChart({
    containerId: "uat-chart",
    rows: chartRows,
    priorities,
    colors: getThemeColors()
  });
}

function bindCompositionTeamScopeToggle() {
  const scopeSelect = document.getElementById("composition-team-scope");
  if (!scopeSelect || scopeSelect.dataset.bound === "1") return;

  scopeSelect.dataset.bound = "1";
  scopeSelect.addEventListener("change", () => {
    state.compositionTeamScope = scopeSelect.value || "bc";
    renderCompositionChartPreferred();
  });
}

function computeMedian(values) {
  const list = (values || [])
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (list.length === 0) return null;
  const mid = Math.floor(list.length / 2);
  if (list.length % 2 === 1) return Number(list[mid].toFixed(2));
  return Number(((list[mid - 1] + list[mid]) / 2).toFixed(2));
}

function computeAverage(values) {
  const list = (values || []).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (list.length === 0) return null;
  const sum = list.reduce((acc, value) => acc + value, 0);
  return Number((sum / list.length).toFixed(2));
}

function diffDaysFromIso(startIso, endIso) {
  const startAt = new Date(String(startIso || "")).getTime();
  const endAt = new Date(String(endIso || "")).getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt < startAt) return null;
  return Number(((endAt - startAt) / (24 * 60 * 60 * 1000)).toFixed(2));
}

function getParkingLotExitAt(idea) {
  const events = Array.isArray(idea?.lifecycle_events) ? idea.lifecycle_events : [];
  for (const event of events) {
    const fromStage = String(event?.from_stage || "").trim();
    const toStage = String(event?.to_stage || "").trim();
    const at = String(event?.at || "").trim();
    if (fromStage !== "parking_lot") continue;
    if (!toStage || toStage === "parking_lot") continue;
    if (at) return at;
  }
  return String(idea?.entered_parking_lot || "").trim();
}

function computeLifecyclePhaseSpentDays(idea) {
  const phaseKeys = new Set(PRODUCT_CYCLE_PHASES.map((phase) => phase.key));
  const totals = Object.fromEntries(PRODUCT_CYCLE_PHASES.map((phase) => [phase.key, 0]));
  const events = (Array.isArray(idea?.lifecycle_events) ? idea.lifecycle_events : [])
    .filter((event) => event && event.at)
    .slice()
    .sort((a, b) => new Date(String(a.at)).getTime() - new Date(String(b.at)).getTime());

  if (events.length === 0) return totals;

  let currentStage = "";
  let currentAt = "";
  const first = events[0];
  if (phaseKeys.has(String(first?.from_stage || ""))) {
    currentStage = String(first.from_stage);
    currentAt = String(first.at || "");
  } else if (phaseKeys.has(String(first?.to_stage || ""))) {
    currentStage = String(first.to_stage);
    currentAt = String(first.at || "");
  }

  for (const event of events) {
    const eventAt = String(event?.at || "");
    const delta = diffDaysFromIso(currentAt, eventAt);
    if (currentStage && phaseKeys.has(currentStage) && typeof delta === "number") {
      totals[currentStage] += delta;
    }

    const nextStage = String(event?.to_stage || "");
    if (nextStage) {
      currentStage = nextStage;
      currentAt = eventAt;
      continue;
    }
    currentAt = eventAt;
  }

  const doneAt = String(idea?.entered_done || "");
  const tailDelta = diffDaysFromIso(currentAt, doneAt);
  if (currentStage && phaseKeys.has(currentStage) && typeof tailDelta === "number") {
    totals[currentStage] += tailDelta;
  }

  for (const key of Object.keys(totals)) {
    totals[key] = Number(totals[key].toFixed(2));
  }
  return totals;
}

function isoYear(value) {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(String(value || ""));
  return match ? match[1] : "";
}

function inferIdeaYear(idea) {
  for (const key of [
    "entered_done",
    "sfd_start",
    "entered_parking_lot",
    "entered_design",
    "entered_ready_for_development",
    "entered_in_development"
  ]) {
    const year = isoYear(idea?.[key]);
    if (year) return year;
  }
  const firstEventAt = Array.isArray(idea?.lifecycle_events) ? idea.lifecycle_events[0]?.at : "";
  return isoYear(firstEventAt);
}

function getProductCycleIdeas() {
  return Array.isArray(state.productCycle?.ideas) ? state.productCycle.ideas : [];
}

function getProductCyclePublicAggregates() {
  const value = state.productCycle?.publicAggregates;
  return value && typeof value === "object" ? value : null;
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

function getProductCycleTeamsFromAggregates(publicAggregates) {
  const configured = Array.isArray(state.productCycle?.teams)
    ? state.productCycle.teams.filter((team) => typeof team === "string" && team.trim())
    : [];
  if (configured.length > 0) return configured;

  const found = new Set();
  const cycleByYear = publicAggregates?.cycleTime?.byYear;
  if (cycleByYear && typeof cycleByYear === "object") {
    for (const yearNode of Object.values(cycleByYear)) {
      if (!yearNode || typeof yearNode !== "object") continue;
      for (const effortNode of Object.values(yearNode)) {
        const teamsNode = effortNode?.teams;
        if (!teamsNode || typeof teamsNode !== "object") continue;
        for (const team of Object.keys(teamsNode)) found.add(team);
      }
    }
  }
  const lifecycleByYear = publicAggregates?.lifecyclePhaseDays?.byYear;
  if (lifecycleByYear && typeof lifecycleByYear === "object") {
    for (const yearNode of Object.values(lifecycleByYear)) {
      const teamsNode = yearNode?.teams;
      if (!teamsNode || typeof teamsNode !== "object") continue;
      for (const team of Object.keys(teamsNode)) found.add(team);
    }
  }

  const ordered = Array.from(found).sort((a, b) => a.localeCompare(b));
  if (ordered.includes("UNMAPPED")) {
    return ordered.filter((team) => team !== "UNMAPPED").concat("UNMAPPED");
  }
  return ordered;
}

function getCycleTeams(ideas) {
  const configured = Array.isArray(state.productCycle?.teams)
    ? state.productCycle.teams.filter((team) => typeof team === "string" && team.trim())
    : [];
  const teamSet = new Set(configured);
  const hasUnmapped = ideas.some((idea) => {
    const team = String(idea?.primary_team || "").trim();
    return !team || !teamSet.has(team);
  });
  return hasUnmapped ? [...configured, "UNMAPPED"] : configured;
}

function bucketTeamName(primaryTeam, teamSet) {
  const team = String(primaryTeam || "").trim();
  if (team && teamSet.has(team)) return team;
  return "UNMAPPED";
}

function countIdeaKnownTeams(idea, teamSet) {
  const known = new Set();
  const teamList = Array.isArray(idea?.teams) ? idea.teams : [];
  for (const team of teamList) {
    const normalized = String(team || "").trim();
    if (normalized && teamSet.has(normalized)) known.add(normalized);
  }
  if (known.size > 0) return known.size;

  const primary = String(idea?.primary_team || "").trim();
  if (primary && teamSet.has(primary)) return 1;
  return 0;
}

function matchesEffortScope(idea, effortScope, teamSet) {
  const count = countIdeaKnownTeams(idea, teamSet);
  if (effortScope === "combined") return count >= 2;
  if (effortScope === "single") return count <= 1;
  return true;
}

function getIdeaKnownTeams(idea, teamSet) {
  const known = [];
  const seen = new Set();
  const teamList = Array.isArray(idea?.teams) ? idea.teams : [];
  for (const team of teamList) {
    const normalized = String(team || "").trim();
    if (!normalized || !teamSet.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    known.push(normalized);
  }
  return known;
}

function getIdeaContributionTeams(idea, mappedTeamSet, knownTeamSet, effortScope) {
  const knownTeams = getIdeaKnownTeams(idea, knownTeamSet).filter((team) => mappedTeamSet.has(team));
  if (effortScope === "combined" && knownTeams.length >= 2) {
    return knownTeams;
  }
  if (knownTeams.length === 1) {
    return knownTeams;
  }
  return [bucketTeamName(idea?.primary_team, mappedTeamSet)];
}

function hexToRgb(color) {
  const raw = String(color || "").trim();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split("").map((ch) => Number.parseInt(ch + ch, 16));
    return { r, g, b };
  }
  const full = /^#([0-9a-f]{6})$/i.exec(raw);
  if (full) {
    const hex = full[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16)
    };
  }
  return null;
}

function shadeColor(color, amount) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp(Math.round(rgb.r + amount));
  const g = clamp(Math.round(rgb.g + amount));
  const b = clamp(Math.round(rgb.b + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function cycleTeamBaseColor(themeColors, teamName) {
  if (teamName === "API") return themeColors.teams.api;
  if (teamName === "Frontend") return themeColors.teams.react;
  if (teamName === "Broadcast") return themeColors.teams.bc;
  if (teamName === "UNMAPPED") return readThemeColor("--mgmt-dev", "#98a3af");
  return themeColors.teams.legacy;
}

function cycleYearTeamColor(themeColors, teamName, year) {
  const base = cycleTeamBaseColor(themeColors, teamName);
  if (year === "2026") return shadeColor(base, -20);
  return base;
}

function bindManagementUatScopeToggle() {
  const scopeSelect = document.getElementById("management-uat-scope");
  if (!scopeSelect || scopeSelect.dataset.bound === "1") return;

  scopeSelect.dataset.bound = "1";
  scopeSelect.addEventListener("change", () => {
    state.managementUatScope = scopeSelect.value === "bugs_only" ? "bugs_only" : "all";
    renderManagementChart();
  });
}

function normalizeSprintGoals(sprintGoalsDoc) {
  const sprints = Array.isArray(sprintGoalsDoc?.sprints) ? sprintGoalsDoc.sprints : [];
  return sprints
    .filter((sprint) => /^\d{4}-\d{2}-\d{2}$/.test(String(sprint?.sprint_start || "")))
    .sort((a, b) => String(a.sprint_start || "").localeCompare(String(b.sprint_start || "")));
}

function bindSprintGoalsTeamScopeToggle() {
  const scopeSelect = document.getElementById("sprint-goals-team-scope");
  if (!scopeSelect || scopeSelect.dataset.bound === "1") return;
  scopeSelect.dataset.bound = "1";
  scopeSelect.addEventListener("change", () => {
    state.sprintGoalsTeamScope = scopeSelect.value || "API";
    renderSprintGoalsChart();
  });
}

function renderSprintGoalsChart() {
  const status = document.getElementById("sprint-goals-status");
  const root = document.getElementById("sprint-goals-chart");
  const context = document.getElementById("sprint-goals-context");
  const scopeSelect = document.getElementById("sprint-goals-team-scope");
  if (!status || !root || !context) return;

  status.hidden = true;
  if (!state.sprintGoals || typeof state.sprintGoals !== "object") {
    status.hidden = false;
    status.textContent = "No sprint goals data found in data/manual/sprint-goals.json.";
    return;
  }

  const team = SPRINT_GOALS_TEAMS.includes(state.sprintGoalsTeamScope)
    ? state.sprintGoalsTeamScope
    : "API";
  if (scopeSelect) scopeSelect.value = team;

  const sprints = normalizeSprintGoals(state.sprintGoals);
  const recent = sprints.slice(-SPRINT_GOALS_LOOKBACK);
  if (recent.length === 0) {
    status.hidden = false;
    status.textContent = "No valid sprint rows found in sprint-goals.json.";
    return;
  }

  const x = recent.map((sprint) => sprint.sprint_start);
  const xShort = recent.map((sprint) => formatDateShort(sprint.sprint_start));
  const totals = [];
  const passed = [];
  const successRatePct = [];

  for (const sprint of recent) {
    const teams = Array.isArray(sprint.teams) ? sprint.teams : [];
    const row = teams.find((entry) => String(entry?.team || "") === team) || {};
    const total = toNumber(row.goals_total);
    const ok = toNumber(row.goals_passed);
    totals.push(total);
    passed.push(ok);
    successRatePct.push(total > 0 ? (ok / total) * 100 : 0);
  }

  if (!window.BugChartsRecharts?.renderSprintGoalsChart) {
    status.hidden = false;
    status.textContent = "Sprint goals chart unavailable: Recharts renderer missing.";
    return;
  }
  const rows = recent.map((_, index) => ({
    date: x[index],
    dateShort: xShort[index],
    goalsTotal: totals[index],
    goalsPassed: passed[index],
    successRate: successRatePct[index]
  }));
  window.BugChartsRecharts.renderSprintGoalsChart({
    containerId: "sprint-goals-chart",
    rows,
    colors: getThemeColors()
  });

  context.textContent = `${team}, last ${recent.length} sprints`;
}

function bindProductCycleControls() {
  const effortSelect = document.getElementById("product-cycle-effort-scope");
  const metricSelect = document.getElementById("product-cycle-metric-scope");
  if (!effortSelect || !metricSelect || effortSelect.dataset.bound === "1") return;

  effortSelect.dataset.bound = "1";
  metricSelect.dataset.bound = "1";

  effortSelect.addEventListener("change", () => {
    state.productCycleEffortScope = PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS.includes(effortSelect.value)
      ? effortSelect.value
      : "all";
    renderProductCycleChart();
  });

  metricSelect.addEventListener("change", () => {
    state.productCycleMetricScope = metricSelect.value === "average" ? "average" : "median";
    renderProductCycleChart();
  });
}

function bindLifecycleDaysControls() {
  const yearSelect = document.getElementById("lifecycle-days-year-scope");
  const metricSelect = document.getElementById("lifecycle-days-metric-scope");
  if (!yearSelect || !metricSelect || yearSelect.dataset.bound === "1") return;

  yearSelect.dataset.bound = "1";
  metricSelect.dataset.bound = "1";

  yearSelect.addEventListener("change", () => {
    state.lifecycleDaysYearScope = LIFECYCLE_YEAR_OPTIONS.includes(yearSelect.value)
      ? yearSelect.value
      : "2026";
    renderLifecycleDaysChart();
  });

  metricSelect.addEventListener("change", () => {
    state.lifecycleDaysMetricScope = metricSelect.value === "average" ? "average" : "median";
    renderLifecycleDaysChart();
  });
}

function setProductCycleTotalsText(text) {
  const totals = document.getElementById("product-cycle-totals");
  if (!totals) return;
  const value = String(text || "").trim();
  if (!value) {
    totals.hidden = true;
    totals.textContent = "";
    return;
  }
  totals.hidden = false;
  totals.textContent = value;
}

function renderProductCycleChartFromPublicAggregates(publicAggregates, effortScope, metric) {
  const status = document.getElementById("product-cycle-status");
  const context = document.getElementById("product-cycle-context");
  if (!status || !context) return;
  setProductCycleTotalsText("");

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No product cycle aggregates found in product-cycle-times.json.";
    return;
  }

  const metricLabel = metric === "average" ? "Average" : "Median";
  const yearsToShow = PRODUCT_CYCLE_COMPARE_YEARS;
  const perYear = yearsToShow.map((year) => {
    const teamNodes = publicAggregates?.cycleTime?.byYear?.[year]?.[effortScope]?.teams || {};
    const totalsNode = publicAggregates?.cycleTime?.totalsByYear?.[year]?.[effortScope] || {};
    const teamStats = teams.map((team) => {
      const row = teamNodes?.[team] || {};
      const median = toFiniteMetric(row.median);
      const average = toFiniteMetric(row.average);
      const metricValue = metric === "average" ? average : median;
      return {
        team,
        n: toCount(row.n),
        median,
        average,
        metric: metricValue
      };
    });
    return {
      year,
      ideasInYearCount: toCount(totalsNode.total),
      doneInYearCount: toCount(totalsNode.done),
      openAtYearEnd: toCount(totalsNode.ongoing_year_end),
      openNow: toCount(totalsNode.ongoing_now),
      cycleRowsCount: toCount(totalsNode.cycle_sample),
      teamStats
    };
  });

  const totalIdeasCombined = perYear.reduce((sum, entry) => sum + entry.ideasInYearCount, 0);
  const totalCycleSample = perYear.reduce((sum, entry) => sum + entry.cycleRowsCount, 0);
  const contextText = `Total ideas (2025+2026): ${totalIdeasCombined} • cycle sample: ${totalCycleSample}`;
  context.textContent = contextText;

  if (perYear.every((entry) => entry.cycleRowsCount === 0)) {
    status.hidden = false;
    status.textContent = `No completed Parking lot exit -> Done items found for ${yearsToShow.join(", ")}.`;
    clearChartContainer("product-cycle-chart");
    return;
  }

  const themeColors = getThemeColors();
  const seriesDefs = perYear.map((entry, index) => ({
    key: `year_${entry.year}`,
    name: String(entry.year),
    color: index % 2 === 0 ? themeColors.teams.api : themeColors.teams.bc
  }));
  const rows = teams.map((team) => {
    const row = { team };
    for (const entry of perYear) {
      const key = `year_${entry.year}`;
      const stat = entry.teamStats.find((item) => item.team === team) || {};
      const metricValue =
        typeof stat.metric === "number" && Number.isFinite(stat.metric) ? stat.metric : 0;
      row[key] = metricValue;
      row[`meta_${key}`] = {
        n: toNumber(stat.n),
        median: toFiniteMetric(stat.median) || 0,
        average: toFiniteMetric(stat.average) || 0
      };
      row[`color_${key}`] = cycleYearTeamColor(themeColors, team, entry.year);
    }
    return row;
  });

  if (!window.BugChartsRecharts?.renderProductCycleChart) {
    status.hidden = false;
    status.textContent = "Product cycle chart unavailable: Recharts renderer missing.";
    return;
  }
  window.BugChartsRecharts.renderProductCycleChart({
    containerId: "product-cycle-chart",
    rows,
    seriesDefs,
    colors: themeColors,
    metricLabel
  });
  setProductCycleTotalsText("");

  const yearsWithoutCycles = perYear
    .filter((entry) => entry.cycleRowsCount === 0)
    .map((entry) => entry.year);
  if (yearsWithoutCycles.length > 0) {
    status.hidden = false;
    status.textContent = `No completed Parking lot exit -> Done items found for ${yearsWithoutCycles.join(", ")}; showing other year(s).`;
  }
}

function renderLifecycleDaysChartFromPublicAggregates(publicAggregates, year, metric) {
  const status = document.getElementById("lifecycle-days-status");
  const context = document.getElementById("lifecycle-days-context");
  if (!status || !context) return;

  const teams = getProductCycleTeamsFromAggregates(publicAggregates);
  if (teams.length === 0) {
    status.hidden = false;
    status.textContent = "No lifecycle aggregates found in product-cycle-times.json.";
    return;
  }

  const metricLabel = metric === "average" ? "Average" : "Median";
  const chartTitleText = `Lifecycle time spent per phase (${metricLabel})`;

  const themeColors = getThemeColors();
  const phaseColors = [
    themeColors.uatBuckets.d0_7,
    themeColors.uatBuckets.d8_14,
    themeColors.uatBuckets.d15_30,
    themeColors.uatBuckets.d31_60,
    themeColors.uatBuckets.d61_plus
  ];
  const phaseDefs = PRODUCT_CYCLE_PHASES.map((phase, phaseIndex) => ({
    key: phase.key,
    label: phase.label,
    color: phaseColors[phaseIndex] || themeColors.teams.legacy
  }));
  const rows = teams.map((team) => {
    const row = { team };
    for (const phase of PRODUCT_CYCLE_PHASES) {
      const source =
        publicAggregates?.lifecyclePhaseDays?.byYear?.[year]?.teams?.[team]?.[phase.key] || {};
      const median = toFiniteMetric(source.median);
      const average = toFiniteMetric(source.average);
      const metricValue = metric === "average" ? average : median;
      row[phase.key] =
        typeof metricValue === "number" && Number.isFinite(metricValue) ? metricValue : 0;
      row[`meta_${phase.key}`] = {
        n: toCount(source.n),
        median: median || 0,
        average: average || 0
      };
    }
    return row;
  });
  const plottedValues = phaseDefs
    .flatMap((phase) => rows.map((row) => row[phase.key]))
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);

  const totalsNode = publicAggregates?.lifecyclePhaseDays?.totalsByYear?.[year] || {};
  const doneCount = toCount(totalsNode.done);
  const ongoingCount = toCount(totalsNode.ongoing);
  const totalCount = toCount(totalsNode.total);
  const sampleCount = toCount(totalsNode.cycle_sample);
  const totalsText = `${year}: total ${totalCount} • done ${doneCount} • ongoing ${ongoingCount} • cycle sample ${sampleCount}`;

  if (plottedValues.length === 0) {
    status.hidden = false;
    status.textContent = `No lifecycle phase time data found for ${year}.`;
    clearChartContainer("lifecycle-days-chart");
    return;
  }
  if (!window.BugChartsRecharts?.renderLifecycleDaysChart) {
    status.hidden = false;
    status.textContent = "Lifecycle chart unavailable: Recharts renderer missing.";
    return;
  }
  window.BugChartsRecharts.renderLifecycleDaysChart({
    containerId: "lifecycle-days-chart",
    rows,
    phaseDefs,
    colors: themeColors,
    metricLabel
  });
  context.textContent = `${chartTitleText} • ${totalsText}`;
}

function renderProductCycleChart() {
  const status = document.getElementById("product-cycle-status");
  const root = document.getElementById("product-cycle-chart");
  const context = document.getElementById("product-cycle-context");
  const effortSelect = document.getElementById("product-cycle-effort-scope");
  const metricSelect = document.getElementById("product-cycle-metric-scope");
  if (!status || !root || !context) return;

  status.hidden = true;
  setProductCycleTotalsText("");
  const effortScope = PRODUCT_CYCLE_EFFORT_SCOPE_OPTIONS.includes(state.productCycleEffortScope)
    ? state.productCycleEffortScope
    : "all";
  const metric = state.productCycleMetricScope === "average" ? "average" : "median";
  if (effortSelect) effortSelect.value = effortScope;
  if (metricSelect) metricSelect.value = metric;

  const ideas = getProductCycleIdeas();
  const publicAggregates = getProductCyclePublicAggregates();
  if (ideas.length === 0 && !publicAggregates) {
    status.hidden = false;
    status.textContent = "No product cycle data found in data/manual/product-cycle-times.json.";
    return;
  }
  if (ideas.length === 0 && publicAggregates) {
    renderProductCycleChartFromPublicAggregates(publicAggregates, effortScope, metric);
    return;
  }

  const teams = getCycleTeams(ideas);
  const knownTeamSet = new Set((state.productCycle?.teams || []).filter((team) => team !== "UNMAPPED"));
  const mappedTeamSet = new Set(teams.filter((team) => team !== "UNMAPPED"));
  const metricFn = metric === "average" ? computeAverage : computeMedian;
  const metricLabel = metric === "average" ? "Average" : "Median";
  const yearsToShow = PRODUCT_CYCLE_COMPARE_YEARS;

  const perYear = yearsToShow.map((year) => {
    const ideasInYear = ideas
      .filter((idea) => inferIdeaYear(idea) === year)
      .filter((idea) => matchesEffortScope(idea, effortScope, knownTeamSet));
    const yearEndAt = new Date(`${year}-12-31T23:59:59.999Z`).getTime();
    const doneByYearEnd = ideasInYear.filter((idea) => {
      const doneAt = new Date(String(idea?.entered_done || "")).getTime();
      return Number.isFinite(doneAt) && doneAt <= yearEndAt;
    });
    const openAtYearEnd = Math.max(0, ideasInYear.length - doneByYearEnd.length);
    const openNow = ideasInYear.filter((idea) => !idea?.entered_done).length;
    const doneInYear = ideasInYear.filter((idea) => isoYear(idea?.entered_done) === year);
    const cycleRows = doneInYear
      .map((idea) => ({
        ...idea,
        parking_exit_to_done_days: diffDaysFromIso(getParkingLotExitAt(idea), idea?.entered_done)
      }))
      .filter((idea) => typeof idea.parking_exit_to_done_days === "number");
    const valuesByTeam = new Map(teams.map((team) => [team, []]));
    for (const idea of cycleRows) {
      const contributionTeams = getIdeaContributionTeams(idea, mappedTeamSet, knownTeamSet, effortScope);
      for (const team of contributionTeams) {
        if (!valuesByTeam.has(team)) valuesByTeam.set(team, []);
        valuesByTeam.get(team).push(idea.parking_exit_to_done_days);
      }
    }
    const teamStats = teams.map((team) => {
      const values = valuesByTeam.get(team) || [];
      return {
        team,
        n: values.length,
        median: computeMedian(values),
        average: computeAverage(values),
        metric: metricFn(values)
      };
    });
    return {
      year,
      ideasInYear,
      doneByYearEnd,
      openAtYearEnd,
      openNow,
      doneInYear,
      cycleRows,
      teamStats
    };
  });
  const totalIdeasCombined = perYear.reduce((sum, entry) => sum + entry.ideasInYear.length, 0);
  const totalCycleSample = perYear.reduce((sum, entry) => sum + entry.cycleRows.length, 0);
  const contextText = `Total ideas (2025+2026): ${totalIdeasCombined} • cycle sample: ${totalCycleSample}`;
  context.textContent = contextText;

  if (perYear.every((entry) => entry.cycleRows.length === 0)) {
    status.hidden = false;
    status.textContent = `No completed Parking lot exit -> Done items found for ${yearsToShow.join(", ")}.`;
    clearChartContainer("product-cycle-chart");
    context.textContent = contextText;
    return;
  }

  const themeColors = getThemeColors();
  const seriesDefs = perYear.map((entry, index) => ({
    key: `year_${entry.year}`,
    name: String(entry.year),
    color: index % 2 === 0 ? themeColors.teams.api : themeColors.teams.bc
  }));
  const rows = teams.map((team) => {
    const row = { team };
    for (const entry of perYear) {
      const key = `year_${entry.year}`;
      const stat = entry.teamStats.find((item) => item.team === team) || {};
      const metricValue =
        typeof stat.metric === "number" && Number.isFinite(stat.metric) ? stat.metric : 0;
      row[key] = metricValue;
      row[`meta_${key}`] = {
        n: toNumber(stat.n),
        median: toFiniteMetric(stat.median) || 0,
        average: toFiniteMetric(stat.average) || 0
      };
      row[`color_${key}`] = cycleYearTeamColor(themeColors, team, entry.year);
    }
    return row;
  });
  if (!window.BugChartsRecharts?.renderProductCycleChart) {
    status.hidden = false;
    status.textContent = "Product cycle chart unavailable: Recharts renderer missing.";
    return;
  }
  window.BugChartsRecharts.renderProductCycleChart({
    containerId: "product-cycle-chart",
    rows,
    seriesDefs,
    colors: themeColors,
    metricLabel
  });
  setProductCycleTotalsText("");

  context.textContent = contextText;

  const yearsWithoutCycles = perYear
    .filter((entry) => entry.cycleRows.length === 0)
    .map((entry) => entry.year);
  if (yearsWithoutCycles.length > 0) {
    status.hidden = false;
    status.textContent = `No completed Parking lot exit -> Done items found for ${yearsWithoutCycles.join(", ")}; showing other year(s).`;
  }
}

function renderLifecycleDaysChart() {
  const status = document.getElementById("lifecycle-days-status");
  const root = document.getElementById("lifecycle-days-chart");
  const context = document.getElementById("lifecycle-days-context");
  const yearSelect = document.getElementById("lifecycle-days-year-scope");
  const metricSelect = document.getElementById("lifecycle-days-metric-scope");
  if (!status || !root || !context) return;

  status.hidden = true;
  const year = LIFECYCLE_YEAR_OPTIONS.includes(state.lifecycleDaysYearScope)
    ? state.lifecycleDaysYearScope
    : "2026";
  const metric = state.lifecycleDaysMetricScope === "average" ? "average" : "median";
  if (yearSelect) yearSelect.value = year;
  if (metricSelect) metricSelect.value = metric;

  const ideas = getProductCycleIdeas();
  const publicAggregates = getProductCyclePublicAggregates();
  if (ideas.length === 0 && !publicAggregates) {
    status.hidden = false;
    status.textContent = "No product cycle data found in data/manual/product-cycle-times.json.";
    return;
  }
  if (ideas.length === 0 && publicAggregates) {
    renderLifecycleDaysChartFromPublicAggregates(publicAggregates, year, metric);
    return;
  }

  const ideasInYear = ideas.filter((idea) => inferIdeaYear(idea) === year);
  const ideasWithPhaseSpent = ideasInYear.map((idea) => ({
    ...idea,
    _phase_spent_days: computeLifecyclePhaseSpentDays(idea)
  }));
  const teams = getCycleTeams(ideasInYear);
  const mappedTeamSet = new Set(teams.filter((team) => team !== "UNMAPPED"));
  const metricFn = metric === "average" ? computeAverage : computeMedian;
  const metricLabel = metric === "average" ? "Average" : "Median";
  const chartTitleText = `Lifecycle time spent per phase (${metricLabel})`;

  const groupedByTeam = new Map();
  for (const team of teams) groupedByTeam.set(team, []);
  for (const idea of ideasWithPhaseSpent) {
    const bucket = bucketTeamName(idea?.primary_team, mappedTeamSet);
    if (!groupedByTeam.has(bucket)) groupedByTeam.set(bucket, []);
    groupedByTeam.get(bucket).push(idea);
  }

  const themeColors = getThemeColors();
  const phaseColors = [
    themeColors.uatBuckets.d0_7,
    themeColors.uatBuckets.d8_14,
    themeColors.uatBuckets.d15_30,
    themeColors.uatBuckets.d31_60,
    themeColors.uatBuckets.d61_plus
  ];
  const phaseDefs = PRODUCT_CYCLE_PHASES.map((phase, phaseIndex) => ({
    key: phase.key,
    label: phase.label,
    color: phaseColors[phaseIndex] || themeColors.teams.legacy
  }));
  const rows = teams.map((team) => {
    const row = { team };
    for (const phase of PRODUCT_CYCLE_PHASES) {
      const values = (groupedByTeam.get(team) || [])
        .map((idea) => idea?._phase_spent_days?.[phase.key])
        .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
      const median = computeMedian(values);
      const average = computeAverage(values);
      const metricValue = metricFn(values);
      row[phase.key] =
        typeof metricValue === "number" && Number.isFinite(metricValue) ? metricValue : 0;
      row[`meta_${phase.key}`] = {
        n: values.length,
        median: median || 0,
        average: average || 0
      };
    }
    return row;
  });

  const plottedValues = phaseDefs
    .flatMap((phase) => rows.map((row) => row[phase.key]))
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  const doneCount = ideasInYear.filter((idea) => isoYear(idea?.entered_done) === year).length;
  const ongoingCount = Math.max(0, ideasInYear.length - doneCount);
  const sampleSet = new Set();
  for (const idea of ideasWithPhaseSpent) {
    const hasPhaseSpent = PRODUCT_CYCLE_PHASES.some((phase) => {
      const value = idea?._phase_spent_days?.[phase.key];
      return typeof value === "number" && Number.isFinite(value) && value > 0;
    });
    if (hasPhaseSpent) sampleSet.add(String(idea?.key || ""));
  }
  const sampleCount = sampleSet.size;
  const totalsText = `${year}: total ${ideasInYear.length} • done ${doneCount} • ongoing ${ongoingCount} • cycle sample ${sampleCount}`;
  context.textContent = chartTitleText;

  if (plottedValues.length === 0) {
    status.hidden = false;
    status.textContent = `No lifecycle phase time data found for ${year}.`;
    clearChartContainer("lifecycle-days-chart");
    return;
  }
  if (!window.BugChartsRecharts?.renderLifecycleDaysChart) {
    status.hidden = false;
    status.textContent = "Lifecycle chart unavailable: Recharts renderer missing.";
    return;
  }
  window.BugChartsRecharts.renderLifecycleDaysChart({
    containerId: "lifecycle-days-chart",
    rows,
    phaseDefs,
    colors: themeColors,
    metricLabel
  });
  context.textContent = `${chartTitleText} • ${totalsText}`;
}

function renderManagementChart() {
  const status = document.getElementById("management-status");
  const root = document.getElementById("management-chart");
  const context = document.getElementById("management-context");
  if (!status || !root || !context) return;

  status.hidden = true;

  const scope = state.managementUatScope === "bugs_only" ? "bugs_only" : "all";
  const scopeSelect = document.getElementById("management-uat-scope");
  if (scopeSelect) scopeSelect.value = scope;
  const flowVariants = state.snapshot?.kpis?.broadcast?.flow_by_priority_variants;
  const scopedFlow = flowVariants && typeof flowVariants === "object" ? flowVariants[scope] : null;
  const flow = scopedFlow || state.snapshot?.kpis?.broadcast?.flow_by_priority;
  if (!flow || typeof flow !== "object") {
    status.hidden = false;
    status.textContent = "No Broadcast flow_by_priority data found in snapshot.json.";
    return;
  }

  const bands = ["highest", "high", "medium"];
  const baseLabels = ["Highest", "High", "Medium"];
  const themeColors = getThemeColors();
  const devMedian = bands.map((band) => {
    const value = flow?.[band]?.median_dev_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const uatMedian = bands.map((band) => {
    const value = flow?.[band]?.median_uat_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const devAvg = bands.map((band) => {
    const value = flow?.[band]?.avg_dev_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const uatAvg = bands.map((band) => {
    const value = flow?.[band]?.avg_uat_days;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const devCounts = bands.map((band) => toNumber(flow?.[band]?.n_dev));
  const uatCounts = bands.map((band) => toNumber(flow?.[band]?.n_uat));
  const labels = baseLabels;
  const totalFlowTickets = bands.reduce(
    (sum, band, idx) => sum + Math.max(devCounts[idx], uatCounts[idx]),
    0
  );
  const uat = state.snapshot?.uatAging;
  const uatScopeLabel = String(uat?.scope?.label || "Broadcast");
  const uatCurrentCount = toNumber(uat?.totalIssues);
  context.textContent = `${uatScopeLabel}, ${uatCurrentCount} currently in UAT • ${totalFlowTickets} historical flow tickets (sample)`;

  const rows = labels.map((label, idx) => ({
    label,
    devMedian: Number.isFinite(devMedian[idx]) ? devMedian[idx] : 0,
    uatMedian: Number.isFinite(uatMedian[idx]) ? uatMedian[idx] : 0,
    devAvg: Number.isFinite(devAvg[idx]) ? devAvg[idx] : 0,
    uatAvg: Number.isFinite(uatAvg[idx]) ? uatAvg[idx] : 0,
    devCount: devCounts[idx],
    uatCount: uatCounts[idx]
  }));

  const yValues = [...devMedian, ...uatMedian].filter((value) => Number.isFinite(value));
  const variantCandidates = [
    flowVariants?.all,
    flowVariants?.bugs_only,
    state.snapshot?.kpis?.broadcast?.flow_by_priority
  ].filter((candidate) => candidate && typeof candidate === "object");
  const variantYValues = [];
  for (const candidate of variantCandidates) {
    for (const band of ["medium", "high", "highest"]) {
      const dev = candidate?.[band]?.median_dev_days;
      const uat = candidate?.[band]?.median_uat_days;
      if (typeof dev === "number" && Number.isFinite(dev)) variantYValues.push(dev);
      if (typeof uat === "number" && Number.isFinite(uat)) variantYValues.push(uat);
    }
  }
  const maxY = [...yValues, ...variantYValues].length
    ? Math.max(...yValues, ...variantYValues)
    : 1;
  const paddedMaxY = Math.max(1, Math.ceil(maxY * 1.12));

  if (!window.BugChartsRecharts?.renderManagementChart) {
    status.hidden = false;
    status.textContent = "Management chart unavailable: Recharts renderer missing.";
    return;
  }
  window.BugChartsRecharts.renderManagementChart({
    containerId: "management-chart",
    rows,
    colors: themeColors,
    devColor: readThemeColor("--mgmt-dev", "#98a3af"),
    uatColor: readThemeColor("--mgmt-uat", "#c0c8d1"),
    yUpper: paddedMaxY
  });

  if (scope === "bugs_only" && !scopedFlow) {
    status.hidden = false;
    status.textContent = "Bugs-only flow bars are unavailable in this snapshot; showing all-issues bars.";
  }
}

async function loadSnapshot() {
  const status = document.getElementById("status");
  const uatStatus = document.getElementById("uat-status");
  const managementStatus = document.getElementById("management-status");
  const sprintGoalsStatus = document.getElementById("sprint-goals-status");
  const productCycleStatus = document.getElementById("product-cycle-status");
  const lifecycleDaysStatus = document.getElementById("lifecycle-days-status");
  status.hidden = true;
  if (uatStatus) uatStatus.hidden = true;
  if (managementStatus) managementStatus.hidden = true;
  if (sprintGoalsStatus) sprintGoalsStatus.hidden = true;
  if (productCycleStatus) productCycleStatus.hidden = true;
  if (lifecycleDaysStatus) lifecycleDaysStatus.hidden = true;
  state.mode = getModeFromUrl();
  applyModeVisibility();

  try {
    const [snapshotResponse, sprintGoalsResponse, productCycleResponse] = await Promise.all([
      fetch("./snapshot.json", { cache: "no-store" }),
      fetch("./data/manual/sprint-goals.json", { cache: "no-store" }),
      fetch("./data/manual/product-cycle-times.json", { cache: "no-store" })
    ]);
    if (!snapshotResponse.ok) throw new Error(`snapshot.json HTTP ${snapshotResponse.status}`);
    state.snapshot = await snapshotResponse.json();
    if (sprintGoalsResponse.ok) {
      state.sprintGoals = await sprintGoalsResponse.json();
    } else {
      state.sprintGoals = null;
      if (sprintGoalsStatus) {
        sprintGoalsStatus.hidden = false;
        sprintGoalsStatus.textContent = `Failed to load sprint-goals.json: HTTP ${sprintGoalsResponse.status}`;
      }
    }
    if (productCycleResponse.ok) {
      state.productCycle = await productCycleResponse.json();
    } else {
      state.productCycle = null;
      if (productCycleStatus) {
        productCycleStatus.hidden = false;
        productCycleStatus.textContent = `Failed to load product-cycle-times.json: HTTP ${productCycleResponse.status}`;
      }
      if (lifecycleDaysStatus) {
        lifecycleDaysStatus.hidden = false;
        lifecycleDaysStatus.textContent = `Failed to load product-cycle-times.json: HTTP ${productCycleResponse.status}`;
      }
    }
    bindCompositionTeamScopeToggle();
    bindManagementUatScopeToggle();
    bindSprintGoalsTeamScopeToggle();
    bindProductCycleControls();
    bindLifecycleDaysControls();
    setLastUpdatedSubtitles(state.snapshot);
    setProductCycleUpdatedSubtitles(state.productCycle, state.snapshot?.updatedAt);
    if (state.mode !== "composition") {
      renderTrendChartPreferred();
    }
    if (state.mode !== "trend") {
      renderCompositionChartPreferred();
    }
    renderUatAgingChart();
    renderManagementChart();
    renderSprintGoalsChart();
    renderProductCycleChart();
    renderLifecycleDaysChart();
  } catch (error) {
    status.hidden = false;
    status.textContent = `Failed to load snapshot.json: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (uatStatus) {
      uatStatus.hidden = false;
      uatStatus.textContent = status.textContent;
    }
    if (managementStatus) {
      managementStatus.hidden = false;
      managementStatus.textContent = status.textContent;
    }
    if (sprintGoalsStatus) {
      sprintGoalsStatus.hidden = false;
      sprintGoalsStatus.textContent = status.textContent;
    }
    if (productCycleStatus) {
      productCycleStatus.hidden = false;
      productCycleStatus.textContent = status.textContent;
    }
    if (lifecycleDaysStatus) {
      lifecycleDaysStatus.hidden = false;
      lifecycleDaysStatus.textContent = status.textContent;
    }
  }
}

loadSnapshot();
