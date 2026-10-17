import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools/handlers";
import { createToolActionAudit } from "@/lib/tools/partners-tool-audit";
import { MAX_EMAIL_ATTACHMENT_BYTES } from "@/lib/email-delivery";
import {
  classifyAuditStatus,
  ensureToolAccess,
  findToolDefinition,
  getToolHttpStatus,
  summarizeInput,
  summarizeOutput,
  toToolFailure,
  toToolSuccess,
  ToolError,
  type ToolRequest,
} from "@/lib/tools/runtime";

export async function GET(_request: Request, ctx: RouteContext<"/api/tools/[tool]">) {
  const { tool } = await ctx.params;
  const definition = findToolDefinition(tool);
  if (!definition) {
    return NextResponse.json(
      { success: false, errorCode: "NOT_FOUND", message: "Tool not found.", correlationId: crypto.randomUUID() },
      { status: 404 }
    );
  }

  const access = await ensureToolAccess(definition);
  if (!access.ok) {
    return NextResponse.json(access.response, {
      status: access.response.errorCode === "UNAUTHENTICATED" ? 401 : 403,
    });
  }

  return NextResponse.json({
    name: definition.name,
    classification: definition.classification,
    description: definition.description,
    requiredPermissions: definition.requiredPermissions,
    inputSummary: definition.inputSummary,
    outputSummary: definition.outputSummary,
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/tools/[tool]">) {
  const { tool } = await ctx.params;
  const definition = findToolDefinition(tool);
  if (!definition) {
    return NextResponse.json(
      { success: false, errorCode: "NOT_FOUND", message: "Tool not found.", correlationId: crypto.randomUUID() },
      { status: 404 }
    );
  }

  const access = await ensureToolAccess(definition);
  if (!access.ok) {
    return NextResponse.json(access.response, {
      status: access.response.errorCode === "UNAUTHENTICATED" ? 401 : 403,
    });
  }

  let inputSummary: string | null = null;
  try {
    let body;
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (tool !== "save_partner_email_draft") throw new ToolError("VALIDATION_FAILED", "Multipart input is only supported for email drafts.");
      const form = await request.formData();
      const input = JSON.parse(String(form.get("input") || "{}"));
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new ToolError("VALIDATION_FAILED", "Draft input must be an object.");
      const file = form.get("attachment");
      if (!(file instanceof File) || !file.size || file.size > MAX_EMAIL_ATTACHMENT_BYTES) throw new ToolError("VALIDATION_FAILED", "A valid attachment is required.");
      // Binary multipart avoids base64 expansion at Vercel's request-size boundary.
      body = { input: { ...input, attachment: { filename: file.name, contentType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") } } };
    } else body = await request.json().catch(() => ({}));
    const parsedBody = typeof body === "object" && body !== null ? (body as ToolRequest<Record<string, unknown>>) : { input: {} };
    const input = parsedBody.input && typeof parsedBody.input === "object" && !Array.isArray(parsedBody.input)
      ? parsedBody.input : typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    inputSummary = summarizeInput(input);
    const result = await executeTool(tool, input, access.context);
    const response = toToolSuccess(result.data, access.correlationId);

    await createToolActionAudit({
      toolName: definition.name,
      classification: definition.classification,
      context: access.context,
      correlationId: access.correlationId,
      requestSource: access.requestSource,
      status: "success",
      inputSummary,
      outputSummary: result.audit?.outputSummary ?? summarizeOutput(result.data),
      target: result.audit?.target ?? null,
    });

    return NextResponse.json(response);
  } catch (error) {
    const failure = toToolFailure(error, access.correlationId);

    await createToolActionAudit({
      toolName: definition.name,
      classification: definition.classification,
      context: access.context,
      correlationId: access.correlationId,
      requestSource: access.requestSource,
      status: classifyAuditStatus(error),
      inputSummary,
      outputSummary: null,
      errorCode: failure.errorCode,
      target: null,
    });

    return NextResponse.json(failure, { status: getToolHttpStatus(error) });
  }
}
