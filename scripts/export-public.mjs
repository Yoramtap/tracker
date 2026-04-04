#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { DIST_DIR, PUBLIC_DASHBOARD_SNAPSHOT_PATHS } from "./dashboard-contract.mjs";
import { SNAPSHOT_SANITIZERS } from "./snapshot-sanitizers.mjs";
import { buildPublicDashboard } from "./build-public-dashboard.mjs";
import { validateDashboardSnapshotFiles } from "./validate-dashboard-snapshots.mjs";

const DEFAULT_TARGET = DIST_DIR;

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

async function listFilesRecursively(rootDir, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(rootDir, absolutePath)));
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(path.relative(rootDir, absolutePath));
  }
  return files;
}

async function copySafeFiles(sourceDir, targetDir, fileNames) {
  for (const fileName of fileNames) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);
    const sanitize = SNAPSHOT_SANITIZERS[path.basename(fileName)];

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    if (sanitize) {
      const raw = await fs.readFile(sourcePath, "utf8");
      const sanitized = sanitize(JSON.parse(raw));
      await fs.writeFile(targetPath, JSON.stringify(sanitized), "utf8");
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
    console.log(`Copied ${fileName} -> ${targetPath}`);
  }
}

async function main() {
  const sourceDir = process.cwd();
  const targetDir = path.resolve(getArg("--target") || DEFAULT_TARGET);
  const buildDir = path.resolve(targetDir, ".build-temp");

  try {
    if (path.resolve(sourceDir) === targetDir) {
      throw new Error("Refusing to build the public site into the repo root.");
    }

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    const buildResult = await buildPublicDashboard({
      sourceDir,
      outDir: buildDir
    });
    const builtFileNames = await listFilesRecursively(buildResult.outDir);

    await validateDashboardSnapshotFiles(
      sourceDir,
      PUBLIC_DASHBOARD_SNAPSHOT_PATHS.map((relativePath) =>
        relativePath.split(path.posix.sep).join(path.sep)
      )
    );
    await copySafeFiles(buildResult.outDir, targetDir, builtFileNames);
    await copySafeFiles(sourceDir, targetDir, PUBLIC_DASHBOARD_SNAPSHOT_PATHS);
    await fs.writeFile(path.join(targetDir, ".nojekyll"), "", "utf8");
    console.log(`Public site artifact built at: ${targetDir}`);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
