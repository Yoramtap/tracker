import { resolveDashboardAppDeps } from "./dashboard-app/deps.js";
import { createProductPanels } from "./dashboard-app/product-panels.js?v=local12";
import { createWorkflowPanels } from "./dashboard-app/workflow-panels.js?v=local22";

(function initDashboardApp() {
  const {
    dashboardRuntimeContract,
    dashboardUiUtils,
    dashboardDataUtils,
    dashboardChartCore,
    dashboardSvgCore,
    getDashboardCharts,
    getDashboardPretextLayout,
    getPreloadedDataSourcePromises,
    browserApi
  } = resolveDashboardAppDeps();
  const PRODUCT_CYCLE_SCOPE = "inception";
  const PRODUCT_CYCLE_SCOPE_LABEL = "All ideas";
  const PRODUCT_CYCLE_MULTI_TEAM_KEY = "multiteam";
  const PRODUCT_CYCLE_MULTI_TEAM_LABEL = "Cross-team";
  const PRODUCT_CYCLE_TEAM_ORDER = [
    PRODUCT_CYCLE_MULTI_TEAM_KEY,
    "api",
    "frontend",
    "broadcast",
    "workers",
    "titanium",
    "shift",
    "unmapped"
  ];
  const FOURTEEN_DAY_WINDOW_KEY = "14d";
  const THIRTY_DAY_WINDOW_KEY = "30d";
  const ALL_TEAM_SCOPE_KEY = "all";
  const ALL_TEAMS_LABEL = "All teams";
  const BUG_TRENDS_VIEW_DEFAULT = "graph";
  const BUG_TRENDS_VIEW_MODES = [BUG_TRENDS_VIEW_DEFAULT, "table"];
  const BUG_TRENDS_WINDOW_DEFAULT = "90d";
  const PR_ACTIVITY_LEGACY_WINDOW_DEFAULT = "90d";
  const PR_ACTIVITY_LEGACY_SPRINT_WINDOWS = [FOURTEEN_DAY_WINDOW_KEY, THIRTY_DAY_WINDOW_KEY, "90d"];
  const TEAM_BUG_JQL = {
    api: "project = TFC AND type = Bug AND labels = API",
    legacy: "project = TFC AND type = Bug AND labels = Frontend",
    react: 'project = TFC AND type = Bug AND labels = "NewFrontend"',
    bc: "project = TFC AND type = Bug AND labels = Broadcast",
    workers: "project = TFO AND type = Bug AND labels = Workers",
    titanium: 'project = MESO AND type = Bug AND labels = "READY"'
  };
  const PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT = "delivery";
  const PRODUCT_DELIVERY_WORKFLOW_VIEW_MODES = [PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT, "workflow"];
  const MANAGEMENT_FLOW_SCOPES = ["ongoing", "done"];
  const LIFECYCLE_TEAM_SCOPE_DEFAULT = "all";
  const PRODUCT_CYCLE_TEAM_DEFAULT = "all";
  const DEVELOPMENT_WORKFLOW_WINDOWS = [
    FOURTEEN_DAY_WINDOW_KEY,
    THIRTY_DAY_WINDOW_KEY,
    "90d",
    "6m",
    "1y"
  ];
  const PR_ACTIVITY_LEGACY_WINDOWS = [...DEVELOPMENT_WORKFLOW_WINDOWS, "2y"];
  const SHARED_ROLLING_PERIOD_WINDOWS = DEVELOPMENT_WORKFLOW_WINDOWS;
  const SHARED_ROLLING_PERIOD_PARAM_NAMES = [
    "bug-trends-window",
    "pr-cycle-window",
    "pr-activity-legacy-window"
  ];
  const SHIPMENT_MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC"
  });
  const getSourcePath = (rootKey, relativePath) =>
    dashboardRuntimeContract.getSourcePath(rootKey, relativePath);
  const SECTION_FILTER_DEFAULT = dashboardRuntimeContract.defaultSection || "community";
  const SECTION_FILTER_ITEMS = Array.isArray(dashboardRuntimeContract.sectionFilterItems)
    ? dashboardRuntimeContract.sectionFilterItems
    : [];
  const SECTION_FILTER_OPTIONS = SECTION_FILTER_ITEMS.map(({ value }) => value);
  const SECTION_FILTER_PANEL_IDS = {
    shipped: ["product-cycle-shipments-panel"],
    "product-delivery": ["cycle-time-to-ship-panel"],
    uat: ["uat-acceptance-time-panel"],
    community: ["community-contributors-panel"],
    "dev-trends": ["development-workflow-trends-panel"],
    "dev-ai": ["development-workflow-trends-panel"],
    "dev-breakdown": ["development-workflow-breakdown-panel"],
    bug: ["bug-trends-panel"]
  };
  const SECTION_FRESHNESS_CONTEXT_IDS = {
    community: "contributors-context",
    shipped: "product-cycle-shipments-context",
    "product-delivery": "product-cycle-context",
    uat: "management-facility-context",
    "dev-trends": "pr-activity-legacy-context",
    "dev-ai": "pr-activity-legacy-context",
    "dev-breakdown": "workflow-breakdown-context",
    bug: "bug-trends-context"
  };
  const CHART_CONFIG = {
    trend: {
      panelId: "bug-trends-panel",
      statusId: "bug-trends-status",
      contextId: "bug-trends-context",
      summaryId: "bug-trends-summary",
      containerId: "bug-trends-chart",
      missingMessage: "Bug trends view unavailable: chart renderer missing."
    },
    "management-facility": {
      panelId: "uat-acceptance-time-panel",
      statusId: "management-facility-status",
      contextId: "management-facility-context",
      containerId: "development-vs-uat-by-facility-chart",
      rendererName: "renderDevelopmentVsUatByFacilityChart",
      missingMessage: "Development vs UAT chart unavailable: renderer missing."
    },
    "pr-activity-legacy": {
      panelId: "development-workflow-trends-panel",
      statusId: "pr-activity-legacy-status",
      contextId: "pr-activity-legacy-context",
      summaryId: "pr-activity-legacy-summary",
      containerId: "pr-activity-legacy-count-chart",
      missingMessage: "No Jira-linked PR activity found in pr-activity-snapshot.json."
    },
    contributors: {
      panelId: "community-contributors-panel",
      statusId: "contributors-status",
      contextId: "contributors-context",
      containerId: "top-contributors-chart",
      missingMessage: "Contributors chart unavailable: renderer missing."
    },
    "product-cycle-shipments": {
      panelId: "product-cycle-shipments-panel",
      statusId: "product-cycle-shipments-status",
      contextId: "product-cycle-shipments-context",
      summaryId: "product-cycle-shipments-summary",
      containerId: "product-cycle-shipments-chart",
      missingMessage: "No product cycle shipments found in product-cycle-shipments-snapshot.json."
    },
    "product-cycle": {
      panelId: "cycle-time-to-ship-panel",
      statusId: "product-cycle-status",
      contextId: "product-cycle-context",
      containerId: "cycle-time-parking-lot-to-done-chart",
      missingMessage: "No product cycle aggregates found in product-cycle-snapshot.json."
    },
    "workflow-breakdown": {
      panelId: "development-workflow-breakdown-panel",
      statusId: "workflow-breakdown-status",
      contextId: "workflow-breakdown-context",
      containerId: "workflow-breakdown-card",
      missingMessage: "No workflow breakdown data found in pr-cycle-snapshot.json."
    }
  };
  const CHART_STATUS_IDS = [
    ...new Set(Object.values(CHART_CONFIG).map((config) => config.statusId))
  ];
  const PANEL_DISPLAY_ORDER = [
    "actions-required-panel",
    "product-cycle-shipments-panel",
    "community-contributors-panel",
    "uat-acceptance-time-panel",
    "cycle-time-to-ship-panel",
    "development-workflow-breakdown-panel",
    "development-workflow-trends-panel",
    "bug-trends-panel"
  ];
  const DATA_SOURCE_CONFIG = {
    snapshot: {
      stateKey: "snapshot",
      url: getSourcePath("data", "backlog-snapshot.json"),
      errorMessage: "Failed to load backlog-snapshot.json",
      statusIds: ["bug-trends-status"],
      clearContainers: ["bug-trends-chart", "bug-trends-table"]
    },
    prActivity: {
      stateKey: "prActivitySnapshot",
      url: getSourcePath("data", "pr-activity-snapshot.json"),
      errorMessage: "Failed to load pr-activity-snapshot.json",
      statusIds: ["pr-activity-legacy-status", "workflow-breakdown-status"],
      clearContainers: [
        "pr-activity-legacy-count-chart",
        "pr-activity-legacy-merge-time-chart",
        "workflow-breakdown-card"
      ]
    },
    managementFacility: {
      stateKey: "managementFacilitySnapshot",
      url: getSourcePath("data", "management-facility-snapshot.json"),
      errorMessage: "Failed to load management-facility-snapshot.json",
      statusIds: ["management-facility-status"],
      clearContainers: ["development-vs-uat-by-facility-chart"]
    },
    productCycle: {
      stateKey: "productCycle",
      url: getSourcePath("data", "product-cycle-snapshot.json"),
      errorMessage: "Failed to load product-cycle-snapshot.json",
      statusIds: ["product-cycle-status"]
    },
    productCycleShipments: {
      stateKey: "productCycleShipments",
      url: getSourcePath("data", "product-cycle-shipments-snapshot.json"),
      errorMessage: "Failed to load product-cycle-shipments-snapshot.json",
      statusIds: ["product-cycle-shipments-status"],
      clearContainers: ["product-cycle-shipments-chart"]
    },
    contributors: {
      stateKey: "contributors",
      url: getSourcePath("data", "contributors-snapshot.json"),
      errorMessage: "Failed to load contributors-snapshot.json",
      statusIds: ["contributors-status"],
      clearContainers: ["top-contributors-chart"]
    },
    prCycle: {
      stateKey: "prCycle",
      url: getSourcePath("data", "pr-cycle-snapshot.json"),
      errorMessage: "Failed to load pr-cycle-snapshot.json",
      statusIds: ["workflow-breakdown-status"],
      clearContainers: ["workflow-breakdown-card"]
    }
  };
  const PRELOADED_DATA_SOURCE_PROMISES = getPreloadedDataSourcePromises();
  const CHART_DATA_SOURCES = {
    trend: ["snapshot"],
    "management-facility": ["managementFacility"],
    "pr-activity-legacy": ["prActivity"],
    contributors: ["contributors"],
    "product-cycle-shipments": ["productCycleShipments"],
    "product-cycle": ["productCycle"],
    "workflow-breakdown": ["prCycle"]
  };
  let CHART_RENDERERS = {};

  function productDeliveryWorkflowViewKey(value) {
    return normalizeOption(
      value,
      PRODUCT_DELIVERY_WORKFLOW_VIEW_MODES,
      PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT
    );
  }

  function bugTrendsViewKey(value) {
    return normalizeOption(value, BUG_TRENDS_VIEW_MODES, BUG_TRENDS_VIEW_DEFAULT);
  }

  function bugTrendsWindowKey(value) {
    return sharedRollingPeriodKey(value, BUG_TRENDS_WINDOW_DEFAULT);
  }

  function prActivityLegacyWindowKey(value) {
    return normalizeOption(value, PR_ACTIVITY_LEGACY_WINDOWS, PR_ACTIVITY_LEGACY_WINDOW_DEFAULT);
  }

  function sharedRollingPeriodKey(value, fallback = BUG_TRENDS_WINDOW_DEFAULT) {
    return normalizeOption(value, SHARED_ROLLING_PERIOD_WINDOWS, fallback);
  }

  function isSharedRollingPeriod(value) {
    return SHARED_ROLLING_PERIOD_WINDOWS.includes(String(value || "").trim());
  }

  function normalizeDashboardMode(mode) {
    return mode === "composition" ? "trend" : mode;
  }

  function defaultBugTrendsViewForMode(mode) {
    return mode === "composition" ? "table" : BUG_TRENDS_VIEW_DEFAULT;
  }

  function sectionFilterKey(value) {
    const rawSection = String(value || "")
      .trim()
      .toLowerCase();
    if (rawSection === "product") return "product-delivery";
    if (rawSection === "management" || rawSection === "management-facility") return "uat";
    if (rawSection === "development" || rawSection === "pr-activity") return "dev-trends";
    if (rawSection === "ai-use" || rawSection === "dev-ai" || rawSection === "pr-activity-ai") {
      return "dev-ai";
    }
    if (rawSection === "workflow-breakdown" || rawSection === "pr-cycle") return "dev-breakdown";
    return normalizeOption(rawSection, SECTION_FILTER_OPTIONS, SECTION_FILTER_DEFAULT);
  }

  function isPanelVisibleForSection(panelId, sectionKey = state.sectionFilter) {
    const activeSection = sectionFilterKey(sectionKey);
    const normalizedPanelId = String(panelId || "").trim();
    return (SECTION_FILTER_PANEL_IDS[activeSection] || []).includes(normalizedPanelId);
  }

  function renderSectionFilteredPanels() {
    applyModeVisibility();
    ensurePanelBackToTopControls();
    ensureActiveSourcesLoaded();
    renderVisibleCharts();
    renderActivePanelFreshnessFooter();
  }

  function getActiveSectionFreshnessTimestamp(
    activeSection = sectionFilterKey(state.sectionFilter)
  ) {
    if (activeSection === "community") return state.contributors?.updatedAt;
    if (activeSection === "shipped") return state.productCycleShipments?.generatedAt;
    if (activeSection === "product-delivery") return state.productCycle?.generatedAt;
    if (activeSection === "uat") return state.managementFacilitySnapshot?.updatedAt;
    if (activeSection === "dev-trends" || activeSection === "dev-ai") {
      return state.prActivitySnapshot?.updatedAt;
    }
    if (activeSection === "dev-breakdown") return state.prCycle?.updatedAt;
    if (activeSection === "bug") return state.snapshot?.updatedAt;
    return "";
  }

  function renderActivePanelFreshnessFooter() {
    if (state.mode !== "all") return;
    const activeSection = sectionFilterKey(state.sectionFilter);
    const contextId = SECTION_FRESHNESS_CONTEXT_IDS[activeSection];
    if (!contextId) return;
    setPanelContext(
      document.getElementById(contextId),
      formatContextWithFreshness("", getActiveSectionFreshnessTimestamp(activeSection))
    );
  }

  async function renderSectionFilteredPanelsAfterShell() {
    if (state.mode !== "all") {
      renderSectionFilteredPanels();
      return;
    }

    const ensureHeavyPanelShell = dashboardRuntimeContract?.ensureHeavyPanelShell;
    const ensureHeavyScripts = dashboardRuntimeContract?.ensureHeavyScripts;
    if (typeof ensureHeavyPanelShell === "function") {
      try {
        await ensureHeavyPanelShell(state.mode, state.sectionFilter);
        if (typeof ensureHeavyScripts === "function") {
          await ensureHeavyScripts(state.mode, state.sectionFilter);
        }
        applyDashboardPanelOrder();
        ensurePanelBackToTopControls();
        syncDashboardControlsFromState(CONTROL_BINDINGS, state);
        bindDashboardControlState(CONTROL_BINDINGS, state);
      } catch (error) {
        setStatusMessage(
          "actions-required-status",
          `Failed to load dashboard section: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }
    }

    renderSectionFilteredPanels();
  }

  async function renderSectionSelectionChange() {
    renderActionsRequiredFrame();
    await renderSectionFilteredPanelsAfterShell();
    renderActionsRequiredFrame();
  }

  function renderSectionFilterRadios(name = "report-section", selectedValue = state.sectionFilter) {
    const renderTitleMarkup = (value, label) => `
      <span class="report-intro__title">${escapeHtml(label)}</span>${
        value === "dev-ai" ? '<span class="report-intro__badge report-intro__badge--stacked">Beta</span>' : ""
      }
    `;
    return SECTION_FILTER_ITEMS.map(
      ({ value, label }) => `
          <label class="report-intro__card report-intro__card--${escapeHtml(value)}">
            <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${
              value === selectedValue ? " checked" : ""
            } />
            <span class="report-intro__label">
              ${renderTitleMarkup(value, label)}
            </span>
          </label>
        `
    ).join("");
  }

  function renderSegmentedRadioGroup(name, options, selectedValue, className = "") {
    const classes = ["radio-group-card", "radio-group-card--segmented", className]
      .filter(Boolean)
      .join(" ");
    return `
      <fieldset class="${escapeHtml(classes)}">
        <legend>${escapeHtml(name)}</legend>
        ${(Array.isArray(options) ? options : [])
          .map(
            ({ value, label, srLabel }) => `
              <label>
                <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${
                  value === selectedValue ? " checked" : ""
                } />
                <span aria-hidden="${srLabel ? "true" : "false"}">${escapeHtml(label)}</span>${
                  srLabel ? `<span class="sr-only">${escapeHtml(srLabel)}</span>` : ""
                }
              </label>
            `
          )
          .join("")}
      </fieldset>
    `;
  }

  function renderPageToolbarShell({
    title,
    digest,
    headerControlsMarkup = "",
    controlsMarkup = "",
    className = ""
  }) {
    const classes = ["development-page-toolbar", "page-context-toolbar", className]
      .filter(Boolean)
      .join(" ");
    return `
      <div class="${escapeHtml(classes)}" aria-label="${escapeHtml(title)} controls">
        <div class="development-page-toolbar__header">
          <div class="development-page-toolbar__copy">
            <h3>${escapeHtml(title)}</h3>
            <p class="development-page-toolbar__digest">${escapeHtml(digest)}</p>
          </div>
          ${
            headerControlsMarkup
              ? `<div class="development-page-toolbar__header-controls">${headerControlsMarkup}</div>`
              : ""
          }
        </div>
        ${
          controlsMarkup
            ? `<div class="development-page-toolbar__controls">${controlsMarkup}</div>`
            : ""
        }
      </div>
    `;
  }

  function renderLabeledControl(label, markup, className = "") {
    const classes = ["development-page-toolbar__control", className].filter(Boolean).join(" ");
    return `
      <div class="${escapeHtml(classes)}">
        <span class="development-page-toolbar__label">${escapeHtml(label)}</span>
        ${markup}
      </div>
    `;
  }

  function windowOptions(values) {
    return values.map((value) => ({
      value,
      label: getPeriodButtonLabel(value),
      srLabel: getPrActivityWindowLabel(value)
    }));
  }

  function getPeriodButtonLabel(windowKey) {
    switch (windowKey) {
      case FOURTEEN_DAY_WINDOW_KEY:
        return "14 days";
      case THIRTY_DAY_WINDOW_KEY:
        return "30 days";
      case "90d":
        return "90 days";
      case "6m":
        return "6 months";
      case "1y":
        return "1 year";
      case "2y":
        return "2 years";
      default:
        return String(windowKey || "");
    }
  }

  function renderPrCycleTeamSwitch() {
    const selectedTeam = String(state.prCycleTeam || ALL_TEAM_SCOPE_KEY)
      .trim()
      .toLowerCase();
    const teamOptions = [
      { value: "all", label: "All" },
      { value: "api", label: "API" },
      { value: "legacy", label: "Legacy FE" },
      { value: "react", label: "React FE" },
      { value: "bc", label: "BC" },
      { value: "workers", label: "Workers" },
      { value: "titanium", label: "Titanium" }
    ];
    return `
      <div class="pr-cycle-team-switch page-toolbar__team-switch" role="radiogroup" aria-label="Workflow breakdown team">
        ${teamOptions
          .map(
            ({ value, label }) => `
              <label class="pr-cycle-team-pill">
                <input type="radio" name="pr-cycle-team" value="${escapeHtml(value)}"${
                  value === selectedTeam ? " checked" : ""
                } />
                <span>${escapeHtml(label)}</span>
              </label>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderDevelopmentPageToolbar(activeSection = sectionFilterKey(state.sectionFilter)) {
    if (
      !["dev-trends", "dev-ai", "dev-breakdown"].includes(activeSection) ||
      state.mode !== "all"
    ) {
      return "";
    }
    const isBreakdown = activeSection === "dev-breakdown";
    const windowName = isBreakdown ? "pr-cycle-window" : "pr-activity-legacy-window";
    const rangeOptions = isBreakdown ? SHARED_ROLLING_PERIOD_WINDOWS : PR_ACTIVITY_LEGACY_WINDOWS;
    const pageCopyBySection = {
      "dev-trends": {
        title: "PR Volume",
        digest: "Opened PR volume by team for the selected period."
      },
      "dev-ai": {
        title: "AI PRs",
        digest: "Beta: share of opened PRs labeled as AI-assisted."
      },
      "dev-breakdown": {
        title: "Dev Throughput",
        digest: "How quickly teams move development work through tracked stages."
      }
    };
    const selectedWindow = isBreakdown
      ? sharedRollingPeriodKey(state.developmentWorkflowWindow, THIRTY_DAY_WINDOW_KEY)
      : prActivityLegacyWindowKey(state.prActivityLegacyWindow);
    const controlsMarkup = [
      isBreakdown
        ? renderLabeledControl("Team", renderPrCycleTeamSwitch(), "page-toolbar__team-control")
        : "",
      renderLabeledControl(
        "Period",
        renderSegmentedRadioGroup(
          windowName,
          windowOptions(rangeOptions),
          selectedWindow,
          "development-page-toolbar__group"
        ),
        "page-toolbar__range-control"
      )
    ]
      .filter(Boolean)
      .join("");

    return renderPageToolbarShell({
      ...pageCopyBySection[activeSection],
      controlsMarkup,
      className: "development-work-page-toolbar"
    });
  }

  function formatShipmentMonthButton(dateText) {
    const parsed = new Date(`${String(dateText || "").trim()}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) return String(dateText || "").trim();
    return SHIPMENT_MONTH_SHORT_FORMATTER.format(parsed);
  }

  function renderShippedNavIcon(direction) {
    const isPrevious = direction === "previous";
    const path = isPrevious ? "M9.5 3.5 5.5 8l4 4.5" : "M6.5 3.5 10.5 8l-4 4.5";
    return `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
  }

  function renderShippedPageToolbar() {
    const activeSection = sectionFilterKey(state.sectionFilter);
    if (activeSection !== "shipped" || state.mode !== "all") return "";
    const timelineSnapshot = state.productCycleShipments?.chartData?.shippedTimeline;
    const selection = productPanels.resolveShipmentTimelineSelection(
      timelineSnapshot,
      state.productCycleShipmentsYear,
      state.productCycleShipmentsMonthKey
    );
    const { availableYears, monthsInYear, selectedYear, selectedMonthKey } = selection;
    if (availableYears.length > 0) {
      state.productCycleShipmentsYear = selectedYear;
      state.productCycleShipmentsMonthKey = selectedMonthKey;
    }
    const activeYearIndex = Math.max(0, availableYears.indexOf(selectedYear));
    const previousYear = activeYearIndex > 0 ? availableYears[activeYearIndex - 1] : "";
    const nextYear =
      activeYearIndex < availableYears.length - 1 ? availableYears[activeYearIndex + 1] : "";
    const monthMap = new Map(
      monthsInYear.map((month) => [String(month?.monthKey || "").trim(), month])
    );
    const monthButtonsMarkup =
      selectedYear && availableYears.length > 0
        ? Array.from({ length: 12 }, (_, monthIndex) => {
            const monthNumber = String(monthIndex + 1).padStart(2, "0");
            const monthKey = `${selectedYear}-${monthNumber}`;
            const monthSnapshot = monthMap.get(monthKey) || null;
            const monthStart = monthSnapshot?.monthStart || `${monthKey}-01`;
            const isActive = monthKey === selectedMonthKey;
            const isDisabled = !monthSnapshot;
            return `
              <button
                type="button"
                class="shipped-month-picker__button${isActive ? " is-active" : ""}"
                data-shipped-month-key="${escapeHtml(monthKey)}"
                ${isDisabled ? "disabled" : ""}
                aria-pressed="${isActive ? "true" : "false"}"
              >
                <span class="shipped-month-picker__label">${escapeHtml(
                  formatShipmentMonthButton(monthStart)
                )}</span>
              </button>
            `;
          }).join("")
        : "";

    const controlsMarkup =
      availableYears.length > 0
        ? renderLabeledControl(
            "Period",
            `
              <div class="shipped-timeline__selector shipped-page-toolbar__selector">
                <div class="shipped-timeline__year-switch" aria-label="Shipment year">
                  <button
                    type="button"
                    class="shipped-timeline__nav"
                    ${previousYear ? `data-shipped-year-target="${escapeHtml(previousYear)}"` : ""}
                    ${previousYear ? "" : "disabled"}
                    aria-label="${previousYear ? `Show ${escapeHtml(previousYear)}` : "No previous year"}"
                  >
                    ${renderShippedNavIcon("previous")}
                  </button>
                  <div class="shipped-timeline__year-label">${escapeHtml(selectedYear)}</div>
                  <button
                    type="button"
                    class="shipped-timeline__nav"
                    ${nextYear ? `data-shipped-year-target="${escapeHtml(nextYear)}"` : ""}
                    ${nextYear ? "" : "disabled"}
                    aria-label="${nextYear ? `Show ${escapeHtml(nextYear)}` : "No next year"}"
                  >
                    ${renderShippedNavIcon("next")}
                  </button>
                </div>
                <div class="shipped-month-picker" role="group" aria-label="Months in ${escapeHtml(
                  selectedYear
                )}">
                  ${monthButtonsMarkup}
                </div>
              </div>
            `,
            "shipped-page-toolbar__control"
          )
        : "";

    return renderPageToolbarShell({
      title: "What we shipped",
      digest: "See how many product ideas each team is shipping over time.",
      controlsMarkup,
      className: "shipped-page-toolbar"
    });
  }

  function renderCommunityPageToolbar() {
    return renderPageToolbarShell({
      title: "Community contributions",
      digest: "See how much technical work our community is contributing."
    });
  }

  function renderProductDeliveryPageToolbar() {
    const controlsMarkup = renderLabeledControl(
      "Team",
      `<div id="product-cycle-team-switch" class="pr-cycle-team-switch page-toolbar__team-switch" role="radiogroup" aria-label="Product delivery and workflow team"></div>`,
      "page-toolbar__team-control"
    );
    return renderPageToolbarShell({
      title: "Product delivery and workflow",
      digest: "Compare how long ideas take to ship once they enter active development.",
      controlsMarkup,
      className: "product-delivery-page-toolbar"
    });
  }

  function renderUatPageToolbar() {
    return renderPageToolbarShell({
      title: "User acceptance time by business unit",
      digest: "Compare user approval time for pending and verified work."
    });
  }

  function renderBugPageToolbar() {
    const windowKey = bugTrendsWindowKey(state.bugTrendsWindow);
    const controlsMarkup = renderLabeledControl(
      "Period",
      renderSegmentedRadioGroup(
        "bug-trends-window",
        windowOptions(DEVELOPMENT_WORKFLOW_WINDOWS),
        windowKey,
        "development-page-toolbar__group"
      ),
      "page-toolbar__range-control"
    );
    return renderPageToolbarShell({
      title: "Bug trends",
      digest: "Track backlog pressure by team across the selected range.",
      controlsMarkup,
      className: "development-work-page-toolbar"
    });
  }

  function renderActivePageToolbar() {
    if (state.mode !== "all") return "";
    const activeSection = sectionFilterKey(state.sectionFilter);
    if (activeSection === "community") return renderCommunityPageToolbar();
    if (activeSection === "shipped") return renderShippedPageToolbar();
    if (activeSection === "product-delivery") return renderProductDeliveryPageToolbar();
    if (activeSection === "uat") return renderUatPageToolbar();
    if (["dev-trends", "dev-ai", "dev-breakdown"].includes(activeSection)) {
      return renderDevelopmentPageToolbar(activeSection);
    }
    if (activeSection === "bug") return renderBugPageToolbar();
    return "";
  }

  function bindShippedPageToolbarNavigation(rootNode) {
    const toolbar = rootNode?.querySelector?.(".shipped-page-toolbar");
    if (!toolbar) return;
    toolbar.onclick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const yearButton = target.closest("[data-shipped-year-target]");
      if (yearButton instanceof HTMLButtonElement && !yearButton.disabled) {
        state.productCycleShipmentsYear =
          String(yearButton.dataset.shippedYearTarget || "").trim() ||
          state.productCycleShipmentsYear;
        state.productCycleShipmentsMonthKey = "";
        renderActionsRequiredFrame();
        productPanels.renderProductCycleShipmentsTimeline();
        return;
      }
      const monthButton = target.closest("[data-shipped-month-key]");
      if (monthButton instanceof HTMLButtonElement && !monthButton.disabled) {
        state.productCycleShipmentsMonthKey =
          String(monthButton.dataset.shippedMonthKey || "").trim() ||
          state.productCycleShipmentsMonthKey;
        renderActionsRequiredFrame();
        productPanels.renderProductCycleShipmentsTimeline();
      }
    };
  }

  let CONTROL_BINDINGS = [];

  const state = {
    snapshot: null,
    prActivitySnapshot: null,
    managementFacilitySnapshot: null,
    contributors: null,
    productCycle: null,
    productCycleShipments: null,
    prCycle: null,
    loadedSources: {},
    loadErrors: {},
    mode: "all",
    sectionFilter: SECTION_FILTER_DEFAULT,
    bugTrendsView: BUG_TRENDS_VIEW_DEFAULT,
    bugTrendsWindow: BUG_TRENDS_WINDOW_DEFAULT,
    prActivityLegacyHiddenKeys: [],
    developmentWorkflowWindow: THIRTY_DAY_WINDOW_KEY,
    prActivityLegacyView: "activity",
    prActivityLegacyWindow: PR_ACTIVITY_LEGACY_WINDOW_DEFAULT,
    productDeliveryWorkflowView: PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT,
    productCycleTeam: PRODUCT_CYCLE_TEAM_DEFAULT,
    productCycleShipmentsYear: "",
    productCycleShipmentsMonthKey: "",
    managementFlowScope: "ongoing",
    prCycleTeam: ALL_TEAM_SCOPE_KEY,
    prCycleWindow: THIRTY_DAY_WINDOW_KEY
  };

  const queuedChartModes = new Set();
  let chartRenderFrame = 0;
  let resizeRenderFrame = 0;
  let windowResizeBound = false;
  const {
    toNumber,
    getOldestTimestamp,
    setStatusMessage,
    setStatusMessageForIds,
    getThemeColors,
    clearChartContainer,
    getModeFromUrl,
    getRequiredSourceKeys,
    syncControlValue,
    syncRadioAvailability,
    readDashboardControlStateFromUrl,
    syncDashboardControlsFromState,
    bindDashboardControlState,
    setPanelContext,
    formatContextWithFreshness,
    getSnapshotContextTimestamp,
    renderDashboardRefreshStrip,
    renderDashboardChartState,
    showPanelStatus,
    withChart,
    escapeHtml,
    isEmbedMode
  } = dashboardUiUtils;
  const { buildTeamColorMap, buildTintMap, toCount } = dashboardDataUtils;
  const {
    React,
    buildRowMarkup,
    getPrCycleTeamColor,
    h,
    isCompactViewport,
    renderProductCycleCard,
    renderWithRoot
  } = dashboardChartCore;
  const { SvgChartShell, linearScale, withAlpha } = dashboardSvgCore;
  const { addEventListener, fetchJson, getLocationSearch, hasUrlParam, requestAnimationFrame } =
    browserApi;

  const PR_ACTIVITY_LINE_DEFS = [
    { dataKey: "api", name: "API", colorKey: "api" },
    { dataKey: "legacy", name: "Legacy FE", colorKey: "legacy" },
    { dataKey: "react", name: "React FE", colorKey: "react" },
    { dataKey: "bc", name: "BC", colorKey: "bc" },
    { dataKey: "workers", name: "Workers", colorKey: "workers" },
    { dataKey: "titanium", name: "Titanium", colorKey: "titanium" },
    { dataKey: "unmapped", name: "Unmapped", colorKey: "unmapped" }
  ];
  const PR_ACTIVITY_VISIBLE_LINE_DEFS = PR_ACTIVITY_LINE_DEFS.filter(
    (lineDef) => lineDef.dataKey !== "unmapped"
  );
  const PR_ACTIVITY_EVENT_REFERENCE_MARKERS = [
    { date: "2024-04-13", label: "NAB" },
    { date: "2024-09-13", label: "IBC" },
    { date: "2025-04-05", label: "NAB" },
    { date: "2025-09-12", label: "IBC" },
    { date: "2026-04-18", label: "NAB" },
    { date: "2026-09-11", label: "IBC" }
  ];
  const PR_ACTIVITY_ONE_TIME_REFERENCE_MARKERS = [{ date: "2026-01-01", label: "Codex" }];
  function toChartDateValue(dateText) {
    const timestamp = new Date(`${String(dateText || "")}T00:00:00Z`).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function formatCompactChartDateTick(value) {
    if (!Number.isFinite(value) || value <= 0) return "";
    const date = new Date(value);
    const month = date.toLocaleDateString("en-US", {
      month: "short",
      timeZone: "UTC"
    });
    const year = date.toLocaleDateString("en-US", {
      year: "2-digit",
      timeZone: "UTC"
    });
    return `${month} '${year}`;
  }

  function formatCompactChartPointDate(dateText) {
    const safeDate = String(dateText || "").trim();
    if (!safeDate) return "";
    const date = new Date(`${safeDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return safeDate;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function formatLegacyPrActivityPointDate(
    dateText,
    { monthlySeries = false, describeSprintBucket = false } = {}
  ) {
    const safeDate = String(dateText || "").trim();
    if (!safeDate) return "";
    const formattedDate = monthlySeries
      ? formatCompactMonthYear(safeDate.slice(0, 7))
      : formatCompactChartPointDate(safeDate);
    return !monthlySeries && describeSprintBucket && formattedDate
      ? `Sprint ending ${formattedDate}`
      : formattedDate;
  }

  function shiftChartIsoDate(dateText, deltaDays) {
    const date = new Date(`${String(dateText || "")}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCDate(date.getUTCDate() + deltaDays);
    return date.toISOString().slice(0, 10);
  }

  function shiftChartIsoMonths(dateText, deltaMonths) {
    const date = new Date(`${String(dateText || "")}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCMonth(date.getUTCMonth() + deltaMonths);
    return date.toISOString().slice(0, 10);
  }

  function isoDateOnlyFromTimestamp(value) {
    const parsed = new Date(String(value || ""));
    if (!Number.isFinite(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function capChartDateToTimestamp(dateText, timestamp) {
    const safeDate = String(dateText || "").trim();
    const ceilingDate = isoDateOnlyFromTimestamp(timestamp);
    if (!safeDate) return "";
    if (!ceilingDate) return safeDate;
    return safeDate > ceilingDate ? ceilingDate : safeDate;
  }

  function getSnapshotDisplayDate(dateText, { preferChartData = false } = {}) {
    return capChartDateToTimestamp(
      dateText,
      getSnapshotContextTimestamp(state, { preferChartData })
    );
  }

  function getPrActivitySnapshot() {
    if (state.prActivitySnapshot && typeof state.prActivitySnapshot === "object") {
      return state.prActivitySnapshot;
    }
    if (state.snapshot?.prActivity && typeof state.snapshot.prActivity === "object") {
      return {
        updatedAt: String(state.snapshot?.updatedAt || "").trim(),
        prActivity: state.snapshot.prActivity
      };
    }
    return null;
  }

  function getManagementFacilitySnapshot() {
    if (state.managementFacilitySnapshot && typeof state.managementFacilitySnapshot === "object") {
      return state.managementFacilitySnapshot;
    }
    if (state.snapshot?.chartData?.managementBusinessUnit) {
      return {
        updatedAt: String(state.snapshot?.updatedAt || "").trim(),
        chartDataUpdatedAt: String(state.snapshot?.chartDataUpdatedAt || "").trim(),
        chartData: state.snapshot.chartData
      };
    }
    return null;
  }

  function getPrActivityDisplayDate(dateText) {
    return capChartDateToTimestamp(
      dateText,
      getOldestTimestamp([getPrActivitySnapshot()?.updatedAt, state.prCycle?.updatedAt])
    );
  }

  function getPrActivityWindowLabel(windowKey) {
    switch (windowKey) {
      case FOURTEEN_DAY_WINDOW_KEY:
        return "Last 14 days";
      case THIRTY_DAY_WINDOW_KEY:
        return "Last 30 days";
      case "90d":
        return "Last 90 days";
      case "6m":
        return "Last 6 months";
      case "1y":
        return "Last year";
      case "2y":
        return "Last 2 years";
      default:
        return "Last year";
    }
  }

  function getPrActivityWindowedPoints(points, selectedWindowKey) {
    const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
    if (safePoints.length === 0) {
      return {
        points: [],
        windowKey: selectedWindowKey,
        windowLabel: getPrActivityWindowLabel(selectedWindowKey)
      };
    }
    const latestPoint = safePoints[safePoints.length - 1];
    const latestDate = getPrActivityDisplayDate(latestPoint?.date || "");
    let startDate = latestDate;
    if (selectedWindowKey === FOURTEEN_DAY_WINDOW_KEY)
      startDate = shiftChartIsoDate(latestDate, -13);
    else if (selectedWindowKey === THIRTY_DAY_WINDOW_KEY)
      startDate = shiftChartIsoDate(latestDate, -29);
    else if (selectedWindowKey === "90d") startDate = shiftChartIsoDate(latestDate, -89);
    else if (selectedWindowKey === "6m") startDate = shiftChartIsoMonths(latestDate, -6);
    else startDate = shiftChartIsoMonths(latestDate, -12);
    const filteredPoints = safePoints.filter(
      (point) => getPrActivityDisplayDate(point?.date || "") >= startDate
    );
    return {
      points: filteredPoints.length > 0 ? filteredPoints : safePoints,
      windowKey: selectedWindowKey,
      windowLabel: getPrActivityWindowLabel(selectedWindowKey)
    };
  }

  function getBugTrendWindowedPoints(points, selectedWindowKey) {
    const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
    const windowKey = bugTrendsWindowKey(selectedWindowKey);
    if (safePoints.length === 0) {
      return {
        points: [],
        windowKey,
        windowLabel: getPrActivityWindowLabel(windowKey)
      };
    }

    const latestPoint = safePoints[safePoints.length - 1];
    const latestDate = getSnapshotDisplayDate(latestPoint?.date || "");
    let startDate = latestDate;
    if (windowKey === FOURTEEN_DAY_WINDOW_KEY) startDate = shiftChartIsoDate(latestDate, -13);
    else if (windowKey === THIRTY_DAY_WINDOW_KEY) startDate = shiftChartIsoDate(latestDate, -29);
    else if (windowKey === "90d") startDate = shiftChartIsoDate(latestDate, -89);
    else if (windowKey === "6m") startDate = shiftChartIsoMonths(latestDate, -6);
    else startDate = shiftChartIsoMonths(latestDate, -12);

    const filteredPoints = safePoints.filter(
      (point) => getSnapshotDisplayDate(point?.date || "") >= startDate
    );
    return {
      points: filteredPoints.length > 0 ? filteredPoints : safePoints,
      windowKey,
      windowLabel: getPrActivityWindowLabel(windowKey)
    };
  }

  function normalizeOption(value, options, fallback) {
    return options.includes(value) ? value : fallback;
  }

  function applyDashboardPanelOrder() {
    const main = document.getElementById("dashboard-main");
    if (!main) return;
    PANEL_DISPLAY_ORDER.forEach((panelId) => {
      const panel = document.getElementById(panelId);
      if (panel && panel.parentElement === main) {
        main.appendChild(panel);
      }
    });
  }

  function getDashboardTopReturnTarget() {
    return (
      document.getElementById("actions-required-panel") || document.getElementById("dashboard-main")
    );
  }

  function scrollDashboardToTop() {
    const target = getDashboardTopReturnTarget();
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function ensurePanelBackToTopControl(panel) {
    if (!(panel instanceof HTMLElement) || !panel.id || panel.id === "actions-required-panel") {
      return;
    }

    let mount = panel.querySelector(".panel-return");
    if (!mount) {
      mount = document.createElement("div");
      mount.className = "panel-return";
      mount.innerHTML = `
        <button type="button" class="panel-return__button" aria-label="Back to top of dashboard">
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 12.5V3.5"></path>
            <path d="M4.5 7L8 3.5 11.5 7"></path>
          </svg>
        </button>
      `;
      const button = mount.querySelector(".panel-return__button");
      button?.addEventListener("click", scrollDashboardToTop);
      panel.appendChild(mount);
    }
  }

  function ensurePanelBackToTopControls() {
    document.querySelectorAll(".panel").forEach((panel) => ensurePanelBackToTopControl(panel));
  }

  function getConfig(configKey) {
    return CHART_CONFIG[configKey] || null;
  }

  function getRenderer(
    config,
    rendererName = config.rendererName,
    missingMessage = config.missingMessage
  ) {
    const renderer = getDashboardCharts()?.[rendererName];
    if (renderer) return renderer;
    setStatusMessage(config.statusId, missingMessage);
    return null;
  }

  function renderNamedChart(config, props, options = {}) {
    const { rendererName = config.rendererName, missingMessage = config.missingMessage } = options;
    const renderChart = getRenderer(config, rendererName, missingMessage);
    if (!renderChart) return false;
    renderChart(props);
    return true;
  }

  function applyModeVisibility() {
    const validModes = new Set(Object.keys(CHART_CONFIG));
    const selectedMode = validModes.has(state.mode) ? state.mode : "all";
    const showAll = selectedMode === "all";
    const selectedSection = sectionFilterKey(state.sectionFilter);
    const embedMode = isEmbedMode();
    const actionsPanel = document.getElementById("actions-required-panel");
    document.body.classList.toggle("embed-mode", embedMode);
    document.body.classList.toggle("single-chart-mode", embedMode && !showAll);
    document.body.classList.toggle("embedded-frame-mode", embedMode && showAll);
    document.body.classList.toggle(
      "development-section-mode",
      showAll && ["dev-trends", "dev-ai", "dev-breakdown"].includes(selectedSection)
    );
    document.body.classList.toggle(
      "shipped-section-mode",
      showAll && selectedSection === "shipped"
    );
    document.body.classList.toggle(
      "community-section-mode",
      showAll && selectedSection === "community"
    );
    document.body.classList.toggle(
      "product-delivery-section-mode",
      showAll && selectedSection === "product-delivery"
    );
    document.body.classList.toggle("uat-section-mode", showAll && selectedSection === "uat");
    document.body.classList.toggle("bug-section-mode", showAll && selectedSection === "bug");
    if (actionsPanel) actionsPanel.hidden = !showAll;
    for (const [mode, config] of Object.entries(CHART_CONFIG)) {
      const panel = document.getElementById(config.panelId);
      if (!panel) continue;
      panel.hidden = showAll
        ? !isPanelVisibleForSection(config.panelId, selectedSection)
        : mode !== selectedMode;
    }
  }

  function renderActionsRequiredFrame() {
    const panel = document.getElementById("actions-required-panel");
    const listNode = document.getElementById("actions-required-list");
    const contextNode = document.getElementById("actions-required-context");
    const statusNode = document.getElementById("actions-required-status");
    if (!panel || !listNode || !contextNode || !statusNode) return;

    if (state.mode !== "all") {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    setPanelContext(contextNode, "");

    statusNode.hidden = true;
    listNode.innerHTML = `
    <div class="dashboard-overview">
        <div class="dashboard-overview__main">
          <p class="dashboard-overview__eyebrow">Insights</p>
          <h2 class="dashboard-overview__title">Trends for product and teams</h2>
        </div>
        <div class="report-intro">
        <fieldset class="report-intro__grid" aria-label="Report section filter">
          <legend class="sr-only">Report section filter</legend>
          ${renderSectionFilterRadios("report-section", state.sectionFilter)}
        </fieldset>
        </div>
        ${renderActivePageToolbar()}
    </div>
  `;
    syncDashboardControlsFromState(CONTROL_BINDINGS, state);
    bindDashboardControlState(CONTROL_BINDINGS, state);
    bindShippedPageToolbarNavigation(listNode);
  }

  function getPanelLeadMountId(panelId) {
    return `${String(panelId || "").trim()}-lead`;
  }

  function ensurePanelLeadMount(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return null;
    let mount = document.getElementById(getPanelLeadMountId(panelId));
    if (mount) return mount;

    mount = document.createElement("div");
    mount.id = getPanelLeadMountId(panelId);
    mount.className = "panel-lead-mount";
    mount.hidden = true;

    const titleRow = panel.querySelector(".panel-title-row");
    if (titleRow && titleRow.parentElement === panel) {
      titleRow.insertAdjacentElement("afterend", mount);
    } else {
      panel.prepend(mount);
    }
    return mount;
  }

  function clearPanelLead(panelId) {
    const mount = ensurePanelLeadMount(panelId);
    if (!mount) return;
    mount.innerHTML = "";
    mount.hidden = true;
  }

  function clearPanelStats(summaryId) {
    const mount = document.getElementById(String(summaryId || "").trim());
    if (!mount) return;
    mount.innerHTML = "";
    mount.hidden = true;
  }

  function renderPanelStats(summaryId, model) {
    const mount = document.getElementById(String(summaryId || "").trim());
    if (!mount || !model) {
      clearPanelStats(summaryId);
      return false;
    }
    const pretextLayout = getDashboardPretextLayout();
    const rendered = pretextLayout?.renderStatsStrip?.(summaryId, model);
    if (rendered) return true;
    clearPanelStats(summaryId);
    return false;
  }

  function renderPanelLead(panelId, model) {
    const mount = ensurePanelLeadMount(panelId);
    if (!mount || !model) {
      clearPanelLead(panelId);
      return false;
    }
    const pretextLayout = getDashboardPretextLayout();
    const rendered = pretextLayout?.renderPanelLead?.(mount, model);
    if (rendered) return true;

    const chipsMarkup = (Array.isArray(model?.chips) ? model.chips : [])
      .filter(Boolean)
      .map((item) => `<span class="dashboard-panel-lead__chip">${escapeHtml(item)}</span>`)
      .join("");
    mount.hidden = false;
    mount.innerHTML = `
      <section class="dashboard-panel-lead dashboard-panel-lead--fallback">
        <div class="dashboard-panel-lead__summary-shell">
          <div class="dashboard-panel-lead__summary">${escapeHtml(model.summaryText)}</div>
        </div>
        ${chipsMarkup ? `<div class="dashboard-panel-lead__chips">${chipsMarkup}</div>` : ""}
      </section>
    `;
    return true;
  }

  function formatCompactMonthYear(monthKey) {
    const safeMonthKey = String(monthKey || "").trim();
    if (!/^\d{4}-\d{2}$/.test(safeMonthKey)) return safeMonthKey;
    const date = new Date(`${safeMonthKey}-01T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return safeMonthKey;
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function formatCountLabel(count, singular, plural = `${singular}s`) {
    const safeCount = toCount(count);
    const formattedCount = safeCount.toLocaleString("nl-NL");
    return `${formattedCount} ${safeCount === 1 ? singular : plural}`;
  }

  function buildJiraSearchUrl(jiraBase, jql) {
    const safeJql = String(jql || "").trim();
    if (!safeJql) return "";
    const url = new URL("/issues/", String(jiraBase || "https://nepgroup.atlassian.net").trim());
    url.searchParams.set("jql", safeJql);
    return url.toString();
  }

  function removeObsoleteDashboardUrlParams(paramNames) {
    if (typeof window === "undefined" || !window.location || !window.history) return;
    const nextUrl = new URL(window.location.href);
    let changed = false;
    for (const name of Array.isArray(paramNames) ? paramNames : []) {
      if (!nextUrl.searchParams.has(name)) continue;
      nextUrl.searchParams.delete(name);
      changed = true;
    }
    if (changed) {
      window.history.replaceState({}, "", nextUrl);
    }
  }

  function getSharedRollingPeriodFallback(fallback = "1y") {
    const candidates = [
      state.developmentWorkflowWindow,
      state.bugTrendsWindow,
      state.prCycleWindow,
      state.prActivityLegacyWindow
    ];
    for (const candidate of candidates) {
      if (isSharedRollingPeriod(candidate)) return sharedRollingPeriodKey(candidate, fallback);
    }
    return sharedRollingPeriodKey(fallback, BUG_TRENDS_WINDOW_DEFAULT);
  }

  function syncSharedRollingPeriodUrl() {
    if (typeof window === "undefined" || !window.location || !window.history) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("bug-trends-window", state.bugTrendsWindow);
    nextUrl.searchParams.set("pr-cycle-window", state.developmentWorkflowWindow);
    nextUrl.searchParams.set("pr-activity-legacy-window", state.prActivityLegacyWindow);
    window.history.replaceState({}, "", nextUrl);
  }

  function applySharedRollingPeriod(period, { syncPrActivity = true } = {}) {
    const periodKey = sharedRollingPeriodKey(period);
    state.bugTrendsWindow = periodKey;
    state.developmentWorkflowWindow = periodKey;
    state.prCycleWindow = periodKey;
    if (syncPrActivity) {
      state.prActivityLegacyWindow = periodKey;
    }
    return periodKey;
  }

  function syncInitialRollingPeriods() {
    const activeSection = sectionFilterKey(state.sectionFilter);
    if (activeSection === "bug") {
      applySharedRollingPeriod(state.bugTrendsWindow);
      return;
    }
    if (activeSection === "dev-breakdown") {
      applySharedRollingPeriod(state.developmentWorkflowWindow);
      return;
    }
    if (activeSection === "dev-trends" || activeSection === "dev-ai") {
      const prActivityWindow = prActivityLegacyWindowKey(state.prActivityLegacyWindow);
      state.prActivityLegacyWindow = prActivityWindow;
      if (isSharedRollingPeriod(prActivityWindow)) {
        applySharedRollingPeriod(prActivityWindow);
        return;
      }
      applySharedRollingPeriod(getSharedRollingPeriodFallback("1y"), { syncPrActivity: false });
      return;
    }
    applySharedRollingPeriod(getSharedRollingPeriodFallback(BUG_TRENDS_WINDOW_DEFAULT));
  }

  function handleSharedRollingPeriodStateChange({ name, value }) {
    if (name === "pr-activity-legacy-window") {
      const prActivityWindow = prActivityLegacyWindowKey(value);
      state.prActivityLegacyWindow = prActivityWindow;
      if (!isSharedRollingPeriod(prActivityWindow)) {
        applySharedRollingPeriod(getSharedRollingPeriodFallback("1y"), { syncPrActivity: false });
        return true;
      }
      applySharedRollingPeriod(prActivityWindow);
      return true;
    }
    applySharedRollingPeriod(value);
    return true;
  }

  function buildIssueItemsSearchUrl(
    issueItems,
    jiraBrowseBase = "https://nepgroup.atlassian.net/browse/"
  ) {
    const jiraRoot = String(jiraBrowseBase || "https://nepgroup.atlassian.net/browse/").replace(
      /\/browse\/?$/,
      ""
    );
    const issueKeys = Array.from(
      new Set(
        (Array.isArray(issueItems) ? issueItems : [])
          .map((item) => String(item?.issueId || item || "").trim())
          .filter(Boolean)
      )
    );
    if (issueKeys.length === 0) return "";
    return buildJiraSearchUrl(
      jiraRoot,
      `issueKey in (${issueKeys.join(",")}) ORDER BY updated DESC`
    );
  }

  function buildBugTeamSearchUrl(teamKey) {
    const jql =
      TEAM_BUG_JQL[
        String(teamKey || "")
          .trim()
          .toLowerCase()
      ];
    if (!jql) return "";
    return buildJiraSearchUrl(
      "https://nepgroup.atlassian.net",
      `${jql} ORDER BY priority DESC, updated DESC`
    );
  }

  function formatSignedWhole(value) {
    const safeValue = Math.round(toNumber(value));
    return safeValue > 0 ? `+${safeValue}` : String(safeValue);
  }

  function sumBugPriorityTotal(teamPoint) {
    return ["highest", "high", "medium", "low", "lowest"].reduce(
      (sum, key) => sum + toCount(teamPoint?.[key]),
      0
    );
  }

  function getBroadcastScopeLabel() {
    const managementFacilitySnapshot = getManagementFacilitySnapshot();
    return String(
      managementFacilitySnapshot?.chartData?.managementBusinessUnit?.scopeLabel || "Broadcast"
    );
  }

  function isPretextLayoutActive() {
    const pretextLayout = getDashboardPretextLayout();
    const locationSearch = getLocationSearch();
    return (
      pretextLayout?.isLayoutEnabled?.(locationSearch) === true ||
      pretextLayout?.isWorkflowEnabled?.(locationSearch) === true
    );
  }

  function setBugTrendsViewVisibility(viewKey) {
    const graphNode = document.getElementById("bug-trends-chart");
    const tableNode = document.getElementById("bug-trends-table");
    if (graphNode) graphNode.hidden = viewKey === "table";
    if (tableNode) tableNode.hidden = viewKey !== "table";
  }

  function buildBugTrendsLeadModel(viewKey, points) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const rankedTeams = Object.entries(latestPoint)
      .filter(([key]) => key !== "date")
      .map(([key, teamPoint]) => ({
        key,
        label: normalizeDisplayTeamName(key),
        total: sumBugPriorityTotal(teamPoint),
        longstanding30: toCount(teamPoint?.longstanding_30d_plus)
      }))
      .filter((team) => team.total > 0)
      .sort((left, right) => {
        if (right.total !== left.total) return right.total - left.total;
        return left.label.localeCompare(right.label);
      });

    const totalOpen = rankedTeams.reduce((sum, team) => sum + team.total, 0);
    const leadTeam = rankedTeams[0] || null;
    const bcLongstanding =
      rankedTeams.find(
        (team) =>
          String(team.key || "")
            .trim()
            .toLowerCase() === "bc"
      )?.longstanding30 || 0;
    const trendWindowSize = safePoints.length;
    const latestDate = getSnapshotDisplayDate(latestPoint?.date || "");

    return {
      summaryText:
        viewKey === "table"
          ? `${totalOpen} open bugs are currently on the board, with ${leadTeam?.label || "the busiest team"} carrying the heaviest share of backlog pressure.`
          : `The last ${trendWindowSize} sprint${trendWindowSize === 1 ? "" : "s"} ${trendWindowSize === 1 ? "ends" : "end"} at ${totalOpen} open bugs, with ${leadTeam?.label || "the busiest team"} carrying the heaviest share of backlog pressure.`,
      calloutLabel: "Open bugs",
      calloutValue: String(totalOpen),
      calloutSubtext: leadTeam ? `Largest share: ${leadTeam.label}` : latestDate,
      chips: [
        latestDate ? `Latest: ${latestDate}` : "",
        bcLongstanding > 0 ? `BC 30d+: ${bcLongstanding}` : "",
        viewKey === "table" ? "Table view" : "Trend view"
      ].filter(Boolean),
      accentColor: "rgba(116, 78, 74, 0.22)"
    };
  }

  function buildBugTrendsTableModel(points, windowLabel) {
    const safePoints = Array.isArray(points) ? points : [];
    const latestPoint = safePoints[safePoints.length - 1] || null;
    if (!latestPoint) return null;

    const latestDate = getSnapshotDisplayDate(latestPoint?.date || "");
    const comparisonPoint = safePoints[0] || latestPoint;
    const changeLabel = String(windowLabel || "").trim() || "Window";

    const rows = Object.entries(latestPoint)
      .filter(([key]) => key !== "date")
      .map(([key, teamPoint]) => {
        const total = sumBugPriorityTotal(teamPoint);
        const previousTotal = sumBugPriorityTotal(comparisonPoint?.[key]);
        const highest = toCount(teamPoint?.highest);
        const high = toCount(teamPoint?.high);
        const highestShare = total > 0 ? Math.round((highest / total) * 100) : 0;
        const highShare = total > 0 ? Math.round((high / total) * 100) : 0;
        const teamLabel = normalizeDisplayTeamName(key);
        return {
          label: teamLabel,
          valueText: String(total),
          valueHref: buildBugTeamSearchUrl(key),
          total,
          urgentTotal: highest + high,
          color: getPrCycleTeamColor(key),
          valueMetaText: [
            `${highestShare}% highest`,
            `${highShare}% high`,
            `${changeLabel} ${formatSignedWhole(total - previousTotal)}`
          ].join(" · ")
        };
      })
      .filter((row) => toCount(row?.valueText) > 0)
      .sort((left, right) => {
        if (toCount(right?.valueText) !== toCount(left?.valueText)) {
          return toCount(right?.valueText) - toCount(left?.valueText);
        }
        return String(left?.label || "").localeCompare(String(right?.label || ""));
      });
    const totalOpen = rows.reduce((sum, row) => sum + toCount(row?.total), 0);
    const urgentOpen = rows.reduce((sum, row) => sum + toCount(row?.urgentTotal), 0);
    const leadTeam = rows[0] || null;
    const maxTotal = rows.reduce((highest, row) => Math.max(highest, toCount(row?.total)), 1);

    return {
      accentColor: "var(--chart-active)",
      stats: [
        {
          label: "Open bugs",
          value: String(totalOpen),
          className: "dashboard-utility-layout__stat--primary"
        },
        { label: "Largest backlog", value: leadTeam?.label || "None" },
        { label: "Highest + high", value: String(urgentOpen) },
        { label: "Window", value: changeLabel }
      ],
      columnStartLabel: "Team",
      columnEndLabel: "Open bugs",
      rows: rows.map((row) => ({
        ...row,
        width: Math.max(10, Math.round((toCount(row?.total) / maxTotal) * 100))
      })),
      footerBits: [latestDate ? `Latest snapshot ${latestDate}` : "", changeLabel].filter(Boolean)
    };
  }

  function buildLegacyPrActivityStatsModel(points, { viewKey, windowLabel, granularity } = {}) {
    const safePoints = Array.isArray(points) ? points : [];
    if (safePoints.length === 0) return null;

    const teamRows = PR_ACTIVITY_VISIBLE_LINE_DEFS.map((lineDef) => {
      const totals = safePoints.reduce(
        (sum, point) => {
          const teamMetrics = point?.[lineDef.dataKey];
          const opened = toCount(teamMetrics?.offered);
          const ai = toCount(teamMetrics?.aiOffered);
          const explicitNonAi =
            teamMetrics && Object.prototype.hasOwnProperty.call(teamMetrics, "nonAiOffered")
              ? toCount(teamMetrics?.nonAiOffered)
              : Math.max(0, opened - ai);
          const nonAi = Math.max(explicitNonAi, opened - ai);
          sum.opened += opened;
          sum.ai += ai;
          sum.nonAi += nonAi;
          return sum;
        },
        { opened: 0, ai: 0, nonAi: 0 }
      );
      return { ...lineDef, ...totals };
    });

    const totalOpened = teamRows.reduce((sum, row) => sum + row.opened, 0);
    const totalAi = teamRows.reduce((sum, row) => sum + row.ai, 0);
    const totalNonAi = teamRows.reduce((sum, row) => sum + row.nonAi, 0);
    const aiShare = totalOpened > 0 ? Math.round((totalAi / totalOpened) * 100) : 0;
    const leadingTeam = teamRows
      .filter((row) => row.opened > 0)
      .sort((left, right) => {
        if (right.opened !== left.opened) return right.opened - left.opened;
        return left.name.localeCompare(right.name);
      })[0];
    const bucketLabel = `${safePoints.length} ${String(granularity || "bucket").toLowerCase()}${
      safePoints.length === 1 ? "" : "s"
    }`;

    return {
      accentColor:
        viewKey === "ai"
          ? "#1f7a64"
          : leadingTeam
            ? getPrCycleTeamColor(leadingTeam.dataKey)
            : "var(--chart-active)",
      stats:
        viewKey === "ai"
          ? [
              {
                label: "PRs opened",
                value: formatCountLabel(totalOpened, "PR"),
                className: "dashboard-utility-layout__stat--primary"
              },
              {
                label: "AI share",
                value: `${aiShare}%`
              },
              { label: "AI labeled", value: formatCountLabel(totalAi, "PR") },
              { label: "Not AI labeled", value: formatCountLabel(totalNonAi, "PR") }
            ]
          : [
              {
                label: "PRs opened",
                value: formatCountLabel(totalOpened, "PR"),
                className: "dashboard-utility-layout__stat--primary"
              },
              { label: "Leading team", value: leadingTeam?.name || "None" },
              { label: "View", value: "Team trend" },
              {
                label: "Window",
                value: windowLabel ? `${windowLabel} · ${bucketLabel}` : bucketLabel
              }
            ]
    };
  }

  function renderBugTrendsPanel() {
    const config = getConfig("trend");
    const viewKey = bugTrendsViewKey(state.bugTrendsView);
    const windowKey = bugTrendsWindowKey(state.bugTrendsWindow);
    state.bugTrendsView = viewKey;
    state.bugTrendsWindow = windowKey;
    syncControlValue("bug-trends-view", viewKey);
    syncControlValue("bug-trends-window", windowKey);
    const points = Array.isArray(state.snapshot?.combinedPoints)
      ? state.snapshot.combinedPoints
      : [];
    const bugTrendWindow = getBugTrendWindowedPoints(points, windowKey);
    const trendPoints = bugTrendWindow.points;
    const firstPoint = trendPoints[0] || null;
    const lastPoint = trendPoints[trendPoints.length - 1] || null;
    const firstDisplayDate = getSnapshotDisplayDate(firstPoint?.date || "");
    const lastDisplayDate = getSnapshotDisplayDate(lastPoint?.date || "");
    renderDashboardChartState("trend", getConfig, () => ({
      contextText: isPretextLayoutActive()
        ? formatContextWithFreshness("", state.snapshot?.updatedAt)
        : formatContextWithFreshness(
            viewKey === "table"
              ? firstDisplayDate && lastDisplayDate
                ? `${bugTrendWindow.windowLabel} • ${trendPoints.length} sprint${trendPoints.length === 1 ? "" : "s"} • latest ${lastDisplayDate}`
                : ""
              : firstDisplayDate && lastDisplayDate
                ? `${bugTrendWindow.windowLabel} • ${trendPoints.length} sprint${trendPoints.length === 1 ? "" : "s"} • ${firstDisplayDate} to ${lastDisplayDate}`
                : bugTrendWindow.windowLabel,
            getSnapshotContextTimestamp(state)
          ),
      render: () => {
        const pretextLayout = getDashboardPretextLayout();
        const clearChart = getDashboardCharts()?.clearChart;
        const graphContainerId = "bug-trends-chart";
        const tableContainerId = "bug-trends-table";
        const renderUtilityTable =
          viewKey === "table" && isPretextLayoutActive() && Boolean(pretextLayout);
        if (typeof clearChart === "function") clearChart({ containerId: graphContainerId });
        else {
          const graphNode = document.getElementById(graphContainerId);
          if (graphNode) graphNode.innerHTML = "";
        }
        const tableNode = document.getElementById(tableContainerId);
        if (tableNode) tableNode.innerHTML = "";
        if (isPretextLayoutActive()) {
          clearPanelLead(config.panelId);
          clearPanelStats(config.summaryId);
        } else {
          clearPanelStats(config.summaryId);
          renderPanelLead(config.panelId, buildBugTrendsLeadModel(viewKey, trendPoints));
        }
        setBugTrendsViewVisibility(renderUtilityTable ? "table" : "graph");
        if (renderUtilityTable) {
          pretextLayout.renderUtilityListPanel?.(
            tableContainerId,
            buildBugTrendsTableModel(trendPoints, bugTrendWindow.windowKey)
          );
          return;
        }
        renderNamedChart(
          { ...config, containerId: graphContainerId },
          {
            containerId: graphContainerId,
            snapshot: {
              ...state.snapshot,
              combinedPoints: trendPoints,
              bugTrendMaxPoints: trendPoints.length,
              bugTrendWindowLabel: bugTrendWindow.windowKey
            },
            colors: getThemeColors()
          },
          {
            rendererName:
              viewKey === "table"
                ? "renderBugCompositionByPriorityChart"
                : "renderBugBacklogTrendByTeamChart"
          }
        );
      }
    }));
  }

  function getLegacyPrActivityClosedSprintDate(prActivitySnapshot) {
    const explicitClosedSprintDate = String(
      prActivitySnapshot?.prActivity?.latestClosedSprintDate || ""
    ).trim();
    if (explicitClosedSprintDate) return explicitClosedSprintDate;

    const sprintPoints = Array.isArray(prActivitySnapshot?.prActivity?.points)
      ? prActivitySnapshot.prActivity.points.filter(Boolean)
      : [];
    if (sprintPoints.length < 2) return "";

    const snapshotDate = isoDateOnlyFromTimestamp(prActivitySnapshot?.updatedAt);
    const latestSprintDate = String(sprintPoints[sprintPoints.length - 1]?.date || "").trim();
    if (!snapshotDate || !latestSprintDate || latestSprintDate !== snapshotDate) return "";

    return String(sprintPoints[sprintPoints.length - 2]?.date || "").trim();
  }

  function clampLegacyPrActivityTrendPoints(points, prActivitySnapshot) {
    const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
    const ceilingDate = getLegacyPrActivityClosedSprintDate(prActivitySnapshot);
    if (!ceilingDate) return safePoints;
    const clampedPoints = safePoints.filter(
      (point) => String(point?.date || "").trim() <= ceilingDate
    );
    return clampedPoints.length > 0 ? clampedPoints : safePoints;
  }

  function clampLegacyPrActivityMonthlyPoints(points, prActivitySnapshot) {
    const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
    if (safePoints.length === 0) return [];

    const snapshotDate = isoDateOnlyFromTimestamp(prActivitySnapshot?.updatedAt);
    const latestPointDate = String(safePoints[safePoints.length - 1]?.date || "").trim();
    if (!snapshotDate || !latestPointDate) return safePoints;

    const snapshotMonthDate = startOfChartMonth(snapshotDate);
    if (!snapshotMonthDate || latestPointDate !== snapshotMonthDate) return safePoints;

    return safePoints.filter((point) => String(point?.date || "").trim() < snapshotMonthDate);
  }

  function getPrActivityMonthlyWindowedPoints(points, selectedWindowKey) {
    const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
    const windowKey = prActivityLegacyWindowKey(selectedWindowKey);
    if (safePoints.length === 0) {
      return {
        points: [],
        windowKey,
        windowLabel: getPrActivityWindowLabel(windowKey)
      };
    }

    const latestPoint = safePoints[safePoints.length - 1];
    const latestDate = String(latestPoint?.date || "").trim();
    const startDate =
      windowKey === "6m"
        ? shiftChartIsoMonths(latestDate, -6)
        : windowKey === "2y"
          ? shiftChartIsoMonths(latestDate, -24)
          : shiftChartIsoMonths(latestDate, -12);
    const filteredPoints = safePoints.filter(
      (point) => String(point?.date || "").trim() >= startDate
    );
    return {
      points: filteredPoints.length > 0 ? filteredPoints : safePoints,
      windowKey,
      windowLabel: getPrActivityWindowLabel(windowKey)
    };
  }

  function buildLegacyPrActivityTrendPoints(selectedWindowKey) {
    const prActivitySnapshot = getPrActivitySnapshot();
    const windowKey = prActivityLegacyWindowKey(selectedWindowKey);
    const monthlyPoints = Array.isArray(prActivitySnapshot?.prActivity?.monthlyPoints)
      ? prActivitySnapshot.prActivity.monthlyPoints.filter(Boolean)
      : [];
    const sprintPoints = Array.isArray(prActivitySnapshot?.prActivity?.points)
      ? prActivitySnapshot.prActivity.points
      : [];
    if (PR_ACTIVITY_LEGACY_SPRINT_WINDOWS.includes(windowKey) || monthlyPoints.length === 0) {
      const clampedSprintPoints = clampLegacyPrActivityTrendPoints(
        sprintPoints,
        prActivitySnapshot
      );
      const windowedSprintPoints = getPrActivityWindowedPoints(clampedSprintPoints, windowKey);
      return {
        ...windowedSprintPoints,
        granularity: "sprint"
      };
    }

    const clampedMonthlyPoints = clampLegacyPrActivityMonthlyPoints(
      monthlyPoints,
      prActivitySnapshot
    );
    return {
      ...getPrActivityMonthlyWindowedPoints(clampedMonthlyPoints, windowKey),
      granularity: "monthly"
    };
  }

  function getLegacyPrActivitySourceLabel(prActivity) {
    const source = String(prActivity?.source || "")
      .trim()
      .toLowerCase();
    if (source === "github_pull_requests") return "GitHub";
    if (source === "jira_dev_status_detail") return "Jira";
    return "PR";
  }

  function prActivityLegacyViewKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase() === "ai"
      ? "ai"
      : "activity";
  }

  function setElementHidden(id, hidden) {
    const node = document.getElementById(id);
    if (node) node.hidden = Boolean(hidden);
  }

  function normalizeDisplayTeamName(name) {
    const raw = String(name || "").trim();
    const key = normalizeProductCycleTeamKey(raw);
    if (key === "api") return "API";
    if (key === "legacy") return "Legacy FE";
    if (key === "react") return "React FE";
    if (key === "bc") return "BC";
    if (key === "workers") return "Workers";
    if (key === "titanium") return "Titanium";
    if (key === PRODUCT_CYCLE_MULTI_TEAM_KEY) return PRODUCT_CYCLE_MULTI_TEAM_LABEL;
    if (key === "frontend") return "Frontend";
    if (key === "broadcast") return "Broadcast";
    if (key === "shift") return "Shift";
    if (
      String(raw || "")
        .trim()
        .toUpperCase() === "UNMAPPED"
    )
      return "Unmapped";
    return raw;
  }

  function formatCompactTeamTabLabel(name) {
    const raw = String(name || "").trim();
    const key = normalizeProductCycleTeamKey(raw);
    if (key === "all") return "All";
    if (key === PRODUCT_CYCLE_MULTI_TEAM_KEY) return "Cross";
    if (key === "frontend") return "FE";
    if (key === "broadcast" || key === "bc") return "BC";
    return normalizeDisplayTeamName(raw);
  }

  function normalizeProductCycleTeamKey(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase();
    if (!raw) return PRODUCT_CYCLE_TEAM_DEFAULT;
    if (raw === "orchestration" || raw === "workers") return "workers";
    if (raw === PRODUCT_CYCLE_MULTI_TEAM_KEY || raw === "multi team" || raw === "multi-team") {
      return PRODUCT_CYCLE_MULTI_TEAM_KEY;
    }
    return raw;
  }

  function getPrActivityLineDefs(colors) {
    return PR_ACTIVITY_VISIBLE_LINE_DEFS.map((line) => ({
      ...line,
      stroke: colors.teams[line.colorKey]
    }));
  }

  function getLegacyPrActivityYUpper(rows, lineDefs) {
    return (Array.isArray(rows) ? rows : []).reduce((highest, row) => {
      const rowMax = lineDefs.reduce(
        (lineHighest, lineDef) => Math.max(lineHighest, toNumber(row?.[lineDef.dataKey])),
        0
      );
      return Math.max(highest, rowMax);
    }, 0);
  }

  function getLegacyPrActivityHiddenKeys() {
    return new Set(
      Array.isArray(state.prActivityLegacyHiddenKeys) ? state.prActivityLegacyHiddenKeys : []
    );
  }

  function setLegacyPrActivityHiddenKeys(updater) {
    const previous = getLegacyPrActivityHiddenKeys();
    const nextValue = typeof updater === "function" ? updater(previous) : updater;
    const nextSet = nextValue instanceof Set ? nextValue : new Set(nextValue || []);
    state.prActivityLegacyHiddenKeys = Array.from(nextSet);
    renderLegacyPrActivityCharts();
  }

  // Compatibility shim for older/stale references from previous naming.
  window.getSharedPrActivityHiddenKeys = getLegacyPrActivityHiddenKeys;
  window.setSharedPrActivityHiddenKeys = setLegacyPrActivityHiddenKeys;

  function buildLegacyPrActivityTicks(yUpper) {
    const safeUpper = Math.max(1, Math.ceil(toNumber(yUpper)));
    if (safeUpper <= 10) return Array.from({ length: safeUpper + 1 }, (_, index) => index);
    const step = safeUpper <= 40 ? 5 : safeUpper <= 80 ? 10 : 20;
    const ticks = [];
    for (let tick = 0; tick <= safeUpper; tick += step) ticks.push(tick);
    if (ticks[ticks.length - 1] !== safeUpper) ticks.push(safeUpper);
    return ticks;
  }

  function buildLegacyPrActivityPath(points) {
    if (!Array.isArray(points) || points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    if (points.length === 2) {
      return points
        .map(
          (point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        )
        .join(" ");
    }

    const deltas = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const dx = points[index + 1].x - points[index].x;
      const dy = points[index + 1].y - points[index].y;
      deltas.push(dx > 0 ? dy / dx : 0);
    }

    const tangents = new Array(points.length).fill(0);
    tangents[0] = deltas[0];
    tangents[tangents.length - 1] = deltas[deltas.length - 1];
    for (let index = 1; index < points.length - 1; index += 1) {
      const previousDelta = deltas[index - 1];
      const nextDelta = deltas[index];
      tangents[index] =
        previousDelta === 0 || nextDelta === 0 || previousDelta * nextDelta < 0
          ? 0
          : (previousDelta + nextDelta) / 2;
    }

    for (let index = 0; index < deltas.length; index += 1) {
      const delta = deltas[index];
      if (delta === 0) {
        tangents[index] = 0;
        tangents[index + 1] = 0;
        continue;
      }
      const leftRatio = tangents[index] / delta;
      const rightRatio = tangents[index + 1] / delta;
      const magnitude = Math.hypot(leftRatio, rightRatio);
      if (magnitude <= 3) continue;
      const scale = 3 / magnitude;
      tangents[index] = scale * leftRatio * delta;
      tangents[index + 1] = scale * rightRatio * delta;
    }

    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const dx = next.x - current.x;
      const control1X = current.x + dx / 3;
      const control1Y = current.y + (tangents[index] * dx) / 3;
      const control2X = next.x - dx / 3;
      const control2Y = next.y - (tangents[index + 1] * dx) / 3;
      path += ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)} ${control2X.toFixed(2)} ${control2Y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }
    return path;
  }

  function startOfChartMonth(dateText) {
    const safeDate = String(dateText || "").trim();
    if (!safeDate) return "";
    return `${safeDate.slice(0, 7)}-01`;
  }

  function isLegacyPrActivityMonthlySeries(rows) {
    const safeRows = filterLegacyPrActivityChartRows(rows);
    if (safeRows.length === 0) return false;
    return safeRows.every((row) => {
      const date = String(row?.date || "").trim();
      return date.length >= 10 && date.slice(8, 10) === "01";
    });
  }

  function filterLegacyPrActivityChartRows(rows) {
    return Array.isArray(rows)
      ? rows.filter((row) => row && Number.isFinite(row.dateValue) && row.dateValue > 0)
      : [];
  }

  function buildLegacyPrActivityXDomain(rows) {
    const safeRows = filterLegacyPrActivityChartRows(rows);
    if (safeRows.length === 0) {
      return { xMin: 0, xMax: 1 };
    }
    if (safeRows.length === 1) {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      return {
        xMin: safeRows[0].dateValue - oneWeekMs,
        xMax: safeRows[0].dateValue + oneWeekMs
      };
    }
    if (isLegacyPrActivityMonthlySeries(safeRows)) {
      return {
        xMin: safeRows[0].dateValue,
        xMax: safeRows[safeRows.length - 1].dateValue
      };
    }

    return {
      xMin: safeRows[0].dateValue,
      xMax: safeRows[safeRows.length - 1].dateValue
    };
  }

  function buildLegacyPrActivityDisplayedXTicks(rows) {
    const safeRows = filterLegacyPrActivityChartRows(rows);
    if (safeRows.length === 0) return [];
    if (isLegacyPrActivityMonthlySeries(safeRows)) {
      const maxTickCount = 14;
      const tickInterval = Math.max(1, Math.ceil(safeRows.length / maxTickCount));
      return Array.from(
        new Set(
          safeRows
            .filter(
              (_row, index) =>
                index === 0 || index === safeRows.length - 1 || index % tickInterval === 0
            )
            .map((row) => row.dateValue)
        )
      );
    }

    const { xMin, xMax } = buildLegacyPrActivityXDomain(safeRows);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= 0) return [];

    const monthTicks = [];
    let monthStartDate = startOfChartMonth(safeRows[0]?.date);
    const chartEndDate = startOfChartMonth(safeRows[safeRows.length - 1]?.date);

    while (monthStartDate && monthStartDate <= chartEndDate) {
      const nextMonthStartDate = shiftChartIsoMonths(monthStartDate, 1);
      const monthStartValue = Math.max(toChartDateValue(monthStartDate), xMin);
      const monthEndValue = Math.min(toChartDateValue(nextMonthStartDate), xMax);
      if (monthEndValue > monthStartValue) {
        monthTicks.push(Math.round((monthStartValue + monthEndValue) / 2));
      } else if (monthStartValue > 0) {
        monthTicks.push(monthStartValue);
      }
      monthStartDate = nextMonthStartDate;
    }

    return Array.from(new Set(monthTicks));
  }

  function buildPrActivityReferenceMarkers(xMin, xMax) {
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= 0) return [];
    const minDate = new Date(xMin);
    const maxDate = new Date(xMax);
    if (!Number.isFinite(minDate.getTime()) || !Number.isFinite(maxDate.getTime())) return [];

    const markers = [
      ...PR_ACTIVITY_EVENT_REFERENCE_MARKERS,
      ...PR_ACTIVITY_ONE_TIME_REFERENCE_MARKERS
    ];

    return markers
      .filter((marker) => {
        const markerValue = toChartDateValue(marker.date);
        return markerValue >= xMin && markerValue <= xMax;
      })
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  }

  function roundLegacyPrActivityUpper(yUpper) {
    const safeUpper = Math.max(1, Math.ceil(toNumber(yUpper)));
    if (safeUpper <= 10) return safeUpper;
    const step = safeUpper <= 40 ? 5 : safeUpper <= 80 ? 10 : 20;
    return Math.ceil(safeUpper / step) * step;
  }

  function LegacyPrActivitySvgChart({
    rows,
    colors,
    yAxisLabel,
    tooltipLabel,
    tooltipValueFormatter,
    tooltipSampleFormatter = null,
    yAxisUpperOverride = 0,
    yAxisFixedUpper = null,
    yAxisPadRatio = 1,
    hiddenKeys,
    setHiddenKeys,
    showLegend = true,
    hideReferenceLabelsOnCompact = false,
    xAxisLabel = "Period"
  }) {
    const lineDefs = getPrActivityLineDefs(colors);
    const compactViewport = isCompactViewport();
    const monthlySeries = isLegacyPrActivityMonthlySeries(rows);
    const rawYUpper = Math.max(yAxisUpperOverride, getLegacyPrActivityYUpper(rows, lineDefs));
    const yUpper =
      Number.isFinite(yAxisFixedUpper) && yAxisFixedUpper > 0
        ? yAxisFixedUpper
        : roundLegacyPrActivityUpper(rawYUpper * Math.max(1, toNumber(yAxisPadRatio)));
    const width = 960;
    const height = compactViewport ? 276 : 360;
    const margin = compactViewport
      ? { top: 14, right: 10, bottom: 36, left: 40 }
      : { top: 26, right: 18, bottom: 62, left: 56 };
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const axisLabelOffset = compactViewport ? 34 : 42;
    const axisLabelFontSize = compactViewport ? 9 : 11;
    const xTicks = rows.map((row) => row.dateValue).filter((value) => value > 0);
    const displayedXTicks = buildLegacyPrActivityDisplayedXTicks(rows);
    const { xMin, xMax } = buildLegacyPrActivityXDomain(rows);
    const yTicks = buildLegacyPrActivityTicks(yUpper);
    const displayedYTicks = yTicks.filter(
      (tick, index) =>
        tick === 0 || tick === yTicks[yTicks.length - 1] || compactViewport || index % 2 === 0
    );
    const visibleDefs = lineDefs.filter((lineDef) => !hiddenKeys.has(lineDef.dataKey));
    const visibleReferenceMarkers =
      xTicks.length > 0 ? buildPrActivityReferenceMarkers(xMin, xMax) : [];
    const seriesRows = visibleDefs.map((lineDef) => ({
      ...lineDef,
      points: rows
        .map((row) => {
          const value = row?.[lineDef.dataKey];
          if (!Number.isFinite(value) || value === null) return null;
          return {
            key: `${lineDef.dataKey}-${row.date}`,
            date: row.date,
            value: toNumber(value),
            sampleCount: toNumber(row?.[`${lineDef.dataKey}SampleCount`]),
            x: linearScale(row.dateValue, xMin, xMax, plotLeft, plotRight),
            y: linearScale(toNumber(value), 0, yUpper, plotBottom, plotTop),
            lineDef
          };
        })
        .filter(Boolean)
    }));
    const [tooltipContent, setTooltipContent] = React.useState(null);

    function showTooltip(point) {
      const pointDateLabel = formatLegacyPrActivityPointDate(point.date, {
        monthlySeries,
        describeSprintBucket: true
      });
      setTooltipContent(
        h(
          "div",
          null,
          h("p", null, h("strong", null, point.lineDef.name)),
          h("p", null, pointDateLabel || point.date || ""),
          h("p", null, tooltipValueFormatter(point.value)),
          typeof tooltipSampleFormatter === "function"
            ? h("p", null, tooltipSampleFormatter(point.sampleCount))
            : null
        )
      );
    }

    return h(
      "div",
      { className: "chart-series-shell" },
      showLegend
        ? h(
            "div",
            {
              className: "svg-chart-legend",
              role: "group",
              "aria-label": `${tooltipLabel} line toggles`
            },
            ...lineDefs.map((lineDef) => {
              const hidden = hiddenKeys.has(lineDef.dataKey);
              return h(
                "button",
                {
                  key: `legacy-pr-legend-${lineDef.dataKey}`,
                  type: "button",
                  className: `svg-chart-legend__button${hidden ? " svg-chart-legend__button--off" : ""}`,
                  style: compactViewport ? { minHeight: "34px", padding: "6px 8px" } : undefined,
                  onClick: () =>
                    setHiddenKeys((previous) => {
                      const next = new Set(previous);
                      if (next.has(lineDef.dataKey)) next.delete(lineDef.dataKey);
                      else next.add(lineDef.dataKey);
                      return next;
                    }),
                  "aria-pressed": hidden ? "false" : "true"
                },
                h("span", {
                  className: "svg-chart-legend__swatch",
                  style: { background: hidden ? withAlpha(lineDef.stroke, 0.28) : lineDef.stroke }
                }),
                h("span", { className: "svg-chart-legend__label" }, lineDef.name)
              );
            })
          )
        : null,
      h(
        SvgChartShell,
        { width, height, colors, tooltipContent, legendItems: [] },
        h(
          "g",
          null,
          h("rect", {
            x: plotLeft,
            y: plotTop,
            width: plotRight - plotLeft,
            height: plotBottom - plotTop,
            rx: 6,
            fill: "rgba(244, 248, 251, 0.58)",
            stroke: "rgba(31, 51, 71, 0.08)",
            strokeWidth: 1
          }),
          ...displayedYTicks.map((tick) => {
            const y = linearScale(tick, 0, yUpper, plotBottom, plotTop);
            return h(
              "g",
              { key: `legacy-pr-y-${tick}` },
              h(
                "text",
                {
                  x: plotLeft - 8,
                  y: y + 4,
                  fill: colors.text,
                  fontSize: compactViewport ? 10 : 11,
                  fontWeight: 600,
                  textAnchor: "end"
                },
                String(tick)
              )
            );
          }),
          ...displayedXTicks.map((tick) =>
            h(
              "text",
              {
                key: `legacy-pr-x-${tick}`,
                x: linearScale(tick, xMin, xMax, plotLeft, plotRight),
                y: plotBottom + 18,
                fill: colors.text,
                fontSize: compactViewport ? 10 : 11,
                fontWeight: 600,
                textAnchor: "middle"
              },
              formatCompactChartDateTick(tick)
            )
          ),
          ...visibleReferenceMarkers.map((marker) =>
            h(
              "g",
              { key: `legacy-pr-marker-${marker.date}` },
              h("line", {
                x1: linearScale(toChartDateValue(marker.date), xMin, xMax, plotLeft, plotRight),
                x2: linearScale(toChartDateValue(marker.date), xMin, xMax, plotLeft, plotRight),
                y1: plotTop,
                y2: plotBottom,
                stroke: "rgba(31, 51, 71, 0.26)",
                strokeDasharray: "4 8",
                strokeWidth: 1.2
              }),
              !(hideReferenceLabelsOnCompact && compactViewport)
                ? h(
                    "text",
                    {
                      x: linearScale(
                        toChartDateValue(marker.date),
                        xMin,
                        xMax,
                        plotLeft,
                        plotRight
                      ),
                      y: plotTop - 6,
                      fill: "rgba(31, 51, 71, 0.74)",
                      fontSize: compactViewport ? 10 : 11,
                      fontWeight: 700,
                      textAnchor: "middle"
                    },
                    marker.label
                  )
                : null
            )
          ),
          ...seriesRows.flatMap((series) => [
            h("path", {
              key: `legacy-pr-line-${series.dataKey}`,
              d: buildLegacyPrActivityPath(series.points),
              fill: "none",
              stroke: series.stroke,
              opacity: 0.92,
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }),
            ...series.points.map((point) =>
              h(
                "g",
                {
                  key: point.key,
                  onPointerEnter: () => showTooltip(point),
                  onPointerMove: () => showTooltip(point),
                  onPointerLeave: () => setTooltipContent(null)
                },
                h("circle", {
                  cx: point.x,
                  cy: point.y,
                  r: compactViewport ? 2 : 2.5,
                  fill: series.stroke,
                  stroke: "#ffffff",
                  strokeWidth: 0.9,
                  opacity: 0.72,
                  pointerEvents: "none"
                }),
                h(
                  "circle",
                  {
                    cx: point.x,
                    cy: point.y,
                    r: compactViewport ? 11 : 13,
                    fill: "rgba(255, 255, 255, 0.001)",
                    stroke: "transparent",
                    "aria-label": `${point.lineDef.name}: ${
                      formatLegacyPrActivityPointDate(point.date, {
                        monthlySeries,
                        describeSprintBucket: true
                      }) ||
                      point.date ||
                      ""
                    } ${tooltipValueFormatter(point.value)}`
                  },
                  h(
                    "title",
                    null,
                    `${point.lineDef.name} • ${
                      formatLegacyPrActivityPointDate(point.date, {
                        monthlySeries,
                        describeSprintBucket: true
                      }) ||
                      point.date ||
                      ""
                    } • ${tooltipValueFormatter(point.value)}`
                  )
                )
              )
            )
          ]),
          h(
            "text",
            {
              x: plotLeft - axisLabelOffset,
              y: plotTop + (plotBottom - plotTop) / 2,
              fill: "rgba(31, 51, 71, 0.92)",
              fontSize: axisLabelFontSize,
              fontWeight: 700,
              textAnchor: "middle",
              transform: `rotate(-90 ${plotLeft - axisLabelOffset} ${plotTop + (plotBottom - plotTop) / 2})`
            },
            yAxisLabel
          ),
          compactViewport
            ? null
            : h(
                "text",
                {
                  x: plotLeft + (plotRight - plotLeft) / 2,
                  y: plotBottom + 42,
                  fill: "rgba(31, 51, 71, 0.92)",
                  fontSize: axisLabelFontSize,
                  fontWeight: 700,
                  textAnchor: "middle"
                },
                xAxisLabel
              )
        )
      )
    );
  }

  function getAiUseTeamRows(points, lineDefs) {
    return lineDefs.map((lineDef) => {
      const buckets = (Array.isArray(points) ? points : []).map((point) => {
        const metrics = point?.[lineDef.dataKey] || {};
        const totalMetric = toNumber(metrics.offered);
        const ai = Math.max(0, toNumber(metrics.aiOffered));
        const nonAi = Math.max(0, toNumber(metrics.nonAiOffered || totalMetric - ai));
        const total = Math.max(totalMetric, ai + nonAi);
        return {
          date: String(point?.date || ""),
          ai,
          nonAi,
          total
        };
      });
      const windowTotals = buckets.reduce(
        (sum, bucket) => ({
          ai: sum.ai + toNumber(bucket.ai),
          total: sum.total + toNumber(bucket.total)
        }),
        { ai: 0, total: 0 }
      );
      const windowShare =
        windowTotals.total > 0
          ? Math.round((windowTotals.ai / Math.max(1, windowTotals.total)) * 100)
          : 0;
      return {
        ...lineDef,
        buckets,
        windowShare,
        windowTotal: windowTotals.total,
        windowAi: windowTotals.ai
      };
    });
  }

  function AiUseSmallMultiplesChart({ points, colors }) {
    const lineDefs = getPrActivityLineDefs(colors).filter(
      (lineDef) => lineDef.dataKey !== "unmapped"
    );
    const teamRows = getAiUseTeamRows(points, lineDefs);
    const maxTotal =
      teamRows.reduce(
        (highest, row) =>
          Math.max(highest, ...row.buckets.map((bucket) => Math.max(0, toNumber(bucket.total)))),
        0
      ) || 1;
    const monthlySeries = (Array.isArray(points) ? points : []).every(
      (point) => startOfChartMonth(point?.date) === point?.date
    );
    const firstDate = String(points?.[0]?.date || "");
    const lastDate = String(points?.[points.length - 1]?.date || "");

    return h(
      "div",
      {
        className: "ai-use-chart",
        role: "group",
        "aria-label": "AI and non-AI PRs opened by team"
      },
      h(
        "div",
        { className: "ai-use-chart__legend", "aria-hidden": "true" },
        h(
          "span",
          { className: "ai-use-chart__legend-item" },
          h("span", { className: "ai-use-chart__swatch ai-use-chart__swatch--non-ai" }),
          "Not AI labeled"
        ),
        h(
          "span",
          { className: "ai-use-chart__legend-item" },
          h("span", { className: "ai-use-chart__swatch ai-use-chart__swatch--ai" }),
          "AI labeled"
        )
      ),
      h(
        "div",
        { className: "ai-use-chart__grid" },
        ...teamRows.map((team) =>
          h(
            "section",
            {
              key: team.dataKey,
              className: "ai-use-chart__team",
              "aria-label": `${team.name} AI use`
            },
            h(
              "div",
              { className: "ai-use-chart__team-header" },
              h("span", {
                className: "ai-use-chart__team-dot",
                style: { background: team.stroke }
              }),
              h("span", { className: "ai-use-chart__team-name" }, team.name),
              h("span", { className: "ai-use-chart__team-share" }, `${team.windowShare}% AI`)
            ),
            h(
              "div",
              { className: "ai-use-chart__plot" },
              ...team.buckets.map((bucket, index) => {
                const totalHeight = Math.max(2, Math.round((bucket.total / maxTotal) * 100));
                const aiHeight =
                  bucket.total > 0
                    ? Math.round((bucket.ai / Math.max(1, bucket.total)) * totalHeight)
                    : 0;
                const nonAiHeight = Math.max(0, totalHeight - aiHeight);
                const dateLabel = formatLegacyPrActivityPointDate(bucket.date, { monthlySeries });
                const share = bucket.total > 0 ? Math.round((bucket.ai / bucket.total) * 100) : 0;
                const nonAiCount = Math.max(0, bucket.total - bucket.ai);
                return h(
                  "span",
                  {
                    key: `${team.dataKey}-${bucket.date}-${index}`,
                    className: "ai-use-chart__bar",
                    tabIndex: bucket.total > 0 ? 0 : -1,
                    "aria-label": `${team.name}, ${dateLabel || bucket.date}: ${bucket.total} PRs opened, ${bucket.ai} AI labeled, ${nonAiCount} not AI labeled, ${share}% AI`
                  },
                  h("span", {
                    className: "ai-use-chart__bar-fill ai-use-chart__bar-fill--non-ai",
                    style: { height: `${nonAiHeight}%` }
                  }),
                  h("span", {
                    className: "ai-use-chart__bar-fill ai-use-chart__bar-fill--ai",
                    style: { height: `${aiHeight}%` }
                  }),
                  h(
                    "span",
                    { className: "ai-use-chart__tooltip", role: "tooltip" },
                    h(
                      "span",
                      { className: "ai-use-chart__tooltip-title" },
                      `${team.name} · ${dateLabel || bucket.date}`
                    ),
                    h("span", null, `${bucket.total} opened`),
                    h("span", null, `${bucket.ai} AI / ${nonAiCount} not AI`),
                    h("span", null, `${share}% AI`)
                  )
                );
              })
            ),
            h(
              "div",
              { className: "ai-use-chart__axis" },
              h("span", null, formatLegacyPrActivityPointDate(firstDate, { monthlySeries })),
              h("span", null, formatLegacyPrActivityPointDate(lastDate, { monthlySeries }))
            )
          )
        )
      ),
      h(
        "p",
        { className: "panel-note ai-use-chart__disclaimer" },
        "Tracks non-draft PRs with the GitHub AI label applied by git-ai checks; it does not infer all AI usage."
      )
    );
  }

  function renderLegacyPrActivityCharts() {
    withChart("pr-activity-legacy", getConfig, ({ status, context }) => {
      const config = getConfig("pr-activity-legacy");
      const prActivity = getPrActivitySnapshot()?.prActivity;
      const windowKey = prActivityLegacyWindowKey(state.prActivityLegacyWindow);
      const activitySection = sectionFilterKey(state.sectionFilter);
      const viewKey = activitySection === "dev-ai" ? "ai" : "activity";
      state.prActivityLegacyWindow = windowKey;
      state.prActivityLegacyView = viewKey;
      syncControlValue("pr-activity-legacy-window", windowKey);
      syncControlValue("pr-activity-legacy-view", viewKey);
      const trendWindow = buildLegacyPrActivityTrendPoints(windowKey);
      const points = trendWindow.points;
      if (points.length === 0) {
        clearChartContainer("pr-activity-legacy-count-chart");
        clearChartContainer("pr-activity-legacy-merge-time-chart");
        clearPanelLead(config?.panelId);
        clearPanelStats(config?.summaryId);
        showPanelStatus(status, config?.missingMessage);
        return;
      }

      const compactViewport = isCompactViewport();
      const monthlySeries = points.every((point) => startOfChartMonth(point?.date) === point?.date);
      const firstPointDate = String(points[0]?.date || "");
      const lastPointDate = String(points[points.length - 1]?.date || "");
      const firstLabel = monthlySeries
        ? formatCompactMonthYear(firstPointDate.slice(0, 7))
        : firstPointDate;
      const lastLabel = monthlySeries
        ? formatCompactMonthYear(lastPointDate.slice(0, 7))
        : lastPointDate;
      const sourceLabel = getLegacyPrActivitySourceLabel(prActivity);
      setElementHidden("pr-activity-legacy-merge-time-block", viewKey === "ai");
      const countTitle = document.getElementById("pr-activity-legacy-count-title");
      if (countTitle) {
        countTitle.textContent =
          viewKey === "ai" ? "PRs opened split by AI label" : "PRs opened by team";
      }
      const panelTitle = document.getElementById("pr-activity-legacy-panel-title");
      if (panelTitle) {
        panelTitle.textContent = viewKey === "ai" ? "AI PRs" : "PR Volume";
      }
      const countSubtitle = document.getElementById("pr-activity-legacy-count-subtitle");
      if (countSubtitle) {
        countSubtitle.textContent = viewKey === "ai" ? "AI label tracking" : "Team trend over time";
      }
      setPanelContext(
        context,
        isPretextLayoutActive()
          ? formatContextWithFreshness("", prActivity?.updatedAt)
          : formatContextWithFreshness(
              compactViewport
                ? `${trendWindow.windowLabel} ${sourceLabel} ${
                    viewKey === "ai" ? "AI use" : "PR activity"
                  } • ${trendWindow.granularity}`
                : `${trendWindow.windowLabel} ${sourceLabel} ${
                    viewKey === "ai" ? "AI use" : "PR activity"
                  } • ${trendWindow.granularity} buckets • ${firstLabel || firstPointDate} to ${lastLabel || lastPointDate}`,
              getSnapshotContextTimestamp(state)
            )
      );
      const colors = getThemeColors();
      const hiddenKeys = getLegacyPrActivityHiddenKeys();
      const buildLegacyRows = (valueAccessor) =>
        points.map((point) => ({
          date: String(point?.date || ""),
          dateValue: toChartDateValue(point?.date),
          api: toNumber(valueAccessor(point?.api)),
          legacy: toNumber(valueAccessor(point?.legacy)),
          react: toNumber(valueAccessor(point?.react)),
          bc: toNumber(valueAccessor(point?.bc)),
          workers: toNumber(valueAccessor(point?.workers)),
          titanium: toNumber(valueAccessor(point?.titanium))
        }));
      const lineDefs = getPrActivityLineDefs(colors);
      const openedCountRows = buildLegacyRows((teamMetrics) => teamMetrics?.offered);
      const mergedCountRows = buildLegacyRows((teamMetrics) => teamMetrics?.merged);
      const mergeTimeRows = buildLegacyRows((teamMetrics) => teamMetrics?.avgReviewToMergeDays);
      mergeTimeRows.forEach((row, index) => {
        const point = points[index] || {};
        Object.assign(row, {
          apiSampleCount: toNumber(point?.api?.avgReviewToMergeSampleCount),
          legacySampleCount: toNumber(point?.legacy?.avgReviewToMergeSampleCount),
          reactSampleCount: toNumber(point?.react?.avgReviewToMergeSampleCount),
          bcSampleCount: toNumber(point?.bc?.avgReviewToMergeSampleCount),
          workersSampleCount: toNumber(point?.workers?.avgReviewToMergeSampleCount),
          titaniumSampleCount: toNumber(point?.titanium?.avgReviewToMergeSampleCount)
        });
      });
      const yAxisUpperOverride = Math.max(
        getLegacyPrActivityYUpper(openedCountRows, lineDefs),
        getLegacyPrActivityYUpper(mergedCountRows, lineDefs)
      );
      const renderLegacyChart = (containerId, rows, options) => {
        renderWithRoot(containerId, rows.length > 0, (root) => {
          root.render(
            h(LegacyPrActivitySvgChart, {
              rows,
              colors,
              hiddenKeys,
              setHiddenKeys: setLegacyPrActivityHiddenKeys,
              ...options
            })
          );
        });
      };
      renderPanelStats(
        config?.summaryId,
        buildLegacyPrActivityStatsModel(points, {
          viewKey,
          windowLabel: trendWindow.windowLabel,
          granularity: trendWindow.granularity
        })
      );
      if (isPretextLayoutActive()) {
        clearPanelLead(config?.panelId);
      } else {
        clearPanelLead(config?.panelId);
      }
      if (viewKey === "ai") {
        renderWithRoot("pr-activity-legacy-count-chart", points.length > 0, (root) => {
          root.render(h(AiUseSmallMultiplesChart, { points, colors }));
        });
        clearChartContainer("pr-activity-legacy-merge-time-chart");
        return;
      }
      renderLegacyChart("pr-activity-legacy-count-chart", openedCountRows, {
        yAxisLabel: "PRs opened",
        tooltipLabel: "PRs opened",
        tooltipValueFormatter: (value) => `${value} PRs opened`,
        yAxisUpperOverride,
        showLegend: true,
        xAxisLabel: monthlySeries ? "Month" : "Sprint"
      });
      renderLegacyChart("pr-activity-legacy-merge-time-chart", mergeTimeRows, {
        yAxisLabel: "Avg days to merge",
        tooltipLabel: "GitHub review-to-merge time",
        tooltipValueFormatter: (value) => {
          const roundedDays = Math.max(0, Math.round(Number(value) || 0));
          return `${roundedDays} day${roundedDays === 1 ? "" : "s"} avg`;
        },
        tooltipSampleFormatter: (sampleCount) =>
          `${Math.max(0, Math.round(Number(sampleCount) || 0))} PRs with review data`,
        yAxisUpperOverride: getLegacyPrActivityYUpper(mergeTimeRows, lineDefs),
        showLegend: false,
        hideReferenceLabelsOnCompact: true,
        xAxisLabel: monthlySeries ? "Month" : "Sprint"
      });
    });
  }

  const productPanels = createProductPanels({
    state,
    constants: {
      PRODUCT_CYCLE_SCOPE,
      PRODUCT_CYCLE_SCOPE_LABEL,
      PRODUCT_CYCLE_MULTI_TEAM_KEY,
      PRODUCT_CYCLE_MULTI_TEAM_LABEL,
      PRODUCT_CYCLE_TEAM_ORDER,
      ALL_TEAM_SCOPE_KEY,
      ALL_TEAMS_LABEL,
      LIFECYCLE_TEAM_SCOPE_DEFAULT,
      PRODUCT_CYCLE_TEAM_DEFAULT
    },
    accessors: {
      getConfig
    },
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
    chart: {
      renderProductCycleCard
    },
    getDashboardCharts
  });
  const workflowPanels = createWorkflowPanels({
    state,
    constants: {
      ALL_TEAM_SCOPE_KEY,
      THIRTY_DAY_WINDOW_KEY,
      DEVELOPMENT_WORKFLOW_WINDOWS,
      MANAGEMENT_FLOW_SCOPES
    },
    prActivityLineDefs: PR_ACTIVITY_VISIBLE_LINE_DEFS,
    accessors: {
      getConfig,
      getManagementFacilitySnapshot,
      getPrActivitySnapshot,
      getPrActivityWindowedPoints
    },
    ui: {
      getDashboardPretextLayout,
      isPretextLayoutActive
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
    },
    chart: {
      isCompactViewport
    }
  });

  CONTROL_BINDINGS = [
    {
      name: "report-section",
      stateKey: "sectionFilter",
      defaultValue: SECTION_FILTER_DEFAULT,
      normalizeValue: sectionFilterKey,
      onChangeRender: renderSectionSelectionChange
    },
    {
      name: "bug-trends-view",
      stateKey: "bugTrendsView",
      defaultValue: BUG_TRENDS_VIEW_DEFAULT,
      normalizeValue: bugTrendsViewKey,
      onChangeRender: renderBugTrendsPanel
    },
    {
      name: "bug-trends-window",
      stateKey: "bugTrendsWindow",
      defaultValue: BUG_TRENDS_WINDOW_DEFAULT,
      normalizeValue: bugTrendsWindowKey,
      onStateChange: handleSharedRollingPeriodStateChange,
      onChangeRender: renderBugTrendsPanel
    },
    {
      name: "management-facility-flow-scope",
      stateKey: "managementFlowScope",
      defaultValue: "ongoing",
      normalizeValue: (value) => normalizeOption(value, MANAGEMENT_FLOW_SCOPES, "ongoing"),
      onChangeRender: workflowPanels.renderDevelopmentVsUatByFacilityChart
    },
    {
      name: "pr-cycle-team",
      stateKey: "prCycleTeam",
      defaultValue: ALL_TEAM_SCOPE_KEY,
      normalizeValue: (value) =>
        String(value || "")
          .trim()
          .toLowerCase() || ALL_TEAM_SCOPE_KEY,
      onChangeRender: workflowPanels.renderWorkflowBreakdown
    },
    {
      name: "pr-cycle-window",
      stateKey: "developmentWorkflowWindow",
      defaultValue: THIRTY_DAY_WINDOW_KEY,
      normalizeValue: (value) => sharedRollingPeriodKey(value, THIRTY_DAY_WINDOW_KEY),
      onStateChange: handleSharedRollingPeriodStateChange,
      onChangeRender: workflowPanels.renderWorkflowBreakdown
    },
    {
      name: "pr-activity-legacy-view",
      stateKey: "prActivityLegacyView",
      defaultValue: "activity",
      normalizeValue: prActivityLegacyViewKey,
      onChangeRender: renderLegacyPrActivityCharts
    },
    {
      name: "pr-activity-legacy-window",
      stateKey: "prActivityLegacyWindow",
      defaultValue: PR_ACTIVITY_LEGACY_WINDOW_DEFAULT,
      normalizeValue: prActivityLegacyWindowKey,
      onStateChange: handleSharedRollingPeriodStateChange,
      onChangeRender: renderLegacyPrActivityCharts
    },
    {
      name: "product-delivery-workflow-view",
      stateKey: "productDeliveryWorkflowView",
      defaultValue: PRODUCT_DELIVERY_WORKFLOW_VIEW_DEFAULT,
      normalizeValue: productDeliveryWorkflowViewKey,
      onChangeRender: productPanels.renderLeadAndCycleTimeByTeamChart
    },
    {
      name: "product-cycle-team",
      stateKey: "productCycleTeam",
      defaultValue: PRODUCT_CYCLE_TEAM_DEFAULT,
      normalizeValue: productPanels.productCycleTeamKey,
      onChangeRender: productPanels.renderLeadAndCycleTimeByTeamChart
    }
  ];

  CHART_RENDERERS = {
    trend: renderBugTrendsPanel,
    "management-facility": workflowPanels.renderDevelopmentVsUatByFacilityChart,
    "pr-activity-legacy": renderLegacyPrActivityCharts,
    contributors: workflowPanels.renderTopContributorsChart,
    "product-cycle-shipments": productPanels.renderProductCycleShipmentsTimeline,
    "product-cycle": productPanels.renderLeadAndCycleTimeByTeamChart,
    "workflow-breakdown": workflowPanels.renderWorkflowBreakdown
  };

  function queueRenderableCharts(entries, shouldQueue) {
    entries.forEach(([mode, payload]) => {
      if (!shouldQueue(mode, payload)) return;
      queueChartRender(mode, typeof payload === "function" ? payload : CHART_RENDERERS[mode]);
    });
  }

  function renderVisibleCharts() {
    queueRenderableCharts(
      Object.entries(CHART_RENDERERS),
      (mode) => isChartActive(mode) && isChartReady(mode)
    );
  }

  function queueReadyChartsForSource(sourceKey) {
    queueRenderableCharts(Object.entries(CHART_DATA_SOURCES), (mode, requiredSources) => {
      if (!requiredSources.includes(sourceKey)) return false;
      return isChartActive(mode) && isChartReady(mode);
    });
  }

  function getActiveSourceKeys() {
    return getRequiredSourceKeys(state.mode, Object.keys(DATA_SOURCE_CONFIG), state.sectionFilter);
  }

  function ensureActiveSourcesLoaded() {
    getActiveSourceKeys().forEach((sourceKey) => {
      if (state.loadedSources[sourceKey] === true) return;
      void loadDataSource(sourceKey);
    });
  }

  function isChartActive(mode) {
    if (state.mode !== "all") return state.mode === mode;
    const config = CHART_CONFIG[mode];
    return isPanelVisibleForSection(config?.panelId, state.sectionFilter);
  }

  function isChartReady(mode) {
    const requiredSources = CHART_DATA_SOURCES[mode] || [];
    if (requiredSources.length === 0) return true;
    if (requiredSources.some((sourceKey) => state.loadErrors[sourceKey])) return false;
    return requiredSources.every((sourceKey) => state.loadedSources[sourceKey] === true);
  }

  function flushChartRenderQueue() {
    chartRenderFrame = 0;
    const iterator = queuedChartModes.values().next();
    if (iterator.done) return;

    const mode = iterator.value;
    queuedChartModes.delete(mode);

    if (isChartActive(mode) && isChartReady(mode)) {
      const renderChart = CHART_RENDERERS[mode];
      if (typeof renderChart === "function") renderChart();
      renderActivePanelFreshnessFooter();
    }

    if (queuedChartModes.size > 0) scheduleChartRenderFlush();
  }

  function scheduleChartRenderFlush() {
    if (chartRenderFrame !== 0) return;
    chartRenderFrame = requestAnimationFrame(flushChartRenderQueue);
  }

  function queueChartRender(mode, renderChart) {
    if (!mode || typeof renderChart !== "function") return;
    queuedChartModes.add(mode);
    scheduleChartRenderFlush();
  }

  function scheduleResizeRender() {
    if (resizeRenderFrame !== 0) return;
    resizeRenderFrame = requestAnimationFrame(() => {
      resizeRenderFrame = 0;
      renderVisibleCharts();
    });
  }

  function bindWindowResizeRerender() {
    if (windowResizeBound) return;
    windowResizeBound = true;
    addEventListener("resize", scheduleResizeRender);
    addEventListener("orientationchange", scheduleResizeRender);
  }

  async function loadDataSource(sourceKey) {
    const source = DATA_SOURCE_CONFIG[sourceKey];
    if (!source) return;
    try {
      const preloadedPromise = PRELOADED_DATA_SOURCE_PROMISES[sourceKey];
      const sourceData =
        preloadedPromise && typeof preloadedPromise.then === "function"
          ? await preloadedPromise
          : await fetchJson(source.url);
      state[source.stateKey] = sourceData;
      state.loadedSources[sourceKey] = true;
      delete state.loadErrors[sourceKey];
      renderDashboardRefreshStrip(state);
      renderActionsRequiredFrame();
      queueReadyChartsForSource(sourceKey);
    } catch (error) {
      state[source.stateKey] = null;
      const message = `${source.errorMessage}: ${error instanceof Error ? error.message : String(error)}`;
      state.loadErrors[sourceKey] = message;
      state.loadedSources[sourceKey] = true;
      setStatusMessageForIds(source.statusIds || [], message);
      (source.clearContainers || []).forEach(clearChartContainer);
      renderDashboardRefreshStrip(state);
      renderActionsRequiredFrame();
    }
  }

  async function loadSnapshot() {
    setStatusMessageForIds(CHART_STATUS_IDS);
    state.snapshot = null;
    state.prActivitySnapshot = null;
    state.managementFacilitySnapshot = null;
    state.productCycle = null;
    state.productCycleShipments = null;
    state.contributors = null;
    state.prCycle = null;
    state.loadedSources = {};
    state.loadErrors = {};
    const rawMode = getModeFromUrl();
    state.mode = normalizeDashboardMode(rawMode);
    readDashboardControlStateFromUrl(CONTROL_BINDINGS, state);
    syncInitialRollingPeriods();
    syncSharedRollingPeriodUrl();
    removeObsoleteDashboardUrlParams(["pr-activity-legacy-metric"]);
    if (!hasUrlParam("bug-trends-view")) {
      state.bugTrendsView = defaultBugTrendsViewForMode(rawMode);
    }
    renderDashboardRefreshStrip(state);
    renderActionsRequiredFrame();
    applyDashboardPanelOrder();
    applyModeVisibility();
    ensurePanelBackToTopControls();
    syncDashboardControlsFromState(CONTROL_BINDINGS, state);
    bindDashboardControlState(CONTROL_BINDINGS, state);
    bindWindowResizeRerender();

    try {
      const requiredSourceKeys = getActiveSourceKeys();
      await Promise.allSettled(requiredSourceKeys.map((sourceKey) => loadDataSource(sourceKey)));
      renderDashboardRefreshStrip(state);
      renderActionsRequiredFrame();
    } catch (error) {
      const message = `Failed to load backlog-snapshot.json: ${
        error instanceof Error ? error.message : String(error)
      }`;
      setStatusMessageForIds(CHART_STATUS_IDS, message);
      renderDashboardRefreshStrip(state);
      renderActionsRequiredFrame();
    }
  }

  loadSnapshot();
})();
