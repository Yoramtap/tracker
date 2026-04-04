#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { build as esbuildBuild, transform } from "esbuild";

const JS_BUNDLE_PATH = "dashboard.bundle.js";
const CSS_BUNDLE_PATH = "dashboard.bundle.css";
const STATIC_ASSETS_DIR = "assets";
const JS_SOURCE_PATHS = [
  "app/dashboard-runtime.js",
  "app/dashboard-view-utils.js",
  "vendor/react.production.min.js",
  "vendor/react-dom.production.min.js",
  "app/dashboard-chart-core.js",
  "app/dashboard-pretext-layout.js",
  "app/dashboard-charts-shipped.js",
  "app/dashboard-charts-product.js"
];
const DASHBOARD_APP_ENTRY_PATH = "app/dashboard-app.js";
const PANEL_SHELL_PATH = "app/dashboard-heavy-panels.html";
const INDEX_PATH = "index.html";
const STYLESHEET_PATH = "app/dashboard-styles.css";
const FONT_STYLESHEET_PATH = "app/dashboard-fonts.css";
const PRETEXT_MODULE_PATH = "vendor/pretext.mjs";

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

function shortHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

async function writeFileEnsured(filePath, contents) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents);
}

async function copyFileEnsured(sourcePath, targetPath) {
  await ensureDir(path.dirname(targetPath));
  await fs.copyFile(sourcePath, targetPath);
}

async function readUtf8(sourceDir, relativePath) {
  return await fs.readFile(path.join(sourceDir, relativePath), "utf8");
}

async function listRelativeFiles(rootDir, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(rootDir, absolutePath)));
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(path.relative(rootDir, absolutePath));
  }
  return files;
}

async function buildPretextIife(sourceDir) {
  const source = await readUtf8(sourceDir, PRETEXT_MODULE_PATH);
  const result = await esbuildBuild({
    stdin: {
      contents: source,
      resolveDir: sourceDir,
      sourcefile: PRETEXT_MODULE_PATH,
      loader: "js"
    },
    bundle: false,
    format: "iife",
    globalName: "DashboardPretextModule",
    minify: false,
    write: false,
    platform: "browser",
    target: "es2020"
  });
  return result.outputFiles[0].text;
}

async function buildDashboardAppIife(sourceDir) {
  const result = await esbuildBuild({
    entryPoints: [path.join(sourceDir, DASHBOARD_APP_ENTRY_PATH)],
    bundle: true,
    format: "iife",
    minify: false,
    write: false,
    platform: "browser",
    target: "es2020"
  });
  return result.outputFiles[0].text;
}

async function buildJsBundle(sourceDir) {
  const chunks = [];
  for (const relativePath of JS_SOURCE_PATHS) {
    chunks.push(await readUtf8(sourceDir, relativePath));
  }
  chunks.splice(6, 0, await buildPretextIife(sourceDir));
  chunks.push(await buildDashboardAppIife(sourceDir));
  const concatenated = chunks.join("\n\n");
  const transformed = await transform(concatenated, {
    loader: "js",
    minify: true,
    target: "es2020"
  });
  return transformed.code;
}

async function buildCssBundle(sourceDir) {
  const styles = await readUtf8(sourceDir, STYLESHEET_PATH);
  const fontStyles = await readUtf8(sourceDir, FONT_STYLESHEET_PATH);
  const normalizedFontStyles = fontStyles.replaceAll("../assets/", "./assets/");
  const transformed = await transform(`${normalizedFontStyles}\n\n${styles}`, {
    loader: "css",
    minify: true,
    target: "es2020"
  });
  return transformed.code;
}

function buildBundledIndexHtml(indexHtml, panelShellHtml, { cssHash, jsHash }) {
  let output = indexHtml;
  output = output.replace(
    /<link rel="stylesheet" href="\.\/app\/dashboard-styles\.css[^"]*" \/>\s*\n\s*<link rel="stylesheet" href="\.\/app\/dashboard-fonts\.css[^"]*" \/>/,
    `<link rel="stylesheet" href="./${CSS_BUNDLE_PATH}?v=${cssHash}" />`
  );
  output = output.replace(
    /<script defer src="\.\/app\/dashboard-runtime\.js[^"]*"><\/script>\s*\n\s*<script defer src="\.\/app\/dashboard-bootstrap\.js[^"]*"><\/script>/,
    `<script defer src="./${JS_BUNDLE_PATH}?v=${jsHash}"></script>`
  );
  output = output.replace('<div id="dashboard-heavy-panels"></div>', panelShellHtml.trim());
  return output;
}

export async function buildPublicDashboard({
  sourceDir = process.cwd(),
  outDir = path.join(os.tmpdir(), `dashboard-public-build-${Date.now()}`)
} = {}) {
  await removeDir(outDir);
  await ensureDir(outDir);
  const staticAssetPaths = (await listRelativeFiles(path.join(sourceDir, STATIC_ASSETS_DIR))).map(
    (relativePath) =>
      path.posix.join(STATIC_ASSETS_DIR, relativePath.split(path.sep).join(path.posix.sep))
  );

  const [indexHtml, panelShellHtml, jsBundle, cssBundle] = await Promise.all([
    readUtf8(sourceDir, INDEX_PATH),
    readUtf8(sourceDir, PANEL_SHELL_PATH),
    buildJsBundle(sourceDir),
    buildCssBundle(sourceDir)
  ]);

  const jsHash = shortHash(jsBundle);
  const cssHash = shortHash(cssBundle);
  const bundledIndexHtml = buildBundledIndexHtml(indexHtml, panelShellHtml, { cssHash, jsHash });

  await Promise.all([
    writeFileEnsured(path.join(outDir, INDEX_PATH), bundledIndexHtml),
    writeFileEnsured(path.join(outDir, JS_BUNDLE_PATH), jsBundle),
    writeFileEnsured(path.join(outDir, CSS_BUNDLE_PATH), cssBundle),
    ...staticAssetPaths.map((assetPath) =>
      copyFileEnsured(path.join(sourceDir, assetPath), path.join(outDir, assetPath))
    )
  ]);

  return {
    outDir,
    jsBundlePath: path.join(outDir, JS_BUNDLE_PATH),
    cssBundlePath: path.join(outDir, CSS_BUNDLE_PATH),
    indexPath: path.join(outDir, INDEX_PATH),
    assetPaths: [INDEX_PATH, JS_BUNDLE_PATH, CSS_BUNDLE_PATH, ...staticAssetPaths]
  };
}

async function main() {
  const targetDir = path.resolve(
    getArg("--target") || path.join(os.tmpdir(), "dashboard-public-build")
  );
  const result = await buildPublicDashboard({
    sourceDir: process.cwd(),
    outDir: targetDir
  });
  console.log(`Built public dashboard at ${result.outDir}`);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
