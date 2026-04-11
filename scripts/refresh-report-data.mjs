#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  sanitizeBacklogSnapshot,
  sanitizeManagementFacilitySnapshot,
  sanitizePrActivitySnapshot
} from "./snapshot-sanitizers.mjs";
import { validateDashboardSnapshot } from "./validate-dashboard-snapshots.mjs";
import {
  BACKLOG_SNAPSHOT_PATH,
  MANAGEMENT_FACILITY_SNAPSHOT_PATH,
  PR_CYCLE_CHANGELOG_CACHE_PATH,
  PR_CYCLE_CHANGELOG_CACHE_TMP_PATH,
  PR_ACTIVITY_ISSUE_CACHE_PATH,
  PR_ACTIVITY_ISSUE_CACHE_TMP_PATH,
  PR_ACTIVITY_REPO_TEAM_MAP_PATH,
  PR_ACTIVITY_SNAPSHOT_PATH,
  PR_CYCLE_SNAPSHOT_PATH,
  PRIMARY_SNAPSHOT_PATH,
  REPO_ROOT_PATH,
  TREND_DATE_CACHE_PATH,
  TREND_DATE_CACHE_TMP_PATH
} from "./dashboard-paths.mjs";
import {
  buildSupplementalWriteArtifacts,
  commitSnapshotRefresh,
  readJsonFile,
  writeJsonAtomic,
  writePrCycleSnapshotAtomic,
  writeProductCycleShipmentsSnapshotAtomic,
  writeProductCycleSnapshotAtomic
} from "./dashboard-snapshot-store.mjs";
import {
  refreshBusinessUnitUatChartData,
  refreshContributorsSnapshot,
  refreshProductCycleSnapshot
} from "./refresh-derived-snapshots.mjs";
import {
  countPrActivitySeriesPoints,
  mergePrActivitySnapshots,
  readPrActivityHistoryState
} from "./refresh-pr-activity-history.mjs";
import { createRefreshRunner } from "./refresh-runner.mjs";

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
const GITHUB_PR_DETAIL_CONCURRENCY = 6;
const GITHUB_PULLS_PAGE_SIZE = 100;
const UAT_CHANGELOG_CONCURRENCY = 6;
const PR_CYCLE_CHANGELOG_CONCURRENCY = 6;
const DEFAULT_TREND_COUNT_CONCURRENCY = 2;
const TREND_DATE_CACHE_FALLBACK_TTL_DAYS = 14;
const SNAPSHOT_SCHEMA_VERSION = 3;
const DEFAULT_SNAPSHOT_RETENTION_COUNT = 26;
const ALLOW_EMPTY = process.argv.includes("--allow-empty");
const FULL_REFRESH_STAGE_ORDER = Object.freeze([
  "fetch",
  "normalize",
  "derive",
  "validate",
  "write"
]);
const PRIORITY_ORDER = ["highest", "high", "medium", "low", "lowest"];
const PR_SUMMARY_FIELD = "customfield_10000";
const PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY = "30d";
const PR_ACTIVITY_HISTORY_FLOOR = "2025-01-01";
const PR_REVIEW_STATUS = "In Review";
const PR_ACTIVITY_PROJECT_KEYS = ["TFC", "TFO", "MESO"];
const PR_ACTIVITY_SOURCE_JIRA = "jira";
const PR_ACTIVITY_SOURCE_GITHUB = "github";
const PR_ACTIVITY_ARTIFACT_PULL_REQUEST_KEYS = new Set(["TFC-11509|1024649212:#52"]);
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
const PR_CYCLE_TEAM_BOARD_SCOPES = {
  api: { boardId: "38", boardType: "scrum" },
  legacy: { boardId: "39", boardType: "scrum" },
  react: { boardId: "46", boardType: "scrum" },
  bc: { boardId: "40", boardType: "scrum" },
  workers: { boardId: "333", boardType: "kanban" },
  titanium: { boardId: "399", boardType: "kanban" }
};
const execFileAsync = promisify(execFile);
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
const FOURTEEN_DAY_WINDOW_KEY = "14d";
const PR_CYCLE_WINDOW_DEFAULT_KEY = "30d";
const PR_CYCLE_REFRESH_WINDOW_KEYS = [FOURTEEN_DAY_WINDOW_KEY, "30d", "90d"];
const PR_CYCLE_HISTORICAL_REFRESH_MAX_AGE_DAYS = 7;
const DEFAULT_TREND_BOARD_CONCURRENCY = 2;
const ISSUE_CHANGELOG_CACHE = new Map();
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
    review: ["In Review", "Review"],
    merge: []
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

function readCliArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return String(process.argv[index + 1] || "")
    .trim()
    .toLowerCase();
}

function resolveStopAfterStage(value = "") {
  const stageName = String(value || "").trim().toLowerCase();
  if (!stageName) return "";
  if (!FULL_REFRESH_STAGE_ORDER.includes(stageName)) {
    throw new Error(
      `Unknown refresh stage "${stageName}". Valid stages: ${FULL_REFRESH_STAGE_ORDER.join(", ")}.`
    );
  }
  return stageName;
}

function hasCliFlag(flag) {
  return process.argv.includes(flag);
}

function formatDurationMs(durationMs) {
  const safeDurationMs = Math.max(0, Number(durationMs) || 0);
  if (safeDurationMs < 1000) return `${safeDurationMs}ms`;
  if (safeDurationMs < 60000) return `${(safeDurationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(safeDurationMs / 60000);
  const seconds = ((safeDurationMs % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

async function withTiming(label, work, logger = console) {
  const startedAtMs = Date.now();
  try {
    return await work();
  } finally {
    logger.log(`Timing ${label}: ${formatDurationMs(Date.now() - startedAtMs)}.`);
  }
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
    path.resolve(REPO_ROOT_PATH, ".env.backlog"),
    path.resolve(REPO_ROOT_PATH, ".env.local")
  ]);

  try {
    const gitFile = await fs.readFile(path.resolve(REPO_ROOT_PATH, ".git"), "utf8");
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

function normalizePrActivitySource(value) {
  return String(value || "").trim().toLowerCase() === PR_ACTIVITY_SOURCE_GITHUB
    ? PR_ACTIVITY_SOURCE_GITHUB
    : PR_ACTIVITY_SOURCE_JIRA;
}

export async function loadPrActivityRepoTeamMapConfig(options = {}) {
  const payload =
    options.payload && typeof options.payload === "object"
      ? options.payload
      : await readJsonFile(options.path || PR_ACTIVITY_REPO_TEAM_MAP_PATH);
  const rawRepos = payload?.repos && typeof payload.repos === "object" ? payload.repos : {};
  return Object.fromEntries(
    Object.entries(rawRepos)
      .map(([repo, team]) => [
        String(repo || "").trim().toLowerCase(),
        String(team || "").trim().toLowerCase()
      ])
      .filter(([repo, team]) => repo && TEAM_KEYS.includes(team))
  );
}

async function loadGitHubCliToken() {
  const { stdout } = await execFileAsync("gh", ["auth", "token"], {
    cwd: REPO_ROOT_PATH,
    env: {
      ...process.env,
      GH_PAGER: "cat"
    }
  });
  return String(stdout || "").trim();
}

export async function resolveGitHubAccessToken(options = {}) {
  const explicitToken = String(options.githubToken || "").trim();
  if (explicitToken) return explicitToken;

  if (typeof options.execAuthToken === "function") {
    return String(await options.execAuthToken()).trim();
  }

  return loadGitHubCliToken();
}

async function githubRequest(token, apiPath) {
  const safeToken = String(token || "").trim();
  const safeApiPath = String(apiPath || "").trim().replace(/^\/+/, "");
  if (!safeToken) {
    throw new Error("Missing GitHub auth. Authenticate with gh auth login.");
  }
  if (!safeApiPath) throw new Error("Missing GitHub API path.");

  const url = `https://api.github.com/${safeApiPath}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${safeToken}`,
          "User-Agent": "tracker-pr-activity-refresh",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }

    if (response.ok) return response.json();

    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      if (attempt === MAX_RETRIES - 1) {
        const body = await response.text();
        throw new Error(`GitHub request failed (${response.status}): ${body}`);
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 600 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    const body = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${body}`);
  }

  throw new Error("GitHub request failed after retries.");
}

function githubPullRequestTouchesSinceDate(pullRequest, safeSinceDate) {
  const createdDate = isoDateOnly(pullRequest?.created_at);
  const mergedDate = isoDateOnly(pullRequest?.merged_at);
  return (
    (createdDate && createdDate >= safeSinceDate) || (mergedDate && mergedDate >= safeSinceDate)
  );
}

function isGitHubSubmittedReview(review, authorLogin) {
  const submittedAt = isoDateTime(review?.submitted_at);
  const state = String(review?.state || "").trim().toUpperCase();
  const reviewerLogin = String(review?.user?.login || "").trim().toLowerCase();
  const safeAuthorLogin = String(authorLogin || "").trim().toLowerCase();
  if (!submittedAt || !state || state === "PENDING") return false;
  if (safeAuthorLogin && reviewerLogin && reviewerLogin === safeAuthorLogin) return false;
  return true;
}

export function normalizeGitHubReviewToMergeRecord(repo, team, pullRequest, reviews) {
  const normalizedPullRequest = normalizeGitHubPullRequestRecord(repo, team, pullRequest);
  if (!normalizedPullRequest || normalizedPullRequest.status !== "MERGED") return null;

  const authorLogin = String(pullRequest?.user?.login || "").trim();
  const submittedReviews = (Array.isArray(reviews) ? reviews : [])
    .filter((review) => isGitHubSubmittedReview(review, authorLogin))
    .map((review) => isoDateOnly(review?.submitted_at))
    .filter(Boolean)
    .filter((reviewDate) => reviewDate <= normalizedPullRequest.mergedProxyDate)
    .sort();
  const reviewStartedAt = submittedReviews[submittedReviews.length - 1] || "";
  if (!reviewStartedAt) return null;

  const reviewToMergeDays = daysBetweenIsoDates(
    reviewStartedAt,
    normalizedPullRequest.mergedProxyDate
  );
  if (reviewToMergeDays < 0) return null;

  return {
    issueKey: normalizedPullRequest.uniqueKey,
    team: normalizedPullRequest.team,
    reviewStartedAt,
    mergedProxyDate: normalizedPullRequest.mergedProxyDate,
    reviewToMergeDays
  };
}

export function normalizeGitHubPullRequestRecord(repo, team, pullRequest) {
  const safeRepo = String(repo || "").trim().toLowerCase();
  const safeTeam = String(team || "").trim().toLowerCase();
  const number = Number(pullRequest?.number);
  const createdDate = isoDateOnly(pullRequest?.created_at);
  const mergedDate = isoDateOnly(pullRequest?.merged_at);
  const state = String(pullRequest?.state || "").trim().toUpperCase();
  const isDraft = Boolean(pullRequest?.draft);
  if (
    !safeRepo ||
    !TEAM_KEYS.includes(safeTeam) ||
    !Number.isFinite(number) ||
    !createdDate ||
    isDraft
  ) {
    return null;
  }

  return {
    uniqueKey: `${safeRepo}#${number}`,
    team: safeTeam,
    offeredProxyDate: createdDate,
    mergedProxyDate: mergedDate,
    status: mergedDate ? "MERGED" : state,
    url: String(pullRequest?.html_url || pullRequest?.url || "").trim(),
    repositoryId: safeRepo,
    pullRequestId: String(number),
    issueKey: ""
  };
}

async function fetchGitHubPullRequestReviews(repo, pullRequestNumber, options = {}) {
  const safeRepo = String(repo || "").trim().toLowerCase();
  const safeNumber = Number(pullRequestNumber);
  if (!safeRepo || !Number.isFinite(safeNumber)) return [];

  const fetchReviewsPage =
    typeof options.fetchReviewsPage === "function"
      ? options.fetchReviewsPage
      : async (repoName, prNumber, page) =>
          githubRequest(
            options.githubToken,
            `repos/${repoName}/pulls/${prNumber}/reviews?per_page=${GITHUB_PULLS_PAGE_SIZE}&page=${page}`
          );

  const reviews = [];
  let page = 1;

  for (;;) {
    const pageRows = await fetchReviewsPage(safeRepo, safeNumber, page);
    const safeRows = Array.isArray(pageRows) ? pageRows : [];
    if (safeRows.length === 0) break;
    reviews.push(...safeRows);
    if (safeRows.length < GITHUB_PULLS_PAGE_SIZE) break;
    page += 1;
  }

  return reviews;
}

async function fetchGitHubPullRequestsForRepo(repo, sinceDate, options = {}) {
  const safeRepo = String(repo || "").trim().toLowerCase();
  const safeSinceDate = isoDateOnly(sinceDate);
  if (!safeRepo || !safeSinceDate) return [];

  const fetchRepoPage =
    typeof options.fetchRepoPage === "function"
      ? options.fetchRepoPage
      : async (repoName, page) =>
          githubRequest(
            options.githubToken,
            `repos/${repoName}/pulls?state=all&sort=updated&direction=desc&per_page=${GITHUB_PULLS_PAGE_SIZE}&page=${page}`
          );

  const pullRequests = [];
  let page = 1;

  for (;;) {
    const pageRows = await fetchRepoPage(safeRepo, page);
    const safeRows = Array.isArray(pageRows) ? pageRows : [];
    if (safeRows.length === 0) break;
    pullRequests.push(...safeRows);
    const lastUpdatedDate = isoDateOnly(safeRows[safeRows.length - 1]?.updated_at);
    if (
      !lastUpdatedDate ||
      lastUpdatedDate < safeSinceDate ||
      safeRows.length < GITHUB_PULLS_PAGE_SIZE
    ) {
      break;
    }
    page += 1;
  }

  return pullRequests.filter((pullRequest) =>
    githubPullRequestTouchesSinceDate(pullRequest, safeSinceDate)
  );
}

export async function fetchGitHubPrActivity(sinceDate, options = {}) {
  const safeSinceDate = isoDateOnly(sinceDate);
  const repoTeamMap =
    options.repoTeamMap && typeof options.repoTeamMap === "object"
      ? options.repoTeamMap
      : await loadPrActivityRepoTeamMapConfig();
  const githubToken = await resolveGitHubAccessToken(options);
  const repoEntries = Object.entries(repoTeamMap).filter(
    ([repo, team]) => String(repo || "").trim() && TEAM_KEYS.includes(String(team || "").trim())
  );

  const perRepoResults = await mapWithConcurrency(
    repoEntries,
    GITHUB_PR_DETAIL_CONCURRENCY,
    async ([repo, team]) => {
      const pullRequests = await fetchGitHubPullRequestsForRepo(repo, safeSinceDate, {
        githubToken,
        fetchRepoPage: options.fetchRepoPage
      });
      const records = pullRequests
        .map((pullRequest) => normalizeGitHubPullRequestRecord(repo, team, pullRequest))
        .filter(Boolean);
      const mergedPullRequests = pullRequests.filter(
        (pullRequest) =>
          !pullRequest?.draft &&
          isoDateOnly(pullRequest?.merged_at) &&
          githubPullRequestTouchesSinceDate(pullRequest, safeSinceDate)
      );
      const ticketReviewToMergeRecords = (
        await mapWithConcurrency(mergedPullRequests, GITHUB_PR_DETAIL_CONCURRENCY, async (pullRequest) => {
          const reviews = await fetchGitHubPullRequestReviews(repo, pullRequest?.number, {
            githubToken,
            fetchReviewsPage: options.fetchReviewsPage
          });
          return normalizeGitHubReviewToMergeRecord(repo, team, pullRequest, reviews);
        })
      ).filter(Boolean);
      return {
        records,
        ticketReviewToMergeRecords
      };
    }
  );

  const records = perRepoResults.flatMap((result) => result.records || []);
  const ticketReviewToMergeRecords = perRepoResults.flatMap(
    (result) => result.ticketReviewToMergeRecords || []
  );
  return {
    source: "github_pull_requests",
    candidateIssueCount: repoEntries.length,
    detailIssueCount: repoEntries.length,
    uniquePrCount: records.length,
    conflictCount: 0,
    reviewChangelogIssueCount: ticketReviewToMergeRecords.length,
    cacheHitCount: 0,
    cacheWriteCount: 0,
    records,
    ticketReviewToMergeRecords
  };
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

function startOfIsoMonth(dateText) {
  const safeDate = String(dateText || "").trim();
  if (!safeDate) return "";
  const date = new Date(`${safeDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function resolvePrActivitySinceDate(
  todayIso,
  maxWindowKey = PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY
) {
  const safeToday = String(todayIso || "").trim();
  if (!safeToday) return "";
  switch (
    String(maxWindowKey || PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY)
      .trim()
      .toLowerCase()
  ) {
    case FOURTEEN_DAY_WINDOW_KEY:
      return shiftIsoDate(safeToday, -13);
    case "30d":
      return shiftIsoDate(safeToday, -29);
    case "90d":
      return shiftIsoDate(safeToday, -89);
    case "6m":
      return shiftIsoMonths(safeToday, -6);
    case "1y":
    default:
      return shiftIsoMonths(safeToday, -12);
  }
}

function resolvePrActivityFetchSinceDate(
  todayIso,
  maxWindowKey = PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY
) {
  const resolvedDate = startOfIsoMonth(resolvePrActivitySinceDate(todayIso, maxWindowKey));
  if (!resolvedDate) return PR_ACTIVITY_HISTORY_FLOOR;
  return resolvedDate < PR_ACTIVITY_HISTORY_FLOOR ? PR_ACTIVITY_HISTORY_FLOOR : resolvedDate;
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

function createEmptyPrActivityBuckets() {
  return TEAM_KEYS.reduce((acc, team) => {
    acc[team] = emptyPrAccumulator();
    return acc;
  }, {});
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

function capIsoDateAt(isoDate, ceilingIsoDate) {
  const safeDate = isoDateOnly(isoDate);
  const safeCeiling = isoDateOnly(ceilingIsoDate);
  if (!safeDate) return "";
  if (!safeCeiling) return safeDate;
  return safeDate > safeCeiling ? safeCeiling : safeDate;
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

function readPrCycleWindowKey(windowConfig) {
  return String(windowConfig?.key || "").trim();
}

function cloneScopedIssueKeys(issueKeys) {
  if (issueKeys instanceof Set) return new Set(issueKeys);
  if (Array.isArray(issueKeys)) return [...issueKeys];
  return new Set();
}

export function buildScopedIssueKeysByWindowMap(windowConfigs, issueKeys = new Set()) {
  const safeWindowConfigs = Array.isArray(windowConfigs) ? windowConfigs.filter(Boolean) : [];
  return Object.fromEntries(
    safeWindowConfigs.map((windowConfig) => [
      readPrCycleWindowKey(windowConfig),
      cloneScopedIssueKeys(issueKeys)
    ])
  );
}

export function selectPrCycleScrumWindowSprints(sprints, windowConfig = {}) {
  const safeSprints = Array.isArray(sprints) ? sprints.filter(Boolean) : [];
  const windowStartMs = new Date(String(windowConfig?.windowStartIso || "")).getTime();
  const windowEndMs = new Date(String(windowConfig?.windowEndIso || "")).getTime();
  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) return [];

  return safeSprints.filter((sprint) => {
    const state = String(sprint?.state || "").trim().toLowerCase();
    if (state !== "active" && state !== "closed") return false;

    const sprintStartMs = new Date(
      String(sprint?.startDate || sprint?.endDate || sprint?.completeDate || "").trim()
    ).getTime();
    const sprintEndMs =
      state === "active"
        ? windowEndMs
        : new Date(
            String(sprint?.completeDate || sprint?.endDate || sprint?.startDate || "").trim()
          ).getTime();
    if (!Number.isFinite(sprintStartMs) || !Number.isFinite(sprintEndMs)) {
      return state === "active";
    }
    return sprintStartMs <= windowEndMs && sprintEndMs >= windowStartMs;
  });
}

async function fetchAgileIssueKeys(site, email, token, endpoint) {
  const issueKeys = new Set();
  let startAt = 0;
  const safeEndpoint = String(endpoint || "").trim();
  if (!safeEndpoint) return issueKeys;

  for (;;) {
    const separator = safeEndpoint.includes("?") ? "&" : "?";
    const payload = await jiraAgileRequest(
      site,
      email,
      token,
      `${safeEndpoint}${separator}startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=key`
    );
    const issues = Array.isArray(payload?.issues) ? payload.issues : [];
    for (const issue of issues) {
      const issueKey = String(issue?.key || "").trim();
      if (issueKey) issueKeys.add(issueKey);
    }

    if (issues.length === 0) break;
    if (Boolean(payload?.isLast)) break;
    const total = Number(payload?.total);
    if (Number.isFinite(total) && startAt + issues.length >= total) break;
    startAt += issues.length;
  }

  return issueKeys;
}

async function fetchPrCycleScrumScopedIssueKeysByWindow(
  site,
  email,
  token,
  boardId,
  windowConfigs
) {
  const safeWindowConfigs = Array.isArray(windowConfigs) ? windowConfigs.filter(Boolean) : [];
  const sprints = await fetchSprintsForBoard(site, email, token, boardId);
  const sprintIssueKeyCache = new Map();
  const scopedIssueKeysByWindowKey = buildScopedIssueKeysByWindowMap(safeWindowConfigs);

  for (const windowConfig of safeWindowConfigs) {
    const scopedIssueKeys = scopedIssueKeysByWindowKey[readPrCycleWindowKey(windowConfig)];
    const sprintsForWindow = selectPrCycleScrumWindowSprints(sprints, windowConfig);
    const sprintIssueKeySets = await Promise.all(
      sprintsForWindow.map(async (sprint) => {
        const sprintId = String(sprint?.id || "").trim();
        if (sprintIssueKeyCache.has(sprintId)) return sprintIssueKeyCache.get(sprintId);
        const issueKeys = await fetchAgileIssueKeys(
          site,
          email,
          token,
          `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint/${encodeURIComponent(
            sprint?.id
          )}/issue`
        );
        sprintIssueKeyCache.set(sprintId, issueKeys);
        return issueKeys;
      })
    );
    for (const issueKeys of sprintIssueKeySets) {
      for (const issueKey of issueKeys) scopedIssueKeys.add(issueKey);
    }
  }

  return scopedIssueKeysByWindowKey;
}

async function fetchPrCycleKanbanScopedIssueKeysByWindow(
  site,
  email,
  token,
  boardId,
  windowConfigs
) {
  const safeWindowConfigs = Array.isArray(windowConfigs) ? windowConfigs.filter(Boolean) : [];
  const boardIssueKeys = await fetchAgileIssueKeys(
    site,
    email,
    token,
    `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/issue`
  );
  return buildScopedIssueKeysByWindowMap(safeWindowConfigs, boardIssueKeys);
}

async function fetchPrCycleTeamScopedIssueKeys(site, email, token, teamKey, windowConfigs) {
  const teamScope = PR_CYCLE_TEAM_BOARD_SCOPES[String(teamKey || "").trim().toLowerCase()];
  const safeWindowConfigs = Array.isArray(windowConfigs) ? windowConfigs.filter(Boolean) : [];
  if (!teamScope?.boardId) return buildScopedIssueKeysByWindowMap(safeWindowConfigs, new Set());

  if (teamScope.boardType === "scrum") {
    return fetchPrCycleScrumScopedIssueKeysByWindow(
      site,
      email,
      token,
      teamScope.boardId,
      safeWindowConfigs
    );
  }

  return fetchPrCycleKanbanScopedIssueKeysByWindow(
    site,
    email,
    token,
    teamScope.boardId,
    safeWindowConfigs
  );
}

async function fetchPrCycleScopedIssueKeysByWindow(site, email, token, windowConfigs) {
  const safeWindowConfigs = Array.isArray(windowConfigs) ? windowConfigs.filter(Boolean) : [];
  const teamEntries = await mapWithConcurrency(PR_CYCLE_TEAM_KEYS, 3, async (teamKey) => [
    teamKey,
    await fetchPrCycleTeamScopedIssueKeys(site, email, token, teamKey, safeWindowConfigs)
  ]);
  return Object.fromEntries(
    safeWindowConfigs.map((windowConfig) => [
      readPrCycleWindowKey(windowConfig),
      Object.fromEntries(
        teamEntries.map(([teamKey, scopedIssueKeysByWindowKey]) => [
          teamKey,
          scopedIssueKeysByWindowKey[readPrCycleWindowKey(windowConfig)] || new Set()
        ])
      )
    ])
  );
}

function attachScopedIssueKeysToPrCycleWindows(windowConfigs, scopedIssueKeysByWindowKey) {
  const safeWindowConfigs = Array.isArray(windowConfigs) ? windowConfigs.filter(Boolean) : [];
  return safeWindowConfigs.map((windowConfig) =>
    windowConfig?.scopedToBoardWork
      ? {
          ...windowConfig,
          scopedIssueKeysByTeam:
            scopedIssueKeysByWindowKey?.[readPrCycleWindowKey(windowConfig)] || null
        }
      : windowConfig
  );
}

function formatScopedIssueKeysByWindowSummary(scopedIssueKeysByWindowKey) {
  const safeScopedIssueKeysByWindowKey =
    scopedIssueKeysByWindowKey && typeof scopedIssueKeysByWindowKey === "object"
      ? scopedIssueKeysByWindowKey
      : null;
  if (!safeScopedIssueKeysByWindowKey) return "";

  return Object.entries(safeScopedIssueKeysByWindowKey)
    .map(
      ([windowKey, issueKeysByTeam]) =>
        `${windowKey} ${PR_CYCLE_TEAM_KEYS.map((teamKey) => `${teamKey} ${issueKeysByTeam?.[teamKey]?.size || 0}`).join(", ")}`
    )
    .join(" | ");
}

function resolveTrendPointDateForSprint(sprint, { pointMode, mondayAnchor, todayIso = "" }) {
  const pickedDate =
    pointMode === "start"
      ? isoDateOnly(sprint?.startDate)
      : isoDateOnly(sprint?.endDate || sprint?.completeDate || sprint?.startDate);
  if (!pickedDate) return "";
  const normalizedDate = mondayAnchor ? toMondayAnchor(pickedDate) : pickedDate;
  return capIsoDateAt(normalizedDate, todayIso);
}

function applyTrendDateCap(dates, todayIso = "") {
  return Array.from(
    new Set(
      (Array.isArray(dates) ? dates : [])
        .map((date) => capIsoDateAt(date, todayIso))
        .filter(Boolean)
    )
  ).sort();
}

function findLatestActiveTrendDate(
  sprints,
  { pointMode, mondayAnchor, sinceDate = "", todayIso = "" }
) {
  let latest = "";
  for (const sprint of Array.isArray(sprints) ? sprints : []) {
    const state = String(sprint?.state || "").toLowerCase();
    if (state !== "active") continue;
    const pointDate = resolveTrendPointDateForSprint(sprint, {
      pointMode,
      mondayAnchor,
      todayIso
    });
    if (!pointDate) continue;
    if (sinceDate && pointDate < sinceDate) continue;
    if (!latest || pointDate > latest) latest = pointDate;
  }
  return latest;
}

function isTrendDateCacheEntryReusable(entry, todayIso = "") {
  const safeToday = isoDateOnly(todayIso);
  if (!safeToday) return true;
  const activeDate = isoDateOnly(entry?.activeDate);
  if (activeDate) return safeToday <= activeDate;
  const updatedAt = isoDateOnly(entry?.updatedAt);
  if (!updatedAt) return true;
  const ageDays = daysBetweenIsoDates(updatedAt, safeToday);
  return ageDays >= 0 && ageDays <= TREND_DATE_CACHE_FALLBACK_TTL_DAYS;
}

function buildTrendDatesFromSprints(
  sprints,
  { lookbackCount, pointMode, includeActive, mondayAnchor, sinceDate = "", todayIso = "" }
) {
  const dates = [];

  for (const sprint of sprints) {
    const state = String(sprint?.state || "").toLowerCase();
    const isClosed = state === "closed";
    const isActive = state === "active";
    if (!isClosed && !(includeActive && isActive)) continue;

    const clampedDate = resolveTrendPointDateForSprint(sprint, {
      pointMode,
      mondayAnchor,
      todayIso
    });
    if (!clampedDate) continue;
    if (sinceDate && clampedDate < sinceDate) continue;
    dates.push(clampedDate);
  }

  const uniqueSorted = Array.from(new Set(dates)).sort();
  if (!Number.isFinite(lookbackCount) || lookbackCount <= 0) return uniqueSorted;
  if (uniqueSorted.length <= lookbackCount) return uniqueSorted;
  return uniqueSorted.slice(-lookbackCount);
}

function buildTrendDateCacheKey(site, options = {}) {
  return JSON.stringify({
    site: String(site || "").trim(),
    projectKey: String(options.projectKey || "").trim(),
    boardId: String(options.boardId || "").trim(),
    lookbackCount: Number(options.lookbackCount || 0),
    pointMode: String(options.pointMode || "").trim(),
    includeActive: Boolean(options.includeActive),
    mondayAnchor: Boolean(options.mondayAnchor),
    sinceDate: String(options.sinceDate || "").trim()
  });
}

function readTrendDateCacheEntry(cacheByKey, cacheKey, todayIso = "") {
  const entry = cacheByKey?.[String(cacheKey || "").trim()];
  if (!entry || typeof entry !== "object") return null;
  if (!isTrendDateCacheEntryReusable(entry, todayIso)) return null;
  const rawDates = Array.isArray(entry.rawDates)
    ? entry.rawDates.filter(Boolean)
    : Array.isArray(entry.dates)
      ? entry.dates.filter(Boolean)
      : [];
  const rawClosedDates = Array.isArray(entry.rawClosedDates)
    ? entry.rawClosedDates.filter(Boolean)
    : Array.isArray(entry.closedDates)
      ? entry.closedDates.filter(Boolean)
      : [];
  const dates = applyTrendDateCap(rawDates, todayIso);
  const closedDates = applyTrendDateCap(rawClosedDates, todayIso);
  if (dates.length === 0) return null;
  return {
    dates,
    closedDates: closedDates.length > 0 ? closedDates : dates
  };
}

function createTrendDateCacheEntry({ rawDates, rawClosedDates, activeDate }) {
  const safeRawDates = Array.isArray(rawDates) ? rawDates.filter(Boolean) : [];
  if (safeRawDates.length === 0) return null;
  const safeRawClosedDates = Array.isArray(rawClosedDates) ? rawClosedDates.filter(Boolean) : [];
  return {
    updatedAt: new Date().toISOString(),
    rawDates: safeRawDates,
    rawClosedDates: safeRawClosedDates.length > 0 ? safeRawClosedDates : safeRawDates,
    activeDate: isoDateOnly(activeDate)
  };
}

function readIssueUpdatedAt(issue) {
  return isoDateTime(issue?.fields?.updated) || String(issue?.fields?.updated || "").trim();
}

export async function resolveTrendDates(site, email, token, options) {
  const {
    fallbackDates,
    projectKey,
    boardId,
    lookbackCount,
    pointMode,
    includeActive,
    mondayAnchor,
    todayIso = "",
    sinceDate = "",
    useCache = true,
    readCache = readJsonFile,
    writeCache = writeJsonAtomic,
    fetchBoards = fetchScrumBoards,
    fetchSprints = fetchSprintsForBoard
  } = options;
  const cacheEnabled = useCache !== false;
  const cacheKey = buildTrendDateCacheKey(site, {
    projectKey,
    boardId,
    lookbackCount,
    pointMode,
    includeActive,
    mondayAnchor,
    sinceDate
  });
  const trendDateCache = cacheEnabled ? await readCache(TREND_DATE_CACHE_PATH) : null;
  const trendDateCacheByKey =
    trendDateCache?.entries && typeof trendDateCache.entries === "object"
      ? { ...trendDateCache.entries }
      : {};
  const cachedResolvedDates = cacheEnabled
    ? readTrendDateCacheEntry(trendDateCacheByKey, cacheKey, todayIso)
    : null;
  if (cachedResolvedDates) {
    return {
      ...cachedResolvedDates,
      usedFallback: false
    };
  }

  try {
    const boardIds = [];
    if (boardId) {
      boardIds.push(boardId);
    } else {
      const boards = await fetchBoards(site, email, token, projectKey);
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
      const sprints = await fetchSprints(site, email, token, id);
      for (const sprint of sprints) {
        if (sprint?.id === undefined || sprint?.id === null) continue;
        sprintById.set(String(sprint.id), sprint);
      }
    }

    const sprintValues = Array.from(sprintById.values());
    const rawDates = buildTrendDatesFromSprints(sprintValues, {
      lookbackCount,
      pointMode,
      includeActive,
      mondayAnchor,
      todayIso: "",
      sinceDate
    });
    const rawClosedDates = buildTrendDatesFromSprints(sprintValues, {
      lookbackCount: 0,
      pointMode,
      includeActive: false,
      mondayAnchor,
      todayIso: "",
      sinceDate
    });
    const dates = applyTrendDateCap(rawDates, todayIso);
    const closedDates = applyTrendDateCap(rawClosedDates, todayIso);

    if (dates.length === 0) {
      throw new Error("No sprint dates resolved from Jira Agile API.");
    }

    const resolvedDates = {
      dates,
      closedDates,
      usedFallback: false
    };
    const cacheEntry = cacheEnabled
      ? createTrendDateCacheEntry({
          rawDates,
          rawClosedDates,
          activeDate: findLatestActiveTrendDate(sprintValues, {
            pointMode,
            mondayAnchor,
            sinceDate
          })
        })
      : null;
    if (cacheEntry) {
      trendDateCacheByKey[cacheKey] = cacheEntry;
      await writeCache(TREND_DATE_CACHE_PATH, TREND_DATE_CACHE_TMP_PATH, {
        updatedAt: new Date().toISOString(),
        entries: trendDateCacheByKey
      });
    }

    return resolvedDates;
  } catch (error) {
    const filteredFallbackDates = (Array.isArray(fallbackDates) ? fallbackDates : []).filter(
      (date) => !sinceDate || String(date || "") >= sinceDate
    );
    return {
      dates: filteredFallbackDates,
      closedDates: filteredFallbackDates,
      usedFallback: true,
      fallbackReason: error?.message || String(error)
    };
  }
}

async function fetchIssueChangelog(site, email, token, issueKey) {
  const cacheKey = `${site}:${String(issueKey || "").trim()}`;
  if (ISSUE_CHANGELOG_CACHE.has(cacheKey)) {
    return ISSUE_CHANGELOG_CACHE.get(cacheKey);
  }

  const promise = (async () => {
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
  })();

  ISSUE_CHANGELOG_CACHE.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    ISSUE_CHANGELOG_CACHE.delete(cacheKey);
    throw error;
  }
}

function clearIssueChangelogCache() {
  ISSUE_CHANGELOG_CACHE.clear();
}

function readPrCycleChangelogCacheEntry(cacheByIssueKey, issueKey, issueUpdatedAt) {
  const safeIssueKey = String(issueKey || "").trim();
  const safeIssueUpdatedAt = String(issueUpdatedAt || "").trim();
  if (!safeIssueKey || !safeIssueUpdatedAt) return null;

  const entry = cacheByIssueKey?.[safeIssueKey];
  if (!entry || typeof entry !== "object") return null;
  if (String(entry.issueUpdatedAt || "").trim() !== safeIssueUpdatedAt) return null;
  if (!entry.changelog || typeof entry.changelog !== "object") return null;
  return entry.changelog;
}

function createPrCycleChangelogCacheEntry(issueUpdatedAt, changelog) {
  const safeIssueUpdatedAt = String(issueUpdatedAt || "").trim();
  if (!safeIssueUpdatedAt || !changelog || typeof changelog !== "object") return null;
  return {
    issueUpdatedAt: safeIssueUpdatedAt,
    changelog
  };
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
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildPrCycleWindowConfigs(todayIso) {
  const safeToday = String(todayIso || "").trim();
  return [
    {
      key: FOURTEEN_DAY_WINDOW_KEY,
      windowDays: 14,
      windowLabel: "Last 14 days",
      windowStartDate: shiftIsoDate(safeToday, -13),
      scopedToBoardWork: true
    },
    {
      key: "30d",
      windowDays: 30,
      windowLabel: "Last 30 days",
      windowStartDate: shiftIsoDate(safeToday, -29),
      scopedToBoardWork: true
    },
    {
      key: "90d",
      windowDays: 90,
      windowLabel: "Last 90 days",
      windowStartDate: shiftIsoDate(safeToday, -89),
      scopedToBoardWork: true
    },
    {
      key: "6m",
      windowDays: 183,
      windowLabel: "Last 6 months",
      windowStartDate: shiftIsoMonths(safeToday, -6),
      scopedToBoardWork: true
    },
    {
      key: "1y",
      windowDays: 365,
      windowLabel: "Last year",
      windowStartDate: shiftIsoMonths(safeToday, -12),
      scopedToBoardWork: true
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

function shouldIncludePrCycleIssueForWindow(baseRow, config) {
  if (!config?.scopedToBoardWork) return true;
  const scopedIssueKeysByTeam =
    config?.scopedIssueKeysByTeam && typeof config.scopedIssueKeysByTeam === "object"
      ? config.scopedIssueKeysByTeam
      : null;
  if (!scopedIssueKeysByTeam) return true;

  const issueKey = String(baseRow?.issueKey || "").trim();
  const teamKey = String(baseRow?.team || "")
    .trim()
    .toLowerCase();
  const scopedIssueKeys = scopedIssueKeysByTeam[teamKey];
  if (scopedIssueKeys instanceof Set) return scopedIssueKeys.has(issueKey);
  if (Array.isArray(scopedIssueKeys)) return scopedIssueKeys.includes(issueKey);
  return false;
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

function buildPrCycleTrackedStatusSet(config) {
  return new Set(getPrCycleTrackedStatuses(config).map((status) => normalizeStatusName(status)));
}

function buildPrCycleStatusHistoryClauses(statuses, windowStartDate) {
  const safeStatuses = normalizeStringList(statuses);
  const safeWindowStartDate = String(windowStartDate || "").trim();
  if (safeStatuses.length === 0 || !safeWindowStartDate) return [];

  return safeStatuses.flatMap((status) => {
    const safeStatus = quoteJqlValue(status);
    const safeDate = quoteJqlValue(safeWindowStartDate);
    return [
      `status CHANGED TO ${safeStatus} AFTER ${safeDate}`,
      `status CHANGED FROM ${safeStatus} AFTER ${safeDate}`
    ];
  });
}

function isIsoDateOnOrAfter(value, threshold) {
  const safeValue = isoDateOnly(value);
  const safeThreshold = isoDateOnly(threshold);
  if (!safeValue || !safeThreshold) return false;
  return safeValue >= safeThreshold;
}

function shouldFetchPrCycleIssueBase(issue, config, trackedStatusSet) {
  const currentStatusTracked = trackedStatusSet.has(
    normalizeStatusName(issue?.fields?.status?.name || "")
  );
  if (currentStatusTracked) return true;

  const currentStatusCategory = normalizeStatusName(issue?.fields?.status?.statusCategory?.name);
  if (currentStatusCategory !== "done") return true;

  const terminalDate = latestIsoDate([
    issue?.fields?.resolutiondate,
    issue?.fields?.statuscategorychangedate
  ]);
  if (!terminalDate) return true;
  return terminalDate >= String(config?.windowStartDate || "").trim();
}

export async function fetchPrCycleIssueBreakdown(site, email, token, config, options = {}) {
  const {
    useCache = true,
    readCache = readJsonFile,
    writeCache = writeJsonAtomic,
    searchIssues = searchJiraIssues,
    fetchChangelog = fetchIssueChangelog,
    changelogConcurrency = PR_CYCLE_CHANGELOG_CONCURRENCY
  } = options;
  const cacheEnabled = useCache !== false;
  const projectClause = config.projectKeys
    .map((projectKey) => quoteJqlValue(projectKey))
    .join(", ");
  const labelClause = Object.keys(PR_TEAM_LABELS)
    .map((label) => quoteJqlValue(label))
    .join(", ");
  const trackedStatusList = getPrCycleTrackedStatuses(config);
  const trackedStatuses = trackedStatusList.map((status) => quoteJqlValue(status)).join(", ");
  const historyClauses = buildPrCycleStatusHistoryClauses(
    trackedStatusList,
    config.windowStartDate
  );
  const jql = [
    `project in (${projectClause})`,
    `AND labels in (${labelClause})`,
    `AND (${[`status in (${trackedStatuses})`, ...historyClauses].join(" OR ")})`
  ].join(" ");

  const issues = await searchIssues(site, email, token, jql, [
    "labels",
    "status",
    "created",
    "updated",
    "resolutiondate",
    "statuscategorychangedate"
  ]);
  console.log(`Fetched ${issues.length} PR cycle candidate issues for ${config.windowLabel}.`);
  const trackedStatusSet = buildPrCycleTrackedStatusSet(config);
  const candidateCounts = issues.reduce(
    (counts, issue) => {
      const currentStatusTracked = trackedStatusSet.has(
        normalizeStatusName(issue?.fields?.status?.name || "")
      );
      const recentlyUpdated = isIsoDateOnOrAfter(issue?.fields?.updated, config.windowStartDate);
      if (currentStatusTracked && recentlyUpdated) counts.both += 1;
      else if (currentStatusTracked) counts.trackedOnly += 1;
      else if (recentlyUpdated) counts.updatedOnly += 1;
      else counts.other += 1;
      return counts;
    },
    { trackedOnly: 0, updatedOnly: 0, both: 0, other: 0 }
  );
  const issuesToAnalyze = issues.filter((issue) =>
    shouldFetchPrCycleIssueBase(issue, config, trackedStatusSet)
  );
  const changelogCache = cacheEnabled ? await readCache(PR_CYCLE_CHANGELOG_CACHE_PATH) : null;
  const changelogCacheByIssueKey =
    changelogCache?.issues && typeof changelogCache.issues === "object"
      ? { ...changelogCache.issues }
      : {};
  const prunedCount = issues.length - issuesToAnalyze.length;
  console.log(
    `PR cycle candidate composition for ${config.windowLabel}: updated-only ${candidateCounts.updatedOnly}, tracked-only ${candidateCounts.trackedOnly}, both ${candidateCounts.both}${prunedCount > 0 ? `; pruned ${prunedCount} stale done issues before changelog fetch` : ""}.`
  );
  const issueResults = await mapWithConcurrency(
    issuesToAnalyze,
    changelogConcurrency,
    async (issue) => {
      const issueKey = String(issue?.key || "").trim();
      if (!issueKey) return null;
      const issueUpdatedAt = readIssueUpdatedAt(issue);
      const cachedChangelog = readPrCycleChangelogCacheEntry(
        changelogCacheByIssueKey,
        issueKey,
        issueUpdatedAt
      );
      if (cachedChangelog) {
        return {
          row: summarizePrCycleIssueBase(issue, cachedChangelog, config),
          cacheHit: true,
          cacheEntry: null,
          issueKey
        };
      }

      const changelog = await fetchChangelog(site, email, token, issueKey);
      return {
        row: summarizePrCycleIssueBase(issue, changelog, config),
        cacheHit: false,
        cacheEntry: createPrCycleChangelogCacheEntry(issueUpdatedAt, changelog),
        issueKey
      };
    }
  );
  let changelogCacheWriteCount = 0;
  for (const issueResult of issueResults) {
    const safeIssueKey = String(issueResult?.issueKey || "").trim();
    if (!safeIssueKey || !issueResult?.cacheEntry) continue;
    changelogCacheByIssueKey[safeIssueKey] = issueResult.cacheEntry;
    changelogCacheWriteCount += 1;
  }
  if (cacheEnabled && changelogCacheWriteCount > 0) {
    await writeCache(PR_CYCLE_CHANGELOG_CACHE_PATH, PR_CYCLE_CHANGELOG_CACHE_TMP_PATH, {
      updatedAt: new Date().toISOString(),
      issues: changelogCacheByIssueKey
    });
  }

  return {
    rows: issueResults.map((result) => result?.row).filter(Boolean),
    changelogCacheHitCount: issueResults.reduce(
      (sum, result) => sum + (result?.cacheHit ? 1 : 0),
      0
    ),
    changelogCacheWriteCount
  };
}

function summarizePrCycleIssueForWindow(baseRow, config) {
  if (!shouldIncludePrCycleIssueForWindow(baseRow, config)) return null;
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
    windowLabel: config.windowLabel,
    teams
  };
}

function shiftPrActivityIsoDate(dateText, deltaDays = 0, deltaMonths = 0) {
  const date = new Date(`${String(dateText || "")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  if (deltaMonths !== 0) date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  if (deltaDays !== 0) date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function getPrActivityWindowPoints(points, windowKey) {
  const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
  if (safePoints.length === 0) return [];
  const latestDate = String(safePoints[safePoints.length - 1]?.date || "").trim();
  if (!latestDate) return safePoints;
  let startDate = latestDate;
  if (windowKey === FOURTEEN_DAY_WINDOW_KEY) startDate = shiftPrActivityIsoDate(latestDate, -13, 0);
  else if (windowKey === "30d") startDate = shiftPrActivityIsoDate(latestDate, -29, 0);
  else if (windowKey === "90d") startDate = shiftPrActivityIsoDate(latestDate, -89, 0);
  else if (windowKey === "6m") startDate = shiftPrActivityIsoDate(latestDate, 0, -6);
  else if (windowKey === "1y") startDate = shiftPrActivityIsoDate(latestDate, 0, -12);
  return safePoints.filter((point) => String(point?.date || "").trim() >= startDate);
}

function buildPrCycleAvgInflowByTeam(prActivity, windowKey) {
  const windowPoints = getPrActivityWindowPoints(prActivity?.points, windowKey);
  return Object.fromEntries(
    PR_CYCLE_TEAM_KEYS.map((teamKey) => {
      const inflowValues = windowPoints
        .map((point) => Number(point?.[teamKey]?.offered))
        .filter((value) => Number.isFinite(value));
      return [
        teamKey,
        inflowValues.length > 0
          ? Number((inflowValues.reduce((sum, value) => sum + value, 0) / inflowValues.length).toFixed(1))
          : null
      ];
    })
  );
}

export function attachPrCycleAvgInflow(prCycleSnapshot, prActivity) {
  if (!prCycleSnapshot?.windows || typeof prCycleSnapshot.windows !== "object") return prCycleSnapshot;
  const hasPrActivityPoints = Array.isArray(prActivity?.points) && prActivity.points.length > 0;
  if (!hasPrActivityPoints) return prCycleSnapshot;
  const windows = Object.fromEntries(
    Object.entries(prCycleSnapshot.windows).map(([windowKey, windowSnapshot]) => {
      const inflowByTeamKey = buildPrCycleAvgInflowByTeam(prActivity, windowKey);
      return [
        windowKey,
        {
          ...windowSnapshot,
          teams: (Array.isArray(windowSnapshot?.teams) ? windowSnapshot.teams : []).map((team) => ({
            ...team,
            avgPrInflow:
              inflowByTeamKey[String(team?.key || "").trim().toLowerCase()] ?? team?.avgPrInflow ?? null
          }))
        }
      ];
    })
  );
  return {
    ...prCycleSnapshot,
    windows
  };
}

async function loadPersistedPrActivity() {
  for (const snapshotPath of [PR_ACTIVITY_SNAPSHOT_PATH, PRIMARY_SNAPSHOT_PATH]) {
    const snapshot = await readJsonFile(snapshotPath);
    if (snapshot?.prActivity && typeof snapshot.prActivity === "object") {
      return snapshot.prActivity;
    }
  }

  return null;
}

function buildPrCycleSnapshot(rows, config) {
  const windowEntries = (Array.isArray(config.windows) ? config.windows : []).map(
    (windowConfig) => [
      windowConfig.key,
      buildPrCycleWindowSnapshot(rows, {
        ...config,
        ...windowConfig
      })
    ]
  );
  const windowSnapshots = Object.fromEntries(windowEntries);
  return finalizePrCycleSnapshot(windowSnapshots, config);
}

function finalizePrCycleSnapshot(windowSnapshots, config = {}) {
  const defaultWindow = String(config.defaultWindow || PR_CYCLE_WINDOW_DEFAULT_KEY)
    .trim()
    .toLowerCase();
  const windowEntries = Object.entries(
    windowSnapshots && typeof windowSnapshots === "object" ? windowSnapshots : {}
  );
  const fallbackEntry = windowEntries.find(([key]) => key === defaultWindow) ||
    windowEntries.find(([key]) => key === PR_CYCLE_WINDOW_DEFAULT_KEY) ||
    windowEntries[0] || ["", { windowLabel: "", teams: [] }];
  const [fallbackWindowKey, fallbackWindow] = fallbackEntry;
  const defaultTeam = fallbackWindow.teams.some((team) => team.key === "bc")
    ? "bc"
    : String(fallbackWindow.teams[0]?.key || "");

  return {
    updatedAt: new Date().toISOString(),
    defaultWindow: fallbackWindowKey || defaultWindow,
    defaultTeam,
    windows: windowSnapshots
  };
}

function snapshotAgeInDays(updatedAt) {
  const timestamp = new Date(String(updatedAt || "")).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / 86400000;
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

function readPullRequestSummaryLastUpdatedAt(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw.includes("pullrequest={")) return "";
  const match = raw.match(/"lastUpdated":"([^"]+)"/);
  return isoDateTime(match?.[1] || "");
}

function readPullRequestSummaryLastUpdated(rawValue) {
  return isoDateOnly(readPullRequestSummaryLastUpdatedAt(rawValue));
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

function isIgnoredPrActivityArtifact(issueKey, pullRequest) {
  const safeIssueKey = String(issueKey || "").trim();
  const safePullRequestKey = pullRequestUniqueKey(pullRequest);
  if (!safeIssueKey || !safePullRequestKey) return false;
  return PR_ACTIVITY_ARTIFACT_PULL_REQUEST_KEYS.has(`${safeIssueKey}|${safePullRequestKey}`);
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

function resolveIssueMergedProxyDate(issueKey, details) {
  const mergedDates = [];

  for (const detail of details ?? []) {
    for (const pullRequest of detail?.pullRequests ?? []) {
      if (isIgnoredPrActivityArtifact(issueKey, pullRequest)) continue;
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
  const issueKey = String(issue?.key || "").trim();
  const team = teamKeyFromLabels(issue?.fields?.labels ?? []);
  if (!team) return [];

  const records = [];

  for (const detail of details ?? []) {
    const branches = Array.isArray(detail?.branches) ? detail.branches : [];
    const pullRequests = Array.isArray(detail?.pullRequests) ? detail.pullRequests : [];

    for (const pullRequest of pullRequests) {
      if (isIgnoredPrActivityArtifact(issueKey, pullRequest)) continue;
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
        issueKey
      });
    }
  }

  return records;
}

function normalizeTicketReviewToMergeRecord(issue, details, changelog) {
  const issueKey = String(issue?.key || "").trim();
  const team = teamKeyFromLabels(issue?.fields?.labels ?? []);
  if (!team) return null;

  const reviewStartedAt = isoDateOnly(findFirstEnteredStatus(changelog, PR_REVIEW_STATUS));
  const mergedProxyDate = resolveIssueMergedProxyDate(issueKey, details);
  if (!reviewStartedAt || !mergedProxyDate) return null;

  const reviewToMergeDays = daysBetweenIsoDates(reviewStartedAt, mergedProxyDate);
  if (reviewToMergeDays < 0) return null;

  return {
    issueKey,
    team,
    reviewStartedAt,
    mergedProxyDate,
    reviewToMergeDays
  };
}

function pullRequestRecordTouchesSinceDate(record, safeSinceDate) {
  const offeredProxyDate = isoDateOnly(record?.offeredProxyDate);
  const mergedProxyDate = isoDateOnly(record?.mergedProxyDate);
  return (
    (offeredProxyDate && offeredProxyDate >= safeSinceDate) ||
    (mergedProxyDate && mergedProxyDate >= safeSinceDate)
  );
}

function readPrActivityIssueCacheEntry(cacheByIssueKey, issueKey, summaryLastUpdatedAt) {
  const safeIssueKey = String(issueKey || "").trim();
  const safeSummaryLastUpdatedAt = String(summaryLastUpdatedAt || "").trim();
  if (!safeIssueKey || !safeSummaryLastUpdatedAt) return null;

  const entry = cacheByIssueKey?.[safeIssueKey];
  if (!entry || typeof entry !== "object") return null;
  if (String(entry.summaryLastUpdatedAt || "").trim() !== safeSummaryLastUpdatedAt) return null;

  return {
    pullRequestRecords: Array.isArray(entry.pullRequestRecords) ? entry.pullRequestRecords : [],
    ticketReviewToMergeRecord:
      entry.ticketReviewToMergeRecord && typeof entry.ticketReviewToMergeRecord === "object"
        ? entry.ticketReviewToMergeRecord
        : null
  };
}

function createPrActivityIssueCacheEntry(summaryLastUpdatedAt, issueResult) {
  const safeSummaryLastUpdatedAt = String(summaryLastUpdatedAt || "").trim();
  if (!safeSummaryLastUpdatedAt) return null;

  return {
    summaryLastUpdatedAt: safeSummaryLastUpdatedAt,
    pullRequestRecords: Array.isArray(issueResult?.pullRequestRecords)
      ? issueResult.pullRequestRecords
      : [],
    ticketReviewToMergeRecord:
      issueResult?.ticketReviewToMergeRecord &&
      typeof issueResult.ticketReviewToMergeRecord === "object"
        ? issueResult.ticketReviewToMergeRecord
        : null
  };
}

async function fetchJiraPrActivity(site, email, token, sinceDate, options = {}) {
  const labelClause = Object.keys(PR_TEAM_LABELS)
    .map((label) => quoteJqlValue(label))
    .join(", ");
  const projectClause = PR_ACTIVITY_PROJECT_KEYS.map((projectKey) =>
    quoteJqlValue(projectKey)
  ).join(", ");
  const jql = [`project in (${projectClause})`, `AND labels in (${labelClause})`].join(" ");

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
  const safeSinceDate = isoDateOnly(sinceDate);
  const prActivityIssueCache =
    options.useCache === false ? null : await readJsonFile(PR_ACTIVITY_ISSUE_CACHE_PATH);
  const prActivityIssueCacheByIssueKey =
    prActivityIssueCache?.issues && typeof prActivityIssueCache.issues === "object"
      ? { ...prActivityIssueCache.issues }
      : {};
  const activeCandidateIssues = candidateIssues.filter((issue) => {
    const summaryLastUpdated = readPullRequestSummaryLastUpdated(issue?.fields?.[PR_SUMMARY_FIELD]);
    return !summaryLastUpdated || summaryLastUpdated >= safeSinceDate;
  });

  const issueResults = await mapWithConcurrency(
    activeCandidateIssues,
    PR_DETAIL_CONCURRENCY,
    async (issue) => {
      const issueKey = String(issue?.key || "").trim();
      const summaryLastUpdatedAt = readPullRequestSummaryLastUpdatedAt(
        issue?.fields?.[PR_SUMMARY_FIELD]
      );
      const cachedIssueResult = readPrActivityIssueCacheEntry(
        prActivityIssueCacheByIssueKey,
        issueKey,
        summaryLastUpdatedAt
      );
      if (cachedIssueResult) {
        return {
          pullRequestRecords: cachedIssueResult.pullRequestRecords.filter((record) =>
            pullRequestRecordTouchesSinceDate(record, safeSinceDate)
          ),
          ticketReviewToMergeRecord: cachedIssueResult.ticketReviewToMergeRecord,
          reviewChangelogFetched: false,
          cacheHit: true,
          cacheEntry: null,
          issueKey
        };
      }

      const details = await fetchIssuePullRequestDetails(site, email, token, issue.id);
      const allPullRequestRecords = normalizePullRequestRecords(issue, details);
      const pullRequestRecords = allPullRequestRecords.filter((record) =>
        pullRequestRecordTouchesSinceDate(record, safeSinceDate)
      );
      const shouldFetchReviewChangelog = allPullRequestRecords.some(
        (record) =>
          String(record?.status || "")
            .trim()
            .toUpperCase() === "MERGED"
      );
      const changelog = shouldFetchReviewChangelog
        ? await fetchIssueChangelog(site, email, token, issue.key)
        : null;
      const ticketReviewToMergeRecord =
        shouldFetchReviewChangelog && changelog
          ? normalizeTicketReviewToMergeRecord(issue, details, changelog)
          : null;
      return {
        pullRequestRecords,
        ticketReviewToMergeRecord,
        reviewChangelogFetched: shouldFetchReviewChangelog,
        cacheHit: false,
        cacheEntry: createPrActivityIssueCacheEntry(summaryLastUpdatedAt, {
          pullRequestRecords: allPullRequestRecords,
          ticketReviewToMergeRecord
        }),
        issueKey
      };
    }
  );

  let cacheWriteCount = 0;
  for (const issueResult of issueResults) {
    const safeIssueKey = String(issueResult?.issueKey || "").trim();
    if (!safeIssueKey || !issueResult?.cacheEntry) continue;
    prActivityIssueCacheByIssueKey[safeIssueKey] = issueResult.cacheEntry;
    cacheWriteCount += 1;
  }
  if (cacheWriteCount > 0) {
    await writeJsonAtomic(PR_ACTIVITY_ISSUE_CACHE_PATH, PR_ACTIVITY_ISSUE_CACHE_TMP_PATH, {
      updatedAt: new Date().toISOString(),
      issues: prActivityIssueCacheByIssueKey
    });
  }

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

  const filteredRecords = Array.from(uniquePullRequests.values()).filter((record) => {
    const offeredProxyDate = isoDateOnly(record.offeredProxyDate);
    const mergedProxyDate = isoDateOnly(record.mergedProxyDate);
    return (
      (offeredProxyDate && offeredProxyDate >= safeSinceDate) ||
      (mergedProxyDate && mergedProxyDate >= safeSinceDate)
    );
  });
  const filteredReviewToMergeRecords = issueResults
    .map((result) => result.ticketReviewToMergeRecord)
    .filter(Boolean)
    .filter((record) => {
      const mergedProxyDate = isoDateOnly(record?.mergedProxyDate);
      return mergedProxyDate && mergedProxyDate >= safeSinceDate;
    });
  const reviewChangelogIssueCount = issueResults.reduce(
    (sum, result) => sum + (result?.reviewChangelogFetched ? 1 : 0),
    0
  );
  const cacheHitCount = issueResults.reduce((sum, result) => sum + (result?.cacheHit ? 1 : 0), 0);

  return {
    source: "jira_dev_status_detail",
    candidateIssueCount: candidateIssues.length,
    detailIssueCount: activeCandidateIssues.length,
    uniquePrCount: filteredRecords.length,
    conflictCount,
    reviewChangelogIssueCount,
    cacheHitCount,
    cacheWriteCount,
    records: filteredRecords,
    ticketReviewToMergeRecords: filteredReviewToMergeRecords
  };
}

async function fetchPrActivity(site, email, token, sinceDate, options = {}) {
  const prActivitySource = normalizePrActivitySource(options.prActivitySource);
  if (prActivitySource !== PR_ACTIVITY_SOURCE_GITHUB) {
    return fetchJiraPrActivity(site, email, token, sinceDate, options);
  }
  return fetchGitHubPrActivity(sinceDate, options);
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

function buildPrActivityPoints(byDate, dates) {
  return (Array.isArray(dates) ? dates : []).map((date) =>
    TEAM_KEYS.reduce(
      (point, team) => {
        point[team] = buildPrPointForTeam(byDate, date, team);
        return point;
      },
      { date }
    )
  );
}

function buildPrActivityCaveat(source) {
  const safeSource = String(source || "").trim().toLowerCase();
  if (safeSource === "github_pull_requests") {
    return "Counts are sourced from GitHub pull requests and attributed by committed repo-to-team mapping. Opened counts use non-draft PR createdAt, merged counts use mergedAt, sprint trend points render only closed sprints, and review-to-merge time uses the latest submitted GitHub review to mergedAt.";
  }
  return "Counts are deduped from Jira dev-status pull request records and attributed by Jira team label. Inflow dates use the earliest available PR lastUpdate and source-branch last commit timestamp, then are bucketed to Jira sprint points. Merged dates use Jira PR lastUpdate as a merge proxy and are bucketed to the corresponding sprint point. Review-to-merge time is a ticket proxy: first Jira In Review status to linked merged PR proxy date. Multiple done Jira tickets can still map to the same underlying PR.";
}

function buildPrimarySnapshotSourceNote(prActivitySource) {
  const safeSource = String(prActivitySource || "").trim().toLowerCase();
  const prActivityNote =
    safeSource === "github_pull_requests"
      ? "PR activity is sourced from GitHub pull requests and attributed by committed repo-to-team mapping."
      : "PR activity is derived from Jira dev-status pull request details.";
  return `Backlog trends are generated from Jira historical JQL snapshots (status and priority as-of each date). Business Unit UAT flow is generated from Jira issue changelogs. ${prActivityNote}`;
}

function buildPrActivitySprintSnapshot(result, sinceDate, sprintDates) {
  const dates = Array.from(
    new Set((Array.isArray(sprintDates) ? sprintDates : []).filter(Boolean))
  ).sort();
  const byDate = new Map(dates.map((date) => [date, createEmptyPrActivityBuckets()]));
  const minimumDate = isoDateOnly(sinceDate);
  const maximumDate = String(dates[dates.length - 1] || "").trim();

  for (const row of result.records ?? []) {
    const offeredDate = isoDateOnly(row.offeredProxyDate);
    const offeredInRange =
      offeredDate &&
      (!minimumDate || offeredDate >= minimumDate) &&
      (!maximumDate || offeredDate <= maximumDate);
    if (offeredInRange) {
      const offeredBucketDate = resolveSprintBucketDate(offeredDate, dates);
      const offeredPoint = byDate.get(offeredBucketDate);
      if (offeredPoint) offeredPoint[row.team].offered += 1;
    }

    if (row.status === "MERGED") {
      const mergedDate = isoDateOnly(row.mergedProxyDate);
      const mergedInRange =
        mergedDate &&
        (!minimumDate || mergedDate >= minimumDate) &&
        (!maximumDate || mergedDate <= maximumDate);
      if (mergedInRange) {
        const mergedBucketDate = resolveSprintBucketDate(mergedDate, dates);
        const mergedPoint = byDate.get(mergedBucketDate);
        if (mergedPoint) mergedPoint[row.team].merged += 1;
      }
    }
  }

  for (const row of result.ticketReviewToMergeRecords ?? []) {
    const mergedDate = isoDateOnly(row.mergedProxyDate);
    const mergedInRange =
      mergedDate &&
      (!minimumDate || mergedDate >= minimumDate) &&
      (!maximumDate || mergedDate <= maximumDate);
    if (mergedInRange) {
      const mergedBucketDate = resolveSprintBucketDate(mergedDate, dates);
      const mergedPoint = byDate.get(mergedBucketDate);
      if (mergedPoint) {
        mergedPoint[row.team].reviewToMergeDaysTotal += row.reviewToMergeDays;
        mergedPoint[row.team].avgReviewToMergeSampleCount += 1;
      }
    }
  }

  return {
    since: sinceDate,
    interval: "sprint",
    monthlyInterval: "month",
    source: String(result?.source || "jira_dev_status_detail").trim() || "jira_dev_status_detail",
    candidateIssueCount: numberOrZero(result.candidateIssueCount),
    uniquePrCount: numberOrZero(result.uniquePrCount),
    conflictCount: numberOrZero(result.conflictCount),
    caveat: buildPrActivityCaveat(result?.source),
    points: buildPrActivityPoints(byDate, dates)
  };
}

function monthBucketDate(isoDate) {
  const safeDate = isoDateOnly(isoDate);
  if (!safeDate) return "";
  return `${safeDate.slice(0, 7)}-01`;
}

function buildPrActivityMonthlySnapshot(result, sinceDate, options = {}) {
  const minimumBucketDate = monthBucketDate(sinceDate);
  const maximumBucketDate = monthBucketDate(options.ceilingDate);
  const dates = new Set();
  const byDate = new Map();

  function ensureMonthBucket(date) {
    const safeDate = String(date || "").trim();
    if (!safeDate) return null;
    if (!byDate.has(safeDate)) {
      byDate.set(safeDate, createEmptyPrActivityBuckets());
    }
    dates.add(safeDate);
    return byDate.get(safeDate);
  }

  for (const row of result.records ?? []) {
    const offeredBucketDate = monthBucketDate(row.offeredProxyDate);
    const offeredBucketInRange =
      (!minimumBucketDate || !offeredBucketDate || offeredBucketDate >= minimumBucketDate) &&
      (!maximumBucketDate || !offeredBucketDate || offeredBucketDate <= maximumBucketDate);
    if (offeredBucketInRange) {
      const offeredPoint = ensureMonthBucket(offeredBucketDate);
      if (offeredPoint) offeredPoint[row.team].offered += 1;
    }

    if (row.status === "MERGED") {
      const mergedBucketDate = monthBucketDate(row.mergedProxyDate);
      const mergedBucketInRange =
        (!minimumBucketDate || !mergedBucketDate || mergedBucketDate >= minimumBucketDate) &&
        (!maximumBucketDate || !mergedBucketDate || mergedBucketDate <= maximumBucketDate);
      if (mergedBucketInRange) {
        const mergedPoint = ensureMonthBucket(mergedBucketDate);
        if (mergedPoint) mergedPoint[row.team].merged += 1;
      }
    }
  }

  for (const row of result.ticketReviewToMergeRecords ?? []) {
    const mergedBucketDate = monthBucketDate(row.mergedProxyDate);
    if (minimumBucketDate && mergedBucketDate && mergedBucketDate < minimumBucketDate) {
      continue;
    }
    if (maximumBucketDate && mergedBucketDate && mergedBucketDate > maximumBucketDate) {
      continue;
    }
    const mergedPoint = ensureMonthBucket(mergedBucketDate);
    if (mergedPoint) {
      mergedPoint[row.team].reviewToMergeDaysTotal += row.reviewToMergeDays;
      mergedPoint[row.team].avgReviewToMergeSampleCount += 1;
    }
  }

  const sortedDates = Array.from(dates).sort();
  return {
    since: sortedDates[0] || minimumBucketDate || sinceDate,
    interval: "month",
    points: buildPrActivityPoints(byDate, sortedDates)
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

async function buildBoardTrend(board, dates, site, email, token, concurrency = 1) {
  return mapWithConcurrency(dates, concurrency, async (date) => {
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
    return { date, ...counts };
  });
}

function emptyPoint(date) {
  return { date, highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
}

function buildCombinedSnapshot(computed, syncedAt, uatAging, prActivity, chartData = null) {
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
      note: buildPrimarySnapshotSourceNote(prActivity?.source)
    },
    ...(uatAging && typeof uatAging === "object" ? { uatAging } : {}),
    prActivity,
    ...(chartData && typeof chartData === "object" ? { chartData } : {}),
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

function buildPrActivitySnapshot(snapshot) {
  return sanitizePrActivitySnapshot({
    updatedAt: String(snapshot?.updatedAt || new Date().toISOString()).trim(),
    prActivity: snapshot?.prActivity
  });
}

function buildBacklogBugSnapshot(snapshot) {
  const backlogSnapshot = sanitizeBacklogSnapshot(snapshot);
  delete backlogSnapshot.prActivity;
  delete backlogSnapshot.chartData;
  delete backlogSnapshot.chartDataUpdatedAt;
  delete backlogSnapshot.uatAging;
  return backlogSnapshot;
}

function buildManagementFacilitySnapshot(snapshot) {
  return sanitizeManagementFacilitySnapshot({
    updatedAt: String(snapshot?.updatedAt || new Date().toISOString()).trim(),
    chartDataUpdatedAt: snapshot?.chartDataUpdatedAt,
    chartData: snapshot?.chartData
  });
}

async function preparePrimarySnapshotArtifacts(snapshot) {
  let existingBacklogSnapshot = null;
  try {
    const raw = await fs.readFile(BACKLOG_SNAPSHOT_PATH, "utf8");
    existingBacklogSnapshot = JSON.parse(raw);
  } catch {
    existingBacklogSnapshot = null;
  }
  const existingPrActivitySnapshot =
    (await readJsonFile(PR_ACTIVITY_SNAPSHOT_PATH)) ||
    (existingBacklogSnapshot?.prActivity && typeof existingBacklogSnapshot.prActivity === "object"
      ? {
          updatedAt: String(existingBacklogSnapshot?.updatedAt || "").trim(),
          prActivity: existingBacklogSnapshot.prActivity
        }
      : null);
  const existingManagementFacilitySnapshot =
    (await readJsonFile(MANAGEMENT_FACILITY_SNAPSHOT_PATH)) ||
    (existingBacklogSnapshot?.chartData && typeof existingBacklogSnapshot.chartData === "object"
      ? {
          updatedAt: String(existingBacklogSnapshot?.updatedAt || "").trim(),
          chartDataUpdatedAt: String(existingBacklogSnapshot?.chartDataUpdatedAt || "").trim(),
          chartData: existingBacklogSnapshot.chartData
        }
      : null);

  const shouldPreserveChartData =
    existingManagementFacilitySnapshot &&
    typeof existingManagementFacilitySnapshot === "object" &&
    existingManagementFacilitySnapshot.chartData &&
    typeof existingManagementFacilitySnapshot.chartData === "object" &&
    (!snapshot.chartData || typeof snapshot.chartData !== "object");
  const preservedChartDataUpdatedAt = shouldPreserveChartData
    ? String(
        existingManagementFacilitySnapshot.chartDataUpdatedAt ||
          existingManagementFacilitySnapshot.updatedAt ||
          snapshot?.source?.syncedAt ||
          ""
      ).trim()
    : "";
  const snapshotWithPreservedChartData = shouldPreserveChartData
    ? {
        ...snapshot,
        chartData: existingManagementFacilitySnapshot.chartData,
        ...(preservedChartDataUpdatedAt ? { chartDataUpdatedAt: preservedChartDataUpdatedAt } : {})
      }
    : snapshot;
  const backlogSnapshot = buildBacklogBugSnapshot(snapshotWithPreservedChartData);
  const prActivitySnapshot = buildPrActivitySnapshot(snapshotWithPreservedChartData);
  const managementFacilitySnapshot = buildManagementFacilitySnapshot(snapshotWithPreservedChartData);
  assertBacklogSnapshotIntegrity(existingBacklogSnapshot, backlogSnapshot);
  assertPrActivitySnapshotIntegrity(existingPrActivitySnapshot, prActivitySnapshot);
  assertManagementFacilitySnapshotIntegrity(
    existingManagementFacilitySnapshot,
    managementFacilitySnapshot
  );
  validateDashboardSnapshot("snapshot.json", snapshot);
  validateDashboardSnapshot("backlog-snapshot.json", backlogSnapshot);
  validateDashboardSnapshot("pr-activity-snapshot.json", prActivitySnapshot);
  validateDashboardSnapshot("management-facility-snapshot.json", managementFacilitySnapshot);

  return {
    snapshot,
    backlogSnapshot,
    prActivitySnapshot,
    managementFacilitySnapshot
  };
}

function getManagementBusinessUnitRowCount(snapshot, scopeKey) {
  return Array.isArray(snapshot?.chartData?.managementBusinessUnit?.byScope?.[scopeKey]?.rows)
    ? snapshot.chartData.managementBusinessUnit.byScope[scopeKey].rows.length
    : 0;
}

function assertBacklogSnapshotIntegrity(previousSnapshot, _nextSnapshot) {
  if (!previousSnapshot || typeof previousSnapshot !== "object") return;
}

function assertPrActivitySnapshotIntegrity(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot || typeof previousSnapshot !== "object") return;

  const previousMonthlyCount = countPrActivitySeriesPoints(previousSnapshot?.prActivity, "monthlyPoints");
  const nextMonthlyCount = countPrActivitySeriesPoints(nextSnapshot?.prActivity, "monthlyPoints");

  if (previousMonthlyCount >= 6 && nextMonthlyCount <= 2) {
    throw new Error(
      `Refusing to write pr-activity-snapshot.json because PR monthly history collapsed from ${previousMonthlyCount} points to ${nextMonthlyCount}.`
    );
  }
}

function assertManagementFacilitySnapshotIntegrity(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot || typeof previousSnapshot !== "object") return;

  const previousOngoingRows = getManagementBusinessUnitRowCount(previousSnapshot, "ongoing");
  const nextOngoingRows = getManagementBusinessUnitRowCount(nextSnapshot, "ongoing");
  const previousDoneRows = getManagementBusinessUnitRowCount(previousSnapshot, "done");
  const nextDoneRows = getManagementBusinessUnitRowCount(nextSnapshot, "done");

  if (previousOngoingRows > 0 && nextOngoingRows === 0) {
    throw new Error(
      `Refusing to write management-facility-snapshot.json because business-unit ongoing chart rows dropped from ${previousOngoingRows} to 0.`
    );
  }
  if (previousDoneRows > 0 && nextDoneRows === 0) {
    throw new Error(
      `Refusing to write management-facility-snapshot.json because business-unit done chart rows dropped from ${previousDoneRows} to 0.`
    );
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
      syncedAt,
      note: buildPrimarySnapshotSourceNote(prActivity?.source || existingSnapshot?.prActivity?.source)
    },
    prActivity
  };
}

function updateExistingSnapshotUat(existingSnapshot, { uatAging, chartData, syncedAt }) {
  if (!existingSnapshot || typeof existingSnapshot !== "object") {
    throw new Error("Cannot run UAT_ONLY without an existing snapshot.json to update.");
  }

  const { uatAging: existingUatAging, ...snapshotWithoutUatAging } = existingSnapshot;
  void existingUatAging;

  return {
    ...snapshotWithoutUatAging,
    updatedAt: new Date().toISOString(),
    source: {
      ...(existingSnapshot.source && typeof existingSnapshot.source === "object"
        ? existingSnapshot.source
        : {}),
      syncedAt,
      note: buildPrimarySnapshotSourceNote(existingSnapshot?.prActivity?.source)
    },
    ...(uatAging && typeof uatAging === "object" ? { uatAging } : {}),
    ...(chartData && typeof chartData === "object" ? { chartData } : {})
  };
}

function buildRefreshConfig() {
  return {
    snapshotRetentionCount: envPositiveInt(
      "SNAPSHOT_RETENTION_COUNT",
      DEFAULT_SNAPSHOT_RETENTION_COUNT
    ),
    site: env("ATLASSIAN_SITE", "nepgroup.atlassian.net"),
    email: env("ATLASSIAN_EMAIL"),
    token: env("ATLASSIAN_API_TOKEN"),
    uatProject: env("UAT_PROJECT", "TFC"),
    uatIssueType: env("UAT_ISSUE_TYPE", ""),
    uatStatus: env("UAT_STATUS", "UAT"),
    uatLabel: env("UAT_LABEL", "Broadcast"),
    prCycleOnly: envBool("PR_CYCLE_ONLY", false),
    productCycleOnly: envBool("PRODUCT_CYCLE_ONLY", false),
    prActivityOnly: envBool("PR_ACTIVITY_ONLY", false),
    uatOnly: envBool("UAT_ONLY", false),
    noWrite: envBool("NO_WRITE", false),
    cleanRun: envBool("CLEAN_RUN", false) || hasCliFlag("--clean"),
    skipPrCycle: envBool("SKIP_PR_CYCLE", false),
    skipPrActivity: envBool("SKIP_PR_ACTIVITY", false),
    skipContributors: envBool("SKIP_CONTRIBUTORS", false),
    skipProductCycle: envBool("SKIP_PRODUCT_CYCLE", false),
    skipTrendRefresh: envBool("SKIP_TREND_REFRESH", false),
    skipUatAging: envBool("SKIP_UAT_AGING", true),
    prCycleProjectKeys: env("PR_CYCLE_PROJECT_KEYS", PR_ACTIVITY_PROJECT_KEYS.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    prCycleCodingStatuses: normalizeStringList(
      env("PR_CYCLE_CODING_STATUS", "In Progress,In Development,Development").split(",")
    ),
    prCycleReviewStatuses: normalizeStringList(
      env(
        "PR_CYCLE_REVIEW_STATUS",
        "In Review,Review,Code Review,Peer Review,Ready for Review"
      ).split(",")
    ),
    prCycleMergeStatuses: normalizeStringList(
      env("PR_CYCLE_MERGE_STATUS", "QA,QA / Lab Testing,Lab Testing,Testing,Ready for QA").split(
        ","
      )
    ),
    sprintProject: env("SPRINT_PROJECT", DEFAULT_SPRINT_PROJECT),
    sprintBoardId: env("SPRINT_BOARD_ID", ""),
    sprintLookbackCount: envPositiveInt("SPRINT_LOOKBACK_COUNT", DEFAULT_SPRINT_LOOKBACK_COUNT),
    sprintPoint:
      env("SPRINT_POINT", DEFAULT_SPRINT_POINT).toLowerCase() === "start" ? "start" : "end",
    sprintIncludeActive: envBool("SPRINT_INCLUDE_ACTIVE", true),
    sprintMondayAnchor: envBool("SPRINT_MONDAY_ANCHOR", DEFAULT_SPRINT_MONDAY_ANCHOR),
    prCycleRebuildAll: envBool("PR_CYCLE_REBUILD_ALL", false),
    prActivityRebuildAll: envBool("PR_ACTIVITY_REBUILD_ALL", false),
    prActivitySource: normalizePrActivitySource(env("PR_ACTIVITY_SOURCE", PR_ACTIVITY_SOURCE_GITHUB)),
    trendCountConcurrency: envPositiveInt(
      "TREND_COUNT_CONCURRENCY",
      DEFAULT_TREND_COUNT_CONCURRENCY
    ),
    trendBoardConcurrency: envPositiveInt(
      "TREND_BOARD_CONCURRENCY",
      DEFAULT_TREND_BOARD_CONCURRENCY
    )
  };
}

function validateRefreshConfig(config) {
  for (const [failed, message] of [
    [
      !config.email,
      "Missing ATLASSIAN_EMAIL. Create .env.backlog with ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, and optional ATLASSIAN_SITE."
    ],
    [
      !config.token,
      "Missing ATLASSIAN_API_TOKEN. Create .env.backlog with ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, and optional ATLASSIAN_SITE."
    ],
    [
      isPlaceholderSite(config.site),
      "ATLASSIAN_SITE looks like a placeholder. Set your real Jira site host (for example: nepgroup.atlassian.net)."
    ],
    [
      isPlaceholderCredential(config.email),
      "ATLASSIAN_EMAIL looks like a placeholder. Set a real Jira account email in .env.backlog."
    ],
    [
      isPlaceholderCredential(config.token),
      "ATLASSIAN_API_TOKEN looks like a placeholder. Set a real Jira API token in .env.backlog."
    ]
  ]) {
    if (failed) throw new Error(message);
  }
  if (
    [config.prCycleOnly, config.productCycleOnly, config.prActivityOnly, config.uatOnly].filter(
      Boolean
    ).length > 1
  ) {
    throw new Error(
      "PR_CYCLE_ONLY, PRODUCT_CYCLE_ONLY, PR_ACTIVITY_ONLY, and UAT_ONLY cannot be combined."
    );
  }
  if (config.prActivityOnly && config.skipPrActivity) {
    throw new Error("PR_ACTIVITY_ONLY cannot be used when SKIP_PR_ACTIVITY=true.");
  }
}

async function maybeRefreshSnapshot(skip, skippedMessage, refresh) {
  if (skip) {
    console.log(skippedMessage);
    return null;
  }
  return refresh();
}

async function buildUatRefreshArtifacts(config) {
  clearIssueChangelogCache();
  const uatFilters = {
    project: config.uatProject,
    issueType: config.uatIssueType,
    status: config.uatStatus,
    label: config.uatLabel
  };
  let uatAging = null;
  if (config.skipUatAging) {
    console.log("Skipping UAT aging (SKIP_UAT_AGING=true).");
  } else {
    const uatRows = await withTiming(
      "UAT aging",
      () => fetchUatIssueAges(config.site, config.email, config.token, uatFilters),
      console
    );
    uatAging = buildUatAging(uatRows, uatFilters);
    console.log(
      `Computed UAT aging (${uatAging.totalIssues} issues, label=${config.uatLabel}, status=${config.uatStatus}).`
    );
  }

  const businessUnitChartData = await withTiming(
    "Business Unit UAT chart data",
    () =>
      refreshBusinessUnitUatChartData({
        site: config.site,
        email: config.email,
        token: config.token,
        searchJiraIssues,
        fetchIssueChangelog,
        mapWithConcurrency,
        envValue: (name, fallback = "") =>
          config.cleanRun && name === "BUSINESS_UNIT_DONE_REBUILD_ALL"
            ? "true"
            : env(name, fallback),
        logger: console
      }),
    console
  );
  clearIssueChangelogCache();
  return { uatAging, businessUnitChartData };
}

async function buildPrCycleRefreshSnapshot(config, todayIso) {
  const prCycleWindows = buildPrCycleWindowConfigs(todayIso);
  if (config.skipPrCycle || config.prActivityOnly) {
    console.log(
      `Skipping PR cycle stage breakdown (${config.prActivityOnly ? "PR_ACTIVITY_ONLY=true" : "SKIP_PR_CYCLE=true"}).`
    );
    return null;
  }

  const shouldRebuildAllWindows = config.prCycleRebuildAll || config.cleanRun;
  const existingPrCycleSnapshot = !shouldRebuildAllWindows
    ? await readJsonFile(PR_CYCLE_SNAPSHOT_PATH)
    : null;
  const prCycleRefreshPlan = resolvePrCycleRefreshPlan(prCycleWindows, existingPrCycleSnapshot, {
    shouldRebuildAllWindows,
    todayIso
  });
  const scopedIssueKeysByWindowKey = prCycleRefreshPlan.prCycleWindowsToRefresh.some(
    (windowConfig) => windowConfig?.scopedToBoardWork
  )
    ? await fetchPrCycleScopedIssueKeysByWindow(
        config.site,
        config.email,
        config.token,
        prCycleRefreshPlan.prCycleWindowsToRefresh
      )
    : null;
  const hydratedPrCycleRefreshPlan = {
    ...prCycleRefreshPlan,
    prCycleWindowsToRefresh: attachScopedIssueKeysToPrCycleWindows(
      prCycleRefreshPlan.prCycleWindowsToRefresh,
      scopedIssueKeysByWindowKey
    )
  };
  console.log(
    `Fetching PR cycle issue histories for ${hydratedPrCycleRefreshPlan.prCycleWindowsToRefresh.map((windowConfig) => windowConfig.windowLabel).join(", ")}.`
  );
  if (scopedIssueKeysByWindowKey) {
    console.log(
      `Resolved board-scoped workflow issue counts: ${formatScopedIssueKeysByWindowSummary(
        scopedIssueKeysByWindowKey
      )}.`
    );
  }
  const prCycleFetchRequest = buildPrCycleFetchRequest(config, hydratedPrCycleRefreshPlan);
  const prCycleBreakdown = await fetchPrCycleIssueBreakdown(
    config.site,
    config.email,
    config.token,
    prCycleFetchRequest,
    {
      useCache: !config.cleanRun
    }
  );
  const prCycleRows = prCycleBreakdown.rows;
  const prCycleSnapshotState = buildPrCycleSnapshotState(
    config,
    existingPrCycleSnapshot,
    hydratedPrCycleRefreshPlan,
    prCycleRows
  );
  console.log(
    `Computed PR cycle stage breakdown (${prCycleRows.length} issue histories across ${config.prCycleProjectKeys.join(", ")} for ${hydratedPrCycleRefreshPlan.prCycleWindowsToRefresh.length} window${hydratedPrCycleRefreshPlan.prCycleWindowsToRefresh.length === 1 ? "" : "s"}; changelog cache hits ${prCycleBreakdown.changelogCacheHitCount}, writes ${prCycleBreakdown.changelogCacheWriteCount}${hydratedPrCycleRefreshPlan.reuseHistoricalPrCycleWindows ? `; refreshed ${hydratedPrCycleRefreshPlan.prCycleWindowsToRefresh.map((windowConfig) => windowConfig.key).join(", ")}, reused cached 6m and 1y windows` : hydratedPrCycleRefreshPlan.historicalPrCycleSnapshotFreshEnough ? "" : `; refreshed all windows because cached 6m and 1y data was older than ${PR_CYCLE_HISTORICAL_REFRESH_MAX_AGE_DAYS} days`}).`
  );
  return attachPrCycleAvgInflow(
    prCycleSnapshotState.prCycleSnapshot,
    await loadPersistedPrActivity()
  );
}

export function resolvePrCycleRefreshPlan(prCycleWindows, existingPrCycleSnapshot, options = {}) {
  const { shouldRebuildAllWindows = false, todayIso = "" } = options;
  const historicalPrCycleSnapshotAgeDays = snapshotAgeInDays(existingPrCycleSnapshot?.updatedAt);
  const historicalPrCycleSnapshotFreshEnough =
    historicalPrCycleSnapshotAgeDays <= PR_CYCLE_HISTORICAL_REFRESH_MAX_AGE_DAYS;
  const canReuseHistoricalPrCycleWindows = Boolean(
    existingPrCycleSnapshot?.windows &&
    typeof existingPrCycleSnapshot.windows === "object" &&
    existingPrCycleSnapshot.windows["90d"] &&
    existingPrCycleSnapshot.windows["6m"] &&
    existingPrCycleSnapshot.windows["1y"] &&
    historicalPrCycleSnapshotFreshEnough
  );
  const reuseHistoricalPrCycleWindows =
    !shouldRebuildAllWindows && canReuseHistoricalPrCycleWindows;
  const prCycleWindowsToRefresh = reuseHistoricalPrCycleWindows
    ? prCycleWindows.filter((windowConfig) =>
        PR_CYCLE_REFRESH_WINDOW_KEYS.includes(windowConfig.key)
      )
    : prCycleWindows;
  const prCycleRangeStartDate = String(
    prCycleWindowsToRefresh[prCycleWindowsToRefresh.length - 1]?.windowStartDate || todayIso
  );

  return {
    historicalPrCycleSnapshotFreshEnough,
    canReuseHistoricalPrCycleWindows,
    reuseHistoricalPrCycleWindows,
    prCycleWindowsToRefresh,
    prCycleRangeStartDate
  };
}

export function buildPrCycleFetchRequest(config, prCycleRefreshPlan) {
  const lastWindowConfig =
    prCycleRefreshPlan?.prCycleWindowsToRefresh?.[
      prCycleRefreshPlan.prCycleWindowsToRefresh.length - 1
    ] || null;

  return {
    projectKeys: config.prCycleProjectKeys,
    windowDays: lastWindowConfig?.windowDays || 365,
    windowLabel: lastWindowConfig?.windowLabel || "Last year",
    windowStartDate: prCycleRefreshPlan?.prCycleRangeStartDate || "",
    windowStartIso: `${String(prCycleRefreshPlan?.prCycleRangeStartDate || "").trim()}T00:00:00.000Z`,
    windowEndIso: new Date().toISOString(),
    codingStatuses: config.prCycleCodingStatuses,
    reviewStatuses: config.prCycleReviewStatuses,
    mergeStatuses: config.prCycleMergeStatuses
  };
}

export function buildPrCycleSnapshotState(
  config,
  existingPrCycleSnapshot,
  prCycleRefreshPlan,
  prCycleRows
) {
  const refreshedPrCycleSnapshot = buildPrCycleSnapshot(prCycleRows, {
    windows: prCycleRefreshPlan.prCycleWindowsToRefresh,
    defaultWindow: PR_CYCLE_WINDOW_DEFAULT_KEY,
    codingStatuses: config.prCycleCodingStatuses,
    reviewStatuses: config.prCycleReviewStatuses,
    mergeStatuses: config.prCycleMergeStatuses
  });
  const prCycleSnapshot = prCycleRefreshPlan.reuseHistoricalPrCycleWindows
    ? finalizePrCycleSnapshot(
        {
          ...(existingPrCycleSnapshot?.windows &&
          typeof existingPrCycleSnapshot.windows === "object"
            ? existingPrCycleSnapshot.windows
            : {}),
          ...refreshedPrCycleSnapshot.windows
        },
        {
          defaultWindow: existingPrCycleSnapshot?.defaultWindow || PR_CYCLE_WINDOW_DEFAULT_KEY
        }
      )
    : refreshedPrCycleSnapshot;

  return {
    refreshedPrCycleSnapshot,
    prCycleSnapshot
  };
}

async function buildPrActivityRefreshState(config, todayIso, resolvedDates, options = {}) {
  const { skipRefresh = false } = options;
  const shouldRebuildPrActivityHistory = config.prActivityRebuildAll || config.cleanRun;
  const prActivityHistoryState = await readPrActivityHistoryState({
    skipHistoryReuse: shouldRebuildPrActivityHistory
  });
  const prActivityHistoryPlan = resolvePrActivityHistoryPlan(prActivityHistoryState, {
    shouldRebuildPrActivityHistory
  });
  if (prActivityHistoryPlan.archivedHistoryWarning) {
    console.warn(prActivityHistoryPlan.archivedHistoryWarning);
  }

  if (skipRefresh) {
    console.log("Skipping PR activity refresh (SKIP_PR_ACTIVITY=true); reusing cached history.");
    return {
      existingSnapshotForPrActivity: prActivityHistoryPlan.existingSnapshotForPrActivity,
      mergedPrActivity: prActivityHistoryPlan.existingPrActivityForMerge
    };
  }

  const prActivityWindowKey = prActivityHistoryPlan.reuseHistoricalPrActivity
    ? PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY
    : "1y";
  const prActivityFetchSinceDate = resolvePrActivityFetchSinceDate(todayIso, prActivityWindowKey);
  const prRows = await withTiming(
    "PR activity fetch",
    () =>
      fetchPrActivity(config.site, config.email, config.token, prActivityFetchSinceDate, {
        useCache: !config.cleanRun,
        prActivitySource: config.prActivitySource
      }),
    console
  );
  const prActivitySnapshotState = buildPrActivitySnapshotState(todayIso, resolvedDates, prRows, {
    existingPrActivityForMerge: prActivityHistoryPlan.existingPrActivityForMerge,
    reuseHistoricalPrActivity: prActivityHistoryPlan.reuseHistoricalPrActivity
  });
  console.log(
    `Computed ${config.prActivitySource === PR_ACTIVITY_SOURCE_GITHUB ? "GitHub Development PR activity" : "Jira Development PR inflow proxy"} (${prRows.uniquePrCount} unique PRs from ${prRows.candidateIssueCount} ${config.prActivitySource === PR_ACTIVITY_SOURCE_GITHUB ? "mapped repos" : "candidate issues"}, ${prRows.detailIssueCount} ${config.prActivitySource === PR_ACTIVITY_SOURCE_GITHUB ? "repos scanned" : "with recent PR summary activity"}, since ${prActivitySnapshotState.prActivityFetchSinceDate} across ${prActivitySnapshotState.prActivitySprintDates.length} sprint buckets and ${prActivitySnapshotState.refreshedPrActivity.monthlyPoints.length} monthly buckets; fetched ${prRows.reviewChangelogIssueCount} ${config.prActivitySource === PR_ACTIVITY_SOURCE_GITHUB ? "review samples" : "review changelogs"}, cache hits ${prRows.cacheHitCount}, cache writes ${prRows.cacheWriteCount}${prActivityHistoryPlan.reuseHistoricalPrActivity ? "; reused cached older PR activity buckets" : ""}).`
  );

  return {
    existingSnapshotForPrActivity: prActivityHistoryPlan.existingSnapshotForPrActivity,
    mergedPrActivity: prActivitySnapshotState.mergedPrActivity
  };
}

export function resolvePrActivityHistoryPlan(prActivityHistoryState, options = {}) {
  const { shouldRebuildPrActivityHistory = false } = options;
  const existingSnapshotForPrActivity = prActivityHistoryState?.currentSnapshot || null;
  const existingPrActivityForMerge = prActivityHistoryState?.bestPrActivity || null;
  const canReuseHistoricalPrActivity = Boolean(
    countPrActivitySeriesPoints(existingPrActivityForMerge, "points") > 0 &&
      countPrActivitySeriesPoints(existingPrActivityForMerge, "monthlyPoints") > 0
  );
  const reuseHistoricalPrActivity =
    !shouldRebuildPrActivityHistory && canReuseHistoricalPrActivity;
  const archivedHistoryWarning =
    reuseHistoricalPrActivity &&
    prActivityHistoryState?.bestSource &&
    prActivityHistoryState.bestSource !== PRIMARY_SNAPSHOT_PATH
      ? `Using archived PR activity history from ${prActivityHistoryState.bestSource} (${prActivityHistoryState.bestMetrics.pointsCount} sprint buckets, ${prActivityHistoryState.bestMetrics.monthlyPointsCount} monthly buckets) because current snapshot.json is missing older monthly history.`
      : "";

  return {
    existingSnapshotForPrActivity,
    existingPrActivityForMerge,
    canReuseHistoricalPrActivity,
    reuseHistoricalPrActivity,
    archivedHistoryWarning
  };
}

export function buildPrActivitySnapshotState(todayIso, resolvedDates, prRows, options = {}) {
  const {
    existingPrActivityForMerge = null,
    reuseHistoricalPrActivity = false
  } = options;
  const allResolvedDates = Array.isArray(resolvedDates?.dates) ? resolvedDates.dates : [];
  const closedResolvedDates = Array.isArray(resolvedDates?.closedDates)
    ? resolvedDates.closedDates
    : [];
  const prActivityWindowKey = reuseHistoricalPrActivity
    ? PR_ACTIVITY_REFRESH_WINDOW_DEFAULT_KEY
    : "1y";
  const prActivityFetchSinceDate = resolvePrActivityFetchSinceDate(todayIso, prActivityWindowKey);
  const sprintDatesSource = closedResolvedDates.length > 0 ? closedResolvedDates : allResolvedDates;
  const prActivitySprintDates = sprintDatesSource.filter(
    (date) => String(date || "") >= prActivityFetchSinceDate
  );
  const latestClosedSprintDate = Array.isArray(resolvedDates?.closedDates)
    ? String(resolvedDates.closedDates[resolvedDates.closedDates.length - 1] || "").trim()
    : "";
  const refreshedPrActivity = buildPrActivitySprintSnapshot(
    prRows,
    prActivityFetchSinceDate,
    prActivitySprintDates
  );
  const prActivityMonthly = buildPrActivityMonthlySnapshot(prRows, prActivityFetchSinceDate, {
    ceilingDate: todayIso
  });
  refreshedPrActivity.latestClosedSprintDate = latestClosedSprintDate;
  refreshedPrActivity.monthlySince = prActivityMonthly.since;
  refreshedPrActivity.monthlyPoints = prActivityMonthly.points;
  const mergedPrActivity = reuseHistoricalPrActivity
    ? mergePrActivitySnapshots(existingPrActivityForMerge, refreshedPrActivity, {
        truncateAfterRefreshedLatest: !resolvedDates.usedFallback,
        ceilingDate: todayIso,
        monthlyFloorDate: resolvePrActivityFetchSinceDate(todayIso, "1y")
      })
    : refreshedPrActivity;

  return {
    prActivityWindowKey,
    prActivityFetchSinceDate,
    prActivitySprintDates,
    latestClosedSprintDate,
    refreshedPrActivity,
    mergedPrActivity
  };
}

export function buildTrendRefreshDateState(config, resolvedDates) {
  const allResolvedDates = Array.isArray(resolvedDates?.dates) ? resolvedDates.dates : [];
  const dates =
    Number.isFinite(config.sprintLookbackCount) && config.sprintLookbackCount > 0
      ? allResolvedDates.slice(-config.sprintLookbackCount)
      : allResolvedDates;

  if (resolvedDates?.usedFallback) {
    return {
      allResolvedDates,
      dates,
      logMethod: "warn",
      logMessage: `Using fallback trend dates (${allResolvedDates.length} points, latest ${dates.length} used for backlog trend). Reason: ${resolvedDates.fallbackReason}`
    };
  }

  return {
    allResolvedDates,
    dates,
    logMethod: "log",
    logMessage: `Resolved ${allResolvedDates.length} trend dates from Jira sprints (point=${config.sprintPoint}, includeActive=${config.sprintIncludeActive}, mondayAnchor=${config.sprintMondayAnchor}); using latest ${dates.length} for backlog trend.`
  };
}

async function resolveTrendRefreshDates(config, todayIso) {
  const resolvedDates = await withTiming(
    "Resolve sprint dates",
    () =>
      resolveTrendDates(config.site, config.email, config.token, {
        fallbackDates: FALLBACK_DATES,
        projectKey: config.sprintProject,
        boardId: config.sprintBoardId,
        lookbackCount: 0,
        pointMode: config.sprintPoint,
        includeActive: config.sprintIncludeActive,
        mondayAnchor: config.sprintMondayAnchor,
        todayIso,
        useCache: !config.cleanRun
      }),
    console
  );
  const trendDateState = buildTrendRefreshDateState(config, resolvedDates);
  console[trendDateState.logMethod](trendDateState.logMessage);
  return {
    resolvedDates,
    allResolvedDates: trendDateState.allResolvedDates,
    dates: trendDateState.dates
  };
}

async function refreshTrendSnapshotData(config, dates) {
  if (config.skipTrendRefresh) {
    console.log("Skipping bug trend refresh (SKIP_TREND_REFRESH=true).");
    return {};
  }

  const computedEntries = await withTiming(
    "Bug trend refresh",
    () =>
      mapWithConcurrency(BOARDS, config.trendBoardConcurrency, async (board) => {
        const trendRows = await buildBoardTrend(
          board,
          dates,
          config.site,
          config.email,
          config.token,
          config.trendCountConcurrency
        );
        console.log(`Computed ${board.constName} (${dates.length} points).`);
        return [board.constName, trendRows];
      }),
    console
  );
  return Object.fromEntries(computedEntries);
}

function buildTrendAndPrActivityResult(prCycleSnapshot, computed, prActivityState) {
  return {
    prCycleSnapshot: attachPrCycleAvgInflow(prCycleSnapshot, prActivityState.mergedPrActivity),
    computed,
    ...prActivityState
  };
}

async function buildTrendAndPrActivityState(config, todayIso) {
  const prCycleSnapshot = await buildPrCycleRefreshSnapshot(config, todayIso);
  const { resolvedDates, dates } = await resolveTrendRefreshDates(config, todayIso);
  const computed = await refreshTrendSnapshotData(config, dates);
  const prActivityState = await buildPrActivityRefreshState(config, todayIso, resolvedDates, {
    skipRefresh: config.skipPrActivity
  });

  return buildTrendAndPrActivityResult(prCycleSnapshot, computed, prActivityState);
}

const refreshRunner = createRefreshRunner({
  allowEmpty: ALLOW_EMPTY,
  resolveStopAfterStage,
  constants: {
    FALLBACK_DATES,
    PRIMARY_SNAPSHOT_PATH
  },
  io: {
    buildSupplementalWriteArtifacts,
    commitSnapshotRefresh,
    preparePrimarySnapshotArtifacts,
    readJsonFile,
    writePrCycleSnapshotAtomic,
    writeProductCycleShipmentsSnapshotAtomic,
    writeProductCycleSnapshotAtomic
  },
  validators: {
    validateDashboardSnapshot
  },
  refreshers: {
    refreshContributorsSnapshot,
    refreshProductCycleSnapshot
  },
  helpers: {
    buildCombinedSnapshot,
    buildPrActivityRefreshState,
    buildPrCycleRefreshSnapshot,
    buildTrendAndPrActivityState,
    buildUatRefreshArtifacts,
    maybeRefreshSnapshot,
    resolveTrendDates,
    updateExistingSnapshotPrActivity,
    updateExistingSnapshotUat,
    validateRefreshConfig,
    withTiming
  },
  jira: {
    env,
    fetchIssueChangelog,
    jiraRequest,
    mapWithConcurrency,
    searchJiraIssues
  }
});

export async function runRefresh(options = {}) {
  const stopAfterStage = resolveStopAfterStage(options.stopAfterStage || readCliArg("--stage"));
  await loadLocalEnv();
  const config = buildRefreshConfig();
  validateRefreshConfig(config);

  console.log(`Refreshing backlog from Jira site: ${config.site}`);
  if (config.cleanRun) {
    console.log(
      "Clean run enabled: bypassing PR activity issue cache, historical snapshot reuse, PR cycle window reuse, and forcing a Business Unit done-cache rebuild."
    );
  }

  if (stopAfterStage) {
    if (refreshRunner.hasModeSpecificRefresh(config)) {
      throw new Error("--stage only supports the default full refresh mode.");
    }
    const result = await refreshRunner.runFullRefreshPipeline(config, { stopAfterStage });
    console.log(`Stopped after ${stopAfterStage} stage.`);
    return result;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  if (await refreshRunner.runModeSpecificRefresh(config, todayIso)) {
    return;
  }

  await refreshRunner.runFullRefreshPipeline(config, { todayIso });
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  runRefresh().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
