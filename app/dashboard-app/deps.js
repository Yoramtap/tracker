function requireGlobal(name, value, message) {
  if (value) return value;
  throw new Error(message || `${name} not loaded.`);
}

export function resolveDashboardAppDeps() {
  const dashboardRuntimeContract = requireGlobal(
    "DashboardRuntimeContract",
    window.DashboardRuntimeContract,
    "Dashboard runtime contract not loaded."
  );
  const dashboardUiUtils = requireGlobal(
    "DashboardViewUtils",
    window.DashboardViewUtils,
    "Dashboard UI helpers not loaded."
  );
  const dashboardDataUtils = requireGlobal(
    "DashboardDataUtils",
    window.DashboardDataUtils,
    "Dashboard data helpers not loaded."
  );
  const dashboardChartCore = requireGlobal(
    "DashboardChartCore",
    window.DashboardChartCore,
    "Dashboard chart core not loaded."
  );
  const dashboardSvgCore = requireGlobal(
    "DashboardSvgCore",
    window.DashboardSvgCore,
    "Dashboard SVG core not loaded."
  );

  return {
    dashboardRuntimeContract,
    dashboardUiUtils,
    dashboardDataUtils,
    dashboardChartCore,
    dashboardSvgCore,
    getDashboardCharts() {
      return window.DashboardCharts || {};
    },
    getDashboardPretextLayout() {
      return window.DashboardPretextLayout || window.DashboardPretextExperiment || null;
    },
    getPreloadedDataSourcePromises() {
      return window.__dashboardDataSourcePromiseCache || Object.create(null);
    },
    browserApi: {
      addEventListener(...args) {
        return window.addEventListener(...args);
      },
      fetchJson(url, options = {}) {
        return fetch(url, { cache: "no-cache", ...options }).then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        });
      },
      getLocationSearch() {
        return window.location.search;
      },
      hasUrlParam(name) {
        return new URLSearchParams(window.location.search).has(name);
      },
      requestAnimationFrame(callback) {
        return window.requestAnimationFrame(callback);
      }
    }
  };
}
