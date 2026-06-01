#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PAGE_SIZE = 100;
const PR_SUMMARY_FIELD = "customfield_10000";
const DEFAULT_OUTPUT_PATH = "scripts/config/contributor-team-map.json";
const DEFAULT_JIRA_CACHE_PATH = ".cache/team-pr-repo-audit-dev-status-cache.json";
const DEFAULT_AUTHOR_CACHE_PATH = ".cache/contributor-team-map-pr-author-cache.json";
const TEAM_BOARD_SCOPES = Object.freeze([
  { team: "api", boardId: "38", label: "API" },
  { team: "legacy", boardId: "39", label: "Legacy FE" },
  { team: "react", boardId: "46", label: "React FE" },
  { team: "bc", boardId: "40", label: "BC" },
  { team: "workers", boardId: "333", label: "Workers" },
  { team: "titanium", boardId: "399", label: "Titanium" }
]);
const ENV_FILES = [".env.backlog", ".env.local"];

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return String(process.argv[index + 1] || "").trim();
  return fallback;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line
      .slice(equalsIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function loadEnv() {
  for (const file of ENV_FILES) loadEnvFile(path.join(REPO_ROOT, file));
}

function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function authHeader(email, token) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function jiraRequest(site, auth, endpoint) {
  const url = endpoint.startsWith("http") ? endpoint : `https://${site}${endpoint}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: auth,
        Accept: "application/json"
      }
    });
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
      continue;
    }
    throw new Error(`Jira request failed (${response.status}): ${await response.text()}`);
  }
  throw new Error("Jira request failed after retries.");
}

async function fetchBoardIssues(site, auth, boardId) {
  const issues = [];
  let startAt = 0;
  for (;;) {
    const payload = await jiraRequest(
      site,
      auth,
      `/rest/agile/1.0/board/${encodeURIComponent(
        boardId
      )}/issue?startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=summary,status,labels,${PR_SUMMARY_FIELD}`
    );
    const rows = Array.isArray(payload?.issues) ? payload.issues : [];
    issues.push(...rows);
    if (issues.length > 0 && issues.length % 1000 === 0) {
      console.error(`Fetched ${issues.length} issues from board ${boardId}...`);
    }
    if (payload?.isLast || rows.length === 0) break;
    const total = Number(payload?.total);
    if (Number.isFinite(total) && startAt + rows.length >= total) break;
    startAt += rows.length;
  }
  return issues;
}

function hasPullRequestSummary(value) {
  if (!value) return false;
  if (typeof value === "string") return /pullrequest/i.test(value);
  return JSON.stringify(value).toLowerCase().includes("pullrequest");
}

function readPullRequestSummaryFingerprint(value) {
  if (!value) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const lastUpdated =
    text.match(/"lastUpdated":"([^"]+)"/)?.[1] || text.match(/lastUpdated=([^,}]+)/)?.[1];
  const stateCount = text.match(/"stateCount":(\d+)/)?.[1] || text.match(/stateCount=(\d+)/)?.[1];
  const count = text.match(/"count":(\d+)/)?.[1] || text.match(/count=(\d+)/)?.[1];
  return [lastUpdated || "unknown", stateCount || "0", count || "0"].join("|");
}

function buildIssueCacheKey(issue) {
  const issueId = String(issue?.id || "").trim();
  const fingerprint = readPullRequestSummaryFingerprint(issue?.fields?.[PR_SUMMARY_FIELD]);
  return issueId && fingerprint ? `${issueId}:${fingerprint}` : "";
}

async function fetchIssuePullRequests(site, auth, issue, cacheRows) {
  const cacheKey = buildIssueCacheKey(issue);
  if (cacheKey && cacheRows[cacheKey]) return cacheRows[cacheKey].pullRequests || [];

  const payload = await jiraRequest(
    site,
    auth,
    `/rest/dev-status/latest/issue/detail?issueId=${encodeURIComponent(
      issue.id
    )}&applicationType=GitHub&dataType=pullrequest`
  );
  const pullRequests = [];
  for (const detail of Array.isArray(payload?.detail) ? payload.detail : []) {
    for (const pullRequest of Array.isArray(detail?.pullRequests) ? detail.pullRequests : []) {
      const url = String(pullRequest?.url || "").trim();
      if (!url) continue;
      pullRequests.push({
        status: String(pullRequest?.status || "")
          .trim()
          .toUpperCase(),
        url
      });
    }
  }
  return pullRequests;
}

function parseGitHubPullRequestUrl(url) {
  const match = String(url || "")
    .trim()
    .match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i);
  if (!match) return null;
  return {
    repo: match[1].toLowerCase(),
    number: match[2],
    key: `${match[1].toLowerCase()}#${match[2]}`
  };
}

async function resolveGitHubToken() {
  const envToken = String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  if (envToken) return envToken;
  const { stdout } = await execFileAsync("gh", ["auth", "token"], {
    cwd: REPO_ROOT,
    env: { ...process.env, GH_PAGER: "cat" }
  });
  return String(stdout || "").trim();
}

async function githubRequest(token, endpoint) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com/${endpoint}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "tracker-contributor-team-map",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (response.ok) return response.json();
    if (
      (response.status === 403 || response.status === 429 || response.status >= 500) &&
      attempt < 3
    ) {
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt)
      );
      continue;
    }
    throw new Error(`GitHub request failed (${response.status}): ${await response.text()}`);
  }
  throw new Error("GitHub request failed after retries.");
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await callback(items[index], index);
      }
    })
  );
  return results;
}

async function fetchPullRequestAuthor(token, pullRequestRef, authorCache) {
  if (authorCache[pullRequestRef.key]) return authorCache[pullRequestRef.key];
  const payload = await githubRequest(
    token,
    `repos/${pullRequestRef.repo}/pulls/${encodeURIComponent(pullRequestRef.number)}`
  );
  const login = String(payload?.user?.login || "")
    .trim()
    .toLowerCase();
  authorCache[pullRequestRef.key] = login;
  return login;
}

function incrementContributorTeamCount(countsByContributor, login, team, pullRequestKey) {
  if (!login || !team) return;
  if (!countsByContributor.has(login)) countsByContributor.set(login, new Map());
  const teamCounts = countsByContributor.get(login);
  const row = teamCounts.get(team) || { team, pullRequestCount: 0, pullRequests: new Set() };
  if (!row.pullRequests.has(pullRequestKey)) {
    row.pullRequests.add(pullRequestKey);
    row.pullRequestCount += 1;
  }
  teamCounts.set(team, row);
}

function buildContributorRows(countsByContributor) {
  return [...countsByContributor.entries()]
    .map(([login, teamCounts]) => {
      const teams = [...teamCounts.values()]
        .map((row) => ({
          team: row.team,
          pullRequestCount: row.pullRequestCount
        }))
        .sort(
          (left, right) =>
            right.pullRequestCount - left.pullRequestCount || left.team.localeCompare(right.team)
        );
      const totalPullRequestCount = teams.reduce((sum, team) => sum + team.pullRequestCount, 0);
      const dominantTeam = teams[0]?.team || "";
      const dominantSharePct =
        totalPullRequestCount > 0
          ? Number(((teams[0].pullRequestCount / totalPullRequestCount) * 100).toFixed(1))
          : 0;
      return {
        login,
        dominantTeam,
        dominantSharePct,
        totalPullRequestCount,
        teams
      };
    })
    .sort((left, right) => left.login.localeCompare(right.login));
}

async function main() {
  loadEnv();
  const site = process.env.ATLASSIAN_SITE;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!site || !email || !token) {
    throw new Error("Missing ATLASSIAN_SITE, ATLASSIAN_EMAIL, or ATLASSIAN_API_TOKEN.");
  }

  const outputPath = path.resolve(REPO_ROOT, readArg("output", DEFAULT_OUTPUT_PATH));
  const jiraCachePath = path.resolve(REPO_ROOT, readArg("jira-cache", DEFAULT_JIRA_CACHE_PATH));
  const authorCachePath = path.resolve(
    REPO_ROOT,
    readArg("author-cache", DEFAULT_AUTHOR_CACHE_PATH)
  );
  const concurrency = Math.max(1, Number.parseInt(readArg("concurrency", "12"), 10) || 12);
  const minConfidencePct = Math.max(
    0,
    Math.min(100, Number.parseFloat(readArg("min-confidence", "60")) || 60)
  );
  const auth = authHeader(email, token);
  const githubToken = await resolveGitHubToken();
  const jiraCacheRows = readJsonIfPresent(jiraCachePath, {});
  const authorCache = readJsonIfPresent(authorCachePath, {});
  const countsByContributor = new Map();
  let linkedPullRequestCount = 0;

  for (const scope of TEAM_BOARD_SCOPES) {
    console.error(`Scanning ${scope.label} board ${scope.boardId}...`);
    const issues = (await fetchBoardIssues(site, auth, scope.boardId)).filter((issue) =>
      hasPullRequestSummary(issue?.fields?.[PR_SUMMARY_FIELD])
    );
    console.error(`Found ${issues.length} ${scope.label} issues with PR summaries.`);
    const issueRows = await mapWithConcurrency(issues, concurrency, async (issue) => ({
      issue,
      pullRequests: await fetchIssuePullRequests(site, auth, issue, jiraCacheRows)
    }));

    const pullRequestRefs = [];
    for (const row of issueRows) {
      for (const pullRequest of row.pullRequests || []) {
        if (pullRequest.status === "DECLINED") continue;
        const pullRequestRef = parseGitHubPullRequestUrl(pullRequest.url);
        if (!pullRequestRef) continue;
        pullRequestRefs.push(pullRequestRef);
      }
    }

    const uniqueRefs = [...new Map(pullRequestRefs.map((ref) => [ref.key, ref])).values()];
    linkedPullRequestCount += uniqueRefs.length;
    console.error(`Resolving ${uniqueRefs.length} ${scope.label} linked GitHub PR authors...`);
    let githubRateLimited = false;
    const authorRows = await mapWithConcurrency(uniqueRefs, concurrency, async (pullRequestRef) => {
      if (!authorCache[pullRequestRef.key] && githubRateLimited) {
        return { pullRequestRef, login: "" };
      }
      try {
        return {
          pullRequestRef,
          login: await fetchPullRequestAuthor(githubToken, pullRequestRef, authorCache)
        };
      } catch (error) {
        if (/rate limit/i.test(String(error?.message || ""))) {
          githubRateLimited = true;
          return { pullRequestRef, login: "" };
        }
        throw error;
      }
    });
    const unresolvedAuthorCount = authorRows.filter((row) => !row.login).length;
    if (unresolvedAuthorCount > 0) {
      console.error(
        `Skipped ${unresolvedAuthorCount} ${scope.label} PR authors that were not cached before GitHub rate limiting.`
      );
    }
    for (const row of authorRows) {
      incrementContributorTeamCount(
        countsByContributor,
        row.login,
        scope.team,
        row.pullRequestRef.key
      );
    }
    writeJson(authorCachePath, authorCache);
    console.error(`Mapped ${countsByContributor.size} contributors after ${scope.label}.`);
  }

  const contributors = buildContributorRows(countsByContributor);
  const payload = {
    generatedAt: new Date().toISOString(),
    resolutionPolicy: "dominant_jira_team_by_linked_github_pr_author",
    mappingConfidenceThresholdPct: minConfidencePct,
    contributorCount: contributors.length,
    mappedContributorCount: contributors.filter(
      (row) => row.login && row.dominantTeam && row.dominantSharePct >= minConfidencePct
    ).length,
    linkedPullRequestCount,
    contributors: Object.fromEntries(
      contributors
        .filter((row) => row.login && row.dominantTeam && row.dominantSharePct >= minConfidencePct)
        .map((row) => [row.login, row.dominantTeam])
    ),
    rows: contributors
  };

  writeJson(outputPath, payload);
  console.log(
    JSON.stringify(
      {
        outputPath,
        contributorCount: payload.contributorCount,
        linkedPullRequestCount: payload.linkedPullRequestCount
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
