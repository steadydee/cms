import { headers } from "next/headers";
import { authorizePartnersAccess, type PartnersAccessLevel, type PartnersRequestContext } from "@/lib/auth";
import { TOOL_DEFINITIONS, type ToolClassification, type ToolDefinition } from "@/lib/tools/definitions";

export type RequestSource = "ui" | "hub" | "internal_agent" | "chatbot" | "api" | "scheduled_job";

export type ToolRequest<TInput = unknown> = {
  input: TInput;
  actor?: {
    actorType: "human" | "agent" | "automation" | "system";
    actorId: string;
    actorLabel: string;
  };
  context?: {
    correlationId?: string;
    requestSource?: RequestSource;
    activePropertyId?: string | null;
    activeWorkspaceId?: string | null;
  };
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
  retryable?: boolean;
  fieldErrors?: Record<string, string>;
  correlationId: string;
};

export type ToolResponse<TData> = ToolSuccess<TData> | ToolFailure;

export type ToolHandlerResult = {
  data: unknown;
  audit?: {
    target?: {
      entityType?: string | null;
      entityId?: string | null;
    } | null;
    outputSummary?: string | null;
  };
};

export class ToolError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  fieldErrors?: Record<string, string>;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; retryable?: boolean; fieldErrors?: Record<string, string> }
  ) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.status = options?.status ?? 400;
    this.retryable = options?.retryable ?? false;
    this.fieldErrors = options?.fieldErrors;
  }
}

const REQUEST_SOURCES = new Set<RequestSource>(["ui", "hub", "internal_agent", "chatbot", "api", "scheduled_job"]);

function hasPermission(context: PartnersRequestContext, permission: string) {
  if (context.source !== "agent") return true;
  const values = new Set(context.permissions ?? []);
  return values.has("partners.admin") || values.has(permission);
}

function determineRequestSource(context: PartnersRequestContext, explicit: string | null): RequestSource {
  if (explicit && REQUEST_SOURCES.has(explicit as RequestSource)) {
    return explicit as RequestSource;
  }

  if (context.source === "agent") return "internal_agent";
  if (context.source === "shell") return "hub";
  return "api";
}

export async function getCorrelationId() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-ow-correlation-id")?.trim() || crypto.randomUUID();
}

export async function getRequestSource(context: PartnersRequestContext) {
  const requestHeaders = await headers();
  return determineRequestSource(context, requestHeaders.get("x-ow-request-source")?.trim() || null);
}

export function listPartnerTools() {
  return TOOL_DEFINITIONS.map(({ accessLevel, ...tool }) => {
    void accessLevel;
    return tool;
  });
}

export function getToolCatalog() {
  return {
    app: "partners",
    appVersion: "0.1.0",
    specVersion: "1.0",
    toolCatalogVersion: "2",
    authModes: ["hub_session", "machine_token"],
    tools: listPartnerTools(),
  };
}

export function findToolDefinition(name: string): ToolDefinition | null {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name) ?? null;
}

function mapPermissionLevel(tool: ToolDefinition): PartnersAccessLevel {
  return tool.accessLevel;
}

function enforceClassificationScope(tool: ToolDefinition, context: PartnersRequestContext) {
  if (context.source !== "agent") return;

  const allowed = new Set(context.allowedToolClassifications ?? []);
  if (allowed.size > 0 && !allowed.has(tool.classification)) {
    throw new ToolError("CLASSIFICATION_NOT_ALLOWED", `${tool.classification} tools are not allowed for this agent`, { status: 403 });
  }
}

function enforcePermissions(tool: ToolDefinition, context: PartnersRequestContext) {
  for (const permission of tool.requiredPermissions) {
    if (!hasPermission(context, permission)) {
      throw new ToolError("PERMISSION_DENIED", `Missing required permission: ${permission}`, { status: 403 });
    }
  }
}

function enforceApproval(tool: ToolDefinition, context: PartnersRequestContext) {
  if (!tool.requiresApproval) return;
  if (context.source === "agent") {
    throw new ToolError("APPROVAL_REQUIRED", `${tool.name} requires an approval flow before agents can execute it`, { status: 403 });
  }
}

export async function ensureToolAccess(tool: ToolDefinition) {
  const correlationId = await getCorrelationId();
  const access = await authorizePartnersAccess(mapPermissionLevel(tool));
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

  try {
    if (tool.requiresPropertyContext && !access.context.propertyId) {
      throw new ToolError("PROPERTY_CONTEXT_MISSING", "This tool requires an active property context", { status: 400 });
    }

    enforceClassificationScope(tool, access.context);
    enforcePermissions(tool, access.context);
    enforceApproval(tool, access.context);
  } catch (error) {
    const failure = toToolFailure(error, correlationId);
    return { ok: false as const, response: failure };
  }

  return {
    ok: true as const,
    correlationId,
    context: access.context,
    requestSource: await getRequestSource(access.context),
  };
}

export function toToolSuccess<TData>(data: TData, correlationId: string): ToolSuccess<TData> {
  return {
    success: true,
    data,
    correlationId,
  };
}

export function toToolFailure(error: unknown, correlationId: string): ToolFailure {
  if (error instanceof ToolError) {
    return {
      success: false,
      errorCode: error.code,
      message: error.message,
      retryable: error.retryable,
      fieldErrors: error.fieldErrors,
      correlationId,
    };
  }

  return {
    success: false,
    errorCode: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unexpected tool error.",
    correlationId,
  };
}

export function getToolHttpStatus(error: unknown) {
  if (error instanceof ToolError) return error.status;
  return 500;
}

export function summarizeInput(input: Record<string, unknown>) {
  const entries = Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 10)
    .map(([key, value]) => `${key}=${typeof value === "object" ? "[object]" : String(value)}`);

  return entries.join(", ") || null;
}

export function summarizeOutput(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const values = data as Record<string, unknown>;
  if (typeof values.id === "string") return `id=${values.id}`;
  if (typeof values.messageId === "string") return `messageId=${values.messageId}`;
  if (typeof values.touchId === "string") return `touchId=${values.touchId}`;
  if (typeof values.count === "number") return `count=${values.count}`;
  return null;
}

export type ToolAuditStatus = "success" | "failed" | "rejected";

export function classifyAuditStatus(error: unknown): ToolAuditStatus {
  if (error instanceof ToolError && (error.status === 401 || error.status === 403)) {
    return "rejected";
  }
  return "failed";
}

export function isWriteClassification(classification: ToolClassification) {
  return classification === "guarded_write" || classification === "restricted";
}
