import fs from "node:fs/promises";
import path from "node:path";

import { PRIMARY_SNAPSHOT_PATH, SNAPSHOT_HISTORY_DIR_PATH } from "./dashboard-paths.mjs";
import { readJsonFile } from "./dashboard-snapshot-store.mjs";

function isoDateOnly(value) {
  return String(value || "").trim().slice(0, 10);
}

export function countPrActivitySeriesPoints(prActivity, key) {
  return Array.isArray(prActivity?.[key]) ? prActivity[key].filter(Boolean).length : 0;
}

function getPrActivityHistoryMetrics(prActivity) {
  return {
    pointsCount: countPrActivitySeriesPoints(prActivity, "points"),
    monthlyPointsCount: countPrActivitySeriesPoints(prActivity, "monthlyPoints"),
    updatedAt: String(prActivity?.updatedAt || "").trim()
  };
}

function comparePrActivityHistoryMetrics(left, right) {
  const safeLeft = left || { pointsCount: 0, monthlyPointsCount: 0, updatedAt: "" };
  const safeRight = right || { pointsCount: 0, monthlyPointsCount: 0, updatedAt: "" };
  if (safeLeft.monthlyPointsCount !== safeRight.monthlyPointsCount) {
    return safeLeft.monthlyPointsCount - safeRight.monthlyPointsCount;
  }
  if (safeLeft.pointsCount !== safeRight.pointsCount) {
    return safeLeft.pointsCount - safeRight.pointsCount;
  }
  return String(safeLeft.updatedAt || "").localeCompare(String(safeRight.updatedAt || ""));
}

async function readBestExistingPrActivityHistorySnapshot() {
  const currentSnapshot = await readJsonFile(PRIMARY_SNAPSHOT_PATH);
  let bestSnapshot = currentSnapshot;
  let bestSource = PRIMARY_SNAPSHOT_PATH;
  let bestMetrics = getPrActivityHistoryMetrics(currentSnapshot?.prActivity);

  let entries = [];
  try {
    entries = await fs.readdir(SNAPSHOT_HISTORY_DIR_PATH, { withFileTypes: true });
  } catch {
    return {
      currentSnapshot,
      bestPrActivity: bestSnapshot?.prActivity || null,
      bestSource,
      bestMetrics
    };
  }

  const archiveFiles = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith("snapshot-") && entry.name.endsWith(".json")
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const fileName of archiveFiles) {
    const archivedSnapshot = await readJsonFile(path.join(SNAPSHOT_HISTORY_DIR_PATH, fileName));
    const archivedMetrics = getPrActivityHistoryMetrics(archivedSnapshot?.prActivity);
    if (comparePrActivityHistoryMetrics(archivedMetrics, bestMetrics) <= 0) continue;
    bestSnapshot = archivedSnapshot;
    bestSource = path.join(SNAPSHOT_HISTORY_DIR_PATH, fileName);
    bestMetrics = archivedMetrics;
  }

  return {
    currentSnapshot,
    bestPrActivity: bestSnapshot?.prActivity || null,
    bestSource,
    bestMetrics
  };
}

export async function readPrActivityHistoryState(options = {}) {
  if (options.skipHistoryReuse) {
    const currentSnapshot = await readJsonFile(PRIMARY_SNAPSHOT_PATH);
    return {
      currentSnapshot,
      bestPrActivity: null,
      bestSource: "",
      bestMetrics: getPrActivityHistoryMetrics(null)
    };
  }

  return await readBestExistingPrActivityHistorySnapshot();
}

function filterDatedPointSeriesFromFloor(points, floorDate) {
  const safeFloorDate = isoDateOnly(floorDate);
  const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
  if (!safeFloorDate) return safePoints;
  return safePoints.filter((point) => String(point?.date || "").trim() >= safeFloorDate);
}

function mergeDatedPointSeries(existingPoints, refreshedPoints, options = {}) {
  const truncateAfterRefreshedLatest = options.truncateAfterRefreshedLatest !== false;
  const ceilingDate = isoDateOnly(options.ceilingDate);
  const safeExistingPoints = Array.isArray(existingPoints) ? existingPoints.filter(Boolean) : [];
  const safeRefreshedPoints = Array.isArray(refreshedPoints) ? refreshedPoints.filter(Boolean) : [];
  const refreshedLatestPointDate = String(
    safeRefreshedPoints[safeRefreshedPoints.length - 1]?.date || ""
  ).trim();
  const mergedByDate = new Map();

  for (const point of safeExistingPoints) {
    const date = String(point?.date || "").trim();
    if (!date) continue;
    mergedByDate.set(date, point);
  }
  for (const point of safeRefreshedPoints) {
    const date = String(point?.date || "").trim();
    if (!date) continue;
    mergedByDate.set(date, point);
  }

  return Array.from(mergedByDate.entries())
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([, point]) => point)
    .filter((point) => {
      const date = String(point?.date || "").trim();
      if (!date) return false;
      if (ceilingDate && date > ceilingDate) return false;
      if (!truncateAfterRefreshedLatest || !refreshedLatestPointDate) return true;
      return date <= refreshedLatestPointDate;
    });
}

export function mergePrActivitySnapshots(existingPrActivity, refreshedPrActivity, options = {}) {
  const truncateAfterRefreshedLatest = options.truncateAfterRefreshedLatest !== false;
  const ceilingDate = isoDateOnly(options.ceilingDate);
  const monthlyFloorDate = isoDateOnly(options.monthlyFloorDate);
  const refreshedPoints = Array.isArray(refreshedPrActivity?.points)
    ? refreshedPrActivity.points.filter(Boolean)
    : [];
  if (refreshedPoints.length === 0) {
    if (!existingPrActivity || typeof existingPrActivity !== "object") {
      return refreshedPrActivity;
    }
    const preservedMonthlyPoints = filterDatedPointSeriesFromFloor(
      Array.isArray(refreshedPrActivity?.monthlyPoints)
        ? refreshedPrActivity.monthlyPoints
        : Array.isArray(existingPrActivity?.monthlyPoints)
          ? existingPrActivity.monthlyPoints
          : [],
      monthlyFloorDate
    );
    return {
      ...existingPrActivity,
      ...refreshedPrActivity,
      since: String(existingPrActivity?.points?.[0]?.date || refreshedPrActivity?.since || ""),
      points: Array.isArray(existingPrActivity?.points) ? existingPrActivity.points : [],
      monthlySince: String(
        preservedMonthlyPoints[0]?.date ||
          refreshedPrActivity?.monthlySince ||
          existingPrActivity?.monthlySince ||
          ""
      ),
      monthlyPoints: preservedMonthlyPoints
    };
  }
  const refreshedMonthlyPoints = Array.isArray(refreshedPrActivity?.monthlyPoints)
    ? refreshedPrActivity.monthlyPoints.filter(Boolean)
    : [];
  const mergedPoints = mergeDatedPointSeries(existingPrActivity?.points, refreshedPoints, {
    ceilingDate,
    truncateAfterRefreshedLatest
  });
  const mergedMonthlyPoints = mergeDatedPointSeries(
    existingPrActivity?.monthlyPoints,
    refreshedMonthlyPoints,
    {
      ceilingDate,
      truncateAfterRefreshedLatest
    }
  );
  const filteredMonthlyPoints = filterDatedPointSeriesFromFloor(
    mergedMonthlyPoints,
    monthlyFloorDate
  );

  return {
    ...(existingPrActivity && typeof existingPrActivity === "object" ? existingPrActivity : {}),
    ...refreshedPrActivity,
    since: String(mergedPoints[0]?.date || refreshedPrActivity?.since || ""),
    points: mergedPoints,
    monthlySince: String(
      filteredMonthlyPoints[0]?.date ||
        refreshedPrActivity?.monthlySince ||
        refreshedPrActivity?.monthlyPoints?.[0]?.date ||
        ""
    ),
    monthlyPoints: filteredMonthlyPoints
  };
}
