#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const SKIP_PATHS = [
  /^package-lock\.json$/,
  /^vendor\//,
  /^assets\//,
  /\.(?:woff2?|png)$/i
];

const PRIVATE_GITHUB_ORG_PATTERN = new RegExp(["ne", "pgpe"].join(""), "i");
const PRIVATE_GITHUB_ACCOUNT_PATTERN = new RegExp(
  [`yoram-tap_${["nep", "group"].join("")}`, `_${["nep", "group"].join("")}`].join("|"),
  "i"
);
const GITHUB_FINE_GRAINED_TOKEN_PATTERN = new RegExp(
  `${["github", "pat"].join("_")}_[A-Za-z0-9_]+`
);
const PRIVATE_KEY_PATTERN = new RegExp(
  `-----BEGIN (?:RSA |EC |OPENSSH |DSA )?${["PRIVATE", "KEY"].join(" ")}-----`
);

const FORBIDDEN_PATTERNS = [
  { label: "private GitHub org marker", pattern: PRIVATE_GITHUB_ORG_PATTERN },
  { label: "private GitHub account marker", pattern: PRIVATE_GITHUB_ACCOUNT_PATTERN },
  { label: "GitHub fine-grained token", pattern: GITHUB_FINE_GRAINED_TOKEN_PATTERN },
  { label: "GitHub classic token", pattern: /\bgh[opsu]_[A-Za-z0-9]{20,}\b/ },
  { label: "private key", pattern: PRIVATE_KEY_PATTERN },
  { label: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { label: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ }
];

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const findings = [];
for (const filePath of trackedFiles()) {
  if (SKIP_PATHS.some((pattern) => pattern.test(filePath))) continue;

  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`${filePath}: ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Public sensitive-marker scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Public sensitive-marker scan passed.");
