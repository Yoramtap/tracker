#!/usr/bin/env node

import { spawn } from "node:child_process";

const PHASES = {
  "pr-activity": {
    env: {
      PR_ACTIVITY_ONLY: "true",
      SKIP_TREND_REFRESH: "true",
      NO_WRITE: "true"
    }
  },
  "pr-cycle": {
    env: {
      PR_CYCLE_ONLY: "true",
      NO_WRITE: "true"
    }
  },
  "pr-cycle-rebuild": {
    env: {
      PR_CYCLE_ONLY: "true",
      PR_CYCLE_REBUILD_ALL: "true",
      NO_WRITE: "true"
    }
  },
  "product-cycle": {
    env: {
      PRODUCT_CYCLE_ONLY: "true",
      NO_WRITE: "true"
    }
  },
  uat: {
    env: {
      UAT_ONLY: "true",
      SKIP_UAT_AGING: "false",
      NO_WRITE: "true"
    }
  },
  "uat-flow": {
    env: {
      UAT_ONLY: "true",
      SKIP_UAT_AGING: "true",
      NO_WRITE: "true"
    }
  }
};

function formatDurationMs(durationMs) {
  const safeDurationMs = Math.max(0, Number(durationMs) || 0);
  if (safeDurationMs < 1000) return `${safeDurationMs}ms`;
  if (safeDurationMs < 60000) return `${(safeDurationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(safeDurationMs / 60000);
  const seconds = ((safeDurationMs % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function resolvePhases(argv) {
  const requested = argv.slice(2).map((value) => String(value || "").trim()).filter(Boolean);
  if (requested.length === 0) return Object.keys(PHASES);
  const unknown = requested.filter((phase) => !PHASES[phase]);
  if (unknown.length > 0) {
    throw new Error(
      `Unknown benchmark phase(s): ${unknown.join(", ")}. Valid phases: ${Object.keys(PHASES).join(", ")}.`
    );
  }
  return requested;
}

async function runPhase(phase) {
  const config = PHASES[phase];
  const env = {
    ...process.env,
    ...config.env
  };
  const startedAtMs = Date.now();

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/refresh-report-data.mjs"], {
      cwd: process.cwd(),
      env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Benchmark phase ${phase} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`
        )
      );
    });
  });

  const durationMs = Date.now() - startedAtMs;
  console.log(`Benchmark ${phase}: ${formatDurationMs(durationMs)}.`);
  return { phase, durationMs };
}

async function main() {
  const phases = resolvePhases(process.argv);
  const results = [];
  for (const phase of phases) {
    console.log(`\n=== Benchmark: ${phase} ===`);
    results.push(await runPhase(phase));
  }

  console.log("\nBenchmark summary:");
  for (const result of results) {
    console.log(`- ${result.phase}: ${formatDurationMs(result.durationMs)}`);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
