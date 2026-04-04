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
        label: "Community",
        icon: getSourcePath("assets", "icons/share-3735079.png")
      },
      {
        value: "shipped",
        label: "Shipped",
        icon: getSourcePath("assets", "icons/bookmark-3735089.png")
      },
      {
        value: "product",
        label: "Product",
        icon: getSourcePath("assets", "icons/chart-3735080.png")
      },
      {
        value: "development",
        label: "Development",
        icon: getSourcePath("assets", "icons/chart-3735080.png")
      },
      { value: "bug", label: "Bugs", icon: getSourcePath("assets", "icons/search-3735055.png") }
    ].map((item) => Object.freeze(item))
  );
  const SECTION_FILTER_VALUES = new Set(SECTION_FILTER_ITEMS.map(({ value }) => value));

  function normalizeSectionFilter(value) {
    const section = String(value || "")
      .trim()
      .toLowerCase();
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
        product: ["managementFacility", "productCycle"],
        development: ["prActivity", "prCycle"],
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
    if (mode === "workflow-breakdown" || mode === "pr-cycle-experiment") return ["prCycle"];
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
