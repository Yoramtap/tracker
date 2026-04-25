#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ALL_DASHBOARD_SNAPSHOT_PATHS,
  ANALYSIS_REPORT_PATH,
  DIST_DIR
} from "../dashboard-contract.mjs";
import { loadLocalEnvFiles, resolveGitHubEnvToken } from "../local-env.mjs";
import { prepareAutomationGitHubAuth } from "./publish-tracker-auth.mjs";

const EXPECTED_AUTOMATION_BRANCH = (process.env.TRACKER_AUTOMATION_BRANCH || "main").trim();
const EXPECTED_AUTOMATION_UPSTREAM = `origin/${EXPECTED_AUTOMATION_BRANCH}`;
const PINNED_NODE_MAJOR = "22";
const ALLOWED_COMMIT_PATHS = new Set(ALL_DASHBOARD_SNAPSHOT_PATHS);
const GIT_ASKPASS_TOKEN_ENV = "TRACKER_GIT_AUTH_TOKEN";
const GITHUB_AUTH_VALIDATION_RETRIES = 3;
const GITHUB_AUTH_VALIDATION_TIMEOUT_MS = 10000;
const LOCAL_AUTOMATION_ENV_OVERRIDE_KEYS = Object.freeze([
  "ATLASSIAN_SITE",
  "ATLASSIAN_EMAIL",
  "ATLASSIAN_API_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN"
]);
const OPTIONAL_ISOLATED_STATE_PATHS = Object.freeze([
  path.join(".cache", "business-unit-uat-done-cache.json"),
  path.join(".cache", "pr-activity-issue-cache.json"),
  path.join(".cache", "pr-cycle-changelog-cache.json"),
  path.join(".cache", "snapshots"),
  path.join(".cache", "trend-date-cache.json")
]);

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

async function runNodeScript(scriptName, args = [], options = {}) {
  const { cwd = process.cwd(), env = process.env } = options;
  await runCommand(process.execPath, [scriptName, ...args], {
    cwd,
    env,
    stdio: "inherit"
  });
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfMissing(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath))) return false;
  if (await pathExists(targetPath)) return false;

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
  return true;
}

async function copyPathIfPresent(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath))) return false;

  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    await fs.cp(sourcePath, targetPath, { recursive: true });
    return true;
  }

  await fs.copyFile(sourcePath, targetPath);
  return true;
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

async function getOriginUrl(cwd) {
  const { stdout } = await runCommand("git", ["remote", "get-url", "origin"], {
    cwd,
    stdio: "pipe"
  });
  return stdout.trim();
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
  let found = false;
  for (const fileName of candidates) {
    try {
      await fs.access(path.join(repoDir, fileName));
      found = true;
      break;
    } catch {
      // Try the next file.
    }
  }
  if (!found) {
    throw new Error(`Expected ${repoDir} to contain .env.backlog or .env.local for Jira auth.`);
  }

  await loadLocalEnvFiles({
    repoRoot: repoDir,
    overrideKeys: LOCAL_AUTOMATION_ENV_OVERRIDE_KEYS
  });
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

async function ensureWorkspaceLocalEnv(sourceRepoDir, targetRepoDir) {
  for (const fileName of [".env.backlog", ".env.local"]) {
    await copyIfMissing(path.join(sourceRepoDir, fileName), path.join(targetRepoDir, fileName));
  }
}

async function ensureWorkspaceNodeModules(sourceRepoDir, targetRepoDir) {
  const targetEsbuildPath = path.join(targetRepoDir, "node_modules", "esbuild", "package.json");
  if (await pathExists(targetEsbuildPath)) {
    return;
  }

  const sourceNodeModules = path.join(sourceRepoDir, "node_modules");
  const sourceEsbuildPath = path.join(sourceNodeModules, "esbuild", "package.json");
  if (!(await pathExists(sourceEsbuildPath))) {
    throw new Error(
      `Source checkout ${sourceRepoDir} is missing node_modules/esbuild/package.json, so there is no known-good dependency tree to copy into the isolated publish workspace.`
    );
  }

  console.log("Copying node_modules into isolated publish workspace.");
  await fs.rm(path.join(targetRepoDir, "node_modules"), { recursive: true, force: true });
  await fs.cp(sourceNodeModules, path.join(targetRepoDir, "node_modules"), { recursive: true });
}

async function copyOptionalWorkspaceState(sourceRepoDir, targetRepoDir) {
  for (const relativePath of OPTIONAL_ISOLATED_STATE_PATHS) {
    await copyPathIfPresent(
      path.join(sourceRepoDir, relativePath),
      path.join(targetRepoDir, relativePath)
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

function buildGitHubApiHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "tracker-automation-preflight",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeGitHubProbeError(error) {
  const errorName = String(error?.name || "").trim();
  const errorMessage = String(error?.message || "").trim();
  const causeCode = String(error?.cause?.code || "").trim();
  const causeMessage = String(error?.cause?.message || "").trim();
  const detail = [errorName, errorMessage, causeCode || causeMessage]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(": ");
  return detail || "unknown transport error";
}

function buildGitHubValidationWarning(detail) {
  const safeDetail = String(detail || "").trim();
  return `Warning: GitHub token preflight validation could not be confirmed${
    safeDetail ? ` (${safeDetail})` : ""
  }. Proceeding because live GitHub requests during refresh will still verify access.`;
}

async function fetchGitHubValidationProbe(token) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_AUTH_VALIDATION_TIMEOUT_MS);

  try {
    return await fetch("https://api.github.com/user", {
      headers: buildGitHubApiHeaders(token),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ensureGitHubTokenAuth(token) {
  for (let attempt = 0; attempt < GITHUB_AUTH_VALIDATION_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetchGitHubValidationProbe(token);
    } catch (error) {
      if (attempt === GITHUB_AUTH_VALIDATION_RETRIES - 1) {
        return buildGitHubValidationWarning(describeGitHubProbeError(error));
      }
      await sleep(500 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return "";
    }

    let errorDetail = "";
    try {
      const payload = await response.json();
      if (payload?.message) {
        errorDetail = String(payload.message).trim();
      }
    } catch {
      // Ignore non-JSON responses.
    }

    if (response.status === 401) {
      throw new Error(
        `GitHub token from GH_TOKEN/GITHUB_TOKEN failed validation (${response.status} ${response.statusText}).${
          errorDetail ? ` ${errorDetail}` : ""
        } Remove the stale token from local env files or replace it with a valid repo-scoped token.`
      );
    }

    if (
      attempt === GITHUB_AUTH_VALIDATION_RETRIES - 1 ||
      !(response.status === 403 || response.status === 429 || response.status >= 500)
    ) {
      return buildGitHubValidationWarning(
        [response.status, response.statusText, errorDetail].filter(Boolean).join(" ")
      );
    }

    await sleep(500 * 2 ** attempt);
  }

  return buildGitHubValidationWarning("exhausted validation retries");
}

async function runGitWithCredentialEnv(cwd, args, options = {}) {
  const githubToken = resolveGitHubEnvToken();
  return await withGitCredentialEnv(githubToken, async (env) => {
    const commandArgs = githubToken ? ["-c", "credential.helper=", ...args] : args;
    return await runCommand("git", commandArgs, {
      cwd,
      env,
      stdio: options.stdio || "inherit"
    });
  });
}

async function ensureGhAuth() {
  const auth = await prepareAutomationGitHubAuth({
    env: process.env,
    validateAccessToken: ensureGitHubTokenAuth
  });

  if (auth.warning) {
    console.warn(auth.warning);
  }
}

async function runPreflight(repoDir, { refresh, shouldPush, preflightOnly }) {
  console.log("\n=== Automation preflight ===");
  await ensureFullCheckout(repoDir);
  await ensureExpectedBranch(repoDir);
  await ensureExpectedUpstream(repoDir);
  await ensureLocalEnv(repoDir);
  await ensureBuildDependency(repoDir);
  warnOnNodeVersionMismatch();

  if (refresh || shouldPush || preflightOnly) {
    await ensureGhAuth();
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

async function refreshData(repoDir, cleanRun) {
  console.log("\n=== Refreshing data ===");
  await runNodeScript("scripts/refresh-report-data.mjs", cleanRun ? ["--clean"] : [], {
    cwd: repoDir
  });
}

async function validateSnapshots(repoDir) {
  console.log("\n=== Validating snapshots ===");
  await runNodeScript("scripts/validate-dashboard-snapshots.mjs", [], {
    cwd: repoDir
  });
}

async function generateAnalysis(repoDir) {
  console.log("\n=== Generating analysis ===");
  await runNodeScript(
    "scripts/dev/analyze-report-data.mjs",
    ["--output", ANALYSIS_REPORT_PATH],
    { cwd: repoDir }
  );
}

async function buildPublicSiteArtifact(repoDir) {
  console.log("\n=== Building public site artifact ===");
  await runNodeScript("scripts/export-public.mjs", ["--target", DIST_DIR], {
    cwd: repoDir
  });
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

async function syncRepoWithOrigin(repoDir) {
  console.log(`\n=== Syncing ${EXPECTED_AUTOMATION_BRANCH} with ${EXPECTED_AUTOMATION_UPSTREAM} ===`);
  await runGitWithCredentialEnv(repoDir, [
    "pull",
    "--ff-only",
    "origin",
    EXPECTED_AUTOMATION_BRANCH
  ]);
}

function buildGitAskpassScript() {
  return `#!/bin/sh
case "$1" in
  *Username*|*username*)
    printf '%s\\n' 'x-access-token'
    ;;
  *)
    printf '%s\\n' "$${GIT_ASKPASS_TOKEN_ENV}"
    ;;
esac
`;
}

async function withGitCredentialEnv(githubToken, work) {
  if (!githubToken) {
    return await work(process.env);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracker-git-askpass-"));
  const askpassPath = path.join(tempDir, "askpass.sh");
  await fs.writeFile(askpassPath, buildGitAskpassScript(), {
    encoding: "utf8",
    mode: 0o700
  });

  const env = {
    ...process.env,
    GIT_ASKPASS: askpassPath,
    GIT_TERMINAL_PROMPT: "0",
    [GIT_ASKPASS_TOKEN_ENV]: githubToken
  };

  try {
    return await work(env);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function pushRepo(cwd) {
  console.log("\n=== Pushing repo ===");
  await runGitWithCredentialEnv(cwd, ["push"]);
}

async function prepareIsolatedPublishWorkspace(sourceRepoDir) {
  const tempRootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracker-publish-"));
  const targetRepoDir = path.join(tempRootDir, path.basename(sourceRepoDir));

  try {
    console.log("\n=== Preparing isolated publish workspace ===");
    console.log(
      `Tracked repo changes detected in ${sourceRepoDir}. This run will publish from a temporary clean clone so local edits stay untouched.`
    );

    await runCommand(
      "git",
      ["clone", "--branch", EXPECTED_AUTOMATION_BRANCH, "--single-branch", sourceRepoDir, targetRepoDir],
      { stdio: "inherit" }
    );

    const originUrl = await getOriginUrl(sourceRepoDir);
    await runCommand("git", ["remote", "set-url", "origin", originUrl], {
      cwd: targetRepoDir,
      stdio: "inherit"
    });

    await ensureWorkspaceLocalEnv(sourceRepoDir, targetRepoDir);
    await ensureWorkspaceNodeModules(sourceRepoDir, targetRepoDir);
    await copyOptionalWorkspaceState(sourceRepoDir, targetRepoDir);
    await syncRepoWithOrigin(targetRepoDir);

    return {
      repoDir: targetRepoDir,
      async cleanup() {
        await fs.rm(tempRootDir, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await fs.rm(tempRootDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function resolvePublishWorkspace(sourceRepoDir, { commitMessage }) {
  if (!commitMessage) {
    return {
      repoDir: sourceRepoDir,
      async cleanup() {}
    };
  }

  const trackedStatus = await gitStatusShort(sourceRepoDir, {
    includeUntracked: false
  });

  if (trackedStatus) {
    return await prepareIsolatedPublishWorkspace(sourceRepoDir);
  }

  await syncRepoWithOrigin(sourceRepoDir);
  return {
    repoDir: sourceRepoDir,
    async cleanup() {}
  };
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

  await runPreflight(repoDir, { refresh, shouldPush, preflightOnly });

  if (preflightOnly) {
    console.log("\nPreflight finished. Repo is ready for automation refresh runs.");
    return;
  }

  const publishWorkspace = await resolvePublishWorkspace(repoDir, { commitMessage });

  try {
    const publishRepoDir = publishWorkspace.repoDir;

    if (commitMessage) {
      await ensureCleanRepo(publishRepoDir);
    }

    if (refresh) {
      await refreshData(publishRepoDir, cleanRun);
    }

    await validateSnapshots(publishRepoDir);

    if (analyze) {
      await generateAnalysis(publishRepoDir);
    }

    await buildPublicSiteArtifact(publishRepoDir);

    if (!commitMessage) {
      console.log("\nPublish helper finished. Validation and build passed; git commit/push skipped.");
      return;
    }

    const changedSnapshotPaths = await ensureOnlySnapshotChanges(publishRepoDir);
    if (!changedSnapshotPaths.length) {
      console.log("\nPublish helper finished. No dashboard snapshot changes to commit.");
      return;
    }

    await commitRepo(publishRepoDir, commitMessage, changedSnapshotPaths);

    if (!shouldPush) {
      console.log("\nPublish helper finished. Local commit created; push skipped.");
      return;
    }

    await pushRepo(publishRepoDir);

    console.log("\nPublish helper finished. Snapshot commit pushed.");
  } finally {
    await publishWorkspace.cleanup();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
