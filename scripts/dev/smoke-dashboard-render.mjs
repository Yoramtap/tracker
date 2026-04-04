#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const baseUrl = process.env.DASHBOARD_SMOKE_BASE_URL || "http://127.0.0.1:4173";
const outputRoot = path.join(os.tmpdir(), "bugtracker-dashboard-smoke");
const scenarios = [
  {
    name: "default-community",
    url: `${baseUrl}/`,
    outputFile: path.join(outputRoot, "default-community.png")
  },
  {
    name: "development-dashboard",
    url: `${baseUrl}/?report-section=development`,
    outputFile: path.join(outputRoot, "development-dashboard.png")
  }
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function ensureReadablePng(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size <= 0) {
    throw new Error(`Screenshot is empty: ${filePath}`);
  }
  return stat.size;
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });

  console.log(`Dashboard smoke base URL: ${baseUrl}`);
  console.log(`Screenshot output dir: ${outputRoot}`);

  for (const scenario of scenarios) {
    console.log(`\nScenario: ${scenario.name}`);
    await run("npx", [
      "playwright",
      "screenshot",
      "--wait-for-timeout",
      "6000",
      scenario.url,
      scenario.outputFile
    ]);
    const byteSize = await ensureReadablePng(scenario.outputFile);
    console.log(`Saved ${scenario.outputFile} (${byteSize} bytes)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
