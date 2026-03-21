#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const FALLBACK_DATES = [
  "2025-06-23",
  "2025-07-07",
  "2025-08-04",
  "2025-08-18",
  "2025-09-01",
  "2025-09-15",
  "2025-09-30",
  "2025-10-13",
  "2025-10-27",
  "2025-11-10",
  "2025-11-24",
  "2025-12-08",
  "2026-01-19",
  "2026-02-02"
];

const BOARDS = [
  {
    constName: "BOARD_38_TREND",
    baseJql: "project = TFC AND type = Bug AND labels = API",
    doneStatuses: '(Done, "Won\'t Fix", Duplicate)'
  },
  {
    constName: "BOARD_39_TREND",
    baseJql: "project = TFC AND type = Bug AND labels = Frontend",
    doneStatuses: '(Done, "Won\'t Fix")'
  },
  {
    constName: "BOARD_46_TREND",
    baseJql: "project = TFC AND type = Bug AND labels = NewFrontend",
    doneStatuses: '(Done, "Won\'t Fix")'
  },
  {
    constName: "BOARD_40_TREND",
    baseJql: "project = TFC AND type = Bug AND labels = Broadcast",
    doneStatuses: '(Done, "Won\'t Fix")',
    includeLongstandingCounts: true
  },
  {
    constName: "BOARD_333_TREND",
    baseJql: "project = TFO AND type = Bug AND labels = Workers",
    doneStatuses: '(Done, "Won\'t Fix")'
  },
  {
    constName: "BOARD_399_TREND",
    baseJql: 'project = MESO AND type = Bug AND labels = "READY"',
    doneStatuses: "(Done)"
  }
];

const PAGE_SIZE = 100;
const MAX_RETRIES = 5;
const JIRA_REQUEST_TIMEOUT_MS = 30000;
const PR_DETAIL_CONCURRENCY = 12;
const UAT_CHANGELOG_CONCURRENCY = 6;
const PR_CYCLE_CHANGELOG_CONCURRENCY = 6;
const SNAPSHOT_PATH = path.resolve(process.cwd(), "snapshot.json");
const SNAPSHOT_TMP_PATH = path.resolve(process.cwd(), "snapshot.json.tmp");
const BACKLOG_SNAPSHOT_PATH = path.resolve(process.cwd(), "backlog-snapshot.json");
const BACKLOG_SNAPSHOT_TMP_PATH = path.resolve(process.cwd(), "backlog-snapshot.json.tmp");
const PR_CYCLE_SNAPSHOT_PATH = path.resolve(process.cwd(), "pr-cycle-snapshot.json");
const PR_CYCLE_SNAPSHOT_TMP_PATH = path.resolve(process.cwd(), "pr-cycle-snapshot.json.tmp");
const SNAPSHOTS_DIR_PATH = path.resolve(process.cwd(), "snapshots");
const SNAPSHOT_SCHEMA_VERSION = 3;
const DEFAULT_SNAPSHOT_RETENTION_COUNT = 26;
const ALLOW_EMPTY = process.argv.includes("--allow-empty");
const PRIORITY_ORDER = ["highest", "high", "medium", "low", "lowest"];
const PR_SUMMARY_FIELD = "customfield_10000";
const PR_ACTIVITY_MAX_WINDOW_KEY = "1y";
const PR_REVIEW_STATUS = "In Review";
const PR_ACTIVITY_PROJECT_KEYS = ["TFC", "TFO", "MESO"];
const TEAM_KEYS = ["api", "legacy", "react", "bc", "workers", "titanium"];
const PR_TEAM_LABELS = {
  API: "api",
  Frontend: "legacy",
  NewFrontend: "react",
  Broadcast: "bc",
  Workers: "workers",
  workers: "workers",
  Media: "titanium",
  media: "titanium",
  Titanium: "titanium",
  titanium: "titanium"
};
const PR_TEAM_LABELS_NORMALIZED = Object.fromEntries(
  Object.entries(PR_TEAM_LABELS).map(([label, teamKey]) => [label.toLowerCase(), teamKey])
);
const UAT_BUCKETS = [
  { id: "d0_7", label: "0-7 days", minDays: 0, maxDays: 7 },
  { id: "d8_14", label: "8-14 days", minDays: 8, maxDays: 14 },
  { id: "d15_30", label: "15-30 days", minDays: 15, maxDays: 30 },
  { id: "d31_60", label: "31-60 days", minDays: 31, maxDays: 60 },
  { id: "d61_plus", label: "61+ days", minDays: 61, maxDays: null }
];
const DEFAULT_SPRINT_PROJECT = "TFC";
const DEFAULT_SPRINT_LOOKBACK_COUNT = 14;
const DEFAULT_SPRINT_POINT = "end";
const DEFAULT_SPRINT_MONDAY_ANCHOR = true;
const PR_CYCLE_WINDOW_DEFAULT_KEY = "90d";
const PR_CYCLE_TEAM_KEYS = ["api", "legacy", "react", "bc", "workers", "titanium"];
const PR_CYCLE_TEAM_LABELS = {
  api: "API",
  legacy: "Legacy FE",
  react: "React FE",
  bc: "BC",
  workers: "Workers",
  titanium: "Titanium"
};
const PR_CYCLE_TEAM_STATUS_OVERRIDES = {
  api: {
    merge: ["QA / Lab Testing", "QA"]
  },
  legacy: {
    merge: ["QA / Lab Testing", "QA"]
  },
  react: {
    merge: ["QA / Lab Testing", "QA"]
  },
  bc: {
    merge: ["QA / Lab Testing", "QA"]
  },
  workers: {
    review: ["In Review", "Review"]
  },
  titanium: {
    review: ["In Review", "Review"],
    merge: ["QA / Lab Testing", "QA"]
  }
};

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name, fallback ? "true" : "false").toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

function envPositiveInt(name, fallback) {
  const parsed = Number.parseInt(env(name, String(fallback)), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function isPlaceholderCredential(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("<jira_api_token>")) return true;
  if (normalized.includes("you@company.com")) return true;
  if (normalized.includes("your-real-email")) return true;
  if (normalized.includes("your-real-api-token")) return true;
  if (normalized.startsWith("<") && normalized.endsWith(">")) return true;
  return false;
}

function isPlaceholderSite(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("your-real-site")) return true;
  if (normalized.includes("example.atlassian.net")) return true;
  return false;
}

async function loadLocalEnv() {
  const candidateSet = new Set([
    path.resolve(process.cwd(), ".env.backlog"),
    path.resolve(process.cwd(), ".env.local")
  ]);

  try {
    const gitFile = await fs.readFile(path.resolve(process.cwd(), ".git"), "utf8");
    const gitDirLine = gitFile.trim();
    if (gitDirLine.startsWith("gitdir:")) {
      const gitDirPath = gitDirLine.slice("gitdir:".length).trim();
      const worktreesMarker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
      const markerIndex = gitDirPath.indexOf(worktreesMarker);
      if (markerIndex !== -1) {
        const inferredRepoRoot = gitDirPath.slice(0, markerIndex);
        candidateSet.add(path.join(inferredRepoRoot, ".env.backlog"));
        candidateSet.add(path.join(inferredRepoRoot, ".env.local"));
      }
    }
  } catch {
    // Ignore missing or unreadable .git metadata.
  }

  const candidates = [...candidateSet];

  for (const filePath of candidates) {
    let raw = "";
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function asOfDateTime(date) {
  return `${date} 23:59`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JIRA_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function jiraSearch(site, email, token, jql, nextPageToken = "", maxResults = PAGE_SIZE) {
  const url = `https://${site}/rest/api/3/search/jql`;
  return jiraRequest(site, email, token, url, {
    method: "POST",
    body: JSON.stringify({
      jql,
      maxResults,
      ...(nextPageToken ? { nextPageToken } : {}),
      fields: ["priority"]
    })
  });
}

async function jiraAgileRequest(site, email, token, endpoint) {
  const url = `https://${site}${endpoint}`;
  return jiraRequest(site, email, token, url);
}

async function jiraRequest(site, email, token, url, options = {}) {
  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(url, {
        method: options.method || "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {})
        },
        ...(options.body ? { body: options.body } : {})
      });
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === MAX_RETRIES - 1) {
        const body = await response.text();
        throw new Error(`Jira request failed (${response.status}): ${body}`);
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 600 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    const body = await response.text();
    throw new Error(`Jira request failed (${response.status}): ${body}`);
  }

  throw new Error("Jira request failed after retries.");
}

function emptyCounts() {
  return { highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
}

function shiftIsoDate(dateText, deltaDays) {
  const date = new Date(`${String(dateText || "")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function shiftIsoMonths(dateText, deltaMonths) {
  const date = new Date(`${String(dateText || "")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  return date.toISOString().slice(0, 10);
}

function resolvePrActivitySinceDate(todayIso) {
  const safeToday = String(todayIso || "").trim();
  if (!safeToday) return "";
  switch (PR_ACTIVITY_MAX_WINDOW_KEY) {
    case "90d":
      return shiftIsoDate(safeToday, -89);
    case "6m":
      return shiftIsoMonths(safeToday, -6);
    case "1y":
    default:
      return shiftIsoMonths(safeToday, -12);
  }
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function countPriority(counts, priorityName) {
  const priorityKey = normalizePriority(priorityName);
  if (priorityKey) counts[priorityKey] += 1;
}

function emptyPrAccumulator() {
  return {
    offered: 0,
    merged: 0,
    reviewToMergeDaysTotal: 0,
    avgReviewToMergeSampleCount: 0
  };
}

function buildPrPointForTeam(byDate, date, team) {
  const teamPoint = byDate.get(date)?.[team] ?? emptyPrAccumulator();
  const sampleCount = numberOrZero(teamPoint.avgReviewToMergeSampleCount);
  return {
    offered: numberOrZero(teamPoint.offered),
    merged: numberOrZero(teamPoint.merged),
    avgReviewToMergeDays:
      sampleCount > 0
        ? Math.round(numberOrZero(teamPoint.reviewToMergeDaysTotal) / Math.max(sampleCount, 1))
        : 0,
    avgReviewToMergeSampleCount: sampleCount
  };
}

function normalizePriority(priorityName) {
  const normalized = String(priorityName || "")
    .trim()
    .toLowerCase();
  if (PRIORITY_ORDER.includes(normalized)) return normalized;
  return "";
}

function emptyUatPriorityBuckets() {
  return UAT_BUCKETS.reduce((acc, bucket) => {
    acc[bucket.id] = 0;
    return acc;
  }, {});
}

function bucketIdForAgeDays(days) {
  for (const bucket of UAT_BUCKETS) {
    if (days < bucket.minDays) continue;
    if (bucket.maxDays === null || days <= bucket.maxDays) return bucket.id;
  }
  return UAT_BUCKETS[UAT_BUCKETS.length - 1].id;
}

function daysSince(isoDate) {
  const atMs = new Date(isoDate).getTime();
  if (!Number.isFinite(atMs)) return 0;
  const nowMs = Date.now();
  const diffMs = Math.max(0, nowMs - atMs);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function findLastEnteredStatus(changelog, statusName) {
  const target = String(statusName || "")
    .trim()
    .toLowerCase();
  let latest = "";

  for (const history of changelog?.histories ?? []) {
    const createdAt = history?.created || "";
    for (const item of history?.items ?? []) {
      if (String(item?.field || "").toLowerCase() !== "status") continue;
      if (
        String(item?.toString || "")
          .trim()
          .toLowerCase() !== target
      )
        continue;
      if (!latest || new Date(createdAt).getTime() > new Date(latest).getTime()) {
        latest = createdAt;
      }
    }
  }

  return latest;
}

function findFirstEnteredStatus(changelog, statusName) {
  const target = String(statusName || "")
    .trim()
    .toLowerCase();
  let earliest = "";

  for (const history of changelog?.histories ?? []) {
    const createdAt = history?.created || "";
    for (const item of history?.items ?? []) {
      if (String(item?.field || "").toLowerCase() !== "status") continue;
      if (
        String(item?.toString || "")
          .trim()
          .toLowerCase() !== target
      )
        continue;
      if (!earliest || new Date(createdAt).getTime() < new Date(earliest).getTime()) {
        earliest = createdAt;
      }
    }
  }

  return earliest;
}

function quoteJqlValue(value) {
  const escaped = String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function isoDateOnly(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const atMs = new Date(text).getTime();
  if (!Number.isFinite(atMs)) return "";
  return new Date(atMs).toISOString().slice(0, 10);
}

function isoDateTime(value) {
  const atMs = new Date(String(value || "")).getTime();
  if (!Number.isFinite(atMs)) return "";
  return new Date(atMs).toISOString();
}

function toUtcIsoDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function earliestIsoDate(values) {
  let earliestMs = Number.POSITIVE_INFINITY;

  for (const value of values ?? []) {
    const atMs = new Date(value).getTime();
    if (!Number.isFinite(atMs)) continue;
    if (atMs < earliestMs) earliestMs = atMs;
  }

  if (!Number.isFinite(earliestMs)) return "";
  return new Date(earliestMs).toISOString().slice(0, 10);
}

function latestIsoDate(values) {
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const value of values ?? []) {
    const atMs = new Date(value).getTime();
    if (!Number.isFinite(atMs)) continue;
    if (atMs > latestMs) latestMs = atMs;
  }

  if (!Number.isFinite(latestMs)) return "";
  return new Date(latestMs).toISOString().slice(0, 10);
}

function daysBetweenIsoDates(startIsoDate, endIsoDate) {
  const startMs = new Date(`${String(startIsoDate || "")}T00:00:00Z`).getTime();
  const endMs = new Date(`${String(endIsoDate || "")}T00:00:00Z`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return -1;
  return Math.round((endMs - startMs) / 86400000);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function toMondayAnchor(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const asUtc = new Date(Date.UTC(year, monthIndex, day));
  const dow = asUtc.getUTCDay(); // 0=Sun .. 6=Sat
  const delta = dow === 1 ? 0 : (8 - dow) % 7; // next Monday, or same day if Monday
  return toUtcIsoDate(year, monthIndex, day + delta);
}

async function fetchScrumBoards(site, email, token, projectKey) {
  const boards = [];
  let startAt = 0;

  for (;;) {
    const payload = await jiraAgileRequest(
      site,
      email,
      token,
      `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&type=scrum&startAt=${startAt}&maxResults=${PAGE_SIZE}`
    );
    const values = payload?.values ?? [];
    boards.push(...values);

    if (values.length === 0) break;
    const isLast = Boolean(payload?.isLast);
    if (isLast) break;
    startAt += values.length;
  }

  return boards;
}

async function fetchSprintsForBoard(site, email, token, boardId) {
  const sprints = [];
  let startAt = 0;

  for (;;) {
    const payload = await jiraAgileRequest(
      site,
      email,
      token,
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active,closed&startAt=${startAt}&maxResults=${PAGE_SIZE}`
    );
    const values = payload?.values ?? [];
    sprints.push(...values);

    if (values.length === 0) break;
    const isLast = Boolean(payload?.isLast);
    if (isLast) break;
    startAt += values.length;
  }

  return sprints;
}

function buildTrendDatesFromSprints(
  sprints,
  { lookbackCount, pointMode, includeActive, mondayAnchor, sinceDate = "" }
) {
  const dates = [];

  for (const sprint of sprints) {
    const state = String(sprint?.state || "").toLowerCase();
    const isClosed = state === "closed";
    const isActive = state === "active";
    if (!isClosed && !(includeActive && isActive)) continue;

    const pickedDate =
      pointMode === "start"
        ? isoDateOnly(sprint?.startDate)
        : isoDateOnly(sprint?.endDate || sprint?.completeDate || sprint?.startDate);
    if (!pickedDate) continue;
    const normalizedDate = mondayAnchor ? toMondayAnchor(pickedDate) : pickedDate;
    if (!normalizedDate) continue;
    if (sinceDate && normalizedDate < sinceDate) continue;
    dates.push(normalizedDate);
  }

  const uniqueSorted = Array.from(new Set(dates)).sort();
  if (!Number.isFinite(lookbackCount) || lookbackCount <= 0) return uniqueSorted;
  if (uniqueSorted.length <= lookbackCount) return uniqueSorted;
  return uniqueSorted.slice(-lookbackCount);
}

async function resolveTrendDates(site, email, token, options) {
  const {
    fallbackDates,
    projectKey,
    boardId,
    lookbackCount,
    pointMode,
    includeActive,
    mondayAnchor,
    sinceDate = ""
  } = options;

  try {
    const boardIds = [];
    if (boardId) {
      boardIds.push(boardId);
    } else {
      const boards = await fetchScrumBoards(site, email, token, projectKey);
      for (const board of boards) {
        if (board?.id !== undefined && board?.id !== null) {
          boardIds.push(String(board.id));
        }
      }
    }

    if (boardIds.length === 0) {
      throw new Error(`No scrum boards found for project ${projectKey}.`);
    }

    const sprintById = new Map();
    for (const id of boardIds) {
      const sprints = await fetchSprintsForBoard(site, email, token, id);
      for (const sprint of sprints) {
        if (sprint?.id === undefined || sprint?.id === null) continue;
        sprintById.set(String(sprint.id), sprint);
      }
    }

    const dates = buildTrendDatesFromSprints(Array.from(sprintById.values()), {
      lookbackCount,
      pointMode,
      includeActive,
      mondayAnchor,
      sinceDate
    });

    if (dates.length === 0) {
      throw new Error("No sprint dates resolved from Jira Agile API.");
    }

    return {
      dates,
      usedFallback: false
    };
  } catch (error) {
    const filteredFallbackDates = (Array.isArray(fallbackDates) ? fallbackDates : []).filter(
      (date) => !sinceDate || String(date || "") >= sinceDate
    );
    return {
      dates: filteredFallbackDates,
      usedFallback: true,
      fallbackReason: error?.message || String(error)
    };
  }
}

async function fetchIssueChangelog(site, email, token, issueKey) {
  const histories = [];
  let startAt = 0;

  for (;;) {
    const payload = await jiraRequest(
      site,
      email,
      token,
      `https://${site}/rest/api/3/issue/${encodeURIComponent(issueKey)}/changelog?startAt=${startAt}&maxResults=${PAGE_SIZE}`
    );

    const page = payload?.values ?? payload?.histories ?? [];
    histories.push(...page);
    if (page.length === 0) break;

    const total = Number(payload?.total || 0);
    startAt += page.length;
    if (total > 0 && startAt >= total) break;
    if (page.length < PAGE_SIZE) break;
  }

  return { histories };
}

async function searchJiraIssues(site, email, token, jql, fields) {
  const issues = [];
  let nextPageToken = "";

  for (;;) {
    const payload = await jiraRequest(site, email, token, `https://${site}/rest/api/3/search/jql`, {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults: PAGE_SIZE,
        ...(nextPageToken ? { nextPageToken } : {}),
        fields
      })
    });
    const pageIssues = payload?.issues ?? [];
    issues.push(...pageIssues);
    if (pageIssues.length === 0 || !payload?.nextPageToken) break;
    nextPageToken = payload.nextPageToken;
  }

  return issues;
}

function normalizeStatusName(statusName) {
  return String(statusName || "")
    .trim()
    .toLowerCase();
}

function buildPrCycleWindowConfigs(todayIso) {
  const safeToday = String(todayIso || "").trim();
  return [
    {
      key: "90d",
      windowDays: 90,
      windowLabel: "Last 90 days",
      windowStartDate: shiftIsoDate(safeToday, -89)
    },
    {
      key: "6m",
      windowDays: 183,
      windowLabel: "Last 6 months",
      windowStartDate: shiftIsoMonths(safeToday, -6)
    },
    {
      key: "1y",
      windowDays: 365,
      windowLabel: "Last year",
      windowStartDate: shiftIsoMonths(safeToday, -12)
    }
  ].map((windowConfig) => ({
    ...windowConfig,
    windowStartIso: `${windowConfig.windowStartDate}T00:00:00.000Z`,
    windowEndIso: new Date().toISOString()
  }));
}

function normalizeStringList(values) {
  const rawValues = Array.isArray(values) ? values : [values];
  return [...new Set(rawValues.map((value) => String(value || "").trim()).filter(Boolean))];
}

function buildPrCyclePhaseDefinitions(config, teamKey = "") {
  const teamOverrides = PR_CYCLE_TEAM_STATUS_OVERRIDES[teamKey] || {};
  const codingStatuses = normalizeStringList(teamOverrides.coding ?? config.codingStatuses);
  const reviewStatuses = normalizeStringList(teamOverrides.review ?? config.reviewStatuses);
  const mergeStatuses = normalizeStringList(teamOverrides.merge ?? config.mergeStatuses);
  return [
    {
      key: "coding",
      label: "In Progress",
      status: codingStatuses[0] || "",
      statuses: codingStatuses,
      tone: "amber"
    },
    {
      key: "review",
      label: "In Review",
      status: reviewStatuses[0] || "",
      statuses: reviewStatuses,
      tone: "amber"
    },
    {
      key: "merge",
      label: "QA",
      status: mergeStatuses[0] || "",
      statuses: mergeStatuses,
      tone: "stone"
    }
  ];
}

function getPrCycleTrackedStatuses(config) {
  return normalizeStringList([
    ...buildPrCyclePhaseDefinitions(config).flatMap((phase) => phase.statuses || []),
    ...PR_CYCLE_TEAM_KEYS.flatMap((teamKey) =>
      buildPrCyclePhaseDefinitions(config, teamKey).flatMap((phase) => phase.statuses || [])
    )
  ]);
}

function buildIssueStatusIntervals(issue, changelog, endAtIso) {
  const createdAt = isoDateTime(issue?.fields?.created);
  const endAt = isoDateTime(endAtIso);
  if (!createdAt || !endAt) return [];

  const transitions = [];
  for (const history of changelog?.histories ?? []) {
    const created = isoDateTime(history?.created);
    if (!created) continue;
    for (const item of history?.items ?? []) {
      if (normalizeStatusName(item?.field) !== "status") continue;
      transitions.push({
        at: created,
        from: String(item?.fromString || "").trim(),
        to: String(item?.toString || "").trim()
      });
    }
  }

  transitions.sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());

  let currentStatus = String(transitions[0]?.from || issue?.fields?.status?.name || "").trim();
  let currentStart = createdAt;
  const intervals = [];

  for (const transition of transitions) {
    const transitionAt = isoDateTime(transition.at);
    if (!transitionAt) continue;
    if (new Date(transitionAt).getTime() < new Date(currentStart).getTime()) continue;

    intervals.push({
      status: currentStatus,
      start: currentStart,
      end: transitionAt
    });
    currentStatus = String(transition.to || currentStatus).trim();
    currentStart = transitionAt;
  }

  intervals.push({
    status: currentStatus,
    start: currentStart,
    end: endAt
  });

  return intervals;
}

function overlapDurationDays(startIso, endIso, windowStartIso, windowEndIso) {
  const startMs = new Date(String(startIso || "")).getTime();
  const endMs = new Date(String(endIso || "")).getTime();
  const windowStartMs = new Date(String(windowStartIso || "")).getTime();
  const windowEndMs = new Date(String(windowEndIso || "")).getTime();
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    !Number.isFinite(windowStartMs) ||
    !Number.isFinite(windowEndMs)
  ) {
    return 0;
  }
  const overlapStart = Math.max(startMs, windowStartMs);
  const overlapEnd = Math.min(endMs, windowEndMs);
  if (overlapEnd <= overlapStart) return 0;
  return (overlapEnd - overlapStart) / 86400000;
}

function summarizePrCycleIssueBase(issue, changelog, config) {
  const team = teamKeyFromLabels(issue?.fields?.labels ?? []);
  if (!PR_CYCLE_TEAM_KEYS.includes(team)) return null;
  const intervals = buildIssueStatusIntervals(issue, changelog, config.windowEndIso);
  if (intervals.length === 0) return null;

  return {
    issueKey: String(issue?.key || "").trim(),
    team,
    intervals
  };
}

async function fetchPrCycleIssueBreakdown(site, email, token, config) {
  const projectClause = config.projectKeys
    .map((projectKey) => quoteJqlValue(projectKey))
    .join(", ");
  const labelClause = Object.keys(PR_TEAM_LABELS)
    .map((label) => quoteJqlValue(label))
    .join(", ");
  const trackedStatuses = getPrCycleTrackedStatuses(config)
    .map((status) => quoteJqlValue(status))
    .join(", ");
  const jql = [
    `project in (${projectClause})`,
    `AND labels in (${labelClause})`,
    `AND (updated >= ${quoteJqlValue(config.windowStartDate)} OR status in (${trackedStatuses}))`
  ].join(" ");

  const issues = await searchJiraIssues(site, email, token, jql, ["labels", "status", "created"]);
  console.log(`Fetched ${issues.length} PR cycle candidate issues for ${config.windowLabel}.`);
  const rows = await mapWithConcurrency(issues, PR_CYCLE_CHANGELOG_CONCURRENCY, async (issue) => {
    const issueKey = String(issue?.key || "").trim();
    if (!issueKey) return null;
    const changelog = await fetchIssueChangelog(site, email, token, issueKey);
    return summarizePrCycleIssueBase(issue, changelog, config);
  });

  return rows.filter(Boolean);
}

function summarizePrCycleIssueForWindow(baseRow, config) {
  const phaseDefinitions = buildPrCyclePhaseDefinitions(config, baseRow.team);
  const stageDays = Object.fromEntries(phaseDefinitions.map((phase) => [phase.key, 0]));

  for (const interval of baseRow.intervals ?? []) {
    const normalizedStatus = normalizeStatusName(interval.status);
    const phase = phaseDefinitions.find((candidate) =>
      (candidate.statuses || []).some((status) => normalizeStatusName(status) === normalizedStatus)
    );
    if (!phase) continue;
    stageDays[phase.key] += overlapDurationDays(
      interval.start,
      interval.end,
      config.windowStartIso,
      config.windowEndIso
    );
  }

  const totalTrackedDays = Object.values(stageDays).reduce(
    (sum, value) => sum + numberOrZero(value),
    0
  );
  if (totalTrackedDays <= 0) return null;

  return {
    issueKey: baseRow.issueKey,
    team: baseRow.team,
    stageDays
  };
}

function buildPrCycleWindowSnapshot(rows, config) {
  const summarizedRows = rows
    .map((row) => summarizePrCycleIssueForWindow(row, config))
    .filter(Boolean);
  const teams = PR_CYCLE_TEAM_KEYS.map((teamKey) => {
    const phaseDefinitions = buildPrCyclePhaseDefinitions(config, teamKey);
    const teamRows = summarizedRows.filter((row) => row.team === teamKey);
    const stages = phaseDefinitions.map((phase) => {
      const phaseRows = teamRows.filter((row) => numberOrZero(row.stageDays?.[phase.key]) > 0);
      const daysTotal = phaseRows.reduce(
        (sum, row) => sum + numberOrZero(row.stageDays?.[phase.key]),
        0
      );
      const avgDays = phaseRows.length > 0 ? Number((daysTotal / phaseRows.length).toFixed(1)) : 0;
      return {
        key: phase.key,
        label: phase.label,
        status: phase.status,
        statuses: phase.statuses,
        days: avgDays,
        tone: phase.tone,
        sampleCount: phaseRows.length
      };
    });
    const totalCycleDays = Number(
      stages.reduce((sum, stage) => sum + numberOrZero(stage.days), 0).toFixed(1)
    );
    const bottleneckStage =
      stages.slice().sort((left, right) => numberOrZero(right.days) - numberOrZero(left.days))[0] ||
      null;
    return {
      key: teamKey,
      label: PR_CYCLE_TEAM_LABELS[teamKey] || teamKey,
      issueCount: teamRows.length,
      totalCycleDays,
      bottleneckLabel: bottleneckStage?.label || "",
      stages
    };
  });

  return {
    windowKey: config.key,
    windowDays: config.windowDays,
    windowLabel: config.windowLabel,
    teams
  };
}

function buildPrCycleSnapshot(rows, config) {
  const windowSnapshots = Object.fromEntries(
    (Array.isArray(config.windows) ? config.windows : []).map((windowConfig) => [
      windowConfig.key,
      buildPrCycleWindowSnapshot(rows, {
        ...config,
        ...windowConfig
      })
    ])
  );
  const defaultWindow = String(config.defaultWindow || PR_CYCLE_WINDOW_DEFAULT_KEY)
    .trim()
    .toLowerCase();
  const fallbackWindow = windowSnapshots[defaultWindow] ||
    windowSnapshots[PR_CYCLE_WINDOW_DEFAULT_KEY] ||
    Object.values(windowSnapshots)[0] || { windowDays: 0, windowLabel: "", teams: [] };
  const defaultTeam = fallbackWindow.teams.some((team) => team.key === "bc")
    ? "bc"
    : String(fallbackWindow.teams[0]?.key || "");

  return {
    updatedAt: new Date().toISOString(),
    defaultWindow: fallbackWindow.windowKey || defaultWindow,
    windowDays: fallbackWindow.windowDays,
    windowLabel: fallbackWindow.windowLabel,
    defaultTeam,
    source: {
      type: "jira_status_history",
      projectKeys: config.projectKeys,
      statuses: {
        coding: config.codingStatuses,
        review: config.reviewStatuses,
        merge: config.mergeStatuses
      },
      teamOverrides: PR_CYCLE_TEAM_STATUS_OVERRIDES
    },
    teams: fallbackWindow.teams,
    windows: windowSnapshots
  };
}

function teamKeyFromLabels(labels) {
  for (const label of labels ?? []) {
    const normalized = String(label || "")
      .trim()
      .toLowerCase();
    if (PR_TEAM_LABELS_NORMALIZED[normalized]) return PR_TEAM_LABELS_NORMALIZED[normalized];
  }
  return "";
}

function hasPullRequestSummary(rawValue) {
  const raw = String(rawValue || "").trim();
  return raw.includes("pullrequest={");
}

async function fetchIssuePullRequestDetails(site, email, token, issueId) {
  const payload = await jiraRequest(
    site,
    email,
    token,
    `https://${site}/rest/dev-status/latest/issue/detail?issueId=${encodeURIComponent(issueId)}&applicationType=GitHub&dataType=pullrequest`
  );
  return Array.isArray(payload?.detail) ? payload.detail : [];
}

function pullRequestUniqueKey(pullRequest) {
  const repositoryId = String(pullRequest?.repositoryId || "").trim();
  const id = String(pullRequest?.id || "").trim();
  const url = String(pullRequest?.url || "").trim();
  if (repositoryId && id) return `${repositoryId}:${id}`;
  return url;
}

function resolvePullRequestOfferProxyDate(pullRequest, branches) {
  const sourceBranch = String(pullRequest?.source?.branch || "").trim();
  const matchingBranch = Array.isArray(branches)
    ? branches.find((branch) => String(branch?.name || "").trim() === sourceBranch)
    : null;

  return earliestIsoDate([pullRequest?.lastUpdate, matchingBranch?.lastCommit?.authorTimestamp]);
}

function resolvePullRequestMergedProxyDate(pullRequest) {
  return isoDateOnly(pullRequest?.lastUpdate);
}

function resolveIssueMergedProxyDate(details) {
  const mergedDates = [];

  for (const detail of details ?? []) {
    for (const pullRequest of detail?.pullRequests ?? []) {
      const status = String(pullRequest?.status || "")
        .trim()
        .toUpperCase();
      if (status !== "MERGED") continue;
      const mergedProxyDate = resolvePullRequestMergedProxyDate(pullRequest);
      if (mergedProxyDate) mergedDates.push(mergedProxyDate);
    }
  }

  return latestIsoDate(mergedDates);
}

function normalizePullRequestRecords(issue, details) {
  const team = teamKeyFromLabels(issue?.fields?.labels ?? []);
  if (!team) return [];

  const records = [];

  for (const detail of details ?? []) {
    const branches = Array.isArray(detail?.branches) ? detail.branches : [];
    const pullRequests = Array.isArray(detail?.pullRequests) ? detail.pullRequests : [];

    for (const pullRequest of pullRequests) {
      const uniqueKey = pullRequestUniqueKey(pullRequest);
      const offeredProxyDate = resolvePullRequestOfferProxyDate(pullRequest, branches);
      const status = String(pullRequest?.status || "")
        .trim()
        .toUpperCase();
      const mergedProxyDate =
        status === "MERGED" ? resolvePullRequestMergedProxyDate(pullRequest) : "";
      if (!uniqueKey || !offeredProxyDate) continue;

      records.push({
        uniqueKey,
        team,
        offeredProxyDate,
        mergedProxyDate,
        status,
        url: String(pullRequest?.url || "").trim(),
        repositoryId: String(pullRequest?.repositoryId || "").trim(),
        pullRequestId: String(pullRequest?.id || "").trim(),
        issueKey: String(issue?.key || "").trim()
      });
    }
  }

  return records;
}

function normalizeTicketReviewToMergeRecord(issue, details, changelog) {
  const team = teamKeyFromLabels(issue?.fields?.labels ?? []);
  if (!team) return null;

  const reviewStartedAt = isoDateOnly(findFirstEnteredStatus(changelog, PR_REVIEW_STATUS));
  const mergedProxyDate = resolveIssueMergedProxyDate(details);
  if (!reviewStartedAt || !mergedProxyDate) return null;

  const reviewToMergeDays = daysBetweenIsoDates(reviewStartedAt, mergedProxyDate);
  if (reviewToMergeDays < 0) return null;

  return {
    issueKey: String(issue?.key || "").trim(),
    team,
    reviewStartedAt,
    mergedProxyDate,
    reviewToMergeDays
  };
}

async function fetchPrActivity(site, email, token, sinceDate) {
  const labelClause = Object.keys(PR_TEAM_LABELS)
    .map((label) => quoteJqlValue(label))
    .join(", ");
  const projectClause = PR_ACTIVITY_PROJECT_KEYS.map((projectKey) =>
    quoteJqlValue(projectKey)
  ).join(", ");
  const jql = [
    `project in (${projectClause})`,
    `AND updated >= ${quoteJqlValue(sinceDate)}`,
    `AND labels in (${labelClause})`
  ].join(" ");

  const issues = await searchJiraIssues(site, email, token, jql, [
    "labels",
    "status",
    "created",
    PR_SUMMARY_FIELD
  ]);

  const candidateIssues = issues.filter(
    (issue) =>
      teamKeyFromLabels(issue?.fields?.labels ?? []) &&
      hasPullRequestSummary(issue?.fields?.[PR_SUMMARY_FIELD])
  );

  const issueResults = await mapWithConcurrency(
    candidateIssues,
    PR_DETAIL_CONCURRENCY,
    async (issue) => {
      const [details, changelog] = await Promise.all([
        fetchIssuePullRequestDetails(site, email, token, issue.id),
        fetchIssueChangelog(site, email, token, issue.key)
      ]);
      return {
        pullRequestRecords: normalizePullRequestRecords(issue, details),
        ticketReviewToMergeRecord: normalizeTicketReviewToMergeRecord(issue, details, changelog)
      };
    }
  );

  const uniquePullRequests = new Map();
  let conflictCount = 0;

  for (const record of issueResults.flatMap((result) => result.pullRequestRecords || [])) {
    const existing = uniquePullRequests.get(record.uniqueKey);
    if (!existing) {
      uniquePullRequests.set(record.uniqueKey, record);
      continue;
    }

    if (existing.team !== record.team) conflictCount += 1;

    existing.offeredProxyDate = earliestIsoDate([
      existing.offeredProxyDate,
      record.offeredProxyDate
    ]);
    existing.mergedProxyDate = latestIsoDate([existing.mergedProxyDate, record.mergedProxyDate]);
    if (existing.status !== "MERGED" && record.status === "MERGED") existing.status = "MERGED";
  }

  return {
    candidateIssueCount: candidateIssues.length,
    uniquePrCount: uniquePullRequests.size,
    conflictCount,
    records: Array.from(uniquePullRequests.values()),
    ticketReviewToMergeRecords: issueResults
      .map((result) => result.ticketReviewToMergeRecord)
      .filter(Boolean)
  };
}

function resolveSprintBucketDate(isoDate, sprintDates) {
  const safeDate = isoDateOnly(isoDate);
  const dates = Array.isArray(sprintDates) ? sprintDates : [];
  if (!safeDate || dates.length === 0) return "";

  for (const sprintDate of dates) {
    if (safeDate <= sprintDate) return sprintDate;
  }

  return dates[dates.length - 1] || "";
}

function buildPrActivitySprintSnapshot(result, sinceDate, sprintDates) {
  const dates = Array.from(
    new Set((Array.isArray(sprintDates) ? sprintDates : []).filter(Boolean))
  ).sort();
  const byDate = new Map(
    dates.map((date) => [
      date,
      TEAM_KEYS.reduce((acc, team) => {
        acc[team] = emptyPrAccumulator();
        return acc;
      }, {})
    ])
  );

  for (const row of result.records ?? []) {
    const offeredBucketDate = resolveSprintBucketDate(row.offeredProxyDate, dates);
    const offeredPoint = byDate.get(offeredBucketDate);
    if (offeredPoint) offeredPoint[row.team].offered += 1;

    if (row.status === "MERGED") {
      const mergedBucketDate = resolveSprintBucketDate(row.mergedProxyDate, dates);
      const mergedPoint = byDate.get(mergedBucketDate);
      if (mergedPoint) mergedPoint[row.team].merged += 1;
    }
  }

  for (const row of result.ticketReviewToMergeRecords ?? []) {
    const mergedBucketDate = resolveSprintBucketDate(row.mergedProxyDate, dates);
    const mergedPoint = byDate.get(mergedBucketDate);
    if (mergedPoint) {
      mergedPoint[row.team].reviewToMergeDaysTotal += row.reviewToMergeDays;
      mergedPoint[row.team].avgReviewToMergeSampleCount += 1;
    }
  }

  return {
    since: sinceDate,
    interval: "sprint",
    source: "jira_dev_status_detail",
    candidateIssueCount: numberOrZero(result.candidateIssueCount),
    uniquePrCount: numberOrZero(result.uniquePrCount),
    conflictCount: numberOrZero(result.conflictCount),
    caveat:
      "Counts are deduped from Jira dev-status pull request records and attributed by Jira team label. Inflow dates use the earliest available PR lastUpdate and source-branch last commit timestamp, then are bucketed to Jira sprint points. Merged dates use Jira PR lastUpdate as a merge proxy and are bucketed to the corresponding sprint point. Review-to-merge time is a ticket proxy: first Jira In Review status to linked merged PR proxy date. Multiple done Jira tickets can still map to the same underlying PR.",
    points: dates.map((date) => ({
      date,
      api: buildPrPointForTeam(byDate, date, "api"),
      legacy: buildPrPointForTeam(byDate, date, "legacy"),
      react: buildPrPointForTeam(byDate, date, "react"),
      bc: buildPrPointForTeam(byDate, date, "bc"),
      workers: buildPrPointForTeam(byDate, date, "workers"),
      titanium: buildPrPointForTeam(byDate, date, "titanium")
    }))
  };
}

async function fetchUatIssueAges(site, email, token, config) {
  const clauses = [
    `project = ${quoteJqlValue(config.project)}`,
    `status = ${quoteJqlValue(config.status)}`,
    `labels = ${quoteJqlValue(config.label)}`
  ];
  if (config.issueType) {
    clauses.splice(1, 0, `type = ${quoteJqlValue(config.issueType)}`);
  }
  const jql = clauses.join(" AND ");

  const issues = [];
  let nextPageToken = "";
  for (;;) {
    const searchPayload = await jiraRequest(
      site,
      email,
      token,
      `https://${site}/rest/api/3/search/jql`,
      {
        method: "POST",
        body: JSON.stringify({
          jql,
          maxResults: PAGE_SIZE,
          ...(nextPageToken ? { nextPageToken } : {}),
          fields: ["priority", "created", "status"]
        })
      }
    );
    const pageIssues = searchPayload?.issues ?? [];
    issues.push(...pageIssues);
    if (pageIssues.length === 0 || !searchPayload?.nextPageToken) break;
    nextPageToken = searchPayload.nextPageToken;
  }

  const rows = [];
  const mappedRows = await mapWithConcurrency(issues, UAT_CHANGELOG_CONCURRENCY, async (issue) => {
    const issueKey = issue?.key;
    if (!issueKey) return null;

    const changelog = await fetchIssueChangelog(site, email, token, issueKey);
    const createdAt = issue?.fields?.created || "";
    const enteredUatAt = findLastEnteredStatus(changelog, config.status) || createdAt;
    const priorityKey = normalizePriority(issue?.fields?.priority?.name);
    if (!priorityKey) return null;

    return {
      priority: priorityKey,
      daysInUat: daysSince(enteredUatAt)
    };
  });

  rows.push(...mappedRows.filter(Boolean));
  return rows;
}

function buildUatAging(rows, config) {
  const priorities = PRIORITY_ORDER.reduce((acc, priority) => {
    acc[priority] = {
      count: 0,
      avgDays: 0,
      maxDays: 0,
      buckets: emptyUatPriorityBuckets()
    };
    return acc;
  }, {});

  const rawDays = PRIORITY_ORDER.reduce((acc, priority) => {
    acc[priority] = [];
    return acc;
  }, {});

  for (const row of rows) {
    const priority = row.priority;
    const days = numberOrZero(row.daysInUat);
    const bucketId = bucketIdForAgeDays(days);

    priorities[priority].count += 1;
    priorities[priority].buckets[bucketId] += 1;
    priorities[priority].maxDays = Math.max(priorities[priority].maxDays, days);
    rawDays[priority].push(days);
  }

  for (const priority of PRIORITY_ORDER) {
    const values = rawDays[priority];
    if (values.length === 0) continue;
    const sum = values.reduce((acc, value) => acc + value, 0);
    priorities[priority].avgDays = Number((sum / values.length).toFixed(1));
  }

  return {
    scope: {
      project: config.project,
      issueType: config.issueType || "Any",
      status: config.status,
      label: config.label
    },
    generatedAt: new Date().toISOString(),
    totalIssues: rows.length,
    buckets: UAT_BUCKETS,
    priorities
  };
}

async function countFor(board, date, site, email, token) {
  const baseJqlClauses = [
    board.baseJql,
    `AND created <= "${asOfDateTime(date)}"`,
    `AND status WAS NOT IN ${board.doneStatuses} ON "${date}"`
  ];
  const jql = baseJqlClauses.join(" ");

  const counts = emptyCounts();
  let nextPageToken = "";

  for (;;) {
    const payload = await jiraSearch(site, email, token, jql, nextPageToken, PAGE_SIZE);
    const issues = payload.issues ?? [];

    for (const issue of issues) {
      countPriority(counts, issue?.fields?.priority?.name);
    }

    if (issues.length === 0) break;
    if (!payload.nextPageToken) break;
    nextPageToken = payload.nextPageToken;
  }

  if (board.includeLongstandingCounts) {
    const [longstanding30dPlus, longstanding60dPlus] = await Promise.all([
      countIssuesForJql(
        site,
        email,
        token,
        [...baseJqlClauses, `AND created <= "${asOfDateTime(shiftIsoDate(date, -30))}"`].join(" ")
      ),
      countIssuesForJql(
        site,
        email,
        token,
        [...baseJqlClauses, `AND created <= "${asOfDateTime(shiftIsoDate(date, -60))}"`].join(" ")
      )
    ]);
    counts.longstanding_30d_plus = longstanding30dPlus;
    counts.longstanding_60d_plus = longstanding60dPlus;
  }

  return counts;
}

async function countIssuesForJql(site, email, token, jql) {
  let total = 0;
  let nextPageToken = "";

  for (;;) {
    const payload = await jiraSearch(site, email, token, jql, nextPageToken, PAGE_SIZE);
    const issues = payload.issues ?? [];
    total += issues.length;
    if (issues.length === 0 || !payload.nextPageToken) break;
    nextPageToken = payload.nextPageToken;
  }

  return total;
}

async function buildBoardTrend(board, dates, site, email, token) {
  const points = [];
  for (const date of dates) {
    const counts = await countFor(board, date, site, email, token);
    console.log(
      `[${board.constName}] ${date}: Hst ${counts.highest}, H ${counts.high}, M ${counts.medium}, L ${counts.low}, Lst ${counts.lowest}${
        board.includeLongstandingCounts
          ? `, 30d+ ${numberOrZero(counts.longstanding_30d_plus)}, 60d+ ${numberOrZero(
              counts.longstanding_60d_plus
            )}`
          : ""
      }`
    );
    points.push({ date, ...counts });
  }
  return points;
}

function emptyPoint(date) {
  return { date, highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
}

function buildCombinedSnapshot(computed, syncedAt, uatAging, prActivity) {
  const updatedAt = new Date().toISOString();
  const api = computed.BOARD_38_TREND ?? [];
  const legacy = computed.BOARD_39_TREND ?? [];
  const react = computed.BOARD_46_TREND ?? [];
  const bc = computed.BOARD_40_TREND ?? [];
  const workers = computed.BOARD_333_TREND ?? [];
  const titanium = computed.BOARD_399_TREND ?? [];

  const apiByDate = new Map(api.map((point) => [point.date, point]));
  const legacyByDate = new Map(legacy.map((point) => [point.date, point]));
  const reactByDate = new Map(react.map((point) => [point.date, point]));
  const bcByDate = new Map(bc.map((point) => [point.date, point]));
  const workersByDate = new Map(workers.map((point) => [point.date, point]));
  const titaniumByDate = new Map(titanium.map((point) => [point.date, point]));

  const allDates = Array.from(
    new Set([
      ...api.map((point) => point.date),
      ...legacy.map((point) => point.date),
      ...react.map((point) => point.date),
      ...bc.map((point) => point.date),
      ...workers.map((point) => point.date),
      ...titanium.map((point) => point.date)
    ])
  ).sort();

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    updatedAt,
    source: {
      mode: "mcp_snapshot",
      syncedAt,
      note: "Backlog trends are generated from Jira historical JQL snapshots (status and priority as-of each date). UAT aging is generated from current UAT issues and changelog-derived status entry timestamps. PR activity is derived from Jira dev-status pull request details."
    },
    uatAging,
    prActivity,
    combinedPoints: allDates.map((date) => ({
      date,
      api: apiByDate.get(date) ?? emptyPoint(date),
      legacy: legacyByDate.get(date) ?? emptyPoint(date),
      react: reactByDate.get(date) ?? emptyPoint(date),
      bc: bcByDate.get(date) ?? emptyPoint(date),
      workers: workersByDate.get(date) ?? emptyPoint(date),
      titanium: titaniumByDate.get(date) ?? emptyPoint(date)
    }))
  };
}

async function writeSnapshotAtomic(snapshot) {
  let existingBacklogSnapshot = null;
  try {
    const raw = await fs.readFile(BACKLOG_SNAPSHOT_PATH, "utf8");
    existingBacklogSnapshot = JSON.parse(raw);
  } catch {
    existingBacklogSnapshot = null;
  }

  const shouldPreserveChartData =
    existingBacklogSnapshot &&
    typeof existingBacklogSnapshot === "object" &&
    existingBacklogSnapshot.chartData &&
    typeof existingBacklogSnapshot.chartData === "object" &&
    (!snapshot.chartData || typeof snapshot.chartData !== "object");
  const preservedChartDataUpdatedAt = shouldPreserveChartData
    ? String(
        existingBacklogSnapshot.chartDataUpdatedAt ||
          existingBacklogSnapshot.updatedAt ||
          existingBacklogSnapshot.source?.syncedAt ||
          ""
      ).trim()
    : "";
  const backlogSnapshot = shouldPreserveChartData
    ? {
        ...snapshot,
        chartData: existingBacklogSnapshot.chartData,
        ...(preservedChartDataUpdatedAt ? { chartDataUpdatedAt: preservedChartDataUpdatedAt } : {})
      }
    : snapshot;

  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const backlogSerialized = `${JSON.stringify(backlogSnapshot, null, 2)}\n`;
  try {
    await fs.writeFile(SNAPSHOT_TMP_PATH, serialized, "utf8");
    await fs.writeFile(BACKLOG_SNAPSHOT_TMP_PATH, backlogSerialized, "utf8");
    await fs.rename(SNAPSHOT_TMP_PATH, SNAPSHOT_PATH);
    await fs.rename(BACKLOG_SNAPSHOT_TMP_PATH, BACKLOG_SNAPSHOT_PATH);
  } catch (error) {
    await fs.unlink(SNAPSHOT_TMP_PATH).catch(() => undefined);
    await fs.unlink(BACKLOG_SNAPSHOT_TMP_PATH).catch(() => undefined);
    throw error;
  }
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updateExistingSnapshotPrActivity(existingSnapshot, prActivity, syncedAt) {
  if (!existingSnapshot || typeof existingSnapshot !== "object") {
    throw new Error("Cannot run PR_ACTIVITY_ONLY without an existing snapshot.json to update.");
  }

  return {
    ...existingSnapshot,
    updatedAt: new Date().toISOString(),
    source: {
      ...(existingSnapshot.source && typeof existingSnapshot.source === "object"
        ? existingSnapshot.source
        : {}),
      syncedAt
    },
    prActivity
  };
}

async function writePrCycleSnapshotAtomic(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  try {
    await fs.writeFile(PR_CYCLE_SNAPSHOT_TMP_PATH, serialized, "utf8");
    await fs.rename(PR_CYCLE_SNAPSHOT_TMP_PATH, PR_CYCLE_SNAPSHOT_PATH);
  } catch (error) {
    await fs.unlink(PR_CYCLE_SNAPSHOT_TMP_PATH).catch(() => undefined);
    throw error;
  }
}

function snapshotArchiveFileName(syncedAt) {
  const safeStamp = String(syncedAt || "unknown")
    .replace(/[:.]/g, "-")
    .replace(/[^0-9TZ-]/g, "");
  return `snapshot-${safeStamp}.json`;
}

async function archiveSnapshot(snapshot, syncedAt) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const fileName = snapshotArchiveFileName(syncedAt);
  const filePath = path.join(SNAPSHOTS_DIR_PATH, fileName);
  await fs.mkdir(SNAPSHOTS_DIR_PATH, { recursive: true });
  await fs.writeFile(filePath, serialized, "utf8");
  return filePath;
}

async function pruneArchivedSnapshots(maxSnapshots) {
  let entries = [];
  try {
    entries = await fs.readdir(SNAPSHOTS_DIR_PATH, { withFileTypes: true });
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
    await fs.unlink(path.join(SNAPSHOTS_DIR_PATH, fileName));
    removed.push(fileName);
  }
  return removed;
}

async function main() {
  await loadLocalEnv();
  const snapshotRetentionCount = envPositiveInt(
    "SNAPSHOT_RETENTION_COUNT",
    DEFAULT_SNAPSHOT_RETENTION_COUNT
  );

  const site = env("ATLASSIAN_SITE", "nepgroup.atlassian.net");
  const email = env("ATLASSIAN_EMAIL");
  const token = env("ATLASSIAN_API_TOKEN");
  const uatProject = env("UAT_PROJECT", "TFC");
  const uatIssueType = env("UAT_ISSUE_TYPE", "");
  const uatStatus = env("UAT_STATUS", "UAT");
  const uatLabel = env("UAT_LABEL", "Broadcast");
  const prCycleOnly = envBool("PR_CYCLE_ONLY", false);
  const prActivityOnly = envBool("PR_ACTIVITY_ONLY", false);
  const skipPrCycle = envBool("SKIP_PR_CYCLE", false);
  const prCycleProjectKeys = env("PR_CYCLE_PROJECT_KEYS", PR_ACTIVITY_PROJECT_KEYS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const prCycleCodingStatuses = normalizeStringList(
    env("PR_CYCLE_CODING_STATUS", "In Progress").split(",")
  );
  const prCycleReviewStatuses = normalizeStringList(
    env("PR_CYCLE_REVIEW_STATUS", "In Review").split(",")
  );
  const prCycleMergeStatuses = normalizeStringList(env("PR_CYCLE_MERGE_STATUS", "QA").split(","));
  const sprintProject = env("SPRINT_PROJECT", DEFAULT_SPRINT_PROJECT);
  const sprintBoardId = env("SPRINT_BOARD_ID", "");
  const sprintLookbackCount = envPositiveInt(
    "SPRINT_LOOKBACK_COUNT",
    DEFAULT_SPRINT_LOOKBACK_COUNT
  );
  const sprintPointRaw = env("SPRINT_POINT", DEFAULT_SPRINT_POINT).toLowerCase();
  const sprintPoint = sprintPointRaw === "start" ? "start" : "end";
  const sprintIncludeActive = envBool("SPRINT_INCLUDE_ACTIVE", true);
  const sprintMondayAnchor = envBool("SPRINT_MONDAY_ANCHOR", DEFAULT_SPRINT_MONDAY_ANCHOR);

  if (!email) {
    throw new Error(
      "Missing ATLASSIAN_EMAIL. Create .env.backlog with ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, and optional ATLASSIAN_SITE."
    );
  }
  if (!token) {
    throw new Error(
      "Missing ATLASSIAN_API_TOKEN. Create .env.backlog with ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, and optional ATLASSIAN_SITE."
    );
  }
  if (isPlaceholderSite(site)) {
    throw new Error(
      "ATLASSIAN_SITE looks like a placeholder. Set your real Jira site host (for example: nepgroup.atlassian.net)."
    );
  }
  if (isPlaceholderCredential(email)) {
    throw new Error(
      "ATLASSIAN_EMAIL looks like a placeholder. Set a real Jira account email in .env.backlog."
    );
  }
  if (isPlaceholderCredential(token)) {
    throw new Error(
      "ATLASSIAN_API_TOKEN looks like a placeholder. Set a real Jira API token in .env.backlog."
    );
  }

  console.log(`Refreshing backlog from Jira site: ${site}`);
  if (prCycleOnly && prActivityOnly) {
    throw new Error("PR_CYCLE_ONLY and PR_ACTIVITY_ONLY cannot both be true.");
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const prCycleWindows = buildPrCycleWindowConfigs(todayIso);
  const prCycleRangeStartDate = String(
    prCycleWindows[prCycleWindows.length - 1]?.windowStartDate || todayIso
  );
  let prCycleSnapshot = null;
  if (skipPrCycle || prActivityOnly) {
    if (prActivityOnly) {
      console.log("Skipping PR cycle stage breakdown (PR_ACTIVITY_ONLY=true).");
    } else {
      console.log("Skipping PR cycle stage breakdown (SKIP_PR_CYCLE=true).");
    }
  } else {
    console.log(
      `Fetching PR cycle issue histories for ${prCycleWindows.map((windowConfig) => windowConfig.windowLabel).join(", ")}.`
    );
    const prCycleRows = await fetchPrCycleIssueBreakdown(site, email, token, {
      projectKeys: prCycleProjectKeys,
      windowDays: prCycleWindows[prCycleWindows.length - 1]?.windowDays || 365,
      windowLabel: prCycleWindows[prCycleWindows.length - 1]?.windowLabel || "Last year",
      windowStartDate: prCycleRangeStartDate,
      windowStartIso: `${prCycleRangeStartDate}T00:00:00.000Z`,
      windowEndIso: new Date().toISOString(),
      codingStatuses: prCycleCodingStatuses,
      reviewStatuses: prCycleReviewStatuses,
      mergeStatuses: prCycleMergeStatuses
    });
    prCycleSnapshot = buildPrCycleSnapshot(prCycleRows, {
      projectKeys: prCycleProjectKeys,
      codingStatuses: prCycleCodingStatuses,
      reviewStatuses: prCycleReviewStatuses,
      mergeStatuses: prCycleMergeStatuses,
      windows: prCycleWindows,
      defaultWindow: PR_CYCLE_WINDOW_DEFAULT_KEY
    });
    console.log(
      `Computed PR cycle stage breakdown (${prCycleRows.length} issue histories across ${prCycleProjectKeys.join(", ")} for ${prCycleWindows.length} windows).`
    );
  }
  if (prCycleOnly) {
    if (!prCycleSnapshot) {
      throw new Error("PR_CYCLE_ONLY cannot be used when SKIP_PR_CYCLE=true.");
    }
    await writePrCycleSnapshotAtomic(prCycleSnapshot);
    console.log("Wrote pr-cycle-snapshot.json (PR_CYCLE_ONLY mode).");
    return;
  }

  const resolvedDates = await resolveTrendDates(site, email, token, {
    fallbackDates: FALLBACK_DATES,
    projectKey: sprintProject,
    boardId: sprintBoardId,
    lookbackCount: sprintLookbackCount,
    pointMode: sprintPoint,
    includeActive: sprintIncludeActive,
    mondayAnchor: sprintMondayAnchor
  });
  const dates = resolvedDates.dates;
  if (resolvedDates.usedFallback) {
    console.warn(
      `Using fallback trend dates (${dates.length} points). Reason: ${resolvedDates.fallbackReason}`
    );
  } else {
    console.log(
      `Resolved ${dates.length} trend dates from Jira sprints (point=${sprintPoint}, includeActive=${sprintIncludeActive}, mondayAnchor=${sprintMondayAnchor}).`
    );
  }

  const computed = {};
  for (const board of BOARDS) {
    computed[board.constName] = await buildBoardTrend(board, dates, site, email, token);
    console.log(`Computed ${board.constName} (${dates.length} points).`);
  }

  const uatRows = await fetchUatIssueAges(site, email, token, {
    project: uatProject,
    issueType: uatIssueType,
    status: uatStatus,
    label: uatLabel
  });
  const uatAging = buildUatAging(uatRows, {
    project: uatProject,
    issueType: uatIssueType,
    status: uatStatus,
    label: uatLabel
  });
  console.log(
    `Computed UAT aging (${uatAging.totalIssues} issues, label=${uatLabel}, status=${uatStatus}).`
  );

  const prActivitySinceDate = resolvePrActivitySinceDate(todayIso);
  const prRows = await fetchPrActivity(site, email, token, prActivitySinceDate);
  const prActivitySprintDatesResult = await resolveTrendDates(site, email, token, {
    fallbackDates: FALLBACK_DATES,
    projectKey: sprintProject,
    boardId: sprintBoardId,
    lookbackCount: 0,
    pointMode: sprintPoint,
    includeActive: sprintIncludeActive,
    mondayAnchor: sprintMondayAnchor,
    sinceDate: prActivitySinceDate
  });
  const prActivitySprintDates = prActivitySprintDatesResult.dates;
  const prActivity = buildPrActivitySprintSnapshot(
    prRows,
    prActivitySinceDate,
    prActivitySprintDates
  );
  console.log(
    `Computed Jira Development PR inflow proxy (${prRows.uniquePrCount} unique PRs from ${prRows.candidateIssueCount} candidate issues since ${prActivitySinceDate} across ${prActivitySprintDates.length} sprint buckets).`
  );
  if (prActivityOnly) {
    const existingSnapshot = await readJsonFile(SNAPSHOT_PATH);
    const syncedAt = new Date().toISOString();
    const updatedSnapshot = updateExistingSnapshotPrActivity(
      existingSnapshot,
      prActivity,
      syncedAt
    );
    await writeSnapshotAtomic(updatedSnapshot);
    const archivedPath = await archiveSnapshot(updatedSnapshot, syncedAt);
    const prunedSnapshots = await pruneArchivedSnapshots(snapshotRetentionCount);
    console.log("Wrote snapshot.json/backlog-snapshot.json (PR_ACTIVITY_ONLY mode).");
    console.log(`Archived snapshot history copy: ${archivedPath}`);
    if (prunedSnapshots.length > 0) {
      console.log(
        `Pruned ${prunedSnapshots.length} archived snapshot(s) to keep the latest ${snapshotRetentionCount}.`
      );
    }
    return;
  }

  const grandTotal = Object.values(computed)
    .flat()
    .reduce(
      (acc, point) =>
        acc +
        numberOrZero(point.highest) +
        numberOrZero(point.high) +
        numberOrZero(point.medium) +
        numberOrZero(point.low) +
        numberOrZero(point.lowest),
      0
    );

  if (grandTotal === 0 && !ALLOW_EMPTY) {
    throw new Error(
      [
        "Refusing to write snapshot.json because every board/date returned 0 issues.",
        "Likely causes: wrong Jira credentials, no Browse Project permission on TFC, or JQL label filters no longer matching.",
        "If this is intentionally empty, rerun with --allow-empty."
      ].join(" ")
    );
  }

  const syncedAt = new Date().toISOString();
  const snapshot = buildCombinedSnapshot(computed, syncedAt, uatAging, prActivity);
  await writeSnapshotAtomic(snapshot);
  if (prCycleSnapshot) {
    await writePrCycleSnapshotAtomic(prCycleSnapshot);
  }
  const archivedPath = await archiveSnapshot(snapshot, syncedAt);
  const prunedSnapshots = await pruneArchivedSnapshots(snapshotRetentionCount);

  console.log(
    "Updated snapshot.json for BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, BOARD_40_TREND, BOARD_333_TREND, and BOARD_399_TREND."
  );
  console.log(`Archived snapshot history copy: ${archivedPath}`);
  if (prunedSnapshots.length > 0) {
    console.log(
      `Pruned ${prunedSnapshots.length} archived snapshot(s) to keep the latest ${snapshotRetentionCount}.`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
