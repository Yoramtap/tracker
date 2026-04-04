import fs from "node:fs/promises";
import path from "node:path";

import {
  BACKLOG_SNAPSHOT_PATH,
  BACKLOG_SNAPSHOT_TMP_PATH,
  CONTRIBUTORS_SNAPSHOT_PATH,
  CONTRIBUTORS_SNAPSHOT_TMP_PATH,
  MANAGEMENT_FACILITY_SNAPSHOT_PATH,
  MANAGEMENT_FACILITY_SNAPSHOT_TMP_PATH,
  PR_ACTIVITY_SNAPSHOT_PATH,
  PR_ACTIVITY_SNAPSHOT_TMP_PATH,
  PR_CYCLE_SNAPSHOT_PATH,
  PR_CYCLE_SNAPSHOT_TMP_PATH,
  PRIMARY_SNAPSHOT_PATH,
  PRIMARY_SNAPSHOT_TMP_PATH,
  PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_PATH,
  PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_TMP_PATH,
  PRODUCT_CYCLE_SNAPSHOT_PATH,
  PRODUCT_CYCLE_SNAPSHOT_TMP_PATH,
  SNAPSHOT_HISTORY_DIR_PATH
} from "./dashboard-paths.mjs";
import {
  sanitizeContributorsSnapshot,
  sanitizePrCycleSnapshot,
  sanitizeProductCycleSnapshot
} from "./snapshot-sanitizers.mjs";
import { validateDashboardSnapshot } from "./validate-dashboard-snapshots.mjs";

const PRIMARY_SNAPSHOT_WRITE_ENTRIES = Object.freeze([
  { key: "snapshot", outputPath: PRIMARY_SNAPSHOT_PATH, tmpPath: PRIMARY_SNAPSHOT_TMP_PATH },
  {
    key: "backlogSnapshot",
    outputPath: BACKLOG_SNAPSHOT_PATH,
    tmpPath: BACKLOG_SNAPSHOT_TMP_PATH
  },
  {
    key: "prActivitySnapshot",
    outputPath: PR_ACTIVITY_SNAPSHOT_PATH,
    tmpPath: PR_ACTIVITY_SNAPSHOT_TMP_PATH
  },
  {
    key: "managementFacilitySnapshot",
    outputPath: MANAGEMENT_FACILITY_SNAPSHOT_PATH,
    tmpPath: MANAGEMENT_FACILITY_SNAPSHOT_TMP_PATH
  }
]);

export async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJsonAtomic(outputPath, tmpPath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await fs.writeFile(tmpPath, serialized, "utf8");
    await fs.rename(tmpPath, outputPath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}

export async function writeDashboardPrimaryArtifactsAtomic(primaryArtifacts) {
  const serializedByKey = Object.fromEntries(
    PRIMARY_SNAPSHOT_WRITE_ENTRIES.map((entry) => [
      entry.key,
      `${JSON.stringify(primaryArtifacts[entry.key], null, 2)}\n`
    ])
  );

  try {
    await fs.mkdir(path.dirname(PRIMARY_SNAPSHOT_TMP_PATH), { recursive: true });
    for (const entry of PRIMARY_SNAPSHOT_WRITE_ENTRIES) {
      await fs.writeFile(entry.tmpPath, serializedByKey[entry.key], "utf8");
    }
    for (const entry of PRIMARY_SNAPSHOT_WRITE_ENTRIES) {
      await fs.rename(entry.tmpPath, entry.outputPath);
    }
  } catch (error) {
    await Promise.all(
      PRIMARY_SNAPSHOT_WRITE_ENTRIES.map((entry) =>
        fs.unlink(entry.tmpPath).catch(() => undefined)
      )
    );
    throw error;
  }
}

async function writeSanitizedSnapshotAtomic(snapshot, sanitizer, outputPath, tmpPath, fileName) {
  const sanitizedSnapshot = sanitizer(snapshot);
  validateDashboardSnapshot(fileName, sanitizedSnapshot);
  await writeJsonAtomic(outputPath, tmpPath, sanitizedSnapshot);
}

export async function writePrCycleSnapshotAtomic(snapshot) {
  return writeSanitizedSnapshotAtomic(
    snapshot,
    sanitizePrCycleSnapshot,
    PR_CYCLE_SNAPSHOT_PATH,
    PR_CYCLE_SNAPSHOT_TMP_PATH,
    "pr-cycle-snapshot.json"
  );
}

export async function writeProductCycleSnapshotAtomic(snapshot) {
  return writeSanitizedSnapshotAtomic(
    snapshot,
    sanitizeProductCycleSnapshot,
    PRODUCT_CYCLE_SNAPSHOT_PATH,
    PRODUCT_CYCLE_SNAPSHOT_TMP_PATH,
    "product-cycle-snapshot.json"
  );
}

export function buildProductCycleShipmentsSnapshot(snapshot) {
  const shippedTimeline =
    snapshot?.detailData?.shippedTimeline && typeof snapshot.detailData.shippedTimeline === "object"
      ? snapshot.detailData.shippedTimeline
      : null;
  return {
    generatedAt: String(snapshot?.generatedAt || new Date().toISOString()).trim(),
    chartData: {
      shippedTimeline: shippedTimeline || {
        timelineStart: "",
        timelineEnd: "",
        totalShipped: 0,
        months: []
      }
    }
  };
}

export async function writeProductCycleShipmentsSnapshotAtomic(snapshot) {
  const shipmentsSnapshot = buildProductCycleShipmentsSnapshot(snapshot);
  validateDashboardSnapshot("product-cycle-shipments-snapshot.json", shipmentsSnapshot);
  return writeJsonAtomic(
    PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_PATH,
    PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_TMP_PATH,
    shipmentsSnapshot
  );
}

export async function writeContributorsSnapshotAtomic(snapshot) {
  return writeSanitizedSnapshotAtomic(
    snapshot,
    sanitizeContributorsSnapshot,
    CONTRIBUTORS_SNAPSHOT_PATH,
    CONTRIBUTORS_SNAPSHOT_TMP_PATH,
    "contributors-snapshot.json"
  );
}

export function buildSupplementalWriteArtifacts({
  contributorsSnapshot,
  productCycleSnapshot,
  prCycleSnapshot
}) {
  const artifacts = [];

  if (contributorsSnapshot) {
    artifacts.push({
      fileName: "contributors-snapshot.json",
      outputSnapshot: sanitizeContributorsSnapshot(contributorsSnapshot),
      logMessage: "Wrote contributors-snapshot.json.",
      write: () => writeContributorsSnapshotAtomic(contributorsSnapshot)
    });
  }

  if (productCycleSnapshot) {
    artifacts.push({
      fileName: "product-cycle-snapshot.json",
      outputSnapshot: sanitizeProductCycleSnapshot(productCycleSnapshot),
      logMessage: "Wrote product-cycle-snapshot.json.",
      write: () => writeProductCycleSnapshotAtomic(productCycleSnapshot)
    });
    artifacts.push({
      fileName: "product-cycle-shipments-snapshot.json",
      outputSnapshot: buildProductCycleShipmentsSnapshot(productCycleSnapshot),
      logMessage: "Wrote product-cycle-shipments-snapshot.json.",
      write: () => writeProductCycleShipmentsSnapshotAtomic(productCycleSnapshot)
    });
  }

  if (prCycleSnapshot) {
    artifacts.push({
      fileName: "pr-cycle-snapshot.json",
      outputSnapshot: sanitizePrCycleSnapshot(prCycleSnapshot),
      logMessage: "",
      write: () => writePrCycleSnapshotAtomic(prCycleSnapshot)
    });
  }

  return artifacts;
}

function snapshotArchiveFileName(syncedAt) {
  const safeStamp = String(syncedAt || "unknown")
    .replace(/[:.]/g, "-")
    .replace(/[^0-9TZ-]/g, "");
  return `snapshot-${safeStamp}.json`;
}

export async function archiveSnapshot(snapshot, syncedAt) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const fileName = snapshotArchiveFileName(syncedAt);
  const filePath = path.join(SNAPSHOT_HISTORY_DIR_PATH, fileName);
  await fs.mkdir(SNAPSHOT_HISTORY_DIR_PATH, { recursive: true });
  await fs.writeFile(filePath, serialized, "utf8");
  return filePath;
}

export async function pruneArchivedSnapshots(maxSnapshots) {
  let entries = [];
  try {
    entries = await fs.readdir(SNAPSHOT_HISTORY_DIR_PATH, { withFileTypes: true });
  } catch {
    return [];
  }

  const fileNames = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith("snapshot-") && entry.name.endsWith(".json")
    )
    .map((entry) => entry.name)
    .sort();

  const overflowCount = fileNames.length - maxSnapshots;
  if (overflowCount <= 0) return [];

  const removed = [];
  for (const fileName of fileNames.slice(0, overflowCount)) {
    await fs.unlink(path.join(SNAPSHOT_HISTORY_DIR_PATH, fileName));
    removed.push(fileName);
  }
  return removed;
}

export async function commitSnapshotRefresh({
  snapshot,
  primaryArtifacts,
  preparePrimarySnapshotArtifacts,
  syncedAt,
  snapshotRetentionCount,
  summaryMessage,
  extraWrites = [],
  extraLogs = []
}) {
  const resolvedPrimaryArtifacts =
    primaryArtifacts || (await preparePrimarySnapshotArtifacts(snapshot));
  await writeDashboardPrimaryArtifactsAtomic(resolvedPrimaryArtifacts);
  for (const writeExtra of extraWrites) {
    await writeExtra();
  }
  const archivedPath = await archiveSnapshot(snapshot || resolvedPrimaryArtifacts.snapshot, syncedAt);
  const prunedSnapshots = await pruneArchivedSnapshots(snapshotRetentionCount);
  console.log(summaryMessage);
  for (const line of extraLogs) {
    if (line) console.log(line);
  }
  console.log(`Archived snapshot history copy: ${archivedPath}`);
  if (prunedSnapshots.length > 0) {
    console.log(
      `Pruned ${prunedSnapshots.length} archived snapshot(s) to keep the latest ${snapshotRetentionCount}.`
    );
  }
}
