import { ensureToolAccess, findToolDefinition } from "@/lib/tools/runtime";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await ensureToolAccess(findToolDefinition("get_partner_email_draft")!);
  if (!access.ok) return Response.json(access.response, { status: access.response.errorCode === "UNAUTHENTICATED" ? 401 : 403 });
  const { id } = await params;
  const draft = await db.emailDraft.findFirst({ where: { id, propertyId: access.context.propertyId } });
  if (!draft?.attachmentContent) return Response.json({ error: "Attachment not found" }, { status: 404 });
  return new Response(new Uint8Array(draft.attachmentContent), { headers: {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(draft.attachmentName || "attachment")}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
