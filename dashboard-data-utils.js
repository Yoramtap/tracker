"use strict";

(function initDashboardDataUtils() {
  const dashboardUiUtils = window.DashboardViewUtils;
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }

  const PRODUCT_CYCLE_TEAM_ORDER = ["api", "frontend", "broadcast", "workers", "titanium", "shift"];
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
    workers: "#5e6b84",
    titanium: "#b07aa1",
    shift: "#8a6a4a",
    unmapped: "#4a758e"
  };

  function toCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.trunc(number);
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

  function hashTeamName(teamName) {
    const text = String(teamName || "")
      .trim()
      .toLowerCase();
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
    if (key.includes("legacy") || key.includes("frontend"))
      return DASHBOARD_TEAM_BASE_COLORS.frontend;
    if (key.includes("react")) return DASHBOARD_TEAM_BASE_COLORS.react;
    if (key.includes("broadcast")) return DASHBOARD_TEAM_BASE_COLORS.broadcast;
    if (key.includes("worker")) return DASHBOARD_TEAM_BASE_COLORS.workers;
    if (key.includes("orchestration")) return DASHBOARD_TEAM_BASE_COLORS.orchestration;
    if (key.includes("titanium") || key.includes("media"))
      return DASHBOARD_TEAM_BASE_COLORS.titanium;
    return TEAM_FALLBACK_PALETTE[
      hashTeamName(raw || `team-${index}`) % TEAM_FALLBACK_PALETTE.length
    ];
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
      return Object.fromEntries(
        teams.map((team, index) => [team, resolveTeamBaseColor(team, index)])
      );
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
    buildTeamColorMap,
    buildTintMap,
    orderProductCycleTeams,
    toCount
  };
})();
