import fs from "node:fs/promises";
import path from "node:path";

export function resolveGitHubEnvToken(env = process.env) {
  const ghToken = String(env.GH_TOKEN || "").trim();
  if (ghToken) return ghToken;

  const githubToken = String(env.GITHUB_TOKEN || "").trim();
  if (githubToken) return githubToken;

  return "";
}

export async function loadLocalEnvFiles({
  repoRoot,
  env = process.env,
  overrideKeys = []
} = {}) {
  const safeRepoRoot = String(repoRoot || "").trim();
  if (!safeRepoRoot) {
    throw new Error("Missing repoRoot for local env loading.");
  }
  const overrideKeySet = new Set(
    Array.isArray(overrideKeys)
      ? overrideKeys
          .map((key) => String(key || "").trim())
          .filter(Boolean)
      : []
  );

  const candidateSet = new Set([
    path.resolve(safeRepoRoot, ".env.backlog"),
    path.resolve(safeRepoRoot, ".env.local")
  ]);

  try {
    const gitFile = await fs.readFile(path.resolve(safeRepoRoot, ".git"), "utf8");
    const gitDirLine = gitFile.trim();
    if (gitDirLine.startsWith("gitdir:")) {
      const gitDirPath = gitDirLine.slice("gitdir:".length).trim();
      const worktreesMarker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
      const markerIndex = gitDirPath.indexOf(worktreesMarker);
      if (markerIndex !== -1) {
        const inferredRepoRoot = gitDirPath.slice(0, markerIndex);
        candidateSet.add(path.join(inferredRepoRoot, ".env.backlog"));
        candidateSet.add(path.join(inferredRepoRoot, ".env.local"));
      }
    }
  } catch {
    // Ignore missing or unreadable .git metadata.
  }

  const loadedPaths = [];

  for (const filePath of candidateSet) {
    let raw = "";
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    loadedPaths.push(filePath);

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (!(key in env) || overrideKeySet.has(key)) {
        env[key] = value;
      }
    }
  }

  return loadedPaths;
}
