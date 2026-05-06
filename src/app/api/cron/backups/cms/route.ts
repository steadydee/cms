import { NextResponse } from "next/server";
import { createPartnersDatabaseBackup } from "@/lib/services/database-backups";

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

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { ok: false, error: "Partners backups only run in production" },
      { status: 403 }
    );
  }

  try {
    const backup = await createPartnersDatabaseBackup();
    return NextResponse.json({ ok: true, backup });
  } catch (error) {
    console.error("Partners backup failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Partners backup failed" },
      { status: 500 }
    );
  }
}
