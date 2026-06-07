import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrActivityQualityReport,
  buildPrCycleInflowConsistencyFindings,
  summarizePrActivityWindow
} from "./check-dashboard-data-quality.mjs";

const TEAM_KEYS = ["api", "legacy", "react", "bc", "workers", "titanium"];

function teamMetrics(overrides = {}) {
  return Object.fromEntries(
    TEAM_KEYS.map((team) => [
      team,
      {
        offered: Number(overrides[team] || 0),
        merged: 0,
        aiOffered: 0,
        nonAiOffered: Number(overrides[team] || 0),
        avgReviewToMergeDays: 0,
        avgReviewToMergeSampleCount: 0
      }
    ])
  );
}

function point(date, overrides) {
  return { date, ...teamMetrics(overrides) };
}

function snapshot({ updatedAt = "2026-06-07T07:29:08.069Z", apiScale = 1 } = {}) {
  return {
    updatedAt,
    prActivity: {
      points: [
        point("2026-03-02", { api: 10 * apiScale, react: 4, bc: 2 }),
        point("2026-05-11", { api: 12 * apiScale, react: 5, workers: 2 }),
        point("2026-05-25", { api: 15 * apiScale, react: 6, titanium: 1 })
      ],
      monthlyPoints: [
        point("2025-05-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-06-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-07-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-08-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-09-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-10-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-11-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2025-12-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2026-01-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2026-02-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2026-03-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2026-04-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2026-05-01", { api: 30 * apiScale, react: 20, bc: 10 }),
        point("2026-06-01", { api: 999 * apiScale, react: 999, bc: 999 })
      ]
    }
  };
}

test("PR activity quality report fails when baseline/live is newer than local", () => {
  const report = buildPrActivityQualityReport(
    snapshot({ updatedAt: "2026-06-05T00:00:00.000Z" }),
    snapshot({ updatedAt: "2026-06-07T00:00:00.000Z" }),
    { totalDeltaThreshold: 0.35, teamDeltaThreshold: 0.75 }
  );

  assert.equal(
    report.findings.some((finding) => finding.type === "live-newer-than-local"),
    true
  );
});

test("PR activity quality report flags large team and total deltas", () => {
  const report = buildPrActivityQualityReport(
    snapshot({ apiScale: 4 }),
    snapshot({ apiScale: 1 }),
    { totalDeltaThreshold: 0.35, teamDeltaThreshold: 0.75 }
  );

  assert.equal(
    report.findings.some(
      (finding) =>
        finding.type === "window-team-delta" &&
        finding.windowKey === "1y" &&
        finding.team === "api"
    ),
    true
  );
  assert.equal(
    report.findings.some(
      (finding) => finding.type === "window-total-delta" && finding.windowKey === "1y"
    ),
    true
  );
});

test("PR activity monthly windows ignore the current partial month", () => {
  const summary = summarizePrActivityWindow(snapshot(), "1y");

  assert.equal(summary.firstDate, "2025-05-01");
  assert.equal(summary.lastDate, "2026-05-01");
  assert.equal(summary.bucketCount, 13);
  assert.equal(summary.teams.api, 390);
});

test("PR cycle inflow consistency flags derived values that drift from PR activity", () => {
  const findings = buildPrCycleInflowConsistencyFindings(snapshot(), {
    windows: {
      "90d": {
        teams: [
          {
            key: "api",
            avgPrInflow: 99
          }
        ]
      }
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "pr-cycle-inflow-mismatch");
  assert.equal(findings[0].windowKey, "90d");
  assert.equal(findings[0].team, "api");
});
