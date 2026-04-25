import { resolveGitHubAccessToken } from "../refresh-report-data.mjs";
import { resolveGitHubEnvToken } from "../local-env.mjs";

export const HEADLESS_GITHUB_TOKEN_GUIDANCE =
  "Add GH_TOKEN= or GITHUB_TOKEN= to .env.backlog or .env.local so weekly refreshes do not depend on interactive gh state.";

export async function prepareAutomationGitHubAuth(options = {}) {
  const env = options.env || process.env;
  const resolveAccessToken =
    typeof options.resolveAccessToken === "function"
      ? options.resolveAccessToken
      : resolveGitHubAccessToken;
  const validateAccessToken =
    typeof options.validateAccessToken === "function"
      ? options.validateAccessToken
      : async () => {};

  const envToken = resolveGitHubEnvToken(env);
  const token = String(await resolveAccessToken({ env })).trim();

  if (!token) {
    throw new Error(
      `Missing GitHub auth. Authenticate with gh auth login or ${HEADLESS_GITHUB_TOKEN_GUIDANCE}`
    );
  }

  const validationWarning = String((await validateAccessToken(token)) || "").trim();

  let seededEnv = false;
  if (!envToken && !env.GH_TOKEN && !env.GITHUB_TOKEN) {
    env.GH_TOKEN = token;
    seededEnv = true;
  }

  const warningParts = [];
  if (!envToken) {
    warningParts.push(
      `Warning: using gh auth token fallback for this automation run. ${HEADLESS_GITHUB_TOKEN_GUIDANCE}`
    );
  }
  if (validationWarning) {
    warningParts.push(validationWarning);
  }

  return {
    token,
    source: envToken ? "env" : "gh",
    seededEnv,
    warning: warningParts.join("\n")
  };
}
