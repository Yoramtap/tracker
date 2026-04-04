#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] ?? "").trim();
}

async function main() {
  const site = getArg("--site") || "nepgroup.atlassian.net";
  const email = getArg("--email");
  const tokenFromFlag = getArg("--token");

  if (tokenFromFlag) {
    throw new Error(
      "Passing --token is disabled for security. Set ATLASSIAN_API_TOKEN in the environment or run this command interactively and enter the token when prompted."
    );
  }

  const token = process.env.ATLASSIAN_API_TOKEN || (await promptHidden("Jira API token: "));

  if (!email || !token) {
    throw new Error(
      "Usage: node scripts/dev/setup-backlog-auth.mjs --email <email> [--site nepgroup.atlassian.net]"
    );
  }

  const envPath = path.resolve(process.cwd(), ".env.backlog");
  const body = [
    "# Local Jira credentials for report refresh scripts",
    `ATLASSIAN_SITE=${site}`,
    `ATLASSIAN_EMAIL=${email}`,
    `ATLASSIAN_API_TOKEN=${token}`,
    ""
  ].join("\n");

  await fs.writeFile(envPath, body, "utf8");
  console.log(`Wrote ${envPath}`);
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return "";
  }

  return await new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    let value = "";

    const cleanup = () => {
      input.removeListener("keypress", onKeypress);
      if (input.isTTY) {
        input.setRawMode(false);
      }
      output.write("\n");
    };

    const onKeypress = (char, key = {}) => {
      if (key.sequence === "\u0003") {
        cleanup();
        reject(new Error("Credential entry cancelled."));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value.trim());
        return;
      }

      if (key.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }

      if (!char || key.ctrl || key.meta) {
        return;
      }

      value += char;
      output.write("*");
    };

    readline.emitKeypressEvents(input);
    if (input.isTTY) {
      input.setRawMode(true);
    }
    output.write(label);
    input.on("keypress", onKeypress);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
