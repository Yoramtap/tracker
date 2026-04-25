import assert from "node:assert/strict";
import test from "node:test";

import {
  describeRetryableGitRemoteFailure,
  isRetryableGitRemoteFailure,
  runRetryableGitRemoteCommand
} from "./git-remote-retry.mjs";

test("isRetryableGitRemoteFailure matches DNS-style git remote errors", () => {
  assert.equal(
    isRetryableGitRemoteFailure(
      new Error(
        "git pull --ff-only origin main failed with exit code 1.\nfatal: unable to access 'https://github.com/Yoramtap/tracker.git/': Could not resolve host: github.com"
      )
    ),
    true
  );
  assert.equal(
    isRetryableGitRemoteFailure(
      new Error("ssh: Could not resolve hostname github.com: Temporary failure in name resolution")
    ),
    true
  );
});

test("isRetryableGitRemoteFailure does not retry auth failures", () => {
  assert.equal(
    isRetryableGitRemoteFailure(
      new Error(
        "fatal: Authentication failed for 'https://github.com/Yoramtap/tracker.git/'"
      )
    ),
    false
  );
});

test("describeRetryableGitRemoteFailure normalizes repeated whitespace", () => {
  assert.equal(
    describeRetryableGitRemoteFailure(
      new Error("fatal: unable to access\n'https://github.com/':   Could not resolve host")
    ),
    "fatal: unable to access 'https://github.com/': Could not resolve host"
  );
});

test("runRetryableGitRemoteCommand retries retryable git remote failures with backoff", async () => {
  const attempts = [];
  const retryEvents = [];
  const waitDurations = [];

  const result = await runRetryableGitRemoteCommand({
    operationName: "git pull --ff-only origin main",
    baseDelayMs: 25,
    sleep: async (ms) => {
      waitDurations.push(ms);
    },
    onRetry: async (event) => {
      retryEvents.push({
        attempt: event.attempt,
        maxAttempts: event.maxAttempts,
        waitMs: event.waitMs,
        operationName: event.operationName
      });
    },
    run: async () => {
      attempts.push("run");
      if (attempts.length < 3) {
        throw new Error(
          "fatal: unable to access 'https://github.com/Yoramtap/tracker.git/': Could not resolve host: github.com"
        );
      }
      return "ok";
    }
  });

  assert.equal(result, "ok");
  assert.equal(attempts.length, 3);
  assert.deepEqual(waitDurations, [25, 50]);
  assert.deepEqual(retryEvents, [
    {
      attempt: 1,
      maxAttempts: 4,
      waitMs: 25,
      operationName: "git pull --ff-only origin main"
    },
    {
      attempt: 2,
      maxAttempts: 4,
      waitMs: 50,
      operationName: "git pull --ff-only origin main"
    }
  ]);
});

test("runRetryableGitRemoteCommand does not retry non-retryable failures", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      runRetryableGitRemoteCommand({
        operationName: "git push",
        sleep: async () => {},
        run: async () => {
          attempts += 1;
          throw new Error("fatal: Authentication failed for 'https://github.com/Yoramtap/tracker.git/'");
        }
      }),
    /Authentication failed/
  );

  assert.equal(attempts, 1);
});
