"use strict";

(function initDashboardViewUtils(globalObject) {
  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function formatDateShort(date) {
    const [year, month, day] = String(date || "").split("-");
    if (!year || !month || !day) return String(date || "");
    return `${month}/${day}`;
  }

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

  function setTextForIds(ids, text) {
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    }
  }

  function setStatusMessage(statusId, message = "") {
    const node = document.getElementById(statusId);
    if (!node) return null;
    const text = String(message || "");
    node.hidden = text.length === 0;
    node.textContent = text;
    return node;
  }

  function setStatusMessageForIds(ids, message = "") {
    for (const id of ids) setStatusMessage(id, message);
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
    if (globalObject.DashboardCharts?.clearChart) {
      globalObject.DashboardCharts.clearChart({ containerId });
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
    if (chart === "product-cycle" || chart === "cycle-time") return "product-cycle";
    if (chart === "lifecycle-days") return "lifecycle-days";
    return "all";
  }

  globalObject.DashboardViewUtils = {
    toNumber,
    formatDateShort,
    formatUpdatedAt,
    setTextForIds,
    setStatusMessage,
    setStatusMessageForIds,
    readThemeColor,
    getThemeColors,
    clearChartContainer,
    getModeFromUrl
  };
})(window);
