#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_TARGET = "/Users/yoramtap/Documents/AI/bugtracker";
const SAFE_FILES = ["snapshot.json", "index.html", "app.js", "styles.css"];

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

async function ensureDir(dirPath) {
  const stat = await fs.stat(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${dirPath}`);
  }
}

async function copySafeFiles(sourceDir, targetDir) {
  for (const fileName of SAFE_FILES) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);

    await fs.copyFile(sourcePath, targetPath);
    console.log(`Copied ${fileName} -> ${targetPath}`);
  }
}

async function main() {
  const sourceDir = process.cwd();
  const targetDir = path.resolve(getArg("--target") || DEFAULT_TARGET);

  if (path.resolve(sourceDir) === targetDir) {
    throw new Error("Refusing to export into the same directory.");
  }

  await ensureDir(targetDir);

  // Sanity check for expected public repo shape.
  for (const expected of ["index.html", "app.js", "styles.css", ".git"]) {
    const expectedPath = path.join(targetDir, expected);
    try {
      await fs.stat(expectedPath);
    } catch {
      throw new Error(`Target does not look like bugtracker repo (missing ${expected}).`);
    }
  }

  await copySafeFiles(sourceDir, targetDir);
  console.log(`Export complete. Public repo updated at: ${targetDir}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
