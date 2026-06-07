"use strict";

(function initDashboardRuntimeContract() {
  const DEFAULT_SECTION = "community";
  const SOURCE_PATH_ROOTS = Object.freeze({
    runtime: "./app/",
    app: "./app/",
    assets: "./assets/",
    data: "./data/",
    vendor: "./vendor/",
    dev: "./dev/"
  });

  function getSourcePath(rootKey, relativePath = "") {
    const root = SOURCE_PATH_ROOTS[rootKey] || SOURCE_PATH_ROOTS.runtime;
    const normalizedRelativePath = String(relativePath || "").replace(/^\.?\//, "");
    return normalizedRelativePath ? `${root}${normalizedRelativePath}` : root;
  }

  function getVersionedSourcePath(rootKey, relativePath, version = "") {
    const basePath = getSourcePath(rootKey, relativePath);
    const safeVersion = String(version || "").trim();
    return safeVersion ? `${basePath}?v=${safeVersion}` : basePath;
  }

  const SECTION_FILTER_ITEMS = Object.freeze(
    [
      {
        value: "community",
        label: "Community"
      },
      {
        value: "shipped",
        label: "Shipped"
      },
      {
        value: "product-delivery",
        label: "Delivery"
      },
      {
        value: "uat",
        label: "UAT"
      },
      {
        value: "dev-trends",
        label: "PR Volume"
      },
      {
        value: "dev-ai",
        label: "AI PRs"
      },
      {
        value: "dev-breakdown",
        label: "Dev Throughput"
      },
      { value: "bug", label: "Bugs" }
    ].map((item) => Object.freeze(item))
  );
  const SECTION_FILTER_VALUES = new Set(SECTION_FILTER_ITEMS.map(({ value }) => value));

  function normalizeSectionFilter(value) {
    const section = String(value || "")
      .trim()
      .toLowerCase();
    if (section === "product") return "product-delivery";
    if (section === "management" || section === "management-facility") return "uat";
    if (section === "development" || section === "pr-activity") return "dev-trends";
    if (section === "ai-use" || section === "dev-ai" || section === "pr-activity-ai") {
      return "dev-ai";
    }
    if (section === "workflow-breakdown" || section === "pr-cycle") return "dev-breakdown";
    return SECTION_FILTER_VALUES.has(section) ? section : DEFAULT_SECTION;
  }

  function getModeFromUrl(search = window.location.search) {
    try {
      const params = new URLSearchParams(search);
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
      if (chart === "pr" || chart === "prs") {
        return "workflow-breakdown";
      }
      if (chart === "pr-activity" || chart === "pr-activity-legacy") {
        return "pr-activity-legacy";
      }
      if (
        chart === "pr-cycle" ||
        chart === "pr-cycle-experiment" ||
        chart === "workflow-breakdown"
      ) {
        return "workflow-breakdown";
      }
      if (chart === "contributors") return "contributors";
      if (chart === "product-cycle" || chart === "cycle-time") return "product-cycle";
      if (chart === "lifecycle-days") return "lifecycle-days";
      return "all";
    } catch {
      return "all";
    }
  }

  function getSectionFilterFromUrl(search = window.location.search) {
    try {
      return normalizeSectionFilter(new URLSearchParams(search).get("report-section"));
    } catch {
      return DEFAULT_SECTION;
    }
  }

  function getRequiredSourceKeys(mode, availableSourceKeys = [], sectionKey = DEFAULT_SECTION) {
    if (mode === "all") {
      const desiredSourceKeysBySection = {
        community: ["contributors"],
        shipped: ["productCycleShipments"],
        "product-delivery": ["productCycle"],
        uat: ["managementFacility"],
        "dev-trends": ["prActivity"],
        "dev-ai": ["prActivity"],
        "dev-breakdown": ["prCycle"],
        bug: ["snapshot"]
      };
      const desiredSourceKeys =
        desiredSourceKeysBySection[normalizeSectionFilter(sectionKey)] ||
        desiredSourceKeysBySection.community;
      return desiredSourceKeys.filter((sourceKey) => availableSourceKeys.includes(sourceKey));
    }
    if (mode === "contributors") return ["contributors"];
    if (mode === "management-facility") return ["managementFacility"];
    if (mode === "pr-activity-legacy") return ["prActivity"];
    if (mode === "workflow-breakdown" || mode === "pr-cycle-experiment") {
      return ["prCycle"].filter((sourceKey) => availableSourceKeys.includes(sourceKey));
    }
    if (mode === "product-cycle" || mode === "lifecycle-days") return ["productCycle"];
    return ["snapshot"];
  }

  if (typeof window.getSharedPrActivityHiddenKeys !== "function") {
    window.getSharedPrActivityHiddenKeys = () => new Set();
  }
  if (typeof window.setSharedPrActivityHiddenKeys !== "function") {
    window.setSharedPrActivityHiddenKeys = () => {};
  }

  window.DashboardRuntimeContract = Object.freeze({
    defaultSection: DEFAULT_SECTION,
    sourcePathRoots: SOURCE_PATH_ROOTS,
    sectionFilterItems: SECTION_FILTER_ITEMS,
    getSourcePath,
    getVersionedSourcePath,
    normalizeSectionFilter,
    ensureHeavyPanelShell: () => Promise.resolve(),
    ensureHeavyScripts: () => Promise.resolve(),
    getModeFromUrl,
    getRequiredSourceKeys,
    getSectionFilterFromUrl
  });
})();
