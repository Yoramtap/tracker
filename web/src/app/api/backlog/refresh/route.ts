import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getBacklogSnapshot } from "../../../backlog/server-snapshot";

const execFileAsync = promisify(execFile);
let inFlightRefresh: Promise<void> | null = null;

export const runtime = "nodejs";

export async function POST(request: Request) {
  // This endpoint triggers snapshot writer scripts.
  // Writers may perform a full snapshot rebuild or a partial team-slice patch,
  // but that is an internal write strategy and does not imply separate frontend APIs.
  if (process.env.STATIC_EXPORT === "1") {
    return NextResponse.json(
      { error: "Refresh disabled in static export mode" },
      { status: 405 },
    );
  }

  const configuredToken = process.env.BACKLOG_REFRESH_TOKEN?.trim() ?? "";
  const headerToken = request.headers.get("x-backlog-token")?.trim() ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  // Auth rules:
  // - If token is configured: require exact header match.
  // - If token is not configured: deny in production, allow in non-production for local dev.
  if (configuredToken) {
    if (headerToken !== configuredToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  } else if (isProduction) {
    return NextResponse.json(
      { error: "Refresh disabled: BACKLOG_REFRESH_TOKEN is not configured." },
      { status: 401 },
    );
  }

  if (inFlightRefresh) {
    return NextResponse.json(
      { error: "Refresh already in progress" },
      { status: 409 },
    );
  }

  // Best-effort local lock: safe for single-process/single-VM usage,
  // but not a distributed lock for serverless or multi-instance deployments.
  const lockPath = path.resolve(process.cwd(), "src/app/backlog/snapshot.lock");
  let lockHandle: Awaited<ReturnType<typeof fs.open>> | null = null;

  try {
    try {
      lockHandle = await fs.open(lockPath, "wx");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
        return NextResponse.json({ error: "Refresh already in progress" }, { status: 409 });
      }
      throw error;
    }

    const scriptPath = path.resolve(process.cwd(), "scripts/refresh-backlog-trends.mjs");
    inFlightRefresh = execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    }).then(() => undefined);
    await inFlightRefresh;

    return NextResponse.json(await getBacklogSnapshot());
  } catch (error) {
    let message = "Failed to refresh backlog trends.";
    if (typeof error === "object" && error !== null) {
      const maybeError = error as { message?: string; stderr?: string };
      if (maybeError.stderr && maybeError.stderr.trim()) {
        message = maybeError.stderr.trim();
      } else if (maybeError.message) {
        message = maybeError.message;
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    inFlightRefresh = null;
    if (lockHandle) {
      await lockHandle.close().catch(() => undefined);
      await fs.unlink(lockPath).catch(() => undefined);
    }
  }
}
