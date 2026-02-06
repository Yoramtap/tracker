#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const BOARD_ID = 38;
const MAX_SPRINTS = 14;
const PRIORITIES = ["highest", "high", "medium", "low", "lowest"];
const DONE_STATUSES = '(Done, "Won\'t Fix", Duplicate)';

function env(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  return value.trim();
}

async function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.backlog"),
    path.resolve(process.cwd(), ".env.local"),
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

function toIsoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function asOfDateTime(value) {
  return `${value} 23:59`;
}

function mapPriority(priorityName) {
  const value = (priorityName ?? "").toLowerCase();
  if (value === "highest") return "highest";
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";
  if (value === "lowest") return "lowest";
  return null;
}

async function jiraFetch(site, email, token, endpoint, query = {}) {
  const params = new URLSearchParams(query);
  const url = `https://${site}${endpoint}${params.toString() ? `?${params.toString()}` : ""}`;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira request failed (${response.status}) ${endpoint}: ${body}`);
  }

  return response.json();
}

async function fetchClosedSprints(site, email, token) {
  const sprints = [];
  let startAt = 0;

  while (true) {
    const payload = await jiraFetch(site, email, token, `/rest/agile/1.0/board/${BOARD_ID}/sprint`, {
      state: "closed",
      startAt: String(startAt),
      maxResults: "50",
    });

    sprints.push(...(payload.values ?? []));
    startAt += payload.maxResults ?? 50;
    if (payload.isLast || startAt >= (payload.total ?? 0)) {
      break;
    }
  }

  return sprints
    .filter((sprint) => sprint.endDate)
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
    .slice(-MAX_SPRINTS);
}

async function fetchIssuesForAsOf(site, email, token, endDate) {
  const issues = [];
  let startAt = 0;

  const jql = [
    "project = TFC",
    "AND type = Bug",
    "AND labels = API",
    `AND created <= "${asOfDateTime(endDate)}"`,
    `AND status WAS NOT IN ${DONE_STATUSES} ON "${endDate}"`,
  ].join(" ");

  while (true) {
    const payload = await jiraFetch(site, email, token, "/rest/api/3/search", {
      jql,
      fields: "priority",
      startAt: String(startAt),
      maxResults: "100",
    });

    issues.push(...(payload.issues ?? []));
    startAt += payload.maxResults ?? 100;
    if (startAt >= (payload.total ?? 0)) {
      break;
    }
  }

  return issues;
}

function formatTrendBlock(points) {
  const lines = points.map((point) => {
    return `  { date: ${JSON.stringify(point.date)}, highest: ${point.highest}, high: ${point.high}, medium: ${point.medium}, low: ${point.low}, lowest: ${point.lowest} },`;
  });
  return `const BOARD_38_TREND: TrendPoint[] = [\n${lines.join("\n")}\n];`;
}

async function main() {
  await loadLocalEnv();

  const site = env("ATLASSIAN_SITE", "nepgroup.atlassian.net");
  const email = env("ATLASSIAN_EMAIL");
  const token = env("ATLASSIAN_API_TOKEN");

  if (!email || !token) {
    throw new Error(
      "Missing credentials. Set ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN (and optionally ATLASSIAN_SITE).",
    );
  }

  const sprints = await fetchClosedSprints(site, email, token);
  const points = [];

  for (const sprint of sprints) {
    const endDate = toIsoDate(sprint.endDate);
    const issues = await fetchIssuesForAsOf(site, email, token, endDate);
    const counts = { highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };

    for (const issue of issues) {
      const bucket = mapPriority(issue.fields?.priority?.name);
      if (bucket) counts[bucket] += 1;
    }

    points.push({
      date: sprint.name,
      ...counts,
    });
  }

  const dataPath = path.resolve(process.cwd(), "src/app/backlog/data.ts");
  let source = await fs.readFile(dataPath, "utf8");

  const trendRegex = /const BOARD_38_TREND: TrendPoint\[\] = \[[\s\S]*?\];/;
  if (!trendRegex.test(source)) {
    throw new Error("Could not find BOARD_38_TREND block in data.ts");
  }

  source = source.replace(trendRegex, formatTrendBlock(points));
  source = source.replace(
    /syncedAt: ".*?"/,
    `syncedAt: "${new Date().toISOString()}"`,
  );
  source = source.replace(
    /note: ".*?"/,
    'note: "Board 38 sprint trend is now populated from Jira historical as-of queries (not manual points)."',
  );

  await fs.writeFile(dataPath, source, "utf8");

  console.log(`Updated BOARD_38_TREND with ${points.length} closed API sprints from Jira.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
