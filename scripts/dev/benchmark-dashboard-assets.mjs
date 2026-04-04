#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const indexPath = path.join(rootDir, "index.html");
const localAssetPattern = /\b(?:src|href)=["']\.\/([^"'?#]+)(?:\?[^"']*)?["']/g;
const deferredSharedHeavyScriptPaths = [
  "app/dashboard-view-utils.js",
  "vendor/react.production.min.js",
  "vendor/react-dom.production.min.js",
  "app/dashboard-chart-core.js",
  "app/dashboard-pretext-layout.js",
  "app/dashboard-app.js"
];
const deferredShippedScriptPaths = [
  ...deferredSharedHeavyScriptPaths,
  "app/dashboard-charts-shipped.js"
];
const deferredProductScriptPaths = [
  ...deferredSharedHeavyScriptPaths,
  "app/dashboard-charts-product.js"
];
const deferredFullDashboardScriptPaths = [
  ...deferredShippedScriptPaths,
  "app/dashboard-charts-product.js"
];
const deferredPrOnlyScriptPaths = [...deferredSharedHeavyScriptPaths];
const deferredHeavyPanelPaths = ["app/dashboard-heavy-panels.html"];
const pretextLayoutPaths = ["vendor/pretext.mjs"];
const routePayloadSpecs = [
  {
    label: "Direct bug route total",
    scripts: deferredPrOnlyScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: ["data/backlog-snapshot.json"]
  },
  {
    label: "Direct workflow route total",
    scripts: deferredPrOnlyScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: ["data/pr-activity-snapshot.json", "data/pr-cycle-snapshot.json"],
    extra: pretextLayoutPaths
  },
  {
    label: "Direct workflow legacy route total",
    scripts: deferredPrOnlyScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: ["data/pr-activity-snapshot.json", "data/pr-cycle-snapshot.json"]
  },
  {
    label: "Direct contributors route total",
    scripts: deferredPrOnlyScriptPaths,
    panels: [],
    data: ["data/contributors-snapshot.json"]
  },
  {
    label: "Direct product route total",
    scripts: deferredProductScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: ["data/management-facility-snapshot.json", "data/product-cycle-snapshot.json"],
    extra: pretextLayoutPaths
  },
  {
    label: "Direct product legacy route total",
    scripts: deferredProductScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: ["data/management-facility-snapshot.json", "data/product-cycle-snapshot.json"]
  },
  {
    label: "Direct shipped route total",
    scripts: deferredShippedScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: ["data/product-cycle-shipments-snapshot.json"]
  },
  {
    label: "Full dashboard route total",
    scripts: deferredFullDashboardScriptPaths,
    panels: deferredHeavyPanelPaths,
    data: [
      "data/backlog-snapshot.json",
      "data/pr-activity-snapshot.json",
      "data/management-facility-snapshot.json",
      "data/product-cycle-snapshot.json",
      "data/product-cycle-shipments-snapshot.json",
      "data/contributors-snapshot.json",
      "data/pr-cycle-snapshot.json"
    ]
  }
];

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function classifyAsset(filePath) {
  if (filePath.endsWith(".css")) return "styles";
  if (filePath.endsWith(".js")) return "scripts";
  return "other";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

async function readIndexAssets() {
  const html = await fs.readFile(indexPath, "utf8");
  const assets = [];

  for (const match of html.matchAll(localAssetPattern)) {
    const relativePath = String(match[1] || "").trim();
    if (!relativePath) continue;
    assets.push(relativePath);
  }

  return [...new Set(assets)];
}

async function statAsset(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const stat = await fs.stat(absolutePath);
  return {
    relativePath,
    absolutePath,
    bytes: stat.size,
    group: classifyAsset(relativePath)
  };
}

async function statOptionalFile(relativePath) {
  try {
    return await statAsset(relativePath);
  } catch {
    return null;
  }
}

async function main() {
  const assetPaths = await readIndexAssets();
  const assets = await Promise.all(assetPaths.map(statAsset));
  const totals = { styles: 0, scripts: 0, other: 0 };
  const dataSources = [
    "data/backlog-snapshot.json",
    "data/pr-activity-snapshot.json",
    "data/management-facility-snapshot.json",
    "data/product-cycle-snapshot.json",
    "data/product-cycle-shipments-snapshot.json",
    "data/contributors-snapshot.json",
    "data/pr-cycle-snapshot.json"
  ];

  for (const asset of assets) {
    totals[asset.group] += asset.bytes;
  }

  const deferredSharedHeavyScripts = (
    await Promise.all(deferredSharedHeavyScriptPaths.map(statOptionalFile))
  ).filter(Boolean);
  const deferredShippedScripts = (
    await Promise.all(deferredShippedScriptPaths.map(statOptionalFile))
  ).filter(Boolean);
  const deferredProductScripts = (
    await Promise.all(deferredProductScriptPaths.map(statOptionalFile))
  ).filter(Boolean);
  const deferredFullDashboardScripts = (
    await Promise.all(deferredFullDashboardScriptPaths.map(statOptionalFile))
  ).filter(Boolean);
  const deferredHeavyPanels = (
    await Promise.all(deferredHeavyPanelPaths.map(statOptionalFile))
  ).filter(Boolean);
  const deferredPrOnlyScripts = (
    await Promise.all(deferredPrOnlyScriptPaths.map(statOptionalFile))
  ).filter(Boolean);
  const pretextLayoutAssets = (await Promise.all(pretextLayoutPaths.map(statOptionalFile))).filter(
    Boolean
  );

  const dataSourceStats = (await Promise.all(dataSources.map(statOptionalFile))).filter(Boolean);
  const dataSourceSizeByPath = Object.fromEntries(
    dataSourceStats.map((asset) => [asset.relativePath, asset.bytes])
  );

  const localAgentationPath = path.join(rootDir, "node_modules/agentation/dist/index.js");
  const initialReferencedBytes = totals.styles + totals.scripts + totals.other;
  const optionalAssetBytesByPath = Object.fromEntries(
    [
      ...deferredSharedHeavyScripts,
      ...deferredShippedScripts,
      ...deferredProductScripts,
      ...deferredFullDashboardScripts,
      ...deferredHeavyPanels,
      ...pretextLayoutAssets,
      ...dataSourceStats
    ]
      .filter(Boolean)
      .map((asset) => [asset.relativePath, asset.bytes])
  );
  let localAgentationBytes = 0;
  try {
    localAgentationBytes = (await fs.stat(localAgentationPath)).size;
  } catch {
    // Agentation is optional outside local preview.
  }

  console.log("Dashboard asset benchmark");
  console.log(`HTML entry: ${formatKiB((await fs.stat(indexPath)).size)}`);
  console.log(`Styles: ${formatKiB(totals.styles)}`);
  console.log(`Scripts: ${formatKiB(totals.scripts)}`);
  console.log(`Other assets: ${formatKiB(totals.other)}`);
  console.log(`Initial referenced total: ${formatKiB(initialReferencedBytes)}`);
  console.log(
    `Deferred full-dashboard core stack: ${formatKiB(
      sum([...deferredFullDashboardScripts, ...deferredHeavyPanels].map((asset) => asset.bytes))
    )}`
  );
  console.log(
    `Deferred shipped-only stack: ${formatKiB(
      sum([...deferredShippedScripts, ...deferredHeavyPanels].map((asset) => asset.bytes))
    )}`
  );
  console.log(
    `Deferred product-only stack: ${formatKiB(
      sum([...deferredProductScripts, ...deferredHeavyPanels].map((asset) => asset.bytes))
    )}`
  );
  console.log(
    `Deferred PR-only stack: ${formatKiB(
      sum([...deferredPrOnlyScripts, ...deferredHeavyPanels].map((asset) => asset.bytes))
    )}`
  );
  console.log(
    `Pretext layout module: ${formatKiB(sum(pretextLayoutAssets.map((asset) => asset.bytes)))}`
  );
  if (localAgentationBytes > 0) {
    console.log(`Localhost-only Agentation package: ${formatKiB(localAgentationBytes)}`);
  }
  console.log("");
  console.log("Data source scenarios:");
  console.log(
    `- Default community preload: ${formatKiB(dataSourceSizeByPath["data/contributors-snapshot.json"] || 0)}`
  );
  console.log(
    `- Direct bug route: ${formatKiB(dataSourceSizeByPath["data/backlog-snapshot.json"] || 0)}`
  );
  console.log(
    `- Direct product route: ${formatKiB(
      (dataSourceSizeByPath["data/management-facility-snapshot.json"] || 0) +
        (dataSourceSizeByPath["data/product-cycle-snapshot.json"] || 0)
    )}`
  );
  console.log(
    `- Direct workflow route: ${formatKiB(dataSourceSizeByPath["data/pr-cycle-snapshot.json"] || 0)}`
  );
  console.log(
    `- Full development section: ${formatKiB(
      (dataSourceSizeByPath["data/pr-activity-snapshot.json"] || 0) +
        (dataSourceSizeByPath["data/pr-cycle-snapshot.json"] || 0)
    )}`
  );
  console.log(`- All dashboard sources: ${formatKiB(sum(Object.values(dataSourceSizeByPath)))}`);
  console.log(
    `- Default avoided on first load: ${formatKiB(
      Math.max(
        0,
        sum(Object.values(dataSourceSizeByPath)) -
          (dataSourceSizeByPath["data/contributors-snapshot.json"] || 0)
      )
    )}`
  );
  console.log("");
  const fullRouteSpec = routePayloadSpecs.find(
    (spec) => spec.label === "Full dashboard route total"
  );
  const estimateRouteBytes = (spec) =>
    initialReferencedBytes +
    sum(
      [...spec.scripts, ...spec.panels, ...spec.data, ...(spec.extra || [])].map(
        (relativePath) => optionalAssetBytesByPath[relativePath] || 0
      )
    );
  const fullRouteBytes = fullRouteSpec ? estimateRouteBytes(fullRouteSpec) : 0;
  console.log("Route payload estimates:");
  routePayloadSpecs.forEach((spec) => {
    const routeBytes = estimateRouteBytes(spec);
    const savingsLabel =
      fullRouteBytes > routeBytes
        ? ` (saves ${formatKiB(fullRouteBytes - routeBytes)} vs full)`
        : "";
    console.log(`- ${spec.label}: ${formatKiB(routeBytes)}${savingsLabel}`);
  });
  console.log("");
  console.log("Largest referenced assets:");
  assets
    .slice()
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 8)
    .forEach((asset) => {
      console.log(`- ${asset.relativePath}: ${formatKiB(asset.bytes)}`);
    });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
