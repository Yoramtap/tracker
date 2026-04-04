#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  SNAPSHOT_SANITIZERS,
  sanitizeBacklogSnapshot,
  sanitizePrActivitySnapshot
} from "./snapshot-sanitizers.mjs";
import {
  ALL_DASHBOARD_SNAPSHOT_FILE_NAMES as CONTRACT_ALL_DASHBOARD_SNAPSHOT_FILE_NAMES,
  ALL_DASHBOARD_SNAPSHOT_PATHS as CONTRACT_ALL_DASHBOARD_SNAPSHOT_PATHS,
  INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES as CONTRACT_INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES,
  PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES as CONTRACT_PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES
} from "./dashboard-contract.mjs";

export {
  CONTRACT_INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES as INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES,
  CONTRACT_PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES as PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES
};

const ALL_DASHBOARD_SNAPSHOT_FILE_NAMES = CONTRACT_ALL_DASHBOARD_SNAPSHOT_FILE_NAMES;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describeValue(value) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value === null) return "null";
  if (isPlainObject(value)) return "object";
  return `${typeof value}(${JSON.stringify(value)})`;
}

function findFirstDifference(actual, expected, currentPath = "$") {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { path: currentPath, reason: `expected array, got ${describeValue(actual)}` };
    }
    if (actual.length !== expected.length) {
      return {
        path: currentPath,
        reason: `expected array length ${expected.length}, got ${actual.length}`
      };
    }
    for (let index = 0; index < expected.length; index += 1) {
      const diff = findFirstDifference(actual[index], expected[index], `${currentPath}[${index}]`);
      if (diff) return diff;
    }
    return null;
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      return { path: currentPath, reason: `expected object, got ${describeValue(actual)}` };
    }
    const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();
    for (const key of keys) {
      const nextPath = `${currentPath}.${key}`;
      if (!(key in actual)) {
        return { path: nextPath, reason: "missing required key" };
      }
      if (!(key in expected)) {
        return { path: nextPath, reason: "unexpected key" };
      }
      const diff = findFirstDifference(actual[key], expected[key], nextPath);
      if (diff) return diff;
    }
    return null;
  }

  if (!isDeepStrictEqual(actual, expected)) {
    return {
      path: currentPath,
      reason: `expected ${describeValue(expected)}, got ${describeValue(actual)}`
    };
  }
  return null;
}

function assert(condition, fileName, message) {
  if (!condition) {
    throw new Error(`${fileName}: ${message}`);
  }
}

function assertNonEmptyString(value, fileName, label) {
  assert(typeof value === "string" && value.trim().length > 0, fileName, `${label} must be a non-empty string.`);
}

function assertArray(value, fileName, label) {
  assert(Array.isArray(value), fileName, `${label} must be an array.`);
}

function assertObject(value, fileName, label) {
  assert(isPlainObject(value), fileName, `${label} must be an object.`);
}

function assertFiniteNumber(value, fileName, label) {
  assert(Number.isFinite(value), fileName, `${label} must be a finite number.`);
}

function assertSeriesDates(points, fileName, label) {
  assertArray(points, fileName, label);
  points.forEach((point, index) => {
    assertObject(point, fileName, `${label}[${index}]`);
    assertNonEmptyString(point.date, fileName, `${label}[${index}].date`);
  });
}

function assertSanitizedSnapshot(fileName, snapshot) {
  const sanitizer = SNAPSHOT_SANITIZERS[fileName];
  if (!sanitizer) return;
  const sanitized = sanitizer(snapshot);
  const diff = findFirstDifference(snapshot, sanitized);
  if (diff) {
    throw new Error(`${fileName}: does not match its sanitized contract at ${diff.path} (${diff.reason}).`);
  }
}

function validateCombinedSnapshot(snapshot, fileName) {
  assertObject(snapshot, fileName, "snapshot");
  assertFiniteNumber(snapshot.schemaVersion, fileName, "schemaVersion");
  assertNonEmptyString(snapshot.updatedAt, fileName, "updatedAt");
  assertObject(snapshot.source, fileName, "source");
  assertNonEmptyString(snapshot.source.syncedAt, fileName, "source.syncedAt");
  assertSeriesDates(snapshot.combinedPoints, fileName, "combinedPoints");

  if ("chartData" in snapshot && snapshot.chartData !== undefined) {
    assertObject(snapshot.chartData, fileName, "chartData");
  }
  if ("prActivity" in snapshot && snapshot.prActivity !== undefined) {
    const prActivitySnapshot = sanitizePrActivitySnapshot({
      updatedAt: snapshot.updatedAt,
      prActivity: snapshot.prActivity
    });
    assertObject(prActivitySnapshot.prActivity, fileName, "prActivity");
    assertSeriesDates(prActivitySnapshot.prActivity.points, fileName, "prActivity.points");
    assertSeriesDates(
      prActivitySnapshot.prActivity.monthlyPoints,
      fileName,
      "prActivity.monthlyPoints"
    );
  }

  const backlogProjection = sanitizeBacklogSnapshot(snapshot);
  assertSeriesDates(backlogProjection.combinedPoints, fileName, "combinedPoints");
}

function validateSnapshotSemantics(snapshot, fileName) {
  switch (fileName) {
    case "snapshot.json":
      validateCombinedSnapshot(snapshot, fileName);
      return;
    case "backlog-snapshot.json":
      assertNonEmptyString(snapshot.updatedAt, fileName, "updatedAt");
      assertSeriesDates(snapshot.combinedPoints, fileName, "combinedPoints");
      return;
    case "contributors-snapshot.json":
      assertNonEmptyString(snapshot.updatedAt, fileName, "updatedAt");
      assertObject(snapshot.summary, fileName, "summary");
      assertObject(snapshot.chartData, fileName, "chartData");
      assertArray(snapshot.chartData.rows, fileName, "chartData.rows");
      return;
    case "management-facility-snapshot.json":
      assertNonEmptyString(snapshot.updatedAt, fileName, "updatedAt");
      if ("chartData" in snapshot && snapshot.chartData !== undefined) {
        assertObject(snapshot.chartData, fileName, "chartData");
      }
      return;
    case "pr-activity-snapshot.json":
      assertNonEmptyString(snapshot.updatedAt, fileName, "updatedAt");
      assertObject(snapshot.prActivity, fileName, "prActivity");
      assertSeriesDates(snapshot.prActivity.points, fileName, "prActivity.points");
      assertSeriesDates(snapshot.prActivity.monthlyPoints, fileName, "prActivity.monthlyPoints");
      return;
    case "pr-cycle-snapshot.json":
      assertNonEmptyString(snapshot.updatedAt, fileName, "updatedAt");
      assertNonEmptyString(snapshot.defaultTeam, fileName, "defaultTeam");
      assertNonEmptyString(snapshot.defaultWindow, fileName, "defaultWindow");
      assertObject(snapshot.windows, fileName, "windows");
      return;
    case "product-cycle-snapshot.json":
      assertNonEmptyString(snapshot.generatedAt, fileName, "generatedAt");
      assertObject(snapshot.chartData, fileName, "chartData");
      assertObject(snapshot.chartData.leadCycleByScope, fileName, "chartData.leadCycleByScope");
      assertObject(
        snapshot.chartData.currentStageSnapshot,
        fileName,
        "chartData.currentStageSnapshot"
      );
      return;
    case "product-cycle-shipments-snapshot.json":
      assertNonEmptyString(snapshot.generatedAt, fileName, "generatedAt");
      assertObject(snapshot.chartData, fileName, "chartData");
      assertObject(snapshot.chartData.shippedTimeline, fileName, "chartData.shippedTimeline");
      assertArray(snapshot.chartData.shippedTimeline.months, fileName, "chartData.shippedTimeline.months");
      return;
    default:
      throw new Error(`Unsupported snapshot file: ${fileName}`);
  }
}

export function validateDashboardSnapshot(fileName, snapshot) {
  assert(
    ALL_DASHBOARD_SNAPSHOT_FILE_NAMES.includes(fileName),
    fileName,
    "is not a recognized dashboard snapshot file."
  );
  assertObject(snapshot, fileName, "snapshot");
  assertSanitizedSnapshot(fileName, snapshot);
  validateSnapshotSemantics(snapshot, fileName);
  return snapshot;
}

export function validateDashboardSnapshotText(fileName, text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${fileName}: invalid JSON (${error.message}).`);
  }
  return validateDashboardSnapshot(fileName, parsed);
}

export async function validateDashboardSnapshotFiles(
  sourceDir = process.cwd(),
  relativePaths = CONTRACT_ALL_DASHBOARD_SNAPSHOT_PATHS.map((relativePath) =>
    relativePath.split(path.posix.sep).join(path.sep)
  )
) {
  const validatedFiles = [];
  for (const relativePath of relativePaths) {
    const filePath = path.resolve(sourceDir, relativePath);
    const fileName = path.basename(relativePath);
    const text = await fs.readFile(filePath, "utf8");
    validateDashboardSnapshotText(fileName, text);
    validatedFiles.push(relativePath);
  }
  return validatedFiles;
}

async function main() {
  const validatedFiles = await validateDashboardSnapshotFiles();
  console.log(`Validated ${validatedFiles.length} dashboard snapshot files.`);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
