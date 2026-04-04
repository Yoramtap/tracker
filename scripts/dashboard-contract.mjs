import path from "node:path";

export const DATA_DIR = "data";
export const CACHE_DIR = ".cache";
export const DIST_DIR = "dist";
export const SNAPSHOT_HISTORY_DIR = path.posix.join(CACHE_DIR, "snapshots");
export const ANALYSIS_DIR = path.posix.join(CACHE_DIR, "analysis");
export const ANALYSIS_REPORT_PATH = path.posix.join(ANALYSIS_DIR, "latest-analysis.md");
export const ANALYSIS_HISTORY_DIR = path.posix.join(ANALYSIS_DIR, "history");

export const INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES = Object.freeze(["snapshot.json"]);

export const PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES = Object.freeze([
  "backlog-snapshot.json",
  "contributors-snapshot.json",
  "management-facility-snapshot.json",
  "pr-activity-snapshot.json",
  "pr-cycle-snapshot.json",
  "product-cycle-shipments-snapshot.json",
  "product-cycle-snapshot.json"
]);

export const ALL_DASHBOARD_SNAPSHOT_FILE_NAMES = Object.freeze([
  ...INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES,
  ...PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES
]);

export const PRIMARY_DASHBOARD_SNAPSHOT_FILE_NAME = INTERNAL_DASHBOARD_SNAPSHOT_FILE_NAMES[0];
export const PRIMARY_DASHBOARD_SNAPSHOT_PATH = path.posix.join(
  DATA_DIR,
  PRIMARY_DASHBOARD_SNAPSHOT_FILE_NAME
);

export const PUBLIC_DASHBOARD_SNAPSHOT_PATHS = Object.freeze(
  PUBLIC_DASHBOARD_SNAPSHOT_FILE_NAMES.map((fileName) => path.posix.join(DATA_DIR, fileName))
);

export const ALL_DASHBOARD_SNAPSHOT_PATHS = Object.freeze(
  ALL_DASHBOARD_SNAPSHOT_FILE_NAMES.map((fileName) => path.posix.join(DATA_DIR, fileName))
);
