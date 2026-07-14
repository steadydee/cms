import { NextResponse } from "next/server";
import { syncAllConnectedMailboxes } from "@/lib/services/partner-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sync = await syncAllConnectedMailboxes();
    const status = sync.failed > 0 ? 207 : 200;
    return NextResponse.json({ ok: sync.failed === 0, sync }, { status });
  } catch (error) {
    console.error("Partners Gmail sync cron failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Partners Gmail sync failed" },
      { status: 500 }
    );
  }
}
