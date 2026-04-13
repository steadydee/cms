import { headers } from "next/headers";
import { authorizePartnersAccess } from "@/lib/auth";
import { TOOL_DEFINITIONS, type ToolDefinition } from "@/lib/tools/definitions";

export type ToolRequest<TInput = unknown> = {
  input: TInput;
};

export type ToolSuccess<TData> = {
  success: true;
  data: TData;
  correlationId: string;
};

export type ToolFailure = {
  success: false;
  errorCode: string;
  message: string;
  correlationId: string;
};

export type ToolResponse<TData> = ToolSuccess<TData> | ToolFailure;

const PERMISSION_MAP: Record<string, "read" | "write" | "admin"> = {
  "partners.organizations.read": "read",
  "partners.outreach.read": "read",
  "partners.tasks.read": "read",
  "partners.organizations.write": "write",
  "partners.outreach.write": "write",
  "partners.tasks.write": "write",
  "partners.admin": "admin",
};

export async function getToolCatalog() {
  return {
    app: "partners",
    appVersion: "0.1.0",
    specVersion: "1.0",
    toolCatalogVersion: "2026-04-12",
    authModes: ["hub_session", "machine_token"],
    tools: TOOL_DEFINITIONS,
  };
}

export function findToolDefinition(name: string): ToolDefinition | null {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name) ?? null;
}

export async function getCorrelationId(): Promise<string> {
  return (await headers()).get("x-ow-correlation-id")?.trim() || crypto.randomUUID();
}

export async function ensureToolAccess(tool: ToolDefinition) {
  const correlationId = await getCorrelationId();
  const requiredLevel = tool.requiredPermissions.reduce<"read" | "write" | "admin">((level, permission) => {
    const mapped = PERMISSION_MAP[permission] ?? "read";
    if (mapped === "admin") return "admin";
    if (mapped === "write" && level === "read") return "write";
    return level;
  }, "read");

  const access = await authorizePartnersAccess(requiredLevel);
  if (!access.ok) {
    return {
      ok: false as const,
      response: {
        success: false,
        errorCode: access.status === 401 ? "UNAUTHENTICATED" : "PERMISSION_DENIED",
        message: access.message,
        correlationId,
      } satisfies ToolFailure,
    };
  }

  return {
    ok: true as const,
    correlationId,
    context: access.context,
  };
}
