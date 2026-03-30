"use strict";

(function initDashboardBootstrap() {
  if (typeof window.getSharedPrActivityHiddenKeys !== "function") {
    window.getSharedPrActivityHiddenKeys = () => new Set();
  }
  if (typeof window.setSharedPrActivityHiddenKeys !== "function") {
    window.setSharedPrActivityHiddenKeys = () => {};
  }

  const DEFAULT_SECTION = "community";
  const SECTION_FILTER_ITEMS = [
    { value: "community", label: "Community", icon: "./assets/icons/share-3735079.png" },
    { value: "shipped", label: "Shipped", icon: "./assets/icons/bookmark-3735089.png" },
    { value: "product", label: "Product", icon: "./assets/icons/chart-3735080.png" },
    { value: "development", label: "Development", icon: "./assets/icons/chart-3735080.png" },
    { value: "bug", label: "Bugs", icon: "./assets/icons/search-3735055.png" }
  ];
  const DEFAULT_VISIBLE_PANEL_IDS = new Set([
    "actions-required-panel",
    "community-contributors-panel"
  ]);
  const BASE_HEAVY_SCRIPT_SOURCES = [
    "./dashboard-view-utils.js?v=local2",
    "./vendor/react.production.min.js",
    "./vendor/react-dom.production.min.js",
    "./dashboard-chart-core.js",
    "./dashboard-pretext-layout.js?v=local8"
  ];
  const DASHBOARD_APP_SCRIPT_SOURCE = "./dashboard-app.js?v=local47";
  const SHIPPED_CHART_SCRIPT_SOURCE = "./dashboard-charts-shipped.js?v=local2";
  const PRODUCT_CHART_SCRIPT_SOURCE = "./dashboard-charts-product.js?v=local10";
  const FULL_HEAVY_PANEL_SHELL_SRC = "./dashboard-heavy-panels.html?v=local17";
  const SECTION_HEAVY_PANEL_SOURCES = Object.freeze({
    shipped: "./dashboard-heavy-panels-shipped.html?v=local8",
    product: "./dashboard-heavy-panels-product.html?v=local9",
    development: "./dashboard-heavy-panels-development.html?v=local14",
    bug: "./dashboard-heavy-panels-bug.html?v=local10"
  });
  const ALL_SECTION_HEAVY_PANEL_SOURCES = Object.freeze(Object.values(SECTION_HEAVY_PANEL_SOURCES));
  const LOCAL_AGENTATION_LOADER_SRC = "./agentation-local-loader.js?v=local2";
  const dashboardRuntimeContract =
    window.DashboardRuntimeContract ||
    Object.freeze({
      ensureHeavyPanelShell,
      ensureHeavyScripts,
      getModeFromUrl,
      getRequiredSourceKeys,
      getSectionFilterFromUrl
    });
  window.DashboardRuntimeContract = dashboardRuntimeContract;

  const bootstrapState = {
    heavyStackPromise: null,
    heavyShellPromise: null,
    contributorsSnapshot: null,
    loadedHeavyPanelSources: new Set(),
    cachedHeavyPanelMarkupBySrc: new Map(),
    heavyPanelMarkupPromisesBySrc: new Map(),
    sectionFilter: dashboardRuntimeContract.getSectionFilterFromUrl(window.location.search)
  };

  const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  function formatUpdatedAt(value) {
    const parsed = new Date(String(value || ""));
    if (!Number.isFinite(parsed.getTime())) return "Unknown";
    return updatedAtFormatter.format(parsed);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatusMessage(statusId, message = "") {
    const node = document.getElementById(statusId);
    if (!node) return null;
    const text = String(message || "");
    node.hidden = text.length === 0;
    node.textContent = text;
    return node;
  }

  function setPanelContext(node, text) {
    if (!node) return;
    const safeText = String(text || "").trim();
    node.hidden = safeText.length === 0;
    node.textContent = safeText;
  }

  function formatContextWithFreshness(text, timestamp, label = "updated") {
    const safeText = String(text || "").trim();
    const safeTimestamp = String(timestamp || "").trim();
    if (!safeTimestamp) return safeText;
    const freshnessText = `${label} ${formatUpdatedAt(safeTimestamp)}`;
    return safeText ? `${safeText} • ${freshnessText}` : freshnessText;
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

  function isEmbedMode() {
    const params = new URLSearchParams(window.location.search);
    const embed = (params.get("embed") || "").toLowerCase();
    if (embed === "0" || embed === "false" || embed === "no") return false;
    if (embed === "1" || embed === "true" || embed === "yes") return true;
    return getModeFromUrl() !== "all";
  }

  function getDashboardControlElements(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]`));
  }

  function normalizeSectionFilter(value) {
    const section = String(value || "")
      .trim()
      .toLowerCase();
    return SECTION_FILTER_ITEMS.some((item) => item.value === section) ? section : DEFAULT_SECTION;
  }

  function syncControlSelectionClasses(name) {
    getDashboardControlElements(name).forEach((control) => {
      const label = control.closest("label");
      if (!label) return;
      label.classList.toggle("is-selected", Boolean(control.checked));
    });
  }

  function syncControlValue(name, value) {
    getDashboardControlElements(name).forEach((control) => {
      control.checked = control.value === value;
    });
    syncControlSelectionClasses(name);
  }

  function getSectionFilterFromUrl() {
    return normalizeSectionFilter(
      new URLSearchParams(window.location.search).get("report-section")
    );
  }

  function getRequiredSourceKeys(mode, availableSourceKeys = [], sectionKey = DEFAULT_SECTION) {
    if (mode === "all") {
      const desiredSourceKeysBySection = {
        community: ["contributors"],
        shipped: ["productCycleShipments"],
        product: ["managementFacility", "productCycle"],
        development: ["prActivity", "prCycle"],
        bug: ["snapshot"],
        all: availableSourceKeys.slice()
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

  function getSectionOptionalChartScriptSources(sectionKey = bootstrapState.sectionFilter) {
    const normalizedSection = normalizeSectionFilter(sectionKey);
    if (normalizedSection === "shipped") return [SHIPPED_CHART_SCRIPT_SOURCE];
    if (normalizedSection === "product" || normalizedSection === "bug") {
      return [PRODUCT_CHART_SCRIPT_SOURCE];
    }
    if (normalizedSection === "all") {
      return [SHIPPED_CHART_SCRIPT_SOURCE, PRODUCT_CHART_SCRIPT_SOURCE];
    }
    return [];
  }

  function getOptionalChartScriptSources(
    mode = getModeFromUrl(window.location.search),
    sectionKey = bootstrapState.sectionFilter
  ) {
    switch (
      String(mode || "")
        .trim()
        .toLowerCase()
    ) {
      case "trend":
      case "composition":
      case "management-facility":
      case "product-cycle":
      case "lifecycle-days":
        return [PRODUCT_CHART_SCRIPT_SOURCE];
      case "all":
        return getSectionOptionalChartScriptSources(sectionKey);
      default:
        return [];
    }
  }

  function getHeavyScriptSources(
    mode = getModeFromUrl(window.location.search),
    sectionKey = bootstrapState.sectionFilter
  ) {
    return [
      ...BASE_HEAVY_SCRIPT_SOURCES,
      ...getOptionalChartScriptSources(mode, sectionKey),
      DASHBOARD_APP_SCRIPT_SOURCE
    ];
  }

  function getSectionHeavyPanelSource(sectionKey) {
    const normalizedSection = normalizeSectionFilter(sectionKey);
    if (normalizedSection === "all" || normalizedSection === DEFAULT_SECTION) return "";
    return SECTION_HEAVY_PANEL_SOURCES[normalizedSection] || "";
  }

  function getModeHeavyPanelSources(mode) {
    switch (
      String(mode || "")
        .trim()
        .toLowerCase()
    ) {
      case "contributors":
        return [];
      case "trend":
      case "composition":
        return [SECTION_HEAVY_PANEL_SOURCES.bug];
      case "management-facility":
      case "product-cycle":
      case "lifecycle-days":
        return [SECTION_HEAVY_PANEL_SOURCES.product];
      case "pr-activity":
      case "pr-activity-legacy":
      case "pr-cycle-experiment":
      case "workflow-breakdown":
        return [SECTION_HEAVY_PANEL_SOURCES.development];
      default:
        return [FULL_HEAVY_PANEL_SHELL_SRC];
    }
  }

  function markHeavyPanelSourceLoaded(src) {
    bootstrapState.loadedHeavyPanelSources.add(src);
    if (src === FULL_HEAVY_PANEL_SHELL_SRC) {
      ALL_SECTION_HEAVY_PANEL_SOURCES.forEach((sectionSrc) =>
        bootstrapState.loadedHeavyPanelSources.add(sectionSrc)
      );
    }
  }

  function resolveHeavyPanelSources(
    mode = getModeFromUrl(window.location.search),
    sectionKey = bootstrapState.sectionFilter
  ) {
    const normalizedMode = String(mode || "all")
      .trim()
      .toLowerCase();
    if (normalizedMode === "all") {
      const normalizedSection = normalizeSectionFilter(sectionKey);
      if (normalizedSection === DEFAULT_SECTION) return [];
      if (normalizedSection === "all") {
        if (bootstrapState.loadedHeavyPanelSources.has(FULL_HEAVY_PANEL_SHELL_SRC)) {
          return [];
        }
        const missingSectionSources = ALL_SECTION_HEAVY_PANEL_SOURCES.filter(
          (src) => !bootstrapState.loadedHeavyPanelSources.has(src)
        );
        return missingSectionSources.length === ALL_SECTION_HEAVY_PANEL_SOURCES.length
          ? [FULL_HEAVY_PANEL_SHELL_SRC]
          : missingSectionSources;
      }
      const sectionSrc = getSectionHeavyPanelSource(normalizedSection);
      if (!sectionSrc || bootstrapState.loadedHeavyPanelSources.has(sectionSrc)) return [];
      return [sectionSrc];
    }
    return getModeHeavyPanelSources(normalizedMode).filter(
      (src) => !bootstrapState.loadedHeavyPanelSources.has(src)
    );
  }

  function isDefaultCommunityPath() {
    return (
      getModeFromUrl(window.location.search) === "all" &&
      !isEmbedMode() &&
      bootstrapState.sectionFilter === DEFAULT_SECTION
    );
  }

  function renderSectionFilterIcon(iconPath) {
    if (!iconPath) {
      return '<span class="report-intro__icon report-intro__icon--empty" aria-hidden="true"></span>';
    }
    return `<span class="report-intro__icon" aria-hidden="true"><img class="report-intro__icon-image" src="${escapeHtml(iconPath)}" alt="" width="16" height="16" /></span>`;
  }

  function renderSectionFilterMarkup(selectedValue) {
    return SECTION_FILTER_ITEMS.map(
      ({ value, label, icon }) => `
        <label class="report-intro__card report-intro__card--${escapeHtml(value)}">
          <input type="radio" name="report-section" value="${escapeHtml(value)}"${
            value === selectedValue ? " checked" : ""
          } />
          <span class="report-intro__label">
            ${renderSectionFilterIcon(icon)}
            <span class="report-intro__title">${escapeHtml(label)}</span>
          </span>
        </label>
      `
    ).join("");
  }

  function renderActionsPanel() {
    const listNode = document.getElementById("actions-required-list");
    const contextNode = document.getElementById("actions-required-context");
    const statusNode = document.getElementById("actions-required-status");
    if (!listNode || !contextNode || !statusNode) return;

    listNode.innerHTML = `
      <div class="dashboard-overview">
        <div class="dashboard-overview__main">
          <p class="dashboard-overview__eyebrow">Insights</p>
          <h2 class="dashboard-overview__title">Trends for product and teams</h2>
        </div>
        <div class="report-intro">
          <fieldset class="report-intro__grid" aria-label="Report section filter">
            <legend class="sr-only">Report section filter</legend>
            ${renderSectionFilterMarkup(bootstrapState.sectionFilter)}
          </fieldset>
        </div>
      </div>
    `;
    syncControlValue("report-section", bootstrapState.sectionFilter);
    setPanelContext(
      contextNode,
      formatContextWithFreshness(
        "Oldest panel data",
        bootstrapState.contributorsSnapshot?.updatedAt || ""
      )
    );
    statusNode.hidden = true;
  }

  function applyDefaultCommunityVisibility() {
    document.querySelectorAll("main .panel").forEach((panel) => {
      panel.hidden = !DEFAULT_VISIBLE_PANEL_IDS.has(panel.id);
    });
  }

  function updateUrlSection(sectionValue) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("report-section", sectionValue);
    window.history.replaceState({}, "", nextUrl);
  }

  function bindSectionFilter() {
    const controls = Array.from(document.querySelectorAll('input[name="report-section"]'));
    controls.forEach((control) => {
      if (control.dataset.bound === "1") return;
      control.dataset.bound = "1";
      control.addEventListener("change", () => {
        const nextSection =
          String(control.value || "")
            .trim()
            .toLowerCase() || DEFAULT_SECTION;
        bootstrapState.sectionFilter = nextSection;
        syncControlValue("report-section", nextSection);
        updateUrlSection(nextSection);
        if (nextSection === DEFAULT_SECTION) return;
        void loadHeavyDashboard("all", nextSection);
      });
    });
  }

  function toCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.trunc(number);
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

  function buildContributorRowMarkup({
    contributor = "",
    totalIssues = 0,
    doneIssues = 0,
    activeIssues = 0,
    width = 0
  }) {
    return `
      <div class="pr-cycle-stage-row contributors-card__row">
        <div class="pr-cycle-stage-row__label">
          <span class="pr-cycle-stage-row__label-text">${escapeHtml(contributor)}</span>
          <span class="pr-cycle-stage-row__sample">done ${doneIssues}${
            activeIssues > 0 ? ` • active ${activeIssues}` : ""
          }</span>
        </div>
        <div class="pr-cycle-stage-row__track contributors-card__track" aria-hidden="true">
          <div class="pr-cycle-stage-row__fill contributors-card__fill" style="width:${width}%"></div>
        </div>
        <div class="pr-cycle-stage-row__value"><span class="pr-cycle-stage-row__value-frame">${totalIssues}</span></div>
      </div>
    `;
  }

  function renderTopContributorsCard(rows, summary) {
    const container = document.getElementById("top-contributors-chart");
    if (!container) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    const maxTotal = Math.max(1, ...safeRows.map((row) => toCount(row?.totalIssues)));
    const totalIssues = toCount(summary?.totalIssues);
    const totalContributors = Math.max(toCount(summary?.totalContributors), safeRows.length);
    const rowsMarkup = safeRows
      .map((row) => {
        const total = toCount(row?.totalIssues);
        const done = toCount(row?.doneIssues);
        const active = toCount(row?.activeIssues);
        const width = total > 0 ? Math.max(10, Math.round((total / maxTotal) * 100)) : 0;
        return buildContributorRowMarkup({
          contributor: String(row?.contributor || "").trim(),
          totalIssues: total,
          doneIssues: done,
          activeIssues: active,
          width
        });
      })
      .join("");

    container.innerHTML = `
      <div class="product-cycle-team-card-wrap">
        <article class="pr-cycle-stage-card contributors-card">
          <div class="pr-cycle-stage-card__header">
            <div class="pr-cycle-stage-card__meta">
              <div class="pr-cycle-stage-card__team">Community contributors</div>
              <div class="pr-cycle-stage-card__total">${totalIssues}</div>
            </div>
          </div>
          <div class="pr-cycle-stage-list">${rowsMarkup}</div>
          <div class="pr-cycle-stage-card__footer">
            <span><strong>${totalContributors} contributors ranked</strong> • ${totalIssues} included issues</span>
          </div>
        </article>
      </div>
    `;
  }

  function renderContributorsState(snapshot) {
    const rows = Array.isArray(snapshot?.chartData?.rows)
      ? snapshot.chartData.rows.slice().sort((left, right) => {
          const totalDiff = toCount(right?.totalIssues) - toCount(left?.totalIssues);
          if (totalDiff !== 0) return totalDiff;
          const doneDiff = toCount(right?.doneIssues) - toCount(left?.doneIssues);
          if (doneDiff !== 0) return doneDiff;
          return String(left?.contributor || "").localeCompare(String(right?.contributor || ""));
        })
      : [];
    const contextNode = document.getElementById("contributors-context");
    if (rows.length === 0) {
      setStatusMessage(
        "contributors-status",
        "No contributor chart data found in contributors-snapshot.json."
      );
      const chart = document.getElementById("top-contributors-chart");
      if (chart) chart.innerHTML = "";
      if (contextNode) contextNode.hidden = true;
      return;
    }

    const summary = summarizeContributorRows(rows);
    renderTopContributorsCard(rows, summary);
    setPanelContext(
      contextNode,
      formatContextWithFreshness(
        `${summary.totalIssues} total • ${summary.doneIssues} done • ${summary.activeIssues} active`,
        snapshot?.updatedAt || ""
      )
    );
    setStatusMessage("contributors-status", "");
  }

  async function loadContributorsSnapshot() {
    const cache =
      window.__dashboardDataSourcePromiseCache || (window.__dashboardDataSourcePromiseCache = {});
    const cachedPromise = cache.contributors;
    if (cachedPromise && typeof cachedPromise.then === "function") {
      return cachedPromise;
    }
    cache.contributors = fetch("./contributors-snapshot.json", { cache: "no-cache" }).then(
      async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }
    );
    return cache.contributors;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-dashboard-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
          once: true
        });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.async = false;
      script.dataset.dashboardSrc = src;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true }
      );
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
        once: true
      });
      document.head.appendChild(script);
    });
  }

  async function loadPanelShellFragment(src) {
    const cachedMarkup = bootstrapState.cachedHeavyPanelMarkupBySrc.get(src);
    if (typeof cachedMarkup === "string") return cachedMarkup;

    const pendingMarkup = bootstrapState.heavyPanelMarkupPromisesBySrc.get(src);
    if (pendingMarkup) return pendingMarkup;

    const pending = fetch(src, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load ${src}: HTTP ${response.status}`);
        return response.text();
      })
      .then((markup) => {
        bootstrapState.cachedHeavyPanelMarkupBySrc.set(src, markup);
        bootstrapState.heavyPanelMarkupPromisesBySrc.delete(src);
        return markup;
      })
      .catch((error) => {
        bootstrapState.heavyPanelMarkupPromisesBySrc.delete(src);
        throw error;
      });

    bootstrapState.heavyPanelMarkupPromisesBySrc.set(src, pending);
    return pending;
  }

  async function ensureHeavyPanelShell(
    mode = getModeFromUrl(window.location.search),
    sectionKey = bootstrapState.sectionFilter
  ) {
    const pending = (bootstrapState.heavyShellPromise || Promise.resolve()).then(async () => {
      const mountNode = document.getElementById("dashboard-heavy-panels");
      if (!mountNode) return;
      const sourceUrls = resolveHeavyPanelSources(mode, sectionKey);
      for (const src of sourceUrls) {
        if (bootstrapState.loadedHeavyPanelSources.has(src)) continue;
        mountNode.insertAdjacentHTML("beforebegin", await loadPanelShellFragment(src));
        markHeavyPanelSourceLoaded(src);
      }
      mountNode.dataset.loaded = bootstrapState.loadedHeavyPanelSources.size > 0 ? "true" : "";
      mountNode.hidden = bootstrapState.loadedHeavyPanelSources.size > 0;
    });
    bootstrapState.heavyShellPromise = pending.catch((error) => {
      bootstrapState.heavyShellPromise = null;
      throw error;
    });
    return bootstrapState.heavyShellPromise;
  }

  function ensureHeavyScripts(
    mode = getModeFromUrl(window.location.search),
    sectionKey = bootstrapState.sectionFilter
  ) {
    return getHeavyScriptSources(mode, sectionKey).reduce(
      (promise, src) => promise.then(() => loadScript(src)),
      Promise.resolve()
    );
  }

  async function loadHeavyDashboard(
    mode = getModeFromUrl(window.location.search),
    sectionKey = bootstrapState.sectionFilter
  ) {
    const previousPending = bootstrapState.heavyStackPromise || Promise.resolve();
    bootstrapState.heavyStackPromise = previousPending
      .then(async () => {
        await ensureHeavyPanelShell(mode, sectionKey);
        await ensureHeavyScripts(mode, sectionKey);
      })
      .catch((error) => {
        bootstrapState.heavyStackPromise = null;
        setStatusMessage(
          "actions-required-status",
          `Failed to load full dashboard: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      });
    return bootstrapState.heavyStackPromise;
  }

  function scheduleLocalAgentationSupport() {
    const host = String(window.location.hostname || "")
      .trim()
      .toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return;

    const loadSupport = () => {
      const loadWhenVisible = () => {
        if (document.visibilityState === "hidden") {
          window.setTimeout(loadSupport, 1200);
          return;
        }
        void loadScript(LOCAL_AGENTATION_LOADER_SRC);
      };

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(loadWhenVisible, { timeout: 2500 });
        return;
      }

      window.setTimeout(loadWhenVisible, 1200);
    };

    if (document.readyState === "complete") {
      loadSupport();
      return;
    }

    window.addEventListener("load", loadSupport, { once: true });
  }

  async function bootstrapDefaultCommunity() {
    applyDefaultCommunityVisibility();
    renderActionsPanel();
    bindSectionFilter();
    void loadHeavyDashboard("all", "all").catch(() => {});

    try {
      bootstrapState.contributorsSnapshot = await loadContributorsSnapshot();
      renderActionsPanel();
      bindSectionFilter();
      renderContributorsState(bootstrapState.contributorsSnapshot);
    } catch (error) {
      setStatusMessage(
        "contributors-status",
        `Failed to load contributors-snapshot.json: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  scheduleLocalAgentationSupport();

  if (isDefaultCommunityPath()) {
    void bootstrapDefaultCommunity();
    return;
  }

  void loadHeavyDashboard();
})();
