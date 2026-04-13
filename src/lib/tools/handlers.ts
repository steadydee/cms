import {
  OutreachChannel,
  ResearchFindingStatus,
  ResearchSourceType,
  RelationshipStatus,
  type PartnerType,
  type VisitStatus,
} from "@prisma/client";
import type { PartnersRequestContext } from "@/lib/auth";
import {
  addContact,
  archiveOrganization,
  bulkScheduleFollowUpTasks,
  bulkUpdateOrganizations,
  completeFollowUpTask,
  createOrganization,
  createResearchFinding,
  draftIntroEmail,
  getDashboardSummary,
  getOrganizationDetail,
  getOrganizationViewCounts,
  getResearchFindingDetail,
  listDueFollowUps,
  listOrganizations,
  listRecentlyActiveOrganizations,
  listResearchFindings,
  logOutreachTouch,
  promoteResearchFindingToOrganization,
  reopenFollowUpTask,
  scheduleFollowUpTask,
  sendIntroEmail,
  unarchiveOrganization,
  updateFollowUpAssignee,
  updateResearchFindingStatus,
  updateOrganizationProfile,
  updateOrganizationStatus,
} from "@/lib/services/partners";
import { ToolError, type ToolHandlerResult } from "@/lib/tools/runtime";

function requireString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ToolError("VALIDATION_FAILED", `${key} is required.`, {
      status: 400,
      fieldErrors: { [key]: "Required" },
    });
  }
  return value.trim();
}

function optionalString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new ToolError("VALIDATION_FAILED", `${key} must be a number.`, {
      status: 400,
      fieldErrors: { [key]: "Invalid number" },
    });
  }
  return parsed;
}

function optionalStringArray(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ToolError("VALIDATION_FAILED", `${key} must be an array of strings.`, { status: 400 });
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function optionalBoolean(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", `${key} must be a boolean.`, { status: 400 });
}

function toRelationshipStatus(value: unknown): RelationshipStatus | undefined {
  if (
    value === "not_contacted" ||
    value === "contacted" ||
    value === "awaiting_reply" ||
    value === "engaged" ||
    value === "visit_scheduled" ||
    value === "visited" ||
    value === "proposal_sent" ||
    value === "active_partner" ||
    value === "inactive" ||
    value === "not_interested"
  ) {
    return value;
  }
  if (value === undefined || value === null || value === "" || value === "all") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid relationship status.", { status: 400 });
}

function toVisitStatus(value: unknown): VisitStatus | "all" | undefined {
  if (value === "never_invited" || value === "invited" || value === "scheduled" || value === "visited" || value === "all") {
    return value;
  }
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid visit status.", { status: 400 });
}

function toPartnerType(value: unknown): PartnerType | "all" | undefined {
  if (
    value === "agency" ||
    value === "operator" ||
    value === "travel_advisor" ||
    value === "media" ||
    value === "other" ||
    value === "all"
  ) {
    return value;
  }
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid account type.", { status: 400 });
}

function toResearchStatus(value: unknown): ResearchFindingStatus | "all" | undefined {
  if (value === "new" || value === "reviewed" || value === "promoted" || value === "discarded" || value === "merged" || value === "all") {
    return value;
  }
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid research status.", { status: 400 });
}

function toResearchSourceType(value: unknown): ResearchSourceType | "all" | undefined {
  if (
    value === "manual" ||
    value === "instagram" ||
    value === "website" ||
    value === "directory" ||
    value === "referral" ||
    value === "other" ||
    value === "all"
  ) {
    return value;
  }
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid research source type.", { status: 400 });
}

function toOutreachChannel(value: unknown): OutreachChannel {
  if (value === "email" || value === "whatsapp" || value === "phone" || value === "meeting" || value === "other") {
    return value;
  }
  throw new ToolError("VALIDATION_FAILED", "Invalid outreach channel.", { status: 400 });
}

function toTaskBucket(value: unknown): "all" | "overdue" | "this_week" | "mine" | undefined {
  if (value === "all" || value === "overdue" || value === "this_week" || value === "mine") return value;
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid task bucket.", { status: 400 });
}

function toSavedView(value: unknown):
  | "all"
  | "not_contacted"
  | "awaiting_reply"
  | "visited_not_active"
  | "overdue"
  | "unassigned"
  | "archived"
  | undefined {
  if (
    value === "all" ||
    value === "not_contacted" ||
    value === "awaiting_reply" ||
    value === "visited_not_active" ||
    value === "overdue" ||
    value === "unassigned" ||
    value === "archived"
  ) {
    return value;
  }
  if (value === undefined || value === null || value === "") return undefined;
  throw new ToolError("VALIDATION_FAILED", "Invalid saved view.", { status: 400 });
}

function toBulkAction(value: unknown): "mark_contacted" | "mark_awaiting_reply" | "assign_to_me" {
  if (value === "mark_contacted" || value === "mark_awaiting_reply" || value === "assign_to_me") return value;
  throw new ToolError("VALIDATION_FAILED", "Invalid bulk action.", { status: 400 });
}

function toExtractedJson(input: Record<string, unknown>) {
  const value = input.extractedDataJson;
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object") {
    throw new ToolError("VALIDATION_FAILED", "extractedDataJson must be an object.", { status: 400 });
  }
  return value;
}

function notFound(message: string) {
  return new ToolError("NOT_FOUND", message, { status: 404 });
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: PartnersRequestContext
): Promise<ToolHandlerResult> {
  switch (toolName) {
    case "get_dashboard_summary": {
      return { data: await getDashboardSummary(context.propertyId) };
    }

    case "get_partner_account":
    case "get_partner_organization": {
      const organizationId = requireString(input, "organizationId");
      const organization = await getOrganizationDetail(organizationId, context.propertyId);
      if (!organization) throw notFound("Partner organization not found.");
      return {
        data: organization,
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "find_partner_accounts":
    case "find_partner_organizations": {
      return {
        data: await listOrganizations(context.propertyId, {
          query: optionalString(input, "query"),
          status: toRelationshipStatus(input.status) ?? "all",
          visitStatus: toVisitStatus(input.visitStatus) ?? "all",
          type: toPartnerType(input.type) ?? "all",
          source: optionalString(input, "source"),
          owner: optionalString(input, "owner"),
          view: toSavedView(input.view),
        }),
      };
    }

    case "list_not_contacted_partners": {
      return {
        data: await listOrganizations(context.propertyId, {
          view: "not_contacted",
          status: "not_contacted",
          visitStatus: "all",
        }),
      };
    }

    case "list_recent_active_accounts": {
      const take = optionalNumber(input, "take");
      return { data: await listRecentlyActiveOrganizations(context.propertyId, take ? Math.max(1, Math.min(20, take)) : 5) };
    }

    case "list_saved_view_counts": {
      return { data: await getOrganizationViewCounts(context.propertyId) };
    }

    case "list_tasks":
    case "list_followups_due": {
      return {
        data: await listDueFollowUps(context.propertyId, {
          bucket: toTaskBucket(input.bucket) ?? "all",
          assignee: optionalString(input, "assignee"),
        }),
      };
    }

    case "list_research_findings": {
      return {
        data: await listResearchFindings(context.propertyId, {
          status: toResearchStatus(input.status) ?? "all",
          sourceType: toResearchSourceType(input.sourceType) ?? "all",
          query: optionalString(input, "query"),
        }),
      };
    }

    case "get_research_finding": {
      const findingId = requireString(input, "findingId");
      const finding = await getResearchFindingDetail(findingId, context.propertyId);
      if (!finding) throw notFound("Research finding not found.");
      return {
        data: finding,
        audit: {
          target: { entityType: "research_finding", entityId: finding.id },
        },
      };
    }

    case "draft_intro_email": {
      const organizationId = requireString(input, "organizationId");
      const organization = await getOrganizationDetail(organizationId, context.propertyId);
      if (!organization) throw notFound("Partner organization not found.");
      return {
        data: draftIntroEmail(organization),
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "create_partner_account": {
      const organization = await createOrganization(context, {
        name: requireString(input, "name"),
        type: (toPartnerType(input.type) as PartnerType | undefined) ?? "agency",
        country: optionalString(input, "country"),
        city: optionalString(input, "city"),
        email: optionalString(input, "email"),
        phone: optionalString(input, "phone"),
        whatsapp: optionalString(input, "whatsapp"),
        website: optionalString(input, "website"),
        source: optionalString(input, "source"),
        marketNotes: optionalString(input, "marketNotes"),
        nextActionAt: optionalString(input, "nextActionAt"),
      });
      return {
        data: organization,
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "update_partner_profile": {
      const organization = await updateOrganizationProfile(context, {
        organizationId: requireString(input, "organizationId"),
        country: optionalString(input, "country"),
        city: optionalString(input, "city"),
        email: optionalString(input, "email"),
        phone: optionalString(input, "phone"),
        whatsapp: optionalString(input, "whatsapp"),
        website: optionalString(input, "website"),
        source: optionalString(input, "source"),
        marketNotes: optionalString(input, "marketNotes"),
        nextActionAt: optionalString(input, "nextActionAt"),
        ownerUserId: optionalString(input, "ownerUserId"),
        ownerUserName: optionalString(input, "ownerUserName"),
        priority: optionalNumber(input, "priority"),
      });
      return {
        data: organization,
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "update_partner_status": {
      const organization = await updateOrganizationStatus(context, {
        organizationId: requireString(input, "organizationId"),
        status: toRelationshipStatus(input.status) ?? (() => {
          throw new ToolError("VALIDATION_FAILED", "status is required.", {
            status: 400,
            fieldErrors: { status: "Required" },
          });
        })(),
        visitStatus: (toVisitStatus(input.visitStatus) as VisitStatus | undefined) ?? (() => {
          throw new ToolError("VALIDATION_FAILED", "visitStatus is required.", {
            status: 400,
            fieldErrors: { visitStatus: "Required" },
          });
        })(),
        visitNotes: optionalString(input, "visitNotes"),
      });
      return {
        data: organization,
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "add_partner_contact": {
      const contact = await addContact(context, {
        organizationId: requireString(input, "organizationId"),
        fullName: requireString(input, "fullName"),
        roleTitle: optionalString(input, "roleTitle"),
        email: optionalString(input, "email"),
        phone: optionalString(input, "phone"),
        whatsapp: optionalString(input, "whatsapp"),
        preferredChannel: optionalString(input, "preferredChannel") as OutreachChannel | undefined,
        notes: optionalString(input, "notes"),
        isPrimary: optionalBoolean(input, "isPrimary"),
      });
      return {
        data: contact,
        audit: {
          target: { entityType: "partner_contact", entityId: contact.id },
        },
      };
    }

    case "log_outreach_touch": {
      const touch = await logOutreachTouch(context, {
        organizationId: requireString(input, "organizationId"),
        contactId: optionalString(input, "contactId"),
        channel: toOutreachChannel(input.channel),
        happenedAt: optionalString(input, "happenedAt"),
        subject: optionalString(input, "subject"),
        summary: requireString(input, "summary"),
        outcome: optionalString(input, "outcome"),
        nextStep: optionalString(input, "nextStep"),
        status: toRelationshipStatus(input.status),
      });
      return {
        data: touch,
        audit: {
          target: { entityType: "outreach_touch", entityId: touch.id },
        },
      };
    }

    case "create_task": {
      const task = await scheduleFollowUpTask(context, {
        organizationId: requireString(input, "organizationId"),
        contactId: optionalString(input, "contactId"),
        title: requireString(input, "title"),
        description: optionalString(input, "description"),
        dueAt: requireString(input, "dueAt"),
        assignedToUserId: optionalString(input, "assignedToUserId"),
        assignedToUserName: optionalString(input, "assignedToUserName"),
      });
      return {
        data: task,
        audit: {
          target: { entityType: "follow_up_task", entityId: task.id },
        },
      };
    }

    case "assign_task": {
      const task = await updateFollowUpAssignee(context, {
        taskId: requireString(input, "taskId"),
        assignedToUserId: optionalString(input, "assignedToUserId"),
        assignedToUserName: optionalString(input, "assignedToUserName"),
      });
      return {
        data: task,
        audit: {
          target: { entityType: "follow_up_task", entityId: task.id },
        },
      };
    }

    case "complete_task": {
      const task = await completeFollowUpTask(context, requireString(input, "taskId"));
      return {
        data: task,
        audit: {
          target: { entityType: "follow_up_task", entityId: task.id },
        },
      };
    }

    case "reopen_task": {
      const task = await reopenFollowUpTask(context, requireString(input, "taskId"));
      return {
        data: task,
        audit: {
          target: { entityType: "follow_up_task", entityId: task.id },
        },
      };
    }

    case "create_research_finding": {
      const finding = await createResearchFinding(context, {
        sourceType: (toResearchSourceType(input.sourceType) as ResearchSourceType | undefined) ?? "manual",
        sourceUrl: optionalString(input, "sourceUrl"),
        sourceHandle: optionalString(input, "sourceHandle"),
        observedName: optionalString(input, "observedName"),
        observedText: optionalString(input, "observedText"),
        extractedDataJson: toExtractedJson(input),
        confidence: optionalNumber(input, "confidence"),
        proposedOrganizationId: optionalString(input, "proposedOrganizationId"),
      });
      return {
        data: finding,
        audit: {
          target: { entityType: "research_finding", entityId: finding.id },
        },
      };
    }

    case "review_research_finding": {
      const finding = await updateResearchFindingStatus(context, {
        findingId: requireString(input, "findingId"),
        status: "reviewed",
      });
      return {
        data: finding,
        audit: {
          target: { entityType: "research_finding", entityId: finding.id },
        },
      };
    }

    case "discard_research_finding": {
      const finding = await updateResearchFindingStatus(context, {
        findingId: requireString(input, "findingId"),
        status: "discarded",
      });
      return {
        data: finding,
        audit: {
          target: { entityType: "research_finding", entityId: finding.id },
        },
      };
    }

    case "promote_research_finding": {
      const result = await promoteResearchFindingToOrganization(context, {
        findingId: requireString(input, "findingId"),
      });
      return {
        data: result,
        audit: {
          target: {
            entityType: "proposedOrganization" in result ? "research_finding" : "partner_organization",
            entityId: result.id,
          },
        },
      };
    }

    case "send_intro_email": {
      const result = await sendIntroEmail(context, {
        organizationId: requireString(input, "organizationId"),
        contactId: optionalString(input, "contactId"),
        recipientEmail: requireString(input, "recipientEmail"),
        recipientLabel: optionalString(input, "recipientLabel"),
        subject: requireString(input, "subject"),
        body: requireString(input, "body"),
      });
      return {
        data: result,
        audit: {
          target: { entityType: "partner_organization", entityId: requireString(input, "organizationId") },
        },
      };
    }

    case "archive_partner_account": {
      const organization = await archiveOrganization(context, requireString(input, "organizationId"));
      return {
        data: organization,
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "unarchive_partner_account": {
      const organization = await unarchiveOrganization(context, requireString(input, "organizationId"));
      return {
        data: organization,
        audit: {
          target: { entityType: "partner_organization", entityId: organization.id },
        },
      };
    }

    case "bulk_update_accounts": {
      const result = await bulkUpdateOrganizations(context, {
        organizationIds: optionalStringArray(input, "organizationIds") ?? [],
        action: toBulkAction(input.action),
      });
      return {
        data: result,
        audit: {
          target: { entityType: "partner_organization_bulk", entityId: null },
          outputSummary: typeof result.count === "number" ? `count=${result.count}` : null,
        },
      };
    }

    case "bulk_schedule_tasks": {
      await bulkScheduleFollowUpTasks(context, {
        organizationIds: optionalStringArray(input, "organizationIds") ?? [],
        title: requireString(input, "title"),
        description: optionalString(input, "description"),
        dueAt: requireString(input, "dueAt"),
      });
      return {
        data: { count: (optionalStringArray(input, "organizationIds") ?? []).length },
        audit: {
          target: { entityType: "follow_up_task_bulk", entityId: null },
          outputSummary: `count=${(optionalStringArray(input, "organizationIds") ?? []).length}`,
        },
      };
    }

    default:
      throw new ToolError("NOT_FOUND", "Tool not found.", { status: 404 });
  }
}
