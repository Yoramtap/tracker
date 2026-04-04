#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  ANALYSIS_HISTORY_DIR,
  PRIMARY_DASHBOARD_SNAPSHOT_PATH,
  SNAPSHOT_HISTORY_DIR
} from "../dashboard-contract.mjs";

const PRIORITIES = ["highest", "high", "medium", "low", "lowest"];
const TEAMS = ["api", "legacy", "react", "bc"];
const TEAM_LABELS = {
  api: "API Team",
  legacy: "Legacy FE",
  react: "React FE",
  bc: "Broadcast Team"
};
const DEFAULT_INPUT = PRIMARY_DASHBOARD_SNAPSHOT_PATH;
const DEFAULT_HISTORY_DIR = SNAPSHOT_HISTORY_DIR;
const DEFAULT_REPORT_HISTORY_DIR = ANALYSIS_HISTORY_DIR;

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumPriorities(teamPoint) {
  return PRIORITIES.reduce((acc, priority) => acc + numberOrZero(teamPoint?.[priority]), 0);
}

function sumUrgent(teamPoint) {
  return numberOrZero(teamPoint?.highest) + numberOrZero(teamPoint?.high);
}

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "n/a";
  const rounded = value.toFixed(1);
  return `${rounded}%`;
}

function teamLabel(teamKey) {
  return TEAM_LABELS[teamKey] || teamKey;
}

function safeStampFromIso(isoLike) {
  return String(isoLike || "unknown")
    .replace(/[:.]/g, "-")
    .replace(/[^0-9TZ-]/g, "");
}

function buildBugSeries(points) {
  return points.map((point) => {
    const byTeam = {};
    for (const team of TEAMS) {
      byTeam[team] = {
        total: sumPriorities(point?.[team]),
        urgent: sumUrgent(point?.[team])
      };
    }

    const total = TEAMS.reduce((acc, team) => acc + byTeam[team].total, 0);
    const urgent = TEAMS.reduce((acc, team) => acc + byTeam[team].urgent, 0);

    return {
      date: String(point?.date || ""),
      total,
      urgent,
      byTeam
    };
  });
}

function summarizeBugs(series) {
  const first = series[0];
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;

  const totalDelta = last.total - first.total;
  const totalDeltaPct = first.total > 0 ? (totalDelta / first.total) * 100 : Number.NaN;
  const urgentDelta = last.urgent - first.urgent;
  const urgentDeltaPct = first.urgent > 0 ? (urgentDelta / first.urgent) * 100 : Number.NaN;

  let teamGrowth = [];
  for (const team of TEAMS) {
    const delta = last.byTeam[team].total - first.byTeam[team].total;
    teamGrowth.push({ team, delta, latest: last.byTeam[team].total });
  }
  teamGrowth = teamGrowth.sort((a, b) => b.delta - a.delta);

  const topLatestTeam = [...teamGrowth].sort((a, b) => b.latest - a.latest)[0];
  const biggestGrowth = teamGrowth[0];
  const biggestDrop = teamGrowth[teamGrowth.length - 1];

  const recentDelta = prev ? last.total - prev.total : 0;
  const recentUrgentDelta = prev ? last.urgent - prev.urgent : 0;
  const byTeam = TEAMS.map((team) => ({
    team,
    firstTotal: first.byTeam[team].total,
    lastTotal: last.byTeam[team].total,
    deltaTotal: last.byTeam[team].total - first.byTeam[team].total,
    firstUrgent: first.byTeam[team].urgent,
    lastUrgent: last.byTeam[team].urgent,
    deltaUrgent: last.byTeam[team].urgent - first.byTeam[team].urgent
  }));

  return {
    first,
    last,
    totalDelta,
    totalDeltaPct,
    urgentDelta,
    urgentDeltaPct,
    topLatestTeam,
    biggestGrowth,
    biggestDrop,
    recentDelta,
    recentUrgentDelta,
    byTeam
  };
}

function summarizeUat(uatAging) {
  const priorities = uatAging?.priorities || {};
  const totalIssues = numberOrZero(uatAging?.totalIssues);

  let longAged = 0;
  let longestAvg = { priority: "n/a", avgDays: -1 };
  let oldestMax = { priority: "n/a", maxDays: -1 };

  for (const priority of PRIORITIES) {
    const row = priorities[priority] || {};
    const buckets = row.buckets || {};
    const avgDays = numberOrZero(row.avgDays);
    const maxDays = numberOrZero(row.maxDays);

    longAged += numberOrZero(buckets.d31_60) + numberOrZero(buckets.d61_plus);

    if (avgDays > longestAvg.avgDays) {
      longestAvg = { priority, avgDays };
    }
    if (maxDays > oldestMax.maxDays) {
      oldestMax = { priority, maxDays };
    }
  }

  const longAgedPct = totalIssues > 0 ? (longAged / totalIssues) * 100 : Number.NaN;

  return {
    totalIssues,
    longAged,
    longAgedPct,
    longestAvg,
    oldestMax
  };
}

function asIsoString(value) {
  const asMs = new Date(String(value || "")).getTime();
  if (!Number.isFinite(asMs)) return "";
  return new Date(asMs).toISOString();
}

async function readUatHistory(historyDirPath) {
  let entries = [];
  try {
    entries = await fs.readdir(historyDirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const snapshots = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json")) continue;
    const fullPath = path.join(historyDirPath, entry.name);
    let parsed;
    try {
      parsed = JSON.parse(await fs.readFile(fullPath, "utf8"));
    } catch {
      continue;
    }
    const uat = summarizeUat(parsed?.uatAging || {});
    const timestamp =
      asIsoString(parsed?.source?.syncedAt) ||
      asIsoString(parsed?.updatedAt) ||
      asIsoString(parsed?.uatAging?.generatedAt);
    if (!timestamp) continue;

    snapshots.push({
      file: entry.name,
      timestamp,
      totalIssues: uat.totalIssues,
      longAged: uat.longAged,
      longAgedPct: uat.longAgedPct
    });
  }

  snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return snapshots;
}

function summarizeUatHistory(historyPoints) {
  if (historyPoints.length < 2) return null;

  const first = historyPoints[0];
  const last = historyPoints[historyPoints.length - 1];
  const prev = historyPoints[historyPoints.length - 2];

  let worst = historyPoints[0];
  for (const point of historyPoints) {
    if (numberOrZero(point.longAgedPct) > numberOrZero(worst.longAgedPct)) {
      worst = point;
    }
  }

  return {
    first,
    last,
    prev,
    deltaLongAgedPct: numberOrZero(last.longAgedPct) - numberOrZero(first.longAgedPct),
    deltaTotalIssues: numberOrZero(last.totalIssues) - numberOrZero(first.totalIssues),
    deltaLongAgedCount: numberOrZero(last.longAged) - numberOrZero(first.longAged),
    latestDeltaLongAgedPct: numberOrZero(last.longAgedPct) - numberOrZero(prev.longAgedPct),
    latestDeltaTotalIssues: numberOrZero(last.totalIssues) - numberOrZero(prev.totalIssues),
    worst
  };
}

function buildMarkdown(snapshot, bugSummary, uatSummary, pointCount, uatHistorySummary) {
  const generatedAt = new Date().toISOString();
  const snapshotUpdated = String(snapshot?.updatedAt || "n/a");

  const backlogDirection =
    bugSummary.totalDelta > 0 ? "up" : bugSummary.totalDelta < 0 ? "down" : "flat";

  const riskLevel =
    uatSummary.longAgedPct >= 40 ? "high" : uatSummary.longAgedPct >= 25 ? "medium" : "lower";

  const backlogGoalGap = bugSummary.last.total;
  const urgentGoalGap = bugSummary.last.urgent;
  const broadcastRow = bugSummary.byTeam.find((row) => row.team === "bc") || null;
  const broadcastBacklog = broadcastRow ? broadcastRow.lastTotal : 0;
  const broadcastUrgent = broadcastRow ? broadcastRow.lastUrgent : 0;
  const broadcastTrendDelta = broadcastRow ? broadcastRow.deltaTotal : 0;

  const perspectiveLines = [];
  if (bugSummary.totalDelta > 0 && bugSummary.urgentDelta >= 0) {
    perspectiveLines.push(
      "Backlog growth with non-improving highest+high load suggests intake is outpacing resolution in key lanes."
    );
  } else if (bugSummary.totalDelta > 0 && bugSummary.urgentDelta < 0) {
    perspectiveLines.push(
      "Total backlog is growing, but highest+high pressure is improving, which indicates triage may be working even as volume accumulates."
    );
  } else if (bugSummary.totalDelta < 0 && bugSummary.urgentDelta <= 0) {
    perspectiveLines.push(
      "Backlog and highest+high load are both trending down, indicating healthier throughput and prioritization."
    );
  } else {
    perspectiveLines.push(
      "Signals are mixed across total and highest+high backlog, so decisions should focus on bottleneck teams and aging risk concentration."
    );
  }

  if (uatSummary.longAgedPct >= 40) {
    perspectiveLines.push(
      "A large share of UAT is aging 31+ days, which is likely to delay defect closure and increase release uncertainty."
    );
  } else if (uatSummary.longAgedPct >= 25) {
    perspectiveLines.push(
      "UAT aging is moderate; targeted cleanup can prevent this from becoming a release-risk cluster."
    );
  } else {
    perspectiveLines.push(
      "UAT aging is relatively contained; maintaining flow discipline should keep risk manageable."
    );
  }

  const actions = [];
  actions.push(
    `Assign an owner for ${teamLabel(bugSummary.topLatestTeam.team)} backlog and run a weekly burn-down target until its total drops.`
  );
  if (bugSummary.urgentDelta > 0) {
    actions.push(
      "Run a priority gate for new highest/high bugs this sprint (strict entry criteria + explicit fast-track owner)."
    );
  } else {
    actions.push(
      "Preserve current highest+high triage pattern and codify it as a standard operating check at sprint boundary."
    );
  }
  if (uatSummary.longAgedPct >= 25) {
    actions.push(
      `Schedule a UAT aging sweep focused on ${uatSummary.oldestMax.priority} tickets, starting with the 61+ day bucket.`
    );
  } else {
    actions.push("Keep UAT under control with a simple WIP cap per priority lane.");
  }
  actions.push(
    "Add this analysis to the sprint-close ritual and compare against previous run to confirm direction of change."
  );
  if (uatHistorySummary) {
    actions.push(
      "Use the UAT history trend to set a numeric target for 31+ day aging reduction by next sprint close."
    );
  }
  actions.unshift(
    "Set a monthly backlog-to-zero trajectory: define expected total backlog ceiling for each month and enforce it in sprint planning."
  );
  actions.push(
    "Create a dedicated Broadcast Team unblock lane: reserve fixed weekly capacity for UAT exits (not new intake) until aging pressure normalizes."
  );

  const annualPlan = [
    "Q1: Stabilize intake and stop highest+high growth. Gate new highest/high bugs and enforce owner assignment within 24h.",
    "Q2: Burn down historical backlog. Prioritize largest legacy buckets and retire old defects in planned waves.",
    "Q3: Hold near-zero trend line. Keep backlog under monthly ceiling and block scope that causes recurring bug classes.",
    "Q4: Lock reliability gains. Focus on prevention, flaky-area hardening, and sustained UAT flow discipline."
  ];

  const goalStatus = [
    `- Backlog to zero goal: current gap is ${backlogGoalGap} total bugs (highest+high gap ${urgentGoalGap}). Direction is ${backlogDirection}.`,
    `- Broadcast unblock goal: Broadcast Team backlog is ${broadcastBacklog} (highest+high ${broadcastUrgent}), with window delta ${formatDelta(broadcastTrendDelta)}.`,
    `- UAT pressure: ${formatPercent(uatSummary.longAgedPct)} of UAT is 31+ days (${uatSummary.longAged}/${uatSummary.totalIssues}).`
  ];

  const goal1Health =
    bugSummary.totalDelta <= 0 && bugSummary.urgentDelta <= 0
      ? "on track"
      : bugSummary.totalDelta <= 0
        ? "partially on track"
        : "off track";
  const goal2Health =
    broadcastTrendDelta <= 0 && uatSummary.longAgedPct < 25
      ? "on track"
      : broadcastTrendDelta <= 0 || uatSummary.longAgedPct < 35
        ? "partially on track"
        : "off track";

  return [
    "# Goal-First Report Breakdown",
    "",
    `- Generated at: ${generatedAt}`,
    `- Snapshot updatedAt: ${snapshotUpdated}`,
    `- Trend points analyzed: ${pointCount}`,
    "",
    "## Annual Goals Context",
    "- Goal 1: Reduce total bug backlog trend to 0 during this year.",
    "- Goal 2: Unblock Broadcast Team by reducing UAT aging pressure.",
    "",
    "## Goal Status Snapshot",
    `- Goal 1 health: **${goal1Health}**`,
    `- Goal 2 health: **${goal2Health}**`,
    ...goalStatus,
    "",
    "## Goal 1: Backlog Trend to Zero",
    `- Window: ${bugSummary.first.date} -> ${bugSummary.last.date}`,
    `- Total backlog moved ${bugSummary.first.total} -> ${bugSummary.last.total} (${formatDelta(bugSummary.totalDelta)}, ${formatPercent(bugSummary.totalDeltaPct)})`,
    `- Highest+high backlog moved ${bugSummary.first.urgent} -> ${bugSummary.last.urgent} (${formatDelta(bugSummary.urgentDelta)}, ${formatPercent(bugSummary.urgentDeltaPct)})`,
    `- Latest interval change: total ${formatDelta(bugSummary.recentDelta)}, highest+high ${formatDelta(bugSummary.recentUrgentDelta)}`,
    `- Remaining gap to zero: ${backlogGoalGap} total bugs (${urgentGoalGap} highest+high)`,
    "",
    "### Goal 1 Team Breakdown",
    `- Largest current team backlog: ${teamLabel(bugSummary.topLatestTeam.team)} (${bugSummary.topLatestTeam.latest})`,
    `- Biggest growth in window: ${teamLabel(bugSummary.biggestGrowth.team)} (${formatDelta(bugSummary.biggestGrowth.delta)})`,
    `- Biggest reduction in window: ${teamLabel(bugSummary.biggestDrop.team)} (${formatDelta(bugSummary.biggestDrop.delta)})`,
    ...bugSummary.byTeam.map(
      (row) =>
        `- ${teamLabel(row.team)}: total ${row.firstTotal} -> ${row.lastTotal} (${formatDelta(row.deltaTotal)}), highest+high ${row.firstUrgent} -> ${row.lastUrgent} (${formatDelta(row.deltaUrgent)})`
    ),
    "",
    "## Goal 2: Unblock Broadcast Team via UAT",
    `- Broadcast Team backlog is ${broadcastBacklog} with highest+high ${broadcastUrgent}; trend delta is ${formatDelta(broadcastTrendDelta)}.`,
    `- Total UAT issues: ${uatSummary.totalIssues}`,
    `- Aged 31+ days: ${uatSummary.longAged} (${formatPercent(uatSummary.longAgedPct)})`,
    `- Highest average days in UAT: ${uatSummary.longestAvg.priority} (${uatSummary.longestAvg.avgDays} days)`,
    `- Highest max days in UAT: ${uatSummary.oldestMax.priority} (${uatSummary.oldestMax.maxDays} days)`,
    ...(uatHistorySummary
      ? [
          `- History window: ${uatHistorySummary.first.timestamp.slice(0, 10)} -> ${uatHistorySummary.last.timestamp.slice(0, 10)}`,
          `- 31+ day share: ${formatPercent(uatHistorySummary.first.longAgedPct)} -> ${formatPercent(uatHistorySummary.last.longAgedPct)} (${formatDelta(Number(uatHistorySummary.deltaLongAgedPct.toFixed(1)))} pts)`,
          `- 31+ day issue count: ${uatHistorySummary.first.longAged} -> ${uatHistorySummary.last.longAged} (${formatDelta(uatHistorySummary.deltaLongAgedCount)})`,
          `- Total UAT issues: ${uatHistorySummary.first.totalIssues} -> ${uatHistorySummary.last.totalIssues} (${formatDelta(uatHistorySummary.deltaTotalIssues)})`,
          `- Latest interval delta: 31+ day share ${formatDelta(Number(uatHistorySummary.latestDeltaLongAgedPct.toFixed(1)))} pts, total issues ${formatDelta(uatHistorySummary.latestDeltaTotalIssues)}`,
          `- Worst 31+ day share in history: ${formatPercent(uatHistorySummary.worst.longAgedPct)} (${uatHistorySummary.worst.timestamp.slice(0, 10)})`
        ]
      : []),
    "",
    "## Perspective",
    `- Overall risk posture is **${riskLevel}** based on backlog direction and UAT aging concentration.`,
    ...perspectiveLines.map((line) => `- ${line}`),
    `- To hit the annual goal, focus on closing the ${backlogGoalGap}-bug remaining gap while reversing highest+high growth.`,
    `- Broadcast Team is the highest-leverage lane for system-wide improvement right now.`,
    "",
    "## Recommendations",
    ...actions.map((line, index) => `${index + 1}. ${line}`),
    "",
    "## This-Year Execution Plan",
    ...annualPlan.map((line, index) => `${index + 1}. ${line}`),
    ""
  ].join("\n");
}

async function main() {
  const inputPath = path.resolve(getArg("--input") || DEFAULT_INPUT);
  const outputPathArg = getArg("--output");
  const outputPath = outputPathArg ? path.resolve(outputPathArg) : "";
  const historyDirPath = path.resolve(getArg("--history-dir") || DEFAULT_HISTORY_DIR);
  const reportHistoryDirPath = path.resolve(
    getArg("--report-history-dir") || DEFAULT_REPORT_HISTORY_DIR
  );

  const raw = await fs.readFile(inputPath, "utf8");
  const snapshot = JSON.parse(raw);
  const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];

  if (points.length < 2) {
    throw new Error(
      `Need at least 2 combinedPoints in ${PRIMARY_DASHBOARD_SNAPSHOT_PATH} to analyze trend over time.`
    );
  }

  const bugSeries = buildBugSeries(points);
  const bugSummary = summarizeBugs(bugSeries);
  const uatSummary = summarizeUat(snapshot?.uatAging || {});
  const uatHistoryPoints = await readUatHistory(historyDirPath);
  const uatHistorySummary = summarizeUatHistory(uatHistoryPoints);
  const report = buildMarkdown(snapshot, bugSummary, uatSummary, points.length, uatHistorySummary);
  const generatedAtIso = new Date().toISOString();
  const archivedReportPath = path.join(
    reportHistoryDirPath,
    `analysis-${safeStampFromIso(generatedAtIso)}.md`
  );

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${report}\n`, "utf8");
    console.log(`Wrote analysis report: ${outputPath}`);
  } else {
    console.log(report);
  }

  await fs.mkdir(reportHistoryDirPath, { recursive: true });
  await fs.writeFile(archivedReportPath, `${report}\n`, "utf8");
  console.log(`Archived analysis history copy: ${archivedReportPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
