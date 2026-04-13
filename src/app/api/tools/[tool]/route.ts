import { executeTool } from "@/lib/tools/handlers";
import { ensureToolAccess, findToolDefinition, type ToolRequest } from "@/lib/tools/runtime";

export async function POST(request: Request, ctx: RouteContext<"/api/tools/[tool]">) {
  const { tool } = await ctx.params;
  const definition = findToolDefinition(tool);
  if (!definition) {
    return Response.json(
      {
        success: false,
        errorCode: "NOT_FOUND",
        message: "Tool not found.",
        correlationId: crypto.randomUUID(),
      },
      { status: 404 }
    );
  }

  const access = await ensureToolAccess(definition);
  if (!access.ok) {
    return Response.json(access.response, { status: access.response.errorCode === "UNAUTHENTICATED" ? 401 : 403 });
  }

  const body = (await request.json()) as ToolRequest;
  const response = await executeTool(tool, body.input, access.context, access.correlationId);
  return Response.json(response, {
    status: response.success
      ? 200
      : response.errorCode === "NOT_FOUND"
        ? 404
        : response.errorCode === "VALIDATION_FAILED"
          ? 400
          : response.errorCode === "UNAUTHENTICATED"
            ? 401
            : response.errorCode === "PERMISSION_DENIED"
              ? 403
              : 500,
  });
}
