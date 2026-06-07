#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_LIVE_BASE_URL = "https://yoramtap.github.io/tracker/data";
const DEFAULT_TOTAL_DELTA_THRESHOLD = 0.35;
const DEFAULT_TEAM_DELTA_THRESHOLD = 0.75;
const PR_ACTIVITY_TEAM_KEYS = ["api", "legacy", "react", "bc", "workers", "titanium"];
const SPRINT_WINDOW_DAYS = {
  "14d": 13,
  "30d": 29,
  "90d": 89
};
const MONTHLY_WINDOW_MONTHS = {
  "6m": 6,
  "1y": 12,
  "2y": 24
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    liveBaseUrl: process.env.DASHBOARD_LIVE_DATA_BASE_URL || DEFAULT_LIVE_BASE_URL,
    localDir: process.env.DASHBOARD_LOCAL_DATA_DIR || "data",
    baselineDir: process.env.DASHBOARD_BASELINE_DATA_DIR || "",
    totalDeltaThreshold: Number(
      process.env.PR_ACTIVITY_TOTAL_DELTA_THRESHOLD || DEFAULT_TOTAL_DELTA_THRESHOLD
    ),
    teamDeltaThreshold: Number(
      process.env.PR_ACTIVITY_TEAM_DELTA_THRESHOLD || DEFAULT_TEAM_DELTA_THRESHOLD
    ),
    allowReason: process.env.ALLOW_PR_ACTIVITY_ANOMALY_REASON || ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || "";
    if (arg === "--live-base-url") options.liveBaseUrl = next();
    else if (arg === "--local-dir") options.localDir = next();
    else if (arg === "--baseline-dir") options.baselineDir = next();
    else if (arg === "--total-threshold") options.totalDeltaThreshold = Number(next());
    else if (arg === "--team-threshold") options.teamDeltaThreshold = Number(next());
    else if (arg === "--allow-pr-activity-anomaly") options.allowReason = next();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/check-dashboard-data-quality.mjs [options]

Options:
  --live-base-url <url>              Live data base URL. Default: ${DEFAULT_LIVE_BASE_URL}
  --local-dir <path>                 Local data directory. Default: data
  --baseline-dir <path>              Use local baseline files instead of live URL
  --total-threshold <number>         Total window delta threshold. Default: ${DEFAULT_TOTAL_DELTA_THRESHOLD}
  --team-threshold <number>          Team window delta threshold. Default: ${DEFAULT_TEAM_DELTA_THRESHOLD}
  --allow-pr-activity-anomaly <why>  Allow anomaly failures with an explicit reason
`);
      process.exit(0);
    }
  }
  return options;
}

async function readJsonFromFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonFromUrl(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function readSnapshotPair(options) {
  const localPath = path.join(options.localDir, "pr-activity-snapshot.json");
  const local = await readJsonFromFile(localPath);
  const baseline = options.baselineDir
    ? await readJsonFromFile(path.join(options.baselineDir, "pr-activity-snapshot.json"))
    : await readJsonFromUrl(`${options.liveBaseUrl.replace(/\/$/, "")}/pr-activity-snapshot.json`);
  return { local, baseline };
}

function timestampMs(value) {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

function shiftIsoDate(dateText, days) {
  const date = new Date(`${String(dateText || "")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftIsoMonth(dateText, months) {
  const date = new Date(`${String(dateText || "").slice(0, 7)}-01T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function clampCurrentMonth(points, updatedAt) {
  const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
  const updatedMonth = String(updatedAt || "").slice(0, 7);
  if (!updatedMonth || safePoints.length === 0) return safePoints;
  const currentMonthDate = `${updatedMonth}-01`;
  const latestDate = String(safePoints.at(-1)?.date || "");
  if (latestDate !== currentMonthDate) return safePoints;
  return safePoints.filter((point) => String(point?.date || "") < currentMonthDate);
}

function getWindowedPrActivityPoints(snapshot, windowKey) {
  const prActivity = snapshot?.prActivity || {};
  if (SPRINT_WINDOW_DAYS[windowKey] !== undefined) {
    const points = Array.isArray(prActivity.points) ? prActivity.points.filter(Boolean) : [];
    const latestDate = String(points.at(-1)?.date || "");
    const startDate = shiftIsoDate(latestDate, -SPRINT_WINDOW_DAYS[windowKey]);
    return startDate
      ? points.filter((point) => String(point?.date || "") >= startDate)
      : points;
  }

  const monthlyPoints = clampCurrentMonth(prActivity.monthlyPoints, snapshot?.updatedAt);
  const latestDate = String(monthlyPoints.at(-1)?.date || "");
  const startDate = shiftIsoMonth(latestDate, -MONTHLY_WINDOW_MONTHS[windowKey]);
  return startDate
    ? monthlyPoints.filter((point) => String(point?.date || "") >= startDate)
    : monthlyPoints;
}

function summarizePrActivityWindow(snapshot, windowKey) {
  const points = getWindowedPrActivityPoints(snapshot, windowKey);
  const teams = {};
  for (const team of PR_ACTIVITY_TEAM_KEYS) {
    teams[team] = points.reduce(
      (sum, point) => sum + Math.max(0, Number(point?.[team]?.offered) || 0),
      0
    );
  }
  const total = Object.values(teams).reduce((sum, value) => sum + value, 0);
  return {
    bucketCount: points.length,
    firstDate: String(points[0]?.date || ""),
    lastDate: String(points.at(-1)?.date || ""),
    teams,
    total
  };
}

function percentDelta(localValue, baselineValue) {
  const left = Number(localValue) || 0;
  const right = Number(baselineValue) || 0;
  if (right === 0) return left === 0 ? 0 : Infinity;
  return (left - right) / right;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "infinite";
  return `${Math.round(value * 100)}%`;
}

function buildPrActivityQualityReport(local, baseline, options = {}) {
  const findings = [];
  const localUpdatedAt = String(local?.updatedAt || "");
  const baselineUpdatedAt = String(baseline?.updatedAt || "");
  if (timestampMs(baselineUpdatedAt) > timestampMs(localUpdatedAt)) {
    findings.push({
      severity: "error",
      type: "live-newer-than-local",
      message: `Live PR activity snapshot is newer than local: local ${localUpdatedAt || "unknown"}, live ${baselineUpdatedAt || "unknown"}.`
    });
  }

  const windows = ["14d", "30d", "90d", "6m", "1y", "2y"];
  const windowReports = {};
  for (const windowKey of windows) {
    const localSummary = summarizePrActivityWindow(local, windowKey);
    const baselineSummary = summarizePrActivityWindow(baseline, windowKey);
    const totalDelta = percentDelta(localSummary.total, baselineSummary.total);
    windowReports[windowKey] = { local: localSummary, baseline: baselineSummary, totalDelta };
    if (Math.abs(totalDelta) > options.totalDeltaThreshold) {
      findings.push({
        severity: "error",
        type: "window-total-delta",
        windowKey,
        message: `${windowKey} total PRs opened changed from ${baselineSummary.total} to ${localSummary.total} (${formatPercent(totalDelta)}).`
      });
    }
    for (const team of PR_ACTIVITY_TEAM_KEYS) {
      const teamDelta = percentDelta(localSummary.teams[team], baselineSummary.teams[team]);
      if (Math.abs(teamDelta) > options.teamDeltaThreshold) {
        findings.push({
          severity: "error",
          type: "window-team-delta",
          windowKey,
          team,
          message: `${windowKey} ${team} PRs opened changed from ${baselineSummary.teams[team]} to ${localSummary.teams[team]} (${formatPercent(teamDelta)}).`
        });
      }
    }
  }

  return {
    localUpdatedAt,
    baselineUpdatedAt,
    findings,
    windowReports
  };
}

function printReport(report, options = {}) {
  if (report.findings.length === 0) {
    console.log("Dashboard data quality preflight passed.");
    console.log(`- local PR activity updatedAt: ${report.localUpdatedAt}`);
    console.log(`- baseline PR activity updatedAt: ${report.baselineUpdatedAt}`);
    return;
  }

  const allowReason = String(options.allowReason || "").trim();
  const prefix = allowReason ? "Dashboard data quality anomalies allowed" : "Dashboard data quality preflight failed";
  console.error(`${prefix}:`);
  for (const finding of report.findings) {
    console.error(`- ${finding.message}`);
  }
  if (allowReason) {
    console.error(`Override reason: ${allowReason}`);
  }
}

export {
  buildPrActivityQualityReport,
  getWindowedPrActivityPoints,
  summarizePrActivityWindow
};

async function main() {
  const options = parseArgs();
  const { local, baseline } = await readSnapshotPair(options);
  const report = buildPrActivityQualityReport(local, baseline, options);
  printReport(report, options);
  if (report.findings.length > 0 && !String(options.allowReason || "").trim()) {
    process.exit(1);
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
