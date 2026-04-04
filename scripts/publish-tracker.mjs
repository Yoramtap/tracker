#!/usr/bin/env node

import { spawn } from "node:child_process";

import { ANALYSIS_REPORT_PATH, DIST_DIR } from "./dashboard-contract.mjs";

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseYesNoArg(flag, fallback = null) {
  const raw = getArg(flag).toLowerCase();
  if (!raw) return fallback;
  if (["yes", "true"].includes(raw)) return true;
  if (["no", "false"].includes(raw)) return false;
  throw new Error(`Expected ${flag} to be yes or no.`);
}

function printHelp() {
  console.log(`Usage:
  node scripts/publish-tracker.mjs --refresh yes|no [--clean] [--analyze yes|no] [--message "<commit message>"] [--push]

Examples:
  node scripts/publish-tracker.mjs --refresh yes
  node scripts/publish-tracker.mjs --refresh yes --clean
  node scripts/publish-tracker.mjs --refresh yes --message "Refresh dashboard data"
  node scripts/publish-tracker.mjs --refresh no --message "Republish current dashboard state" --push

Notes:
  - --refresh is required so dataset updates stay explicit.
  - --clean bypasses local refresh caches for that run and rebuilds them from fresh Jira reads.
  - Analysis defaults to yes when refresh=yes, otherwise no.
  - Analysis writes a local operator note into ${ANALYSIS_REPORT_PATH}.
  - The public site artifact is rebuilt locally into ${DIST_DIR}/ before any optional commit/push.
  - Commit/push happen in the current repo.
`);
}

async function runCommand(command, args, options = {}) {
  const { cwd = process.cwd(), stdio = "inherit", env = process.env } = options;
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio
    });

    let stdout = "";
    let stderr = "";

    if (stdio === "pipe") {
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed${
            signal ? ` with signal ${signal}` : ` with exit code ${code}`
          }.${stderr ? `\n${stderr.trim()}` : ""}`
        )
      );
    });
  });
}

async function runNodeScript(scriptName, args = []) {
  await runCommand(process.execPath, [scriptName, ...args], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
}

async function gitStatusShort(cwd) {
  const { stdout } = await runCommand("git", ["status", "--short"], {
    cwd,
    stdio: "pipe"
  });
  return stdout.trim();
}

async function ensureCleanRepo(cwd) {
  const status = await gitStatusShort(cwd);
  if (!status) return;
  throw new Error(
    `Refusing to auto-commit with existing repo changes in ${cwd}:\n${status}`
  );
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const refresh = parseYesNoArg("--refresh");
  if (refresh === null) {
    throw new Error("Missing required --refresh yes|no flag.");
  }

  const analyze = parseYesNoArg("--analyze", refresh);
  const commitMessage = getArg("--message");
  const shouldPush = hasFlag("--push");
  const cleanRun = hasFlag("--clean");
  const repoDir = process.cwd();

  if (shouldPush && !commitMessage) {
    throw new Error("--push requires --message so the git commit stays explicit.");
  }

  console.log("Publish plan:");
  console.log(`- refresh dataset: ${refresh ? "yes" : "no"}`);
  console.log(`- bypass refresh caches: ${cleanRun ? "yes" : "no"}`);
  console.log(`- run analysis: ${analyze ? "yes" : "no"}`);
  console.log("- build public site artifact: yes");
  console.log(`- commit repo: ${commitMessage ? "yes" : "no"}`);
  console.log(`- push repo: ${shouldPush ? "yes" : "no"}`);

  if (commitMessage) {
    await ensureCleanRepo(repoDir);
  }

  if (refresh) {
    console.log("\n=== Refreshing data ===");
    await runNodeScript("scripts/refresh-report-data.mjs", cleanRun ? ["--clean"] : []);
  }

  if (analyze) {
    console.log("\n=== Generating analysis ===");
    await runNodeScript("scripts/analyze-report-data.mjs", [
      "--output",
      ANALYSIS_REPORT_PATH
    ]);
  }

  console.log("\n=== Building public site artifact ===");
  await runNodeScript("scripts/export-public.mjs", ["--target", DIST_DIR]);

  if (!commitMessage) {
    console.log("\nPublish helper finished. Site artifact built; git commit/push skipped.");
    return;
  }

  const repoStatus = await gitStatusShort(repoDir);
  if (!repoStatus) {
    console.log("\nPublish helper finished. No repo changes to commit.");
    return;
  }

  console.log("\n=== Committing repo ===");
  await runCommand("git", ["add", "."], {
    cwd: repoDir,
    stdio: "inherit"
  });
  await runCommand("git", ["commit", "-m", commitMessage], {
    cwd: repoDir,
    stdio: "inherit"
  });

  if (!shouldPush) {
    console.log("\nPublish helper finished. Local commit created; push skipped.");
    return;
  }

  console.log("\n=== Pushing repo ===");
  await runCommand("git", ["push"], {
    cwd: repoDir,
    stdio: "inherit"
  });

  console.log("\nPublish helper finished. Repo committed and pushed.");
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
