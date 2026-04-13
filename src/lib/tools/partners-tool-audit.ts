import { db } from "@/lib/db";
import type { PartnersRequestContext } from "@/lib/auth";
import type { ToolClassification } from "@/lib/tools/definitions";

export type ToolAuditTarget = {
  entityType?: string | null;
  entityId?: string | null;
};

type ToolAuditInput = {
  toolName: string;
  classification: ToolClassification;
  context: PartnersRequestContext;
  correlationId: string;
  requestSource: string;
  status: "success" | "failed" | "rejected";
  inputSummary?: string | null;
  outputSummary?: string | null;
  errorCode?: string | null;
  target?: ToolAuditTarget | null;
};

export async function createToolActionAudit(input: ToolAuditInput) {
  if (input.classification === "read" || input.classification === "draft") {
    return;
  }

  await db.toolActionAudit.create({
    data: {
      app: "partners",
      toolName: input.toolName,
      classification: input.classification,
      actorType: input.context.actorType ?? "human",
      actorId: input.context.userId,
      actorLabel: input.context.userName,
      credentialId: input.context.credentialId ?? null,
      requestSource: input.requestSource,
      propertyId: input.context.propertyId,
      targetEntityType: input.target?.entityType ?? null,
      targetEntityId: input.target?.entityId ?? null,
      status: input.status,
      errorCode: input.errorCode ?? null,
      correlationId: input.correlationId,
      inputSummary: input.inputSummary ?? null,
      outputSummary: input.outputSummary ?? null,
    },
  });
}
