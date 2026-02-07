import fs from "node:fs/promises";
import path from "node:path";
import { BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, backlogSource } from "./data";
import type { BacklogSnapshot, CombinedTrendPoint, TrendPoint } from "./types";

const SNAPSHOT_PATH = path.resolve(process.cwd(), "src/app/backlog/snapshot.json");
const SNAPSHOT_TMP_PATH = path.resolve(process.cwd(), "src/app/backlog/snapshot.json.tmp");
const SNAPSHOT_SCHEMA_VERSION = 1;

function normalizeTrendDate(date: string) {
  return date.startsWith("API ") ? date.slice(4) : date;
}

function emptyTrendPoint(date: string): TrendPoint {
  return { date, highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
}

function buildSnapshotFromModuleData(): BacklogSnapshot {
  const nowIso = new Date().toISOString();
  const apiTrend = BOARD_38_TREND.map((point) => ({
    ...point,
    date: normalizeTrendDate(point.date),
  }));
  const legacyTrend = BOARD_39_TREND;
  const reactTrend = BOARD_46_TREND;

  const apiByDate = new Map(apiTrend.map((point) => [point.date, point]));
  const legacyByDate = new Map(legacyTrend.map((point) => [point.date, point]));
  const reactByDate = new Map(reactTrend.map((point) => [point.date, point]));

  const allDates = Array.from(
    new Set([
      ...apiTrend.map((point) => point.date),
      ...legacyTrend.map((point) => point.date),
      ...reactTrend.map((point) => point.date),
    ]),
  ).sort();

  const combinedPoints: CombinedTrendPoint[] = allDates.map((date) => ({
    date,
    api: apiByDate.get(date) ?? emptyTrendPoint(date),
    legacy: legacyByDate.get(date) ?? emptyTrendPoint(date),
    react: reactByDate.get(date) ?? emptyTrendPoint(date),
  }));

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    updatedAt: nowIso,
    source: backlogSource,
    combinedPoints,
  };
}

export async function getSnapshot(): Promise<BacklogSnapshot> {
  const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<BacklogSnapshot>;
  return {
    ...parsed,
    schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : SNAPSHOT_SCHEMA_VERSION,
    updatedAt: parsed.updatedAt ?? parsed.source?.syncedAt ?? new Date().toISOString(),
    source: parsed.source ?? backlogSource,
    combinedPoints: Array.isArray(parsed.combinedPoints) ? parsed.combinedPoints : [],
  } as BacklogSnapshot;
}

export async function writeSnapshot(nextSnapshot: BacklogSnapshot) {
  const serialized = `${JSON.stringify(nextSnapshot, null, 2)}\n`;
  try {
    await fs.writeFile(SNAPSHOT_TMP_PATH, serialized, "utf8");
    await fs.rename(SNAPSHOT_TMP_PATH, SNAPSHOT_PATH);
  } catch (error) {
    await fs.unlink(SNAPSHOT_TMP_PATH).catch(() => undefined);
    throw error;
  }
}

export async function getBacklogSnapshot(): Promise<BacklogSnapshot> {
  try {
    return await getSnapshot();
  } catch {
    // Fallback to module data below.
  }

  return buildSnapshotFromModuleData();
}
