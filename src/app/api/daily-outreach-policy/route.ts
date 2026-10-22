import { authorizePartnersAccess } from "@/lib/auth";
import { getDailyOutreachStatus, saveDailyOutreachPolicy, pauseDailyOutreachPolicy } from "@/lib/services/daily-outreach";

export async function GET() {
  const access = await authorizePartnersAccess("admin");
  if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
  return Response.json(await getDailyOutreachStatus(access.context));
}

export async function POST(request: Request) {
  const access = await authorizePartnersAccess("admin");
  if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
  try {
    const input = await request.json();
    if (input.action === "pause") { await pauseDailyOutreachPolicy(access.context); return Response.json({ success: true }); }
    const policy = await saveDailyOutreachPolicy(access.context, input);
    return Response.json({ success: true, policy });
  } catch (error) { return Response.json({ success: false, error: error instanceof Error ? error.message : "Invalid policy" }, { status: 400 }); }
}
