import { RelationshipStatus, ResearchFindingStatus, ResearchSourceType, VisitStatus } from "@prisma/client";
import {
  createResearchFinding,
  draftIntroEmail,
  getOrganizationDetail,
  listDueFollowUps,
  listOrganizations,
  listResearchFindings,
} from "@/lib/services/partners";
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
      case "get_partner_account":
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
      case "find_partner_accounts":
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
        const payload = input as {
          bucket?: "all" | "overdue" | "this_week" | "mine";
          assignee?: string;
        };
        const tasks = await listDueFollowUps(context.propertyId, payload);
        return success(tasks, correlationId);
      }
      case "list_research_findings": {
        const payload = input as {
          status?: ResearchFindingStatus | "all";
          sourceType?: ResearchSourceType | "all";
          query?: string;
        };
        const findings = await listResearchFindings(context.propertyId, payload);
        return success(findings, correlationId);
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
      case "create_research_finding": {
        const payload = input as {
          sourceType?: ResearchSourceType;
          sourceUrl?: string;
          sourceHandle?: string;
          observedName?: string;
          observedText?: string;
          extractedDataJson?: unknown;
          confidence?: number;
          proposedOrganizationId?: string;
        };
        const finding = await createResearchFinding(context, payload);
        return success(finding, correlationId);
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
