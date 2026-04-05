#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const rootUrl = String(process.env.DASHBOARD_SMOKE_URL || "http://127.0.0.1:4173").replace(
  /\/+$/,
  ""
);
const isLocalPreview = (() => {
  try {
    const hostname = new URL(rootUrl).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
})();
const DEVELOPMENT_ROUTE_VISIBLE_PANELS = [
  "actions-required-panel",
  "development-workflow-breakdown-panel",
  "development-workflow-trends-panel"
];
const PRODUCT_ROUTE_VISIBLE_PANELS = [
  "actions-required-panel",
  "uat-acceptance-time-panel",
  "cycle-time-to-ship-panel"
];
const BUG_ROUTE_VISIBLE_PANELS = ["actions-required-panel", "bug-trends-panel"];
const PR_ROUTE_FORBIDDEN_RESOURCES = [
  "./app/dashboard-charts-shipped.js",
  "./app/dashboard-charts-product.js",
  "./vendor/prop-types.min.js",
  "./vendor/recharts.umd.js"
];
const SHIPPED_ROUTE_FORBIDDEN_RESOURCES = [
  "./vendor/prop-types.min.js",
  "./vendor/recharts.umd.js"
];
const LOCAL_ONLY_SUPPORT_RESOURCES = new Set([
  "./dev/agentation-local-loader.js",
  "./node_modules/agentation/dist/index.js"
]);
const DEFAULT_ROUTE_LOCAL_ONLY_RUNTIME_RESOURCES = new Set([
  ...LOCAL_ONLY_SUPPORT_RESOURCES,
  "./vendor/react.production.min.js",
  "./vendor/react-dom.production.min.js"
]);

function runAgentBrowser(args) {
  const result = spawnSync("agent-browser", args, {
    encoding: "utf8",
    cwd: process.cwd()
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`agent-browser ${args.join(" ")} failed${details ? `:\n${details}` : "."}`);
  }

  return result.stdout || "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openWithRetry(url, retries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      runAgentBrowser(["open", url]);
      return;
    } catch (error) {
      lastError = error;
      const message = String(error instanceof Error ? error.message : error);
      const isNavigationRace =
        message.includes("Execution context was destroyed") ||
        message.includes("interrupted by another navigation");
      if (!isNavigationRace || attempt === retries) break;
      await sleep(400);
    }
  }
  throw lastError;
}

function lastNonEmptyLine(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : "";
}

function evalJson(expression) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const raw = lastNonEmptyLine(runAgentBrowser(["eval", expression]));
      if (!raw) {
        throw new Error("agent-browser eval returned no JSON payload.");
      }
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    } catch (error) {
      lastError = error;
      const message = String(error instanceof Error ? error.message : error);
      const isTransientEvalError =
        message.includes("Execution context was destroyed") ||
        message.includes("interrupted by another navigation") ||
        message.includes("returned no JSON payload") ||
        message.includes("Invalid response: EOF while parsing a value") ||
        message.includes("Unexpected end of JSON input");
      if (!isTransientEvalError || attempt === 4) break;
    }
  }
  throw lastError;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sameList(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function normalizeResourceName(resourceName) {
  return String(resourceName || "")
    .replace(/\?.*$/, "")
    .trim();
}

function routeSnapshotExpression() {
  return `JSON.stringify({
    url: location.href,
    uptimeMs: Math.round(performance.now()),
    hasRecharts: Boolean(window.Recharts),
    hasViewUtils: !!window.DashboardViewUtils,
    hasAgentRoot: !!document.getElementById("agentation-local-root"),
    hasHeavyPanelShellDom: Boolean(
      document.getElementById("bug-trends-panel") &&
        document.getElementById("development-workflow-breakdown-panel")
    ),
    visiblePanels: Array.from(document.querySelectorAll("main .panel"))
      .filter((node) => !node.hidden)
      .map((node) => node.id),
    filledCharts: Array.from(document.querySelectorAll(".chart-canvas"))
      .filter((node) => node.innerHTML.trim().length > 0)
      .length,
    resourceNames: Array.from(new Set(
      performance.getEntriesByType("resource").map((entry) =>
        entry.name.replace(location.origin + "/", "./")
      )
    )),
    statuses: Array.from(document.querySelectorAll(".panel-status:not([hidden])"))
      .map((node) => ({ id: node.id, text: node.textContent.trim() }))
  })`;
}

function getResourceNameSet(snapshot) {
  return new Set(
    (Array.isArray(snapshot.resourceNames) ? snapshot.resourceNames : [])
      .map((resourceName) => normalizeResourceName(resourceName))
      .filter(Boolean)
  );
}

function normalizeExpectedResources(resources) {
  return (Array.isArray(resources) ? resources : [])
    .map((resourceName) => normalizeResourceName(resourceName))
    .filter(Boolean);
}

function findUnexpectedPrRouteResources(snapshot) {
  const loaded = getResourceNameSet(snapshot);
  return normalizeExpectedResources(PR_ROUTE_FORBIDDEN_RESOURCES).filter((resource) =>
    loaded.has(resource)
  );
}

function findUnexpectedShippedRouteResources(snapshot) {
  const loaded = getResourceNameSet(snapshot);
  return normalizeExpectedResources(SHIPPED_ROUTE_FORBIDDEN_RESOURCES).filter((resource) =>
    loaded.has(resource)
  );
}

function assertResourcesPresent(snapshot, expectedResources, description) {
  const loaded = getResourceNameSet(snapshot);
  const missingResources = normalizeExpectedResources(expectedResources).filter(
    (resource) => !loaded.has(resource)
  );
  assert(
    missingResources.length === 0,
    `${description} missing expected resources: ${JSON.stringify(missingResources)}`
  );
}

function normalizeLocalResourcePath(resourceName) {
  return String(resourceName || "")
    .replace(/^\.\//, "")
    .replace(/\?.*$/, "")
    .trim();
}

function hasResource(snapshot, resourceName) {
  const target = normalizeLocalResourcePath(resourceName);
  return (Array.isArray(snapshot.resourceNames) ? snapshot.resourceNames : [])
    .map((loadedName) => normalizeLocalResourcePath(loadedName))
    .includes(target);
}

async function enrichSnapshotWithLocalResourceStats(snapshot) {
  const localResources = Array.isArray(snapshot.resourceNames)
    ? snapshot.resourceNames.filter((resourceName) => resourceName.startsWith("./"))
    : [];

  const resourcesWithBytes = (
    await Promise.all(
      localResources.map(async (resourceName) => {
        const relativePath = normalizeLocalResourcePath(resourceName);
        if (!relativePath) return null;
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          const stat = await fs.stat(absolutePath);
          return {
            resourceName,
            bytes: stat.size
          };
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean);

  const liveEquivalentResources = resourcesWithBytes.filter(({ resourceName }) => {
    const normalizedResourceName = normalizeResourceName(resourceName);
    if (!isLocalPreview) return true;
    if (snapshot.hasViewUtils) {
      return !LOCAL_ONLY_SUPPORT_RESOURCES.has(normalizedResourceName);
    }
    return !DEFAULT_ROUTE_LOCAL_ONLY_RUNTIME_RESOURCES.has(normalizedResourceName);
  });

  return {
    ...snapshot,
    localResourceCount: resourcesWithBytes.length,
    localResourceBytes: resourcesWithBytes.reduce((total, resource) => total + resource.bytes, 0),
    largestLocalResources: resourcesWithBytes
      .slice()
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 8),
    liveEquivalentResourceCount: liveEquivalentResources.length,
    liveEquivalentResourceBytes: liveEquivalentResources.reduce(
      (total, resource) => total + resource.bytes,
      0
    ),
    largestLiveEquivalentResources: liveEquivalentResources
      .slice()
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 8)
  };
}

async function waitForSnapshot({ description, predicate, timeoutMs = 20000, intervalMs = 500 }) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;

  while (Date.now() < deadline) {
    snapshot = evalJson(routeSnapshotExpression());
    if (predicate(snapshot)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `${description} did not reach the expected state within ${timeoutMs}ms.\nLast snapshot: ${JSON.stringify(
      snapshot
    )}`
  );
}

async function captureRouteSnapshot({
  description,
  url,
  predicate,
  retries = 3,
  resetDelayMs = 800
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await openWithRetry(url);
      return await waitForSnapshot({ description, predicate });
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(resetDelayMs);
    }
  }

  throw lastError;
}

function assertDefaultRoute(snapshot) {
  assert(
    sameList(snapshot.visiblePanels, ["actions-required-panel", "community-contributors-panel"]),
    `Default route visible panels changed: ${JSON.stringify(snapshot.visiblePanels)}`
  );
  assert(
    snapshot.filledCharts === 1,
    `Default route should render 1 filled chart, saw ${snapshot.filledCharts}.`
  );
  assert(
    snapshot.statuses.length === 0,
    `Default route shows status errors: ${JSON.stringify(snapshot.statuses)}`
  );
  assert(
    snapshot.hasViewUtils === true,
    "Default route should eagerly load the heavy dashboard stack."
  );
  assert(
    hasHeavyPanelShellResource(snapshot),
    `Default route should load the heavy dashboard shell in the background: ${JSON.stringify(snapshot.resourceNames)}`
  );
  if (isLocalPreview) {
    assert(
      snapshot.hasAgentRoot === true,
      "Default route should restore the localhost Agentation mount."
    );
  }
}

function hasHeavyPanelShellResource(snapshot) {
  return Boolean(snapshot?.hasHeavyPanelShellDom);
}

function assertDevelopmentRoute(snapshot) {
  assert(
    sameList(snapshot.visiblePanels, DEVELOPMENT_ROUTE_VISIBLE_PANELS),
    `Development route visible panels changed: ${JSON.stringify(snapshot.visiblePanels)}`
  );
  assert(
    snapshot.filledCharts >= 3,
    `Development route should render at least 3 filled charts, saw ${snapshot.filledCharts}.`
  );
  assert(
    snapshot.statuses.length === 0,
    `Development route shows status errors: ${JSON.stringify(snapshot.statuses)}`
  );
  assert(snapshot.hasViewUtils === true, "Development route should load dashboard view utils.");
  assertResourcesPresent(
    snapshot,
    ["./data/pr-activity-snapshot.json", "./data/pr-cycle-snapshot.json"],
    "Development route"
  );
  if (isLocalPreview) {
    assert(snapshot.hasAgentRoot === true, "Development route should mount localhost Agentation.");
  }
}

function assertProductRoute(snapshot) {
  assert(
    sameList(snapshot.visiblePanels, PRODUCT_ROUTE_VISIBLE_PANELS),
    `Product route visible panels changed: ${JSON.stringify(snapshot.visiblePanels)}`
  );
  assert(
    snapshot.filledCharts >= 2,
    `Product route should render at least 2 filled charts, saw ${snapshot.filledCharts}.`
  );
  assert(
    snapshot.statuses.length === 0,
    `Product route shows status errors: ${JSON.stringify(snapshot.statuses)}`
  );
  assert(snapshot.hasViewUtils === true, "Product route should load dashboard view utils.");
  assertResourcesPresent(
    snapshot,
    [
      "./data/management-facility-snapshot.json",
      "./data/product-cycle-snapshot.json"
    ],
    "Product route"
  );
  const unexpectedResources = getResourceNameSet(snapshot);
  assert(
    !unexpectedResources.has("./vendor/prop-types.min.js") &&
      !unexpectedResources.has("./vendor/recharts.umd.js"),
    `Product route should not fetch legacy Recharts assets: ${JSON.stringify(snapshot.resourceNames)}`
  );
  if (isLocalPreview) {
    assert(snapshot.hasAgentRoot === true, "Product route should mount localhost Agentation.");
  }
}

function assertBugRoute(snapshot) {
  assert(
    sameList(snapshot.visiblePanels, BUG_ROUTE_VISIBLE_PANELS),
    `Bug route visible panels changed: ${JSON.stringify(snapshot.visiblePanels)}`
  );
  assert(
    snapshot.filledCharts >= 1,
    `Bug route should render at least 1 filled chart, saw ${snapshot.filledCharts}.`
  );
  assert(
    snapshot.statuses.length === 0,
    `Bug route shows status errors: ${JSON.stringify(snapshot.statuses)}`
  );
  assert(snapshot.hasViewUtils === true, "Bug route should load dashboard view utils.");
  assertResourcesPresent(
    snapshot,
    ["./data/backlog-snapshot.json"],
    "Bug route"
  );
  const unexpectedResources = getResourceNameSet(snapshot);
  assert(
    !unexpectedResources.has("./vendor/prop-types.min.js") &&
      !unexpectedResources.has("./vendor/recharts.umd.js"),
    `Bug route should not fetch legacy Recharts assets: ${JSON.stringify(snapshot.resourceNames)}`
  );
  if (isLocalPreview) {
    assert(snapshot.hasAgentRoot === true, "Bug route should mount localhost Agentation.");
  }
}

function assertShippedRoute(snapshot) {
  assert(
    sameList(snapshot.visiblePanels, ["actions-required-panel", "product-cycle-shipments-panel"]),
    `Shipped route visible panels changed: ${JSON.stringify(snapshot.visiblePanels)}`
  );
  assert(
    snapshot.filledCharts === 2,
    `Shipped route should keep the pre-rendered community card plus the shipped chart, saw ${snapshot.filledCharts}.`
  );
  assert(
    snapshot.statuses.length === 0,
    `Shipped route shows status errors: ${JSON.stringify(snapshot.statuses)}`
  );
  assert(snapshot.hasViewUtils === true, "Shipped route should load dashboard view utils.");
  assert(
    hasHeavyPanelShellResource(snapshot),
    `Shipped route should load the heavy dashboard shell: ${JSON.stringify(snapshot.resourceNames)}`
  );
  assertResourcesPresent(
    snapshot,
    ["./data/product-cycle-shipments-snapshot.json"],
    "Shipped route"
  );
  const unexpectedResources = findUnexpectedShippedRouteResources(snapshot);
  assert(
    unexpectedResources.length === 0,
    `Shipped route should not fetch unrelated heavy assets: ${JSON.stringify(unexpectedResources)}`
  );
  if (isLocalPreview) {
    assert(snapshot.hasAgentRoot === true, "Shipped route should mount localhost Agentation.");
  }
}

function assertPrRoute(snapshot) {
  assert(
    sameList(snapshot.visiblePanels, ["development-workflow-breakdown-panel"]),
    `PR route visible panels changed: ${JSON.stringify(snapshot.visiblePanels)}`
  );
  assert(
    snapshot.filledCharts === 1,
    `PR route should render 1 filled chart, saw ${snapshot.filledCharts}.`
  );
  assert(
    snapshot.statuses.length === 0,
    `PR route shows status errors: ${JSON.stringify(snapshot.statuses)}`
  );
  assert(snapshot.hasViewUtils === true, "PR route should load dashboard view utils.");
  assert(
    snapshot.hasRecharts === false,
    "PR route should not require the legacy Recharts runtime."
  );
  assert(
    hasResource(snapshot, "./data/pr-cycle-snapshot.json"),
    "PR route should fetch pr-cycle-snapshot.json."
  );
  assert(
    !hasResource(snapshot, "./data/pr-activity-snapshot.json"),
    "PR route should not fetch pr-activity-snapshot.json."
  );
  assert(
    !hasResource(snapshot, "./data/backlog-snapshot.json"),
    "PR route should not fetch backlog-snapshot.json."
  );
  const unexpectedResources = findUnexpectedPrRouteResources(snapshot);
  assert(
    unexpectedResources.length === 0,
    `PR route should not fetch legacy Recharts assets: ${JSON.stringify(unexpectedResources)}`
  );
  if (isLocalPreview) {
    assert(snapshot.hasAgentRoot === true, "PR route should mount localhost Agentation.");
  }
}

function verifyWorkflowBreakdownInflowLabels() {
  let breakdownState = { hasContent: false };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    breakdownState = evalJson(`JSON.stringify((() => {
      const panel = document.getElementById("development-workflow-breakdown-panel");
      const utilityStats = Array.from(
        panel?.querySelectorAll(".dashboard-utility-layout__stat") || []
      );
      const metricValues = Array.from(
        panel?.querySelectorAll(".workflow-breakdown-metric__value") || []
      );
      return {
        hasContent: Boolean(panel && panel.innerHTML.trim().length > 0),
        hasOverviewPanel: Boolean(document.getElementById("development-workflow-overview-panel")),
        metricValueCount: metricValues.length,
        utilityStatCount: utilityStats.length,
        utilityStatLabels: utilityStats.map((node) => node.querySelector("dt")?.textContent?.trim() || ""),
        utilityStatValues: utilityStats.map((node) => node.querySelector("dd")?.textContent?.trim() || ""),
        utilityRowCount: Array.from(
          panel?.querySelectorAll(".dashboard-utility-layout__row") || []
        ).length,
        firstMetricColor: metricValues[0] ? getComputedStyle(metricValues[0]).color : "",
        secondMetricColor: metricValues[1] ? getComputedStyle(metricValues[1]).color : "",
        firstSampleText:
          panel?.querySelector(".pr-cycle-stage-row__sample")?.textContent?.trim() || ""
      };
    })())`);
    if (breakdownState.hasContent) break;
    runAgentBrowser(["wait", "250"]);
  }

  assert(
    breakdownState.hasContent === true,
    "Development workflow breakdown should render panel content."
  );
  assert(
    breakdownState.hasOverviewPanel === false,
    "Development workflow overview panel should no longer be present."
  );
  assert(
    breakdownState.metricValueCount >= 1 ||
      (breakdownState.utilityStatCount >= 2 && breakdownState.utilityRowCount >= 1),
    `Development workflow breakdown should render either legacy metrics or the utility layout card: ${JSON.stringify(breakdownState)}`
  );
  if (breakdownState.metricValueCount >= 2) {
    assert(
      breakdownState.firstMetricColor === breakdownState.secondMetricColor,
      `Workflow breakdown metric values should share the same color: ${breakdownState.firstMetricColor} vs ${breakdownState.secondMetricColor}`
    );
  }
  if (breakdownState.metricValueCount >= 1) {
    assert(
      /^n = \d+$/.test(breakdownState.firstSampleText),
      `Development workflow breakdown should show a team sample count under the label, saw ${JSON.stringify(breakdownState.firstSampleText)}`
    );
  }

  return breakdownState;
}

function selectRadioInput(name, value) {
  const result = evalJson(`JSON.stringify((() => {
    const input = document.querySelector(
      'input[type="radio"][name="${String(name)}"][value="${String(value)}"]'
    );
    if (!input) return { found: false, checked: false };
    input.click();
    return { found: true, checked: input.checked };
  })())`);

  assert(result?.found === true, `Missing radio control ${name}=${value}.`);
}

async function assertSectionControlSwitch({
  section,
  expectedVisiblePanels,
  name,
  value,
  description
}) {
  await captureRouteSnapshot({
    description: `${description} route`,
    url: `${rootUrl}/?report-section=${section}`,
    predicate(snapshot) {
      return (
        sameList(snapshot.visiblePanels, expectedVisiblePanels) &&
        snapshot.statuses.length === 0 &&
        snapshot.hasViewUtils === true &&
        hasHeavyPanelShellResource(snapshot) &&
        (!isLocalPreview || snapshot.hasAgentRoot === true)
      );
    }
  });

  selectRadioInput(name, value);
  await waitForSnapshot({
    description,
    predicate(currentSnapshot) {
      return (
        sameList(currentSnapshot.visiblePanels, expectedVisiblePanels) &&
        currentSnapshot.statuses.length === 0 &&
        currentSnapshot.hasViewUtils === true &&
        hasHeavyPanelShellResource(currentSnapshot) &&
        (!isLocalPreview || currentSnapshot.hasAgentRoot === true)
      );
    }
  });
  const confirmation = evalJson(`JSON.stringify((() => {
    const input = document.querySelector(
      'input[type="radio"][name="${String(name)}"][value="${String(value)}"]'
    );
    return { checked: !!input?.checked };
  })())`);
  assert(confirmation?.checked === true, `${description} did not keep ${name}=${value} selected.`);
}

async function main() {
  const defaultSnapshot = await enrichSnapshotWithLocalResourceStats(
    await captureRouteSnapshot({
      description: "Default route",
      url: `${rootUrl}/`,
      predicate(snapshot) {
        return (
          snapshot.uptimeMs >= 1500 &&
          snapshot.filledCharts === 1 &&
          snapshot.statuses.length === 0 &&
          sameList(snapshot.visiblePanels, [
            "actions-required-panel",
            "community-contributors-panel"
          ]) &&
          snapshot.hasViewUtils === true &&
          hasHeavyPanelShellResource(snapshot) &&
          (!isLocalPreview || snapshot.hasAgentRoot === true)
        );
      }
    })
  );
  assertDefaultRoute(defaultSnapshot);

  const developmentSnapshot = await enrichSnapshotWithLocalResourceStats(
    await captureRouteSnapshot({
      description: "Development section route",
      url: `${rootUrl}/?report-section=development`,
      predicate(snapshot) {
        return (
          snapshot.filledCharts >= 3 &&
          snapshot.statuses.length === 0 &&
          snapshot.hasViewUtils === true &&
          sameList(snapshot.visiblePanels, DEVELOPMENT_ROUTE_VISIBLE_PANELS) &&
          hasHeavyPanelShellResource(snapshot) &&
          hasResource(snapshot, "./data/pr-activity-snapshot.json") &&
          hasResource(snapshot, "./data/pr-cycle-snapshot.json") &&
          (!isLocalPreview || snapshot.hasAgentRoot === true)
        );
      }
    })
  );
  assertDevelopmentRoute(developmentSnapshot);
  const workflowBreakdownInflow = verifyWorkflowBreakdownInflowLabels();

  const productSnapshot = await enrichSnapshotWithLocalResourceStats(
    await captureRouteSnapshot({
      description: "Product section route",
      url: `${rootUrl}/?report-section=product`,
      predicate(snapshot) {
        return (
          snapshot.filledCharts >= 2 &&
          snapshot.statuses.length === 0 &&
          snapshot.hasViewUtils === true &&
          sameList(snapshot.visiblePanels, PRODUCT_ROUTE_VISIBLE_PANELS) &&
          hasHeavyPanelShellResource(snapshot) &&
          hasResource(snapshot, "./data/management-facility-snapshot.json") &&
          hasResource(snapshot, "./data/product-cycle-snapshot.json") &&
          (!isLocalPreview || snapshot.hasAgentRoot === true)
        );
      }
    })
  );
  assertProductRoute(productSnapshot);

  const bugSnapshot = await enrichSnapshotWithLocalResourceStats(
    await captureRouteSnapshot({
      description: "Bug section route",
      url: `${rootUrl}/?report-section=bug`,
      predicate(snapshot) {
        return (
          snapshot.filledCharts >= 1 &&
          snapshot.statuses.length === 0 &&
          snapshot.hasViewUtils === true &&
          sameList(snapshot.visiblePanels, BUG_ROUTE_VISIBLE_PANELS) &&
          hasHeavyPanelShellResource(snapshot) &&
          hasResource(snapshot, "./data/backlog-snapshot.json") &&
          (!isLocalPreview || snapshot.hasAgentRoot === true)
        );
      }
    })
  );
  assertBugRoute(bugSnapshot);
  const prSnapshot = await enrichSnapshotWithLocalResourceStats(
    await captureRouteSnapshot({
      description: "PR chart route",
      url: `${rootUrl}/?chart=pr`,
      predicate(snapshot) {
        return (
          snapshot.filledCharts === 1 &&
          snapshot.statuses.length === 0 &&
          snapshot.hasViewUtils === true &&
          snapshot.hasRecharts === false &&
          hasHeavyPanelShellResource(snapshot) &&
          sameList(snapshot.visiblePanels, ["development-workflow-breakdown-panel"]) &&
          findUnexpectedPrRouteResources(snapshot).length === 0 &&
          (!isLocalPreview || snapshot.hasAgentRoot === true)
        );
      }
    })
  );
  assertPrRoute(prSnapshot);

  await captureRouteSnapshot({
    description: "Default route reset",
    url: `${rootUrl}/`,
    predicate(snapshot) {
      return (
        snapshot.uptimeMs >= 1500 &&
        snapshot.filledCharts === 1 &&
        snapshot.statuses.length === 0 &&
        sameList(snapshot.visiblePanels, [
          "actions-required-panel",
          "community-contributors-panel"
        ]) &&
        snapshot.hasViewUtils === true &&
        hasHeavyPanelShellResource(snapshot) &&
        (!isLocalPreview || snapshot.hasAgentRoot === true)
      );
    }
  });

  selectRadioInput("report-section", "shipped");
  const shippedSnapshot = await enrichSnapshotWithLocalResourceStats(
    await waitForSnapshot({
      description: "Shipped section switch",
      predicate(snapshot) {
        return (
          snapshot.filledCharts === 2 &&
          snapshot.statuses.length === 0 &&
          snapshot.hasViewUtils === true &&
          sameList(snapshot.visiblePanels, [
            "actions-required-panel",
            "product-cycle-shipments-panel"
          ]) &&
          hasHeavyPanelShellResource(snapshot) &&
          findUnexpectedShippedRouteResources(snapshot).length === 0 &&
          (!isLocalPreview || snapshot.hasAgentRoot === true)
        );
      }
    })
  );
  assertShippedRoute(shippedSnapshot);
  await assertSectionControlSwitch({
    section: "bug",
    expectedVisiblePanels: BUG_ROUTE_VISIBLE_PANELS,
    name: "bug-trends-view",
    value: "table",
    description: "Bug trends table view"
  });
  await assertSectionControlSwitch({
    section: "product",
    expectedVisiblePanels: PRODUCT_ROUTE_VISIBLE_PANELS,
    name: "management-facility-flow-scope",
    value: "done",
    description: "Completed management-vs-UAT scope"
  });
  await assertSectionControlSwitch({
    section: "development",
    expectedVisiblePanels: DEVELOPMENT_ROUTE_VISIBLE_PANELS,
    name: "pr-cycle-window",
    value: "1y",
    description: "Workflow breakdown 1y window"
  });
  await assertSectionControlSwitch({
    section: "development",
    expectedVisiblePanels: DEVELOPMENT_ROUTE_VISIBLE_PANELS,
    name: "pr-activity-legacy-metric",
    value: "merged",
    description: "Legacy PR activity merged metric"
  });
  await assertSectionControlSwitch({
    section: "product",
    expectedVisiblePanels: PRODUCT_ROUTE_VISIBLE_PANELS,
    name: "product-delivery-workflow-view",
    value: "workflow",
    description: "Product delivery workflow view"
  });

  console.log("Dashboard smoke passed.");
  console.log(`- default: ${JSON.stringify(defaultSnapshot)}`);
  console.log(`- development: ${JSON.stringify(developmentSnapshot)}`);
  console.log(`- product: ${JSON.stringify(productSnapshot)}`);
  console.log(`- bug: ${JSON.stringify(bugSnapshot)}`);
  console.log(`- pr: ${JSON.stringify(prSnapshot)}`);
  console.log(`- shipped: ${JSON.stringify(shippedSnapshot)}`);
  console.log(`- workflowBreakdownInflow: ${JSON.stringify(workflowBreakdownInflow)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
