import assert from "node:assert/strict";
import test from "node:test";

import {
  HEADLESS_GITHUB_TOKEN_GUIDANCE,
  prepareAutomationGitHubAuth
} from "./publish-tracker-auth.mjs";

test("prepareAutomationGitHubAuth preserves env token auth without reseeding GH_TOKEN", async () => {
  const env = {
    GH_TOKEN: "env-token"
  };
  const validatedTokens = [];

  const result = await prepareAutomationGitHubAuth({
    env,
    resolveAccessToken: async ({ env: receivedEnv }) => {
      assert.equal(receivedEnv, env);
      return "env-token";
    },
    validateAccessToken: async (token) => {
      validatedTokens.push(token);
    }
  });

  assert.equal(result.token, "env-token");
  assert.equal(result.source, "env");
  assert.equal(result.seededEnv, false);
  assert.equal(result.warning, "");
  assert.equal(env.GH_TOKEN, "env-token");
  assert.deepEqual(validatedTokens, ["env-token"]);
});

test("prepareAutomationGitHubAuth seeds GH_TOKEN from gh fallback for the current run", async () => {
  const env = {};
  const validatedTokens = [];

  const result = await prepareAutomationGitHubAuth({
    env,
    resolveAccessToken: async () => "gh-token",
    validateAccessToken: async (token) => {
      validatedTokens.push(token);
    }
  });

  assert.equal(result.token, "gh-token");
  assert.equal(result.source, "gh");
  assert.equal(result.seededEnv, true);
  assert.match(result.warning, /using gh auth token fallback/i);
  assert.equal(env.GH_TOKEN, "gh-token");
  assert.deepEqual(validatedTokens, ["gh-token"]);
});

test("prepareAutomationGitHubAuth throws when neither env nor gh provide a token", async () => {
  const escapedGuidance = HEADLESS_GITHUB_TOKEN_GUIDANCE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  await assert.rejects(
    () =>
      prepareAutomationGitHubAuth({
        env: {},
        resolveAccessToken: async () => ""
      }),
    new RegExp(escapedGuidance)
  );
});
