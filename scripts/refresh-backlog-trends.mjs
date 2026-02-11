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
    label: "API",
    doneStatuses: '(Done, "Won\'t Fix", Duplicate)'
  },
  {
    constName: "BOARD_39_TREND",
    label: "Frontend",
    doneStatuses: '(Done, "Won\'t Fix")'
  },
  {
    constName: "BOARD_46_TREND",
    label: "NewFrontend",
    doneStatuses: '(Done, "Won\'t Fix")'
  },
  {
    constName: "BOARD_40_TREND",
    label: "Broadcast",
    doneStatuses: '(Done, "Won\'t Fix")'
  }
];

const PAGE_SIZE = 100;
const MAX_RETRIES = 5;
const SNAPSHOT_PATH = path.resolve(process.cwd(), "snapshot.json");
const SNAPSHOT_TMP_PATH = path.resolve(process.cwd(), "snapshot.json.tmp");
const SNAPSHOT_SCHEMA_VERSION = 2;
const ALLOW_EMPTY = process.argv.includes("--allow-empty");
const PRIORITY_ORDER = ["highest", "high", "medium", "low", "lowest"];
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
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("<jira_api_token>")) return true;
  if (normalized.includes("you@company.com")) return true;
  if (normalized.includes("your-real-email")) return true;
  if (normalized.includes("your-real-api-token")) return true;
  if (normalized.startsWith("<") && normalized.endsWith(">")) return true;
  return false;
}

function isPlaceholderSite(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("your-real-site")) return true;
  if (normalized.includes("example.atlassian.net")) return true;
  return false;
}

async function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.backlog"),
    path.resolve(process.cwd(), ".env.local")
  ];

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
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
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
      response = await fetch(url, {
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

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function countPriority(counts, priorityName) {
  const priorityKey = normalizePriority(priorityName);
  if (priorityKey) counts[priorityKey] += 1;
}

function normalizePriority(priorityName) {
  const normalized = String(priorityName || "").trim().toLowerCase();
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
  const target = String(statusName || "").trim().toLowerCase();
  let latest = "";

  for (const history of changelog?.histories ?? []) {
    const createdAt = history?.created || "";
    for (const item of history?.items ?? []) {
      if (String(item?.field || "").toLowerCase() !== "status") continue;
      if (String(item?.toString || "").trim().toLowerCase() !== target) continue;
      if (!latest || new Date(createdAt).getTime() > new Date(latest).getTime()) {
        latest = createdAt;
      }
    }
  }

  return latest;
}

function quoteJqlValue(value) {
  const escaped = String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

function toUtcIsoDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
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

function buildTrendDatesFromSprints(sprints, { lookbackCount, pointMode, includeActive, mondayAnchor }) {
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
    dates.push(normalizedDate);
  }

  const uniqueSorted = Array.from(new Set(dates)).sort();
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
    mondayAnchor
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
      mondayAnchor
    });

    if (dates.length === 0) {
      throw new Error("No sprint dates resolved from Jira Agile API.");
    }

    return {
      dates,
      usedFallback: false
    };
  } catch (error) {
    return {
      dates: fallbackDates,
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
    const searchPayload = await jiraRequest(site, email, token, `https://${site}/rest/api/3/search/jql`, {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults: PAGE_SIZE,
        ...(nextPageToken ? { nextPageToken } : {}),
        fields: ["priority", "created", "status"]
      })
    });
    const pageIssues = searchPayload?.issues ?? [];
    issues.push(...pageIssues);
    if (pageIssues.length === 0 || !searchPayload?.nextPageToken) break;
    nextPageToken = searchPayload.nextPageToken;
  }

  const rows = [];

  for (const issue of issues) {
    const issueKey = issue?.key;
    if (!issueKey) continue;

    const changelog = await fetchIssueChangelog(site, email, token, issueKey);
    const createdAt = issue?.fields?.created || "";
    const enteredUatAt = findLastEnteredStatus(changelog, config.status) || createdAt;
    const priorityKey = normalizePriority(issue?.fields?.priority?.name);
    if (!priorityKey) continue;

    rows.push({
      priority: priorityKey,
      daysInUat: daysSince(enteredUatAt)
    });
  }

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
  const jql = [
    "project = TFC",
    "AND type = Bug",
    `AND labels = ${board.label}`,
    `AND created <= \"${asOfDateTime(date)}\"`,
    `AND status WAS NOT IN ${board.doneStatuses} ON \"${date}\"`
  ].join(" ");

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

  return counts;
}

async function buildBoardTrend(board, dates, site, email, token) {
  const points = [];
  for (const date of dates) {
    const counts = await countFor(board, date, site, email, token);
    console.log(
      `[${board.constName}] ${date}: Hst ${counts.highest}, H ${counts.high}, M ${counts.medium}, L ${counts.low}, Lst ${counts.lowest}`
    );
    points.push({ date, ...counts });
  }
  return points;
}

function emptyPoint(date) {
  return { date, highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
}

function buildCombinedSnapshot(computed, syncedAt, uatAging) {
  const updatedAt = new Date().toISOString();
  const api = computed.BOARD_38_TREND ?? [];
  const legacy = computed.BOARD_39_TREND ?? [];
  const react = computed.BOARD_46_TREND ?? [];
  const bc = computed.BOARD_40_TREND ?? [];

  const apiByDate = new Map(api.map((point) => [point.date, point]));
  const legacyByDate = new Map(legacy.map((point) => [point.date, point]));
  const reactByDate = new Map(react.map((point) => [point.date, point]));
  const bcByDate = new Map(bc.map((point) => [point.date, point]));

  const allDates = Array.from(
    new Set([
      ...api.map((point) => point.date),
      ...legacy.map((point) => point.date),
      ...react.map((point) => point.date),
      ...bc.map((point) => point.date)
    ])
  ).sort();

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    updatedAt,
    source: {
      mode: "mcp_snapshot",
      syncedAt,
      note: "Backlog trends are generated from Jira historical JQL snapshots (status and priority as-of each date). UAT aging is generated from current UAT issues and changelog-derived status entry timestamps."
    },
    uatAging,
    combinedPoints: allDates.map((date) => ({
      date,
      api: apiByDate.get(date) ?? emptyPoint(date),
      legacy: legacyByDate.get(date) ?? emptyPoint(date),
      react: reactByDate.get(date) ?? emptyPoint(date),
      bc: bcByDate.get(date) ?? emptyPoint(date)
    }))
  };
}

async function writeSnapshotAtomic(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  try {
    await fs.writeFile(SNAPSHOT_TMP_PATH, serialized, "utf8");
    await fs.rename(SNAPSHOT_TMP_PATH, SNAPSHOT_PATH);
  } catch (error) {
    await fs.unlink(SNAPSHOT_TMP_PATH).catch(() => undefined);
    throw error;
  }
}

async function main() {
  await loadLocalEnv();

  const site = env("ATLASSIAN_SITE", "nepgroup.atlassian.net");
  const email = env("ATLASSIAN_EMAIL");
  const token = env("ATLASSIAN_API_TOKEN");
  const uatProject = env("UAT_PROJECT", "TFC");
  const uatIssueType = env("UAT_ISSUE_TYPE", "");
  const uatStatus = env("UAT_STATUS", "UAT");
  const uatLabel = env("UAT_LABEL", "Broadcast");
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
  const snapshot = buildCombinedSnapshot(computed, syncedAt, uatAging);
  await writeSnapshotAtomic(snapshot);

  console.log(
    "Updated snapshot.json for BOARD_38_TREND, BOARD_39_TREND, BOARD_46_TREND, and BOARD_40_TREND."
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
