#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { ANALYSIS_DIR, ANALYSIS_HISTORY_DIR, CACHE_DIR } from "../dashboard-contract.mjs";

const DEFAULT_INPUT_PATH = path.posix.join(CACHE_DIR, "pr-activity-issue-cache.json");
const DEFAULT_JSON_OUTPUT_PATH = path.posix.join(ANALYSIS_DIR, "latest-team-repo-map.json");
const DEFAULT_MARKDOWN_OUTPUT_PATH = path.posix.join(ANALYSIS_DIR, "latest-team-repo-map.md");
const DEFAULT_HISTORY_DIR = ANALYSIS_HISTORY_DIR;
const TEAM_ORDER = ["api", "legacy", "react", "bc", "workers", "titanium"];
const TEAM_LABELS = {
  api: "API",
  legacy: "Legacy FE",
  react: "React FE",
  bc: "BC",
  workers: "Workers",
  titanium: "Titanium"
};

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return String(process.argv[index + 1] ?? "").trim();
}

function safeStampFromIso(isoLike) {
  return String(isoLike || "unknown")
    .replace(/[:.]/g, "-")
    .replace(/[^0-9TZ-]/g, "");
}

function teamLabel(teamKey) {
  return TEAM_LABELS[teamKey] || String(teamKey || "").trim() || "Unknown";
}

function parseRepoFromPullRequestUrl(url) {
  const match = String(url || "")
    .trim()
    .match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/);
  return match?.[1] || "";
}

function parsePullRequestNumber(url) {
  const match = String(url || "")
    .trim()
    .match(/\/pull\/(\d+)$/);
  return match?.[1] || "";
}

function sortCountRows(rows) {
  return [...rows].sort((left, right) => {
    if (right.pullRequestCount !== left.pullRequestCount) {
      return right.pullRequestCount - left.pullRequestCount;
    }
    const leftKey = String(left.key || left.repo || left.team || "").trim();
    const rightKey = String(right.key || right.repo || right.team || "").trim();
    return leftKey.localeCompare(rightKey);
  });
}

function buildSummary(rawCache) {
  const issues = rawCache?.issues && typeof rawCache.issues === "object" ? rawCache.issues : {};
  const teamRepoStats = new Map();
  const repoTeamStats = new Map();
  let issueCount = 0;
  let pullRequestRecordCount = 0;

  for (const [issueKey, entry] of Object.entries(issues)) {
    issueCount += 1;
    const records = Array.isArray(entry?.pullRequestRecords) ? entry.pullRequestRecords : [];
    pullRequestRecordCount += records.length;

    for (const record of records) {
      const team = String(record?.team || "").trim();
      const url = String(record?.url || "").trim();
      const repo = parseRepoFromPullRequestUrl(url);
      const pullRequestNumber = parsePullRequestNumber(url);
      if (!team || !repo || !pullRequestNumber) continue;

      if (!teamRepoStats.has(team)) teamRepoStats.set(team, new Map());
      if (!repoTeamStats.has(repo)) repoTeamStats.set(repo, new Map());

      const teamRepos = teamRepoStats.get(team);
      const repoTeams = repoTeamStats.get(repo);
      const existingTeamRepo = teamRepos.get(repo) || {
        key: repo,
        team,
        pullRequestCount: 0,
        issueKeys: new Set(),
        samplePullRequestUrl: url,
        sampleIssueKey: issueKey
      };
      existingTeamRepo.pullRequestCount += 1;
      existingTeamRepo.issueKeys.add(issueKey);
      if (!existingTeamRepo.samplePullRequestUrl) existingTeamRepo.samplePullRequestUrl = url;
      if (!existingTeamRepo.sampleIssueKey) existingTeamRepo.sampleIssueKey = issueKey;
      teamRepos.set(repo, existingTeamRepo);

      const existingRepoTeam = repoTeams.get(team) || {
        key: team,
        team,
        repo,
        pullRequestCount: 0,
        issueKeys: new Set(),
        samplePullRequestUrl: url,
        sampleIssueKey: issueKey
      };
      existingRepoTeam.pullRequestCount += 1;
      existingRepoTeam.issueKeys.add(issueKey);
      if (!existingRepoTeam.samplePullRequestUrl) existingRepoTeam.samplePullRequestUrl = url;
      if (!existingRepoTeam.sampleIssueKey) existingRepoTeam.sampleIssueKey = issueKey;
      repoTeams.set(team, existingRepoTeam);
    }
  }

  const byTeam = {};
  for (const team of [...TEAM_ORDER, ...[...teamRepoStats.keys()].filter((key) => !TEAM_ORDER.includes(key)).sort()]) {
    if (!teamRepoStats.has(team)) continue;
    const rows = sortCountRows(
      [...teamRepoStats.get(team).values()].map((row) => ({
        repo: row.key,
        pullRequestCount: row.pullRequestCount,
        issueCount: row.issueKeys.size,
        sampleIssueKey: row.sampleIssueKey,
        samplePullRequestUrl: row.samplePullRequestUrl
      }))
    );
    byTeam[team] = {
      teamLabel: teamLabel(team),
      totalPullRequestCount: rows.reduce((sum, row) => sum + row.pullRequestCount, 0),
      repos: rows
    };
  }

  const repoToTeam = sortCountRows(
    [...repoTeamStats.entries()].map(([repo, teams]) => {
      const teamRows = sortCountRows(
        [...teams.values()].map((row) => ({
          key: row.team,
          team: row.team,
          teamLabel: teamLabel(row.team),
          pullRequestCount: row.pullRequestCount,
          issueCount: row.issueKeys.size,
          sampleIssueKey: row.sampleIssueKey,
          samplePullRequestUrl: row.samplePullRequestUrl
        }))
      );
      const dominant = teamRows[0] || null;
      const totalPullRequestCount = teamRows.reduce((sum, row) => sum + row.pullRequestCount, 0);
      const dominantSharePct =
        totalPullRequestCount > 0
          ? Number(((dominant?.pullRequestCount || 0) / totalPullRequestCount * 100).toFixed(1))
          : 0;

      return {
        key: repo,
        repo,
        dominantTeam: dominant?.team || "",
        dominantTeamLabel: teamLabel(dominant?.team || ""),
        dominantSharePct,
        totalPullRequestCount,
        teams: teamRows
      };
    })
  ).map((row) => ({
    repo: row.repo,
    dominantTeam: row.dominantTeam,
    dominantTeamLabel: row.dominantTeamLabel,
    dominantSharePct: row.dominantSharePct,
    totalPullRequestCount: row.totalPullRequestCount,
    teams: row.teams
  }));

  const ambiguousRepos = repoToTeam.filter((repo) => repo.teams.length > 1);
  const resolvedRepoToTeam = Object.fromEntries(
    repoToTeam.map((repo) => [
      repo.repo,
      {
        team: repo.dominantTeam,
        teamLabel: repo.dominantTeamLabel,
        confidence: repo.dominantSharePct,
        totalPullRequestCount: repo.totalPullRequestCount
      }
    ])
  );

  return {
    resolutionPolicy: "dominant_team_by_pull_request_count",
    issueCount,
    pullRequestRecordCount,
    distinctRepoCount: repoToTeam.length,
    distinctTeamCount: Object.keys(byTeam).length,
    byTeam,
    repoToTeam,
    resolvedRepoToTeam,
    ambiguousRepos
  };
}

function buildMarkdown(summary, generatedAt) {
  const lines = [
    "# Team To Repo Draft Map",
    "",
    `- Generated at: ${generatedAt}`,
    `- Source: ${DEFAULT_INPUT_PATH}`,
    `- Resolution policy: dominant team by cached PR count`,
    `- Issues scanned: ${summary.issueCount}`,
    `- PR records scanned: ${summary.pullRequestRecordCount}`,
    `- Distinct repos: ${summary.distinctRepoCount}`,
    `- Multi-team repos resolved by majority: ${summary.ambiguousRepos.length}`,
    ""
  ];

  lines.push("## Draft Repo Ownership");
  for (const repo of summary.repoToTeam) {
    lines.push(
      `- ${repo.repo}: ${repo.dominantTeamLabel} (${repo.dominantSharePct}% of ${repo.totalPullRequestCount} cached PRs)`
    );
  }
  lines.push("");

  lines.push("## By Team");
  for (const team of Object.keys(summary.byTeam)) {
    const teamSummary = summary.byTeam[team];
    lines.push(
      `- ${teamSummary.teamLabel}: ${teamSummary.repos.length} repos, ${teamSummary.totalPullRequestCount} cached PRs`
    );
    for (const repo of teamSummary.repos.slice(0, 10)) {
      lines.push(
        `  - ${repo.repo}: ${repo.pullRequestCount} PRs, sample ${repo.sampleIssueKey} -> ${repo.samplePullRequestUrl}`
      );
    }
  }
  lines.push("");

  lines.push("## Multi-Team Repos Resolved By Majority");
  if (summary.ambiguousRepos.length === 0) {
    lines.push("- None");
  } else {
    for (const repo of summary.ambiguousRepos) {
      const teamBreakdown = repo.teams
        .map((team) => `${team.teamLabel} ${team.pullRequestCount}`)
        .join(", ");
      lines.push(
        `- ${repo.repo}: assigned to ${repo.dominantTeamLabel} (${repo.dominantSharePct}%) from ${teamBreakdown}`
      );
    }
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const inputPath = path.resolve(getArg("--input") || DEFAULT_INPUT_PATH);
  const jsonOutputPath = path.resolve(getArg("--json-output") || DEFAULT_JSON_OUTPUT_PATH);
  const markdownOutputPath = path.resolve(
    getArg("--markdown-output") || DEFAULT_MARKDOWN_OUTPUT_PATH
  );
  const historyDirPath = path.resolve(getArg("--history-dir") || DEFAULT_HISTORY_DIR);

  const raw = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const generatedAt = new Date().toISOString();
  const summary = buildSummary(raw);
  const payload = {
    generatedAt,
    inputPath,
    ...summary
  };
  const markdown = buildMarkdown(summary, generatedAt);
  const stamp = safeStampFromIso(generatedAt);
  const archivedJsonOutputPath = path.join(historyDirPath, `team-repo-map-${stamp}.json`);
  const archivedMarkdownOutputPath = path.join(historyDirPath, `team-repo-map-${stamp}.md`);

  await fs.mkdir(path.dirname(jsonOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(markdownOutputPath), { recursive: true });
  await fs.mkdir(historyDirPath, { recursive: true });

  await fs.writeFile(jsonOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownOutputPath, markdown, "utf8");
  await fs.writeFile(archivedJsonOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(archivedMarkdownOutputPath, markdown, "utf8");

  console.log(`Wrote team repo map JSON: ${jsonOutputPath}`);
  console.log(`Wrote team repo map Markdown: ${markdownOutputPath}`);
  console.log(`Archived JSON history copy: ${archivedJsonOutputPath}`);
  console.log(`Archived Markdown history copy: ${archivedMarkdownOutputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
