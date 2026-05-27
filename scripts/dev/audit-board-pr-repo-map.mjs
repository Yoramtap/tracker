#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PAGE_SIZE = 100;
const PR_SUMMARY_FIELD = "customfield_10000";
const DEFAULT_CACHE_PATH = path.join(".cache", "team-pr-repo-audit-dev-status-cache.json");
const ENV_FILES = [".env.backlog", ".env.local"];
const GITHUB_PAGE_SIZE = 100;
const TEAM_BOARD_SCOPES = Object.freeze([
  { team: "api", boardId: "38", label: "API" },
  { team: "legacy", boardId: "39", label: "Legacy FE" },
  { team: "react", boardId: "46", label: "React FE" },
  { team: "bc", boardId: "40", label: "BC" },
  { team: "workers", boardId: "333", label: "Workers" },
  { team: "titanium", boardId: "399", label: "Titanium" }
]);

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return String(process.argv[index + 1] || "").trim();
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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

function readRepoTeamMap() {
  const payload = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "scripts/config/repo-team-map.json"), "utf8")
  );
  return payload?.repos && typeof payload.repos === "object" ? payload.repos : {};
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

function readDevStatusCache(cachePath) {
  const payload = readJsonIfPresent(cachePath, {});
  return payload && typeof payload === "object" ? payload : {};
}

function resolveAuditScopes() {
  const requestedTeam = readArg("team").toLowerCase();
  const requestedBoard = readArg("board");
  if (requestedBoard || requestedTeam) {
    const knownScope = TEAM_BOARD_SCOPES.find(
      (scope) => scope.team === requestedTeam || scope.boardId === requestedBoard
    );
    return [
      {
        team: requestedTeam || knownScope?.team || "",
        boardId: requestedBoard || knownScope?.boardId || "",
        label: knownScope?.label || requestedTeam || requestedBoard
      }
    ].filter((scope) => scope.team && scope.boardId);
  }
  return TEAM_BOARD_SCOPES;
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
    if (payload?.isLast || rows.length === 0) break;
    const total = Number(payload?.total);
    if (Number.isFinite(total) && startAt + rows.length >= total) break;
    startAt += rows.length;
  }
  return issues;
}

async function fetchIssuePullRequests(site, auth, issue, cache) {
  const prSummary = issue?.fields?.[PR_SUMMARY_FIELD];
  if (!hasPullRequestSummary(prSummary)) return [];
  const cacheKey = buildIssueCacheKey(issue, prSummary);
  if (cache.enabled && cache.rows[cacheKey]) return cache.rows[cacheKey].pullRequests || [];

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
      const repo = repoFromPullRequestUrl(pullRequest?.url) || normalizeRepo(pullRequest?.repositoryName);
      if (!repo) continue;
      pullRequests.push({
        repo,
        status: String(pullRequest?.status || "").trim().toUpperCase(),
        url: String(pullRequest?.url || "").trim(),
        id: String(pullRequest?.id || "").trim()
      });
    }
  }
  if (cache.enabled && cacheKey) {
    cache.rows[cacheKey] = {
      issueId: String(issue?.id || ""),
      issueKey: String(issue?.key || ""),
      updatedAt: new Date().toISOString(),
      pullRequests
    };
    cache.dirty = true;
  }
  return pullRequests;
}

function buildIssueCacheKey(issue, prSummary) {
  const issueId = String(issue?.id || "").trim();
  const fingerprint = readPullRequestSummaryFingerprint(prSummary);
  return issueId && fingerprint ? `${issueId}:${fingerprint}` : "";
}

function readPullRequestSummaryFingerprint(value) {
  if (!value) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const lastUpdated = text.match(/"lastUpdated":"([^"]+)"/)?.[1] || text.match(/lastUpdated=([^,}]+)/)?.[1];
  const stateCount = text.match(/"stateCount":(\d+)/)?.[1] || text.match(/stateCount=(\d+)/)?.[1];
  const count = text.match(/"count":(\d+)/)?.[1] || text.match(/count=(\d+)/)?.[1];
  return [lastUpdated || "unknown", stateCount || "0", count || "0"].join("|");
}

function hasPullRequestSummary(value) {
  if (!value) return false;
  if (typeof value === "string") return /pullrequest/i.test(value);
  return JSON.stringify(value).toLowerCase().includes("pullrequest");
}

function repoFromPullRequestUrl(url) {
  const match = String(url || "")
    .trim()
    .match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\//i);
  return match ? normalizeRepo(match[1]) : "";
}

function normalizeRepo(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveGitHubToken() {
  return String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
}

async function githubRequest(token, endpoint) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com/${endpoint}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "tracker-team-repo-map-audit",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (response.ok) return response.json();
    if ((response.status === 403 || response.status === 429 || response.status >= 500) && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt)
      );
      continue;
    }
    return {
      __error: true,
      status: response.status,
      message: await response.text()
    };
  }
  return {
    __error: true,
    status: 0,
    message: "GitHub request failed after retries."
  };
}

async function fetchCanonicalRepoRow(repo, mappedTeam, token) {
  const safeRepo = normalizeRepo(repo);
  const payload = await githubRequest(token, `repos/${safeRepo}`);
  if (payload?.__error) {
    return {
      repo: safeRepo,
      mappedTeam,
      canonicalRepo: "",
      redirected: false,
      archived: null,
      private: null,
      status: payload.status,
      error: payload.message
    };
  }
  const canonicalRepo = normalizeRepo(payload?.full_name || safeRepo);
  return {
    repo: safeRepo,
    mappedTeam,
    canonicalRepo,
    redirected: Boolean(canonicalRepo && canonicalRepo !== safeRepo),
    archived: Boolean(payload?.archived),
    private: Boolean(payload?.private),
    status: 200
  };
}

async function buildCanonicalRepoAudit(repoTeamMap, allBoardRepos, token, concurrency) {
  if (!token) {
    return {
      skipped: true,
      reason: "Missing GH_TOKEN or GITHUB_TOKEN; canonical GitHub repo validation was skipped."
    };
  }

  const mappedRows = await mapWithConcurrency(
    Object.entries(repoTeamMap).sort(([left], [right]) => left.localeCompare(right)),
    concurrency,
    async ([repo, team]) => fetchCanonicalRepoRow(repo, team, token)
  );
  const byCanonical = new Map();
  for (const row of mappedRows) {
    const key = row.canonicalRepo || `unresolved:${row.repo}`;
    if (!byCanonical.has(key)) byCanonical.set(key, []);
    byCanonical.get(key).push(row);
  }
  const duplicateGroups = [...byCanonical.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([canonicalRepo, rows]) => ({
      canonicalRepo,
      mappedRepos: rows.map((row) => ({
        repo: row.repo,
        mappedTeam: row.mappedTeam,
        redirected: row.redirected
      })),
      mappedRepoCount: rows.length,
      excessAliasCount: rows.length - 1,
      teamCount: new Set(rows.map((row) => row.mappedTeam)).size
    }))
    .sort((left, right) => right.excessAliasCount - left.excessAliasCount || left.canonicalRepo.localeCompare(right.canonicalRepo));
  const canonicalMappedRepos = new Map(
    mappedRows
      .filter((row) => row.canonicalRepo)
      .map((row) => [row.canonicalRepo, row])
  );

  const boardRows = await mapWithConcurrency(
    [...allBoardRepos]
      .filter((repo) => !repoTeamMap[repo])
      .sort((left, right) => left.localeCompare(right)),
    concurrency,
    async (repo) => fetchCanonicalRepoRow(repo, "", token)
  );
  const boardAliasMatches = boardRows
    .map((row) => ({
      boardRepo: row.repo,
      canonicalRepo: row.canonicalRepo,
      mappedTeam: repoTeamMap[row.repo] || "",
      canonicalMappedRow: canonicalMappedRepos.get(row.canonicalRepo) || null
    }))
    .filter((row) => !row.mappedTeam && row.canonicalMappedRow)
    .map((row) => ({
      boardRepo: row.boardRepo,
      canonicalRepo: row.canonicalRepo,
      mappedTeam: row.canonicalMappedRow.mappedTeam,
      mappedRepo: row.canonicalMappedRow.repo
    }))
    .sort((left, right) => left.boardRepo.localeCompare(right.boardRepo));

  return {
    skipped: false,
    mappedRepoCount: mappedRows.length,
    canonicalRepoCount: new Set(mappedRows.map((row) => row.canonicalRepo).filter(Boolean)).size,
    redirectedRepoCount: mappedRows.filter((row) => row.redirected).length,
    unresolvedRepoCount: mappedRows.filter((row) => !row.canonicalRepo).length,
    duplicateCanonicalRepoGroupCount: duplicateGroups.length,
    excessAliasCount: duplicateGroups.reduce((sum, group) => sum + group.excessAliasCount, 0),
    duplicateGroups,
    unresolvedRepos: mappedRows.filter((row) => !row.canonicalRepo),
    boardRepoCanonicalRows: boardRows,
    boardAliasMatches
  };
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
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

function summarizeRepos(issueResults, repoTeamMap) {
  const repos = new Map();
  for (const { issue, pullRequests } of issueResults) {
    for (const pullRequest of pullRequests) {
      if (!repos.has(pullRequest.repo)) {
        repos.set(pullRequest.repo, {
          repo: pullRequest.repo,
          mappedTeam: repoTeamMap[pullRequest.repo] || "",
          issues: new Set(),
          prCount: 0,
          mergedPrCount: 0,
          examples: []
        });
      }
      const row = repos.get(pullRequest.repo);
      row.issues.add(issue.key);
      row.prCount += 1;
      if (pullRequest.status === "MERGED") row.mergedPrCount += 1;
      if (row.examples.length < 3) {
        row.examples.push({
          issue: issue.key,
          status: pullRequest.status,
          url: pullRequest.url
        });
      }
    }
  }

  return [...repos.values()]
    .map((row) => ({
      ...row,
      mappedTeam: row.mappedTeam || "(unmapped)",
      issueCount: row.issues.size,
      issues: [...row.issues].sort()
    }))
    .sort(
      (a, b) =>
        b.mergedPrCount - a.mergedPrCount ||
        a.repo.localeCompare(b.repo)
    );
}

async function auditScope(site, auth, repoTeamMap, scope, cache, concurrency) {
  const issues = await fetchBoardIssues(site, auth, scope.boardId);
  const issueResults = await mapWithConcurrency(issues, concurrency, async (issue) => ({
    issue,
    pullRequests: await fetchIssuePullRequests(site, auth, issue, cache)
  }));
  const candidateIssueCount = issues.filter((issue) =>
    hasPullRequestSummary(issue?.fields?.[PR_SUMMARY_FIELD])
  ).length;
  const repos = summarizeRepos(issueResults, repoTeamMap);
  const mismatches = repos.filter((repo) => repo.mappedTeam !== scope.team);
  const unmappedMismatches = mismatches.filter((repo) => repo.mappedTeam === "(unmapped)");
  return {
    summary: {
      boardId: scope.boardId,
      expectedTeam: scope.team,
      label: scope.label,
      issueCount: issues.length,
      candidateIssueCount,
      linkedIssueCount: issueResults.filter((row) => row.pullRequests.length > 0).length,
      repoCount: repos.length,
      mismatchRepoCount: mismatches.length,
      mismatchedPrCount: mismatches.reduce((sum, row) => sum + row.prCount, 0),
      mismatchedMergedPrCount: mismatches.reduce((sum, row) => sum + row.mergedPrCount, 0),
      unmappedRepoCount: unmappedMismatches.length,
      unmappedPrCount: unmappedMismatches.reduce((sum, row) => sum + row.prCount, 0),
      unmappedMergedPrCount: unmappedMismatches.reduce(
        (sum, row) => sum + row.mergedPrCount,
        0
      )
    },
    repos,
    mismatches
  };
}

function buildSharedRepoCandidates(teams, canonicalRepoAudit) {
  const canonicalByMappedRepo = new Map();
  for (const group of canonicalRepoAudit?.duplicateGroups || []) {
    for (const row of group.mappedRepos || []) canonicalByMappedRepo.set(row.repo, group.canonicalRepo);
  }
  for (const row of canonicalRepoAudit?.boardRepoCanonicalRows || []) {
    if (row.repo && row.canonicalRepo) canonicalByMappedRepo.set(row.repo, row.canonicalRepo);
  }

  const rowsByRepo = new Map();
  for (const team of teams) {
    for (const repoRow of team.repos || []) {
      const canonicalRepo = canonicalByMappedRepo.get(repoRow.repo) || repoRow.repo;
      if (!rowsByRepo.has(canonicalRepo)) rowsByRepo.set(canonicalRepo, []);
      rowsByRepo.get(canonicalRepo).push({
        boardTeam: team.summary.expectedTeam,
        boardLabel: team.summary.label,
        repo: repoRow.repo,
        mappedTeam: repoRow.mappedTeam,
        prCount: repoRow.prCount,
        mergedPrCount: repoRow.mergedPrCount,
        issueCount: repoRow.issueCount,
        examples: repoRow.examples
      });
    }
  }

  return [...rowsByRepo.entries()]
    .map(([canonicalRepo, rows]) => {
      const boardTeams = [...new Set(rows.map((row) => row.boardTeam))].sort();
      return {
        canonicalRepo,
        boardTeams,
        boardTeamCount: boardTeams.length,
        mappedTeams: [...new Set(rows.map((row) => row.mappedTeam).filter(Boolean))].sort(),
        totalPrCount: rows.reduce((sum, row) => sum + row.prCount, 0),
        totalMergedPrCount: rows.reduce((sum, row) => sum + row.mergedPrCount, 0),
        rows: rows.sort((left, right) => left.boardTeam.localeCompare(right.boardTeam))
      };
    })
    .filter((row) => row.boardTeamCount > 1)
    .sort(
      (left, right) =>
        right.totalMergedPrCount - left.totalMergedPrCount ||
        right.totalPrCount - left.totalPrCount ||
        left.canonicalRepo.localeCompare(right.canonicalRepo)
    );
}

async function main() {
  loadEnv();
  const scopes = resolveAuditScopes();
  if (scopes.length === 0) {
    throw new Error("No audit scopes resolved. Use --team <team> and --board <boardId>.");
  }
  const outputPath = readArg("output");
  const cachePath = path.resolve(REPO_ROOT, readArg("cache", DEFAULT_CACHE_PATH));
  const concurrency = Math.max(1, Number.parseInt(readArg("concurrency", "12"), 10) || 12);
  const cache = {
    enabled: !hasFlag("no-cache"),
    rows: {},
    dirty: false
  };
  if (cache.enabled) cache.rows = readDevStatusCache(cachePath);
  const site = process.env.ATLASSIAN_SITE;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!site || !email || !token) {
    throw new Error("Missing ATLASSIAN_SITE, ATLASSIAN_EMAIL, or ATLASSIAN_API_TOKEN.");
  }

  const repoTeamMap = readRepoTeamMap();
  const auth = authHeader(email, token);
  const teams = [];
  for (const scope of scopes) {
    teams.push(await auditScope(site, auth, repoTeamMap, scope, cache, concurrency));
  }
  const allBoardRepos = new Set(
    teams.flatMap((team) => (team.repos || []).map((repo) => repo.repo))
  );
  const canonicalRepoAudit = await buildCanonicalRepoAudit(
    repoTeamMap,
    allBoardRepos,
    resolveGitHubToken(),
    Math.min(concurrency, GITHUB_PAGE_SIZE)
  );
  const sharedRepoCandidates = buildSharedRepoCandidates(teams, canonicalRepoAudit);

  const aggregate = {
    teamCount: teams.length,
    issueCount: teams.reduce((sum, team) => sum + team.summary.issueCount, 0),
    linkedIssueCount: teams.reduce((sum, team) => sum + team.summary.linkedIssueCount, 0),
    repoCount: teams.reduce((sum, team) => sum + team.summary.repoCount, 0),
    mismatchRepoCount: teams.reduce((sum, team) => sum + team.summary.mismatchRepoCount, 0),
    mismatchedPrCount: teams.reduce((sum, team) => sum + team.summary.mismatchedPrCount, 0),
    mismatchedMergedPrCount: teams.reduce(
      (sum, team) => sum + team.summary.mismatchedMergedPrCount,
      0
    ),
    unmappedRepoCount: teams.reduce((sum, team) => sum + team.summary.unmappedRepoCount, 0),
    unmappedPrCount: teams.reduce((sum, team) => sum + team.summary.unmappedPrCount, 0),
    unmappedMergedPrCount: teams.reduce(
      (sum, team) => sum + team.summary.unmappedMergedPrCount,
      0
    ),
    sharedRepoCandidateCount: sharedRepoCandidates.length,
    duplicateCanonicalRepoGroupCount: canonicalRepoAudit?.duplicateCanonicalRepoGroupCount || 0,
    excessAliasCount: canonicalRepoAudit?.excessAliasCount || 0
  };
  const report = {
    generatedAt: new Date().toISOString(),
    aggregate,
    canonicalRepoAudit,
    sharedRepoCandidates,
    teams
  };
  if (outputPath) {
    const resolvedOutputPath = path.resolve(REPO_ROOT, outputPath);
    writeJson(resolvedOutputPath, report);
  }
  if (cache.enabled && cache.dirty) writeJson(cachePath, cache.rows);

  console.log(JSON.stringify(report, null, 2));
  if (aggregate.unmappedRepoCount > 0 && !hasFlag("no-fail")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
