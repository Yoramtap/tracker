#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
  ALL_DASHBOARD_SNAPSHOT_PATHS,
  ANALYSIS_REPORT_PATH,
  DIST_DIR
} from "../dashboard-contract.mjs";

const EXPECTED_AUTOMATION_BRANCH = (process.env.TRACKER_AUTOMATION_BRANCH || "main").trim();
const EXPECTED_AUTOMATION_UPSTREAM = `origin/${EXPECTED_AUTOMATION_BRANCH}`;
const PINNED_NODE_MAJOR = "22";
const ALLOWED_COMMIT_PATHS = new Set(ALL_DASHBOARD_SNAPSHOT_PATHS);

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
  node scripts/dev/publish-tracker.mjs --refresh yes|no [--clean] [--analyze yes|no] [--message "<commit message>"] [--push] [--preflight-only]

Examples:
  node scripts/dev/publish-tracker.mjs --refresh yes
  node scripts/dev/publish-tracker.mjs --refresh yes --clean
  node scripts/dev/publish-tracker.mjs --refresh yes --message "Refresh dashboard data"
  node scripts/dev/publish-tracker.mjs --refresh no --message "Republish current dashboard state" --push
  node scripts/dev/publish-tracker.mjs --refresh no --analyze no --preflight-only

Notes:
  - --refresh is required so dataset updates stay explicit.
  - --clean bypasses local refresh caches for that run and rebuilds them from fresh Jira reads.
  - Analysis defaults to yes when refresh=yes, otherwise no.
  - Analysis writes a local operator note into ${ANALYSIS_REPORT_PATH}.
  - Preflight expects a full local checkout on branch ${EXPECTED_AUTOMATION_BRANCH}, not a detached git worktree.
  - The helper validates snapshots and rebuilds ${DIST_DIR}/ before any optional commit/push.
  - Commits stage only tracked dashboard snapshot files under data/.
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

async function gitStatusShort(cwd, { includeUntracked = true } = {}) {
  const args = ["status", "--short"];
  if (!includeUntracked) {
    args.push("--untracked-files=no");
  }
  const { stdout } = await runCommand("git", args, {
    cwd,
    stdio: "pipe"
  });
  return stdout.trim();
}

async function gitCurrentBranch(cwd) {
  try {
    const { stdout } = await runCommand("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
      cwd,
      stdio: "pipe"
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function gitCurrentUpstream(cwd) {
  try {
    const { stdout } = await runCommand(
      "git",
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      {
        cwd,
        stdio: "pipe"
      }
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

async function listChangedTrackedPaths(cwd) {
  const { stdout } = await runCommand("git", ["diff", "--name-only", "HEAD", "--"], {
    cwd,
    stdio: "pipe"
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveUnexpectedChanges(changedPaths) {
  return changedPaths.filter((filePath) => !ALLOWED_COMMIT_PATHS.has(filePath));
}

async function ensureCleanRepo(cwd) {
  const status = await gitStatusShort(cwd, { includeUntracked: false });
  if (!status) return;
  throw new Error(
    `Refusing to auto-commit with existing tracked repo changes in ${cwd}:\n${status}`
  );
}

async function ensureFullCheckout(repoDir) {
  const gitPath = path.join(repoDir, ".git");
  let stat;
  try {
    stat = await fs.lstat(gitPath);
  } catch {
    throw new Error(`Expected ${repoDir} to be a git checkout, but ${gitPath} is missing.`);
  }

  if (!stat.isDirectory()) {
    throw new Error(
      `Expected a full local checkout, but ${repoDir} is using a git worktree/detached metadata file. Use \`npm run automation:bootstrap\` from your main checkout and point the automation at that persistent clone instead.`
    );
  }
}

async function ensureExpectedBranch(repoDir) {
  const branch = await gitCurrentBranch(repoDir);
  if (!branch) {
    throw new Error(
      `Expected checkout on branch ${EXPECTED_AUTOMATION_BRANCH}, but HEAD is detached.`
    );
  }
  if (branch !== EXPECTED_AUTOMATION_BRANCH) {
    throw new Error(
      `Expected checkout on branch ${EXPECTED_AUTOMATION_BRANCH}, but found ${branch}.`
    );
  }
}

async function ensureExpectedUpstream(repoDir) {
  const upstream = await gitCurrentUpstream(repoDir);
  if (!upstream) {
    throw new Error(
      `Expected branch ${EXPECTED_AUTOMATION_BRANCH} to track ${EXPECTED_AUTOMATION_UPSTREAM}, but no upstream is configured.`
    );
  }
  if (upstream !== EXPECTED_AUTOMATION_UPSTREAM) {
    throw new Error(
      `Expected branch ${EXPECTED_AUTOMATION_BRANCH} to track ${EXPECTED_AUTOMATION_UPSTREAM}, but found ${upstream}.`
    );
  }
}

async function ensureLocalEnv(repoDir) {
  const candidates = [".env.backlog", ".env.local"];
  for (const fileName of candidates) {
    try {
      await fs.access(path.join(repoDir, fileName));
      return;
    } catch {
      // Try the next file.
    }
  }
  throw new Error(`Expected ${repoDir} to contain .env.backlog or .env.local for Jira auth.`);
}

async function ensureBuildDependency(repoDir) {
  try {
    await fs.access(path.join(repoDir, "node_modules", "esbuild", "package.json"));
  } catch {
    throw new Error(
      `Expected ${repoDir}/node_modules/esbuild/package.json to exist. Re-run \`npm run automation:bootstrap\` from the main checkout or install dependencies in this automation checkout before retrying.`
    );
  }
}

function warnOnNodeVersionMismatch() {
  const currentMajor = process.versions.node.split(".")[0];
  if (currentMajor === PINNED_NODE_MAJOR) return;

  console.warn(
    `Warning: running on Node ${process.versions.node}, but the repo is pinned to Node ${PINNED_NODE_MAJOR}.x for CI and local setup.`
  );
}

async function ensureGhAuth(repoDir) {
  await runCommand("gh", ["auth", "status", "-h", "github.com"], {
    cwd: repoDir,
    stdio: "pipe"
  });
}

async function runPreflight(repoDir, { refresh, shouldPush }) {
  console.log("\n=== Automation preflight ===");
  await ensureFullCheckout(repoDir);
  await ensureExpectedBranch(repoDir);
  await ensureExpectedUpstream(repoDir);
  await ensureLocalEnv(repoDir);
  await ensureBuildDependency(repoDir);
  warnOnNodeVersionMismatch();

  if (refresh || shouldPush) {
    await ensureGhAuth(repoDir);
  }
}

function logPublishPlan({
  refresh,
  cleanRun,
  analyze,
  commitMessage,
  shouldPush,
  preflightOnly
}) {
  console.log("Publish plan:");
  console.log(`- refresh dataset: ${refresh ? "yes" : "no"}`);
  console.log(`- bypass refresh caches: ${cleanRun ? "yes" : "no"}`);
  console.log(`- run analysis: ${analyze ? "yes" : "no"}`);
  console.log(`- validate snapshots: ${preflightOnly ? "no (preflight only)" : "yes"}`);
  console.log(`- build public site artifact: ${preflightOnly ? "no (preflight only)" : "yes"}`);
  console.log(`- commit repo: ${commitMessage ? "yes" : "no"}`);
  console.log(`- push repo: ${shouldPush ? "yes" : "no"}`);
}

async function refreshData(cleanRun) {
  console.log("\n=== Refreshing data ===");
  await runNodeScript("scripts/refresh-report-data.mjs", cleanRun ? ["--clean"] : []);
}

async function validateSnapshots() {
  console.log("\n=== Validating snapshots ===");
  await runNodeScript("scripts/validate-dashboard-snapshots.mjs");
}

async function generateAnalysis() {
  console.log("\n=== Generating analysis ===");
  await runNodeScript("scripts/dev/analyze-report-data.mjs", ["--output", ANALYSIS_REPORT_PATH]);
}

async function buildPublicSiteArtifact() {
  console.log("\n=== Building public site artifact ===");
  await runNodeScript("scripts/export-public.mjs", ["--target", DIST_DIR]);
}

async function ensureOnlySnapshotChanges(cwd) {
  const changedPaths = await listChangedTrackedPaths(cwd);
  const unexpectedChanges = resolveUnexpectedChanges(changedPaths);

  if (unexpectedChanges.length) {
    throw new Error(
      `Automation refresh produced tracked changes outside data snapshots:\n${unexpectedChanges.join("\n")}`
    );
  }

  return changedPaths.filter((filePath) => ALLOWED_COMMIT_PATHS.has(filePath));
}

async function commitRepo(cwd, message, changedSnapshotPaths) {
  if (!changedSnapshotPaths.length) return;

  console.log("\n=== Committing repo ===");
  await runCommand("git", ["add", "--", ...changedSnapshotPaths], { cwd, stdio: "inherit" });
  await runCommand("git", ["commit", "-m", message], {
    cwd,
    stdio: "inherit"
  });
}

async function pushRepo(cwd) {
  console.log("\n=== Pushing repo ===");
  await runCommand("git", ["push"], { cwd, stdio: "inherit" });
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
  const preflightOnly = hasFlag("--preflight-only");
  const repoDir = process.cwd();

  if (shouldPush && !commitMessage) {
    throw new Error("--push requires --message so the git commit stays explicit.");
  }

  if (preflightOnly && (commitMessage || shouldPush || cleanRun || refresh || analyze)) {
    // Permit --refresh no / --analyze no for the packaged automation preflight script only.
    if (!(refresh === false && analyze === false && !commitMessage && !shouldPush && !cleanRun)) {
      throw new Error("--preflight-only cannot be combined with refresh, clean, commit, or push actions.");
    }
  }

  logPublishPlan({ refresh, cleanRun, analyze, commitMessage, shouldPush, preflightOnly });

  await runPreflight(repoDir, { refresh, shouldPush });

  if (preflightOnly) {
    console.log("\nPreflight finished. Repo is ready for automation refresh runs.");
    return;
  }

  if (commitMessage) {
    await ensureCleanRepo(repoDir);
  }

  if (refresh) {
    await refreshData(cleanRun);
  }

  await validateSnapshots();

  if (analyze) {
    await generateAnalysis();
  }

  await buildPublicSiteArtifact();

  if (!commitMessage) {
    console.log("\nPublish helper finished. Validation and build passed; git commit/push skipped.");
    return;
  }

  const changedSnapshotPaths = await ensureOnlySnapshotChanges(repoDir);
  if (!changedSnapshotPaths.length) {
    console.log("\nPublish helper finished. No dashboard snapshot changes to commit.");
    return;
  }

  await commitRepo(repoDir, commitMessage, changedSnapshotPaths);

  if (!shouldPush) {
    console.log("\nPublish helper finished. Local commit created; push skipped.");
    return;
  }

  await pushRepo(repoDir);

  console.log("\nPublish helper finished. Snapshot commit pushed.");
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
