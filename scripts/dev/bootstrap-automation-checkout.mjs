#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnvFiles, resolveGitHubEnvToken } from "../local-env.mjs";

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function printHelp(defaultTarget) {
  console.log(`Usage:
  node scripts/dev/bootstrap-automation-checkout.mjs [--source /path/to/source-checkout] [--target /path/to/automation-checkout]

Defaults:
  --source defaults to the current repo checkout
  --target defaults to ${defaultTarget}

What this does:
  - creates a persistent local checkout on branch main
  - points origin at the same remote as the source checkout
  - copies .env.backlog / .env.local when they exist locally
  - copies node_modules from the source checkout when the automation checkout is missing esbuild
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

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureMainCheckout(repoDir) {
  const { stdout } = await runCommand("git", ["branch", "--show-current"], {
    cwd: repoDir,
    stdio: "pipe"
  });
  const branch = stdout.trim();
  if (branch !== "main") {
    throw new Error(
      `Expected source checkout ${repoDir} to be on branch main, but found ${branch || "detached HEAD"}.`
    );
  }
}

async function getOriginUrl(repoDir) {
  const { stdout } = await runCommand("git", ["remote", "get-url", "origin"], {
    cwd: repoDir,
    stdio: "pipe"
  });
  return stdout.trim();
}

async function cloneIfMissing(sourceDir, targetDir) {
  if (await pathExists(path.join(targetDir, ".git"))) {
    console.log(`Automation checkout already exists at ${targetDir}`);
    return;
  }

  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  console.log(`Cloning local checkout into ${targetDir}`);
  await runCommand("git", ["clone", "--branch", "main", "--single-branch", sourceDir, targetDir], {
    stdio: "inherit"
  });
}

async function alignOriginRemote(sourceDir, targetDir) {
  const originUrl = await getOriginUrl(sourceDir);
  await runCommand("git", ["remote", "set-url", "origin", originUrl], {
    cwd: targetDir,
    stdio: "inherit"
  });
}

async function copyIfMissing(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath))) return false;
  if (await pathExists(targetPath)) return false;

  await fs.copyFile(sourcePath, targetPath);
  return true;
}

async function ensureLocalEnv(sourceDir, targetDir) {
  const copiedBacklog = await copyIfMissing(
    path.join(sourceDir, ".env.backlog"),
    path.join(targetDir, ".env.backlog")
  );
  const copiedLocal = await copyIfMissing(
    path.join(sourceDir, ".env.local"),
    path.join(targetDir, ".env.local")
  );

  if (copiedBacklog) {
    console.log("Copied .env.backlog into automation checkout");
  }
  if (copiedLocal) {
    console.log("Copied .env.local into automation checkout");
  }
}

async function reportGitHubAutomationAuth(targetDir) {
  const env = {};
  await loadLocalEnvFiles({ repoRoot: targetDir, env });
  if (resolveGitHubEnvToken(env)) {
    console.log("Detected GH_TOKEN/GITHUB_TOKEN in automation checkout env files");
    return;
  }

  console.log(
    "No GH_TOKEN/GITHUB_TOKEN found in automation checkout env files; weekly refreshes can fall back to gh auth token extraction, but adding a local token is still recommended."
  );
}

async function ensureNodeModules(sourceDir, targetDir) {
  const targetEsbuildPath = path.join(targetDir, "node_modules", "esbuild", "package.json");
  if (await pathExists(targetEsbuildPath)) {
    console.log("Automation checkout already has a valid esbuild install");
    return;
  }

  const sourceNodeModules = path.join(sourceDir, "node_modules");
  if (!(await pathExists(path.join(sourceNodeModules, "esbuild", "package.json")))) {
    throw new Error(
      `Source checkout ${sourceDir} is missing node_modules/esbuild/package.json, so there is no known-good dependency tree to copy.`
    );
  }

  console.log("Copying node_modules from source checkout into automation checkout");
  await fs.rm(path.join(targetDir, "node_modules"), { recursive: true, force: true });
  await fs.cp(sourceNodeModules, path.join(targetDir, "node_modules"), { recursive: true });
}

async function verifyCheckout(targetDir) {
  const { stdout } = await runCommand("git", ["status", "--short", "--branch"], {
    cwd: targetDir,
    stdio: "pipe"
  });
  console.log(stdout.trim());
}

async function main() {
  const defaultSource = process.cwd();
  const defaultTarget = path.join(path.dirname(defaultSource), `${path.basename(defaultSource)}-automation`);

  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp(defaultTarget);
    return;
  }

  const sourceDir = path.resolve(getArg("--source") || defaultSource);
  const targetDir = path.resolve(getArg("--target") || defaultTarget);

  await ensureMainCheckout(sourceDir);
  await cloneIfMissing(sourceDir, targetDir);
  await alignOriginRemote(sourceDir, targetDir);
  await ensureLocalEnv(sourceDir, targetDir);
  await reportGitHubAutomationAuth(targetDir);
  await ensureNodeModules(sourceDir, targetDir);

  console.log("\nAutomation checkout is ready:");
  await verifyCheckout(targetDir);
  console.log(`Path: ${targetDir}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
