#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DATES = [
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
  "2026-02-02",
];

const BOARDS = [
  {
    constName: "BOARD_38_TREND",
    label: "API",
    doneStatuses: '(Done, "Won\'t Fix", Duplicate)',
  },
  {
    constName: "BOARD_39_TREND",
    label: "Frontend",
    doneStatuses: '(Done, "Won\'t Fix")',
  },
  {
    constName: "BOARD_46_TREND",
    label: "NewFrontend",
    doneStatuses: '(Done, "Won\'t Fix")',
  },
];

const PAGE_SIZE = 100;
const MAX_RETRIES = 5;

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
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

function asOfDateTime(date) {
  return `${date} 23:59`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jiraSearch(site, email, token, jql, nextPageToken = "", maxResults = PAGE_SIZE) {
  const url = `https://${site}/rest/api/3/search/jql`;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql,
          maxResults,
          ...(nextPageToken ? { nextPageToken } : {}),
          fields: ["priority"],
        }),
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

function countPriority(counts, priorityName) {
  const normalized = String(priorityName || "").trim().toLowerCase();
  if (normalized === "highest") counts.highest += 1;
  else if (normalized === "high") counts.high += 1;
  else if (normalized === "medium") counts.medium += 1;
  else if (normalized === "low") counts.low += 1;
  else if (normalized === "lowest") counts.lowest += 1;
}

async function countFor(board, date, site, email, token) {
  const jql = [
    "project = TFC",
    "AND type = Bug",
    `AND labels = ${board.label}`,
    `AND created <= "${asOfDateTime(date)}"`,
    `AND status WAS NOT IN ${board.doneStatuses} ON "${date}"`,
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

function formatTrendBlock(constName, points) {
  const lines = points.map((point) => {
    return `  { date: ${JSON.stringify(point.date)}, highest: ${point.highest}, high: ${point.high}, medium: ${point.medium}, low: ${point.low}, lowest: ${point.lowest} },`;
  });
  return `const ${constName}: TrendPoint[] = [\n${lines.join("\n")}\n];`;
}

function replaceConstBlock(source, constName, nextBlock) {
  const startMarker = `const ${constName}: TrendPoint[] = [`;
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find ${constName} block in data.ts`);
  const end = source.indexOf("];", start);
  if (end === -1) throw new Error(`Could not find end of ${constName} block in data.ts`);
  return `${source.slice(0, start)}${nextBlock}${source.slice(end + 2)}`;
}

async function buildBoardTrend(board, site, email, token) {
  const points = [];
  for (const date of DATES) {
    const counts = await countFor(board, date, site, email, token);
    console.log(
      `[${board.constName}] ${date}: Hst ${counts.highest}, H ${counts.high}, M ${counts.medium}, L ${counts.low}, Lst ${counts.lowest}`,
    );
    points.push({ date, ...counts });
  }
  return points;
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

  const computed = {};
  for (const board of BOARDS) {
    computed[board.constName] = await buildBoardTrend(board, site, email, token);
    console.log(`Computed ${board.constName} (${DATES.length} points).`);
  }

  const dataPath = path.resolve(process.cwd(), "src/app/backlog/data.ts");
  let source = await fs.readFile(dataPath, "utf8");

  for (const board of BOARDS) {
    source = replaceConstBlock(
      source,
      board.constName,
      formatTrendBlock(board.constName, computed[board.constName]),
    );
  }

  source = source.replace(/syncedAt: ".*?"/, `syncedAt: "${new Date().toISOString()}"`);
  source = source.replace(
    /note: ".*?"/,
    'note: "Backlog trends are generated from Jira historical JQL snapshots (status and priority as-of each date)."',
  );

  await fs.writeFile(dataPath, source, "utf8");
  console.log("Updated BOARD_38_TREND, BOARD_39_TREND, and BOARD_46_TREND.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
