const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 1500;

const RETRYABLE_GIT_REMOTE_ERROR_PATTERNS = [
  /could not resolve host/i,
  /could not resolve hostname/i,
  /temporary failure in name resolution/i,
  /name or service not known/i,
  /network is unreachable/i,
  /connection timed out/i,
  /operation timed out/i,
  /connection reset by peer/i,
  /failed to connect to .* port \d+/i
];

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableGitRemoteFailure(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) return false;
  return RETRYABLE_GIT_REMOTE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function describeRetryableGitRemoteFailure(error) {
  const message = String(error?.message || error || "").trim();
  const normalized = message.replace(/\s+/g, " ");
  return normalized || "unknown git remote failure";
}

export async function runRetryableGitRemoteCommand(options = {}) {
  const operationName = String(options.operationName || "git remote command").trim();
  const run = options.run;
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(1, Number(options.baseDelayMs) || DEFAULT_BASE_DELAY_MS);
  const sleep = typeof options.sleep === "function" ? options.sleep : defaultSleep;
  const onRetry = typeof options.onRetry === "function" ? options.onRetry : () => {};

  if (typeof run !== "function") {
    throw new Error(`Missing run() for ${operationName}.`);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isRetryableGitRemoteFailure(error) || attempt >= maxAttempts) {
        throw error;
      }

      const waitMs = baseDelayMs * 2 ** (attempt - 1);
      await onRetry({
        attempt,
        maxAttempts,
        waitMs,
        error,
        operationName
      });
      await sleep(waitMs);
    }
  }

  throw new Error(`${operationName} failed unexpectedly after retries.`);
}
