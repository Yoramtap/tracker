"use strict";

(function preloadDashboardData(globalObject) {
  const DATA_SOURCE_URLS = {
    snapshot: "./backlog-snapshot.json",
    productCycle: "./product-cycle-snapshot.json",
    contributors: "./contributors-snapshot.json",
    prCycle: "./pr-cycle-snapshot.json"
  };

  function getRequestedMode() {
    try {
      const params = new URLSearchParams(globalObject.location?.search || "");
      const chart = String(params.get("chart") || "")
        .trim()
        .toLowerCase();
      if (chart === "trend") return "trend";
      if (chart === "composition") return "composition";
      if (chart === "uat") return "uat";
      if (
        chart === "dev-uat-ratio" ||
        chart === "management" ||
        chart === "dev-uat-facility" ||
        chart === "management-facility"
      ) {
        return "management-facility";
      }
      if (chart === "pr" || chart === "prs" || chart === "pr-activity") return "pr-activity";
      if (chart === "pr-cycle" || chart === "pr-cycle-experiment") return "pr-cycle-experiment";
      if (chart === "contributors") return "contributors";
      if (chart === "product-cycle" || chart === "cycle-time") return "product-cycle";
      if (chart === "lifecycle-days") return "lifecycle-days";
      return "all";
    } catch {
      return "all";
    }
  }

  function getNeededSourceKeys() {
    const mode = getRequestedMode();
    if (mode === "all") return Object.keys(DATA_SOURCE_URLS);
    if (mode === "contributors") return ["contributors"];
    if (mode === "pr-activity") return ["snapshot", "prCycle"];
    if (mode === "pr-cycle-experiment") return ["prCycle"];
    if (mode === "product-cycle" || mode === "lifecycle-days") return ["productCycle"];
    return ["snapshot"];
  }

  const cache = {};
  for (const sourceKey of getNeededSourceKeys()) {
    const url = DATA_SOURCE_URLS[sourceKey];
    if (!url) continue;
    cache[sourceKey] = fetch(url, { cache: "no-cache" }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  globalObject.__dashboardDataSourcePromiseCache = cache;
})(window);
