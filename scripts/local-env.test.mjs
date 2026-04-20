import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLocalEnvFiles, resolveGitHubEnvToken } from "./local-env.mjs";

test("resolveGitHubEnvToken prefers GH_TOKEN before GITHUB_TOKEN", () => {
  assert.equal(
    resolveGitHubEnvToken({
      GH_TOKEN: " primary-token ",
      GITHUB_TOKEN: "secondary-token"
    }),
    "primary-token"
  );
});

test("loadLocalEnvFiles loads repo env files without overriding existing values", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracker-local-env-"));

  try {
    await fs.writeFile(
      path.join(tempDir, ".env.backlog"),
      ["ATLASSIAN_EMAIL=loaded@example.com", "GH_TOKEN=repo-token", ""].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(tempDir, ".env.local"), "ATLASSIAN_SITE=example.atlassian.net\n", "utf8");
    await fs.mkdir(path.join(tempDir, ".git"));

    const env = {
      ATLASSIAN_EMAIL: "existing@example.com"
    };

    const loadedPaths = await loadLocalEnvFiles({ repoRoot: tempDir, env });

    assert.deepEqual(
      loadedPaths.map((filePath) => path.basename(filePath)).sort(),
      [".env.backlog", ".env.local"]
    );
    assert.equal(env.ATLASSIAN_EMAIL, "existing@example.com");
    assert.equal(env.ATLASSIAN_SITE, "example.atlassian.net");
    assert.equal(env.GH_TOKEN, "repo-token");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("loadLocalEnvFiles also reads the parent checkout env for worktree-style git metadata", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracker-local-env-worktree-"));
  const sourceRepoRoot = path.join(tempDir, "source");
  const worktreeRoot = path.join(tempDir, "automation");

  try {
    await fs.mkdir(path.join(sourceRepoRoot, ".git"), { recursive: true });
    await fs.mkdir(worktreeRoot, { recursive: true });
    await fs.writeFile(
      path.join(sourceRepoRoot, ".env.local"),
      "GITHUB_TOKEN=parent-token\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(worktreeRoot, ".git"),
      `gitdir: ${path.join(sourceRepoRoot, ".git", "worktrees", "automation")}\n`,
      "utf8"
    );

    const env = {};
    const loadedPaths = await loadLocalEnvFiles({ repoRoot: worktreeRoot, env });

    assert.ok(loadedPaths.some((filePath) => filePath === path.join(sourceRepoRoot, ".env.local")));
    assert.equal(env.GITHUB_TOKEN, "parent-token");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
