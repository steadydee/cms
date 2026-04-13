import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools/handlers";
import { createToolActionAudit } from "@/lib/tools/partners-tool-audit";
import {
  classifyAuditStatus,
  ensureToolAccess,
  findToolDefinition,
  getToolHttpStatus,
  summarizeInput,
  summarizeOutput,
  toToolFailure,
  toToolSuccess,
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

  const body = await request.json().catch(() => ({}));
  const parsedBody = typeof body === "object" && body !== null ? (body as ToolRequest<Record<string, unknown>>) : { input: {} };
  const input =
    parsedBody.input && typeof parsedBody.input === "object" && !Array.isArray(parsedBody.input)
      ? parsedBody.input
      : typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

  const inputSummary = summarizeInput(input);

  try {
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
