import { RelationshipStatus, VisitStatus } from "@prisma/client";
import { getOrganizationDetail, listDueFollowUps, listOrganizations, draftIntroEmail } from "@/lib/services/partners";
import { findToolDefinition, type ToolResponse } from "@/lib/tools/runtime";
import type { PartnersRequestContext } from "@/lib/auth";

export async function executeTool(
  toolName: string,
  input: unknown,
  context: PartnersRequestContext,
  correlationId: string
): Promise<ToolResponse<unknown>> {
  const definition = findToolDefinition(toolName);
  if (!definition) {
    return {
      success: false,
      errorCode: "NOT_FOUND",
      message: "Tool not found.",
      correlationId,
    };
  }

  try {
    switch (toolName) {
      case "get_partner_organization": {
        const organizationId = (input as { organizationId?: string })?.organizationId;
        if (!organizationId) {
          return failure("VALIDATION_FAILED", "organizationId is required.", correlationId);
        }
        const organization = await getOrganizationDetail(organizationId, context.propertyId);
        if (!organization) {
          return failure("NOT_FOUND", "Partner organization not found.", correlationId);
        }
        return success(organization, correlationId);
      }
      case "find_partner_organizations": {
        const payload = input as {
          query?: string;
          status?: RelationshipStatus | "all";
          visitStatus?: VisitStatus | "all";
        };
        const organizations = await listOrganizations(context.propertyId, payload);
        return success(organizations, correlationId);
      }
      case "list_not_contacted_partners": {
        const organizations = await listOrganizations(context.propertyId, {
          status: "not_contacted",
          visitStatus: "all",
        });
        return success(organizations, correlationId);
      }
      case "list_followups_due": {
        const tasks = await listDueFollowUps(context.propertyId);
        return success(tasks, correlationId);
      }
      case "draft_intro_email": {
        const organizationId = (input as { organizationId?: string })?.organizationId;
        if (!organizationId) {
          return failure("VALIDATION_FAILED", "organizationId is required.", correlationId);
        }
        const organization = await getOrganizationDetail(organizationId, context.propertyId);
        if (!organization) {
          return failure("NOT_FOUND", "Partner organization not found.", correlationId);
        }
        return success(draftIntroEmail(organization), correlationId);
      }
      default:
        return failure("NOT_FOUND", "Tool not found.", correlationId);
    }
  } catch (error) {
    return failure(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unexpected tool error.",
      correlationId
    );
  }
}

function success<T>(data: T, correlationId: string): ToolResponse<T> {
  return {
    success: true,
    data,
    correlationId,
  };
}

function failure(errorCode: string, message: string, correlationId: string): ToolResponse<never> {
  return {
    success: false,
    errorCode,
    message,
    correlationId,
  };
}
