#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

async function main() {
  const site = getArg("--site") || "nepgroup.atlassian.net";
  const email = getArg("--email");
  const token = getArg("--token");

  if (!email || !token) {
    throw new Error(
      "Usage: node scripts/setup-backlog-auth.mjs --email <email> --token <token> [--site nepgroup.atlassian.net]",
    );
  }

  const envPath = path.resolve(process.cwd(), ".env.backlog");
  const body = [
    "# Local Jira credentials for backlog trend refresh scripts",
    `ATLASSIAN_SITE=${site}`,
    `ATLASSIAN_EMAIL=${email}`,
    `ATLASSIAN_API_TOKEN=${token}`,
    "",
  ].join("\n");

  await fs.writeFile(envPath, body, "utf8");
  console.log(`Wrote ${envPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

