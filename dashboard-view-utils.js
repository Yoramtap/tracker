"use strict";

(function initDashboardViewUtils(globalObject) {
  const DATA_SOURCE_URLS = {
    snapshot: "./backlog-snapshot.json",
    productCycle: "./product-cycle-snapshot.json",
    contributors: "./contributors-snapshot.json",
    prCycle: "./pr-cycle-snapshot.json"
  };

  function createDashboardRuntimeContract() {
    function getModeFromUrl(search = globalObject.location?.search || "") {
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

    function getRequiredSourceKeys(mode, availableSourceKeys = []) {
      if (mode === "all") return availableSourceKeys.slice();
      if (mode === "contributors") return ["contributors"];
      if (mode === "pr-activity") return ["snapshot", "prCycle"];
      if (mode === "pr-cycle-experiment") return ["prCycle"];
      if (mode === "product-cycle" || mode === "lifecycle-days") return ["productCycle"];
      return ["snapshot"];
    }

    return Object.freeze({
      getModeFromUrl,
      getRequiredSourceKeys
    });
  }

  const dashboardRuntimeContract =
    globalObject.DashboardRuntimeContract || createDashboardRuntimeContract();
  globalObject.DashboardRuntimeContract = dashboardRuntimeContract;

  function getRequestedMode() {
    return dashboardRuntimeContract.getModeFromUrl();
  }

  function getNeededSourceKeys() {
    try {
      return dashboardRuntimeContract.getRequiredSourceKeys(
        getRequestedMode(),
        Object.keys(DATA_SOURCE_URLS)
      );
    } catch {
      return ["snapshot"];
    }
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

  const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit"
  });
  const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function formatDateShort(date) {
    const parsed = new Date(`${String(date || "")}T00:00:00`);
    if (!Number.isFinite(parsed.getTime())) return String(date || "");
    return shortDateFormatter.format(parsed);
  }

  function formatUpdatedAt(value) {
    const parsed = new Date(String(value || ""));
    if (!Number.isFinite(parsed.getTime())) return "Unknown";
    return updatedAtFormatter.format(parsed);
  }

  function getOldestTimestamp(values) {
    const candidates = (Array.isArray(values) ? values : [])
      .map((value) => {
        const text = String(value || "").trim();
        const time = new Date(text).getTime();
        return Number.isFinite(time) ? { text, time } : null;
      })
      .filter(Boolean);
    if (candidates.length === 0) return "";
    candidates.sort((left, right) => left.time - right.time);
    return candidates[0].text;
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getDashboardControlElements(name, controlType = "radio") {
    if (controlType === "checkbox") {
      const checkbox = globalObject.document.querySelector(`input[name="${name}"]`);
      return checkbox ? [checkbox] : [];
    }
    return Array.from(globalObject.document.querySelectorAll(`input[name="${name}"]`));
  }

  function syncControlSelectionClasses(name, controlType = "radio") {
    const controls = getDashboardControlElements(name, controlType);
    controls.forEach((control) => {
      const label = control.closest("label");
      if (!label) return;
      label.classList.toggle("is-selected", Boolean(control.checked));
    });
  }

  function syncControlValue(name, value, controlType = "radio") {
    const controls = getDashboardControlElements(name, controlType);
    if (controls.length === 0) return;
    if (controlType === "checkbox") {
      controls[0].checked = Boolean(value);
      syncControlSelectionClasses(name, controlType);
      return;
    }
    controls.forEach((control) => {
      control.checked = control.value === value;
    });
    syncControlSelectionClasses(name, controlType);
  }

  function syncRadioAvailability(name, allowedValues) {
    const allowed = new Set((Array.isArray(allowedValues) ? allowedValues : []).map((value) => String(value)));
    const radios = Array.from(globalObject.document.querySelectorAll(`input[name="${name}"]`));
    radios.forEach((radio) => {
      const isAllowed = allowed.has(String(radio.value || ""));
      radio.disabled = !isAllowed;
      const label = radio.closest("label");
      if (label) {
        label.setAttribute("aria-disabled", isAllowed ? "false" : "true");
        label.classList.toggle("is-disabled", !isAllowed);
        label.classList.toggle("is-selected", Boolean(radio.checked));
      }
    });
  }

  function readDashboardControlStateFromUrl(bindings, state) {
    const params = new URLSearchParams(globalObject.location.search);
    (Array.isArray(bindings) ? bindings : []).forEach(
      ({ name, stateKey, normalizeValue, normalizeChecked, controlType, defaultValue }) => {
        if (!params.has(name)) {
          state[stateKey] = defaultValue;
          return;
        }
        const raw = String(params.get(name) || "");
        if (controlType === "checkbox") {
          const checked = !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
          state[stateKey] = normalizeChecked(checked);
          return;
        }
        state[stateKey] = normalizeValue(raw);
      }
    );
  }

  function syncDashboardControlsFromState(bindings, state) {
    (Array.isArray(bindings) ? bindings : []).forEach(({ name, stateKey, controlType }) => {
      syncControlValue(name, state[stateKey], controlType);
    });
  }

  function bindDashboardControlState(bindings, state) {
    (Array.isArray(bindings) ? bindings : []).forEach(
      ({
        name,
        stateKey,
        normalizeValue,
        normalizeChecked,
        onChangeRender,
        controlType
      }) => {
        const controls = getDashboardControlElements(name, controlType);
        if (controls.length === 0) return;
        controls.forEach((control) => {
          if (control.dataset.bound === "1") return;
          control.dataset.bound = "1";
          control.addEventListener("change", () => {
            state[stateKey] =
              controlType === "checkbox"
                ? (normalizeChecked ? normalizeChecked(control.checked) : Boolean(control.checked))
                : normalizeValue(control.value);
            syncControlSelectionClasses(name, controlType);
            const nextUrl = new URL(globalObject.location.href);
            (Array.isArray(bindings) ? bindings : []).forEach(({ name: bindingName, stateKey: bindingStateKey, controlType: bindingControlType }) => {
              if (bindingControlType === "checkbox") {
                nextUrl.searchParams.set(bindingName, state[bindingStateKey] ? "true" : "false");
                return;
              }
              nextUrl.searchParams.set(bindingName, String(state[bindingStateKey] || ""));
            });
            globalObject.history.replaceState({}, "", nextUrl);
            onChangeRender();
          });
        });
      }
    );
  }

  function renderRadioPillSwitch(containerId, name, options, selectedValue) {
    const container = globalObject.document.getElementById(containerId);
    if (!container) return;
    const safeOptions = Array.isArray(options) ? options.filter(Boolean) : [];
    container.hidden = safeOptions.length === 0;
    container.innerHTML = safeOptions
      .map(
        (option) => `
        <label class="pr-cycle-team-pill">
          <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}"${
            option.value === selectedValue ? " checked" : ""
          } />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `
      )
      .join("");
  }

  function renderDashboardRadioControlGroup({
    containerId,
    name,
    options,
    selectedValue,
    bindings,
    state
  }) {
    renderRadioPillSwitch(containerId, name, options, selectedValue);
    bindDashboardControlState(bindings, state);
    syncControlValue(name, selectedValue);
  }

  function showPanelStatus(status, message, { containerId = "" } = {}) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    if (containerId) clearChartContainer(containerId);
  }

  function withChart(configKey, getConfig, onReady, { resetStatus = true } = {}) {
    const config = typeof getConfig === "function" ? getConfig(configKey) : null;
    if (!config) return;
    const status = document.getElementById(config.statusId);
    const context = document.getElementById(config.contextId);
    if (!status || !context) return;
    if (resetStatus) status.hidden = true;
    onReady({ config, status, context });
  }

  function renderDashboardChartState(configKey, getConfig, buildResult) {
    withChart(configKey, getConfig, ({ status, context, config }) => {
      const result = buildResult({ status, context, config });
      if (!result) return;
      if (result.error) {
        showPanelStatus(status, result.error, result.clearContainer ? { containerId: config.containerId } : {});
        return;
      }
      if (result.controlGroup) renderDashboardRadioControlGroup(result.controlGroup);
      if (Object.prototype.hasOwnProperty.call(result, "contextText")) {
        setPanelContext(context, result.contextText);
      }
      if (typeof result.render === "function") result.render({ status, context, config });
    });
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
        all: readThemeColor("--team-all", "#98a4b3"),
        api: readThemeColor("--team-api", "#2f6ea8"),
        legacy: readThemeColor("--team-legacy", "#8d6f3f"),
        react: readThemeColor("--team-react", "#3f7f75"),
        bc: readThemeColor("--team-bc", "#76649a"),
        multiteam: readThemeColor("--team-multi-team", "#667a4d"),
        workers: readThemeColor("--team-workers", "#5e6b84"),
        titanium: readThemeColor("--team-titanium", "#b07aa1")
      },
      priorities: {
        highest: readThemeColor("--priority-highest", "#3f638f"),
        high: readThemeColor("--priority-high", "#6f8fb9"),
        medium: readThemeColor("--priority-medium", "#9fb6d7"),
        low: readThemeColor("--priority-low", "#c9d6e8"),
        lowest: readThemeColor("--priority-lowest", "#e9eef5")
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
      barBorder: readThemeColor("--bar-border", "#111111")
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

  function setPanelContext(node, text) {
    if (!node) return;
    const safeText = String(text || "").trim();
    node.hidden = safeText.length === 0;
    node.textContent = safeText;
  }

  function setConfigContext(config, text) {
    if (!config) return;
    setPanelContext(document.getElementById(config.contextId), text);
  }

  function formatContextWithFreshness(text, timestamp, label = "updated") {
    const safeText = String(text || "").trim();
    const safeTimestamp = String(timestamp || "").trim();
    if (!safeTimestamp) return safeText;
    const freshnessText = `${label} ${formatUpdatedAt(safeTimestamp)}`;
    return safeText ? `${safeText} • ${freshnessText}` : freshnessText;
  }

  function getSnapshotContextTimestamp(state, { preferChartData = false } = {}) {
    if (preferChartData) {
      return String(state?.snapshot?.chartDataUpdatedAt || state?.snapshot?.updatedAt || "").trim();
    }
    return String(state?.snapshot?.updatedAt || "").trim();
  }

  function renderDashboardRefreshStrip(state) {
    const panel = document.getElementById("dashboard-refresh-panel");
    const textNode = document.getElementById("dashboard-refresh-text");
    if (!panel || !textNode) return;
    const refreshUpdatedAt = getOldestTimestamp([
      state?.snapshot?.updatedAt,
      state?.snapshot?.chartData ? state?.snapshot?.chartDataUpdatedAt : "",
      state?.productCycle?.generatedAt,
      state?.contributors?.updatedAt,
      state?.prCycle?.updatedAt
    ]);
    panel.hidden = false;
    textNode.hidden = refreshUpdatedAt.length === 0;
    textNode.textContent = refreshUpdatedAt
      ? `Oldest panel data updated ${formatUpdatedAt(refreshUpdatedAt)}`
      : "";
  }

  function getModeFromUrl() {
    return dashboardRuntimeContract.getModeFromUrl(window.location.search);
  }

  function getRequiredSourceKeys(mode, availableSourceKeys = []) {
    return dashboardRuntimeContract.getRequiredSourceKeys(mode, availableSourceKeys);
  }

  function isEmbedMode() {
    const params = new URLSearchParams(window.location.search);
    const embed = (params.get("embed") || "").toLowerCase();
    if (embed === "0" || embed === "false" || embed === "no") return false;
    if (embed === "1" || embed === "true" || embed === "yes") return true;
    return getModeFromUrl() !== "all";
  }

  globalObject.DashboardViewUtils = {
    toNumber,
    formatDateShort,
    formatUpdatedAt,
    getOldestTimestamp,
    setStatusMessage,
    setStatusMessageForIds,
    escapeHtml,
    syncControlValue,
    syncRadioAvailability,
    readDashboardControlStateFromUrl,
    syncDashboardControlsFromState,
    bindDashboardControlState,
    setPanelContext,
    setConfigContext,
    formatContextWithFreshness,
    getSnapshotContextTimestamp,
    renderDashboardRefreshStrip,
    showPanelStatus,
    withChart,
    renderDashboardChartState,
    getThemeColors,
    clearChartContainer,
    getModeFromUrl,
    getRequiredSourceKeys,
    isEmbedMode
  };
})(window);
