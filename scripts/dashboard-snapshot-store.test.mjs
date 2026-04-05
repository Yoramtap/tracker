import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProductCycleShipmentsSnapshot,
  buildSupplementalWriteArtifacts
} from "./dashboard-snapshot-store.mjs";
import {
  sanitizeContributorsSnapshot,
  sanitizePrCycleSnapshot,
  sanitizeProductCycleSnapshot
} from "./snapshot-sanitizers.mjs";

test("buildSupplementalWriteArtifacts returns sanitized artifacts in stable order", () => {
  const contributorsSnapshot = {
    updatedAt: "2026-04-05T10:00:00.000Z",
    summary: {
      total_issues: 3,
      active_issues: 2,
      done_issues: 1,
      total_contributors: 1,
      linked_issues: 0
    },
    chartData: {
      rows: [{ contributor: "Ada", totalIssues: 3, doneIssues: 1, activeIssues: 2 }]
    }
  };
  const productCycleSnapshot = {
    generatedAt: "2026-04-05T11:00:00.000Z",
    chartData: {},
    detailData: {
      shippedTimeline: {
        timelineStart: "2026-01-01",
        timelineEnd: "2026-01-31",
        totalShipped: 4,
        months: []
      }
    }
  };
  const prCycleSnapshot = {
    updatedAt: "2026-04-05T12:00:00.000Z",
    defaultTeam: "api",
    defaultWindow: "30d",
    windows: {
      "30d": {
        windowLabel: "Last 30 days",
        teams: []
      }
    }
  };

  const artifacts = buildSupplementalWriteArtifacts({
    contributorsSnapshot,
    productCycleSnapshot,
    prCycleSnapshot
  });

  assert.deepEqual(
    artifacts.map((artifact) => artifact.fileName),
    [
      "contributors-snapshot.json",
      "product-cycle-snapshot.json",
      "product-cycle-shipments-snapshot.json",
      "pr-cycle-snapshot.json"
    ]
  );
  assert.deepEqual(
    artifacts.map((artifact) => artifact.logMessage),
    [
      "Wrote contributors-snapshot.json.",
      "Wrote product-cycle-snapshot.json.",
      "Wrote product-cycle-shipments-snapshot.json.",
      ""
    ]
  );
  assert.deepEqual(artifacts[0].outputSnapshot, sanitizeContributorsSnapshot(contributorsSnapshot));
  assert.deepEqual(artifacts[1].outputSnapshot, sanitizeProductCycleSnapshot(productCycleSnapshot));
  assert.deepEqual(
    artifacts[2].outputSnapshot,
    buildProductCycleShipmentsSnapshot(productCycleSnapshot)
  );
  assert.deepEqual(artifacts[3].outputSnapshot, sanitizePrCycleSnapshot(prCycleSnapshot));
  artifacts.forEach((artifact) => {
    assert.equal(typeof artifact.write, "function");
  });
});
