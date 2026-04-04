import path from "node:path";

import {
  ANALYSIS_DIR,
  ANALYSIS_HISTORY_DIR,
  ANALYSIS_REPORT_PATH,
  CACHE_DIR,
  DATA_DIR,
  DIST_DIR,
  PRIMARY_DASHBOARD_SNAPSHOT_FILE_NAME,
  SNAPSHOT_HISTORY_DIR
} from "./dashboard-contract.mjs";

const BACKLOG_SNAPSHOT_FILE_NAME = "backlog-snapshot.json";
const CONTRIBUTORS_SNAPSHOT_FILE_NAME = "contributors-snapshot.json";
const MANAGEMENT_FACILITY_SNAPSHOT_FILE_NAME = "management-facility-snapshot.json";
const PR_ACTIVITY_SNAPSHOT_FILE_NAME = "pr-activity-snapshot.json";
const PR_CYCLE_SNAPSHOT_FILE_NAME = "pr-cycle-snapshot.json";
const PRODUCT_CYCLE_SNAPSHOT_FILE_NAME = "product-cycle-snapshot.json";
const PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_FILE_NAME = "product-cycle-shipments-snapshot.json";

export const REPO_ROOT_PATH = path.resolve(process.env.REPO_ROOT || process.cwd());
export const DATA_DIR_PATH = path.resolve(
  process.env.REFRESH_DATA_DIR || path.join(REPO_ROOT_PATH, DATA_DIR)
);
export const CACHE_DIR_PATH = path.resolve(
  process.env.REFRESH_CACHE_DIR || path.join(REPO_ROOT_PATH, CACHE_DIR)
);
export const DIST_DIR_PATH = path.resolve(process.env.DIST_DIR || path.join(REPO_ROOT_PATH, DIST_DIR));
export const SNAPSHOT_HISTORY_DIR_PATH = path.resolve(
  process.env.REFRESH_SNAPSHOT_HISTORY_DIR || path.join(REPO_ROOT_PATH, SNAPSHOT_HISTORY_DIR)
);
export const ANALYSIS_DIR_PATH = path.resolve(path.join(REPO_ROOT_PATH, ANALYSIS_DIR));
export const ANALYSIS_REPORT_PATH_ABSOLUTE = path.resolve(path.join(REPO_ROOT_PATH, ANALYSIS_REPORT_PATH));
export const ANALYSIS_HISTORY_DIR_PATH = path.resolve(
  path.join(REPO_ROOT_PATH, ANALYSIS_HISTORY_DIR)
);

function resolveDataFilePath(fileName) {
  return path.join(DATA_DIR_PATH, fileName);
}

function resolveDataFileTmpPath(fileName) {
  return path.join(DATA_DIR_PATH, `${fileName}.tmp`);
}

export const PRIMARY_SNAPSHOT_PATH = resolveDataFilePath(PRIMARY_DASHBOARD_SNAPSHOT_FILE_NAME);
export const PRIMARY_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(
  PRIMARY_DASHBOARD_SNAPSHOT_FILE_NAME
);
export const BACKLOG_SNAPSHOT_PATH = resolveDataFilePath(BACKLOG_SNAPSHOT_FILE_NAME);
export const BACKLOG_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(BACKLOG_SNAPSHOT_FILE_NAME);
export const PR_ACTIVITY_SNAPSHOT_PATH = resolveDataFilePath(PR_ACTIVITY_SNAPSHOT_FILE_NAME);
export const PR_ACTIVITY_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(
  PR_ACTIVITY_SNAPSHOT_FILE_NAME
);
export const MANAGEMENT_FACILITY_SNAPSHOT_PATH = resolveDataFilePath(
  MANAGEMENT_FACILITY_SNAPSHOT_FILE_NAME
);
export const MANAGEMENT_FACILITY_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(
  MANAGEMENT_FACILITY_SNAPSHOT_FILE_NAME
);
export const CONTRIBUTORS_SNAPSHOT_PATH = resolveDataFilePath(CONTRIBUTORS_SNAPSHOT_FILE_NAME);
export const CONTRIBUTORS_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(
  CONTRIBUTORS_SNAPSHOT_FILE_NAME
);
export const PRODUCT_CYCLE_SNAPSHOT_PATH = resolveDataFilePath(PRODUCT_CYCLE_SNAPSHOT_FILE_NAME);
export const PRODUCT_CYCLE_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(
  PRODUCT_CYCLE_SNAPSHOT_FILE_NAME
);
export const PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_PATH = resolveDataFilePath(
  PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_FILE_NAME
);
export const PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(
  PRODUCT_CYCLE_SHIPMENTS_SNAPSHOT_FILE_NAME
);
export const PR_CYCLE_SNAPSHOT_PATH = resolveDataFilePath(PR_CYCLE_SNAPSHOT_FILE_NAME);
export const PR_CYCLE_SNAPSHOT_TMP_PATH = resolveDataFileTmpPath(PR_CYCLE_SNAPSHOT_FILE_NAME);

export const PR_ACTIVITY_ISSUE_CACHE_PATH = path.join(CACHE_DIR_PATH, "pr-activity-issue-cache.json");
export const PR_ACTIVITY_ISSUE_CACHE_TMP_PATH = path.join(
  CACHE_DIR_PATH,
  "pr-activity-issue-cache.json.tmp"
);
export const BUSINESS_UNIT_DONE_CACHE_PATH = path.join(
  CACHE_DIR_PATH,
  "business-unit-uat-done-cache.json"
);
export const BUSINESS_UNIT_DONE_CACHE_TMP_PATH = path.join(
  CACHE_DIR_PATH,
  "business-unit-uat-done-cache.json.tmp"
);
