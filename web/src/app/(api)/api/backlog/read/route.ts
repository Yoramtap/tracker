import { NextResponse } from "next/server";
import { getBacklogSnapshot, getSnapshot } from "@/domains/backlog/server-snapshot";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getSnapshot());
  } catch {
    return NextResponse.json(await getBacklogSnapshot());
  }
}
