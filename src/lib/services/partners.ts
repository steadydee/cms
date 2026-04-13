import {
  OutreachChannel,
  RelationshipStatus,
  type PartnerType,
  type Prisma,
  type VisitStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { PartnersRequestContext } from "@/lib/auth";

export type SavedOrganizationView =
  | "all"
  | "not_contacted"
  | "awaiting_reply"
  | "visited_not_active"
  | "overdue"
  | "unassigned";

export type OrganizationFilters = {
  status?: RelationshipStatus | "all";
  visitStatus?: VisitStatus | "all";
  type?: PartnerType | "all";
  source?: string;
  owner?: string;
  query?: string;
  view?: SavedOrganizationView;
};

export type FollowUpFilters = {
  bucket?: "all" | "overdue" | "this_week" | "mine";
  assignee?: string;
};

export const ORGANIZATION_VIEW_LABELS: Record<SavedOrganizationView, string> = {
  all: "All organizations",
  not_contacted: "Not contacted",
  awaiting_reply: "Awaiting reply",
  visited_not_active: "Visited, not active",
  overdue: "Overdue next steps",
  unassigned: "Unassigned owner",
};

function buildOrganizationWhere(propertyId: string, filters: OrganizationFilters): Prisma.PartnerOrganizationWhereInput {
  const now = new Date();
  const view = filters.view ?? "all";

  const andClauses: Prisma.PartnerOrganizationWhereInput[] = [{ propertyId }];

  if (filters.status && filters.status !== "all") {
    andClauses.push({ status: filters.status });
  }

  if (filters.visitStatus && filters.visitStatus !== "all") {
    andClauses.push({ visitStatus: filters.visitStatus });
  }

  if (filters.type && filters.type !== "all") {
    andClauses.push({ type: filters.type });
  }

  if (filters.source?.trim()) {
    andClauses.push({ source: filters.source.trim() });
  }

  if (filters.owner?.trim()) {
    andClauses.push({ ownerUserName: filters.owner.trim() });
  }

  if (filters.query?.trim()) {
    const query = filters.query.trim();
    andClauses.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { country: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { source: { contains: query, mode: "insensitive" } },
        { ownerUserName: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  switch (view) {
    case "not_contacted":
      andClauses.push({ status: "not_contacted" });
      break;
    case "awaiting_reply":
      andClauses.push({ status: "awaiting_reply" });
      break;
    case "visited_not_active":
      andClauses.push({ visitStatus: "visited" }, { status: { not: "active_partner" } });
      break;
    case "overdue":
      andClauses.push({ nextActionAt: { lt: now } });
      break;
    case "unassigned":
      andClauses.push({
        OR: [{ ownerUserId: null }, { ownerUserId: "" }, { ownerUserName: null }, { ownerUserName: "" }],
      });
      break;
    case "all":
    default:
      break;
  }

  return { AND: andClauses };
}

export async function getDashboardSummary(propertyId: string) {
  const now = new Date();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalOrganizations,
    notContacted,
    awaitingReply,
    activePartners,
    visitedPartners,
    dueFollowUps,
    overdueFollowUps,
    overdueOrganizations,
    unassignedOrganizations,
    recentlyTouched,
  ] = await Promise.all([
    db.partnerOrganization.count({ where: { propertyId } }),
    db.partnerOrganization.count({ where: { propertyId, status: "not_contacted" } }),
    db.partnerOrganization.count({ where: { propertyId, status: "awaiting_reply" } }),
    db.partnerOrganization.count({ where: { propertyId, status: "active_partner" } }),
    db.partnerOrganization.count({ where: { propertyId, visitStatus: "visited" } }),
    db.followUpTask.count({
      where: {
        organization: { propertyId },
        status: "open",
        dueAt: { lte: weekFromNow },
      },
    }),
    db.followUpTask.count({
      where: {
        organization: { propertyId },
        status: "open",
        dueAt: { lt: now },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        nextActionAt: { lt: now },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        OR: [{ ownerUserId: null }, { ownerUserId: "" }, { ownerUserName: null }, { ownerUserName: "" }],
      },
    }),
    db.outreachTouch.findMany({
      where: { organization: { propertyId } },
      orderBy: { happenedAt: "desc" },
      take: 5,
      select: {
        id: true,
        channel: true,
        subject: true,
        summary: true,
        happenedAt: true,
        createdByUserName: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    totalOrganizations,
    notContacted,
    awaitingReply,
    activePartners,
    visitedPartners,
    dueFollowUps,
    overdueFollowUps,
    overdueOrganizations,
    unassignedOrganizations,
    recentlyTouched,
  };
}

export async function listOrganizations(propertyId: string, filters: OrganizationFilters = {}) {
  const organizations = await db.partnerOrganization.findMany({
    where: buildOrganizationWhere(propertyId, filters),
    include: {
      _count: {
        select: {
          contacts: true,
          tasks: true,
          touches: true,
        },
      },
    },
    orderBy: [
      { priority: "desc" },
      { nextActionAt: "asc" },
      { updatedAt: "desc" },
    ],
  });

  const now = Date.now();
  return organizations.map((organization) => ({
    ...organization,
    isOverdueNextAction: Boolean(organization.nextActionAt && organization.nextActionAt.getTime() < now),
  }));
}

export async function getOrganizationFilterOptions(propertyId: string) {
  const organizations = await db.partnerOrganization.findMany({
    where: { propertyId },
    select: {
      source: true,
      ownerUserName: true,
    },
  });

  const sources = Array.from(
    new Set(
      organizations
        .map((organization) => organization.source?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((left, right) => left.localeCompare(right));

  const owners = Array.from(
    new Set(
      organizations
        .map((organization) => organization.ownerUserName?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((left, right) => left.localeCompare(right));

  return { sources, owners };
}

export async function getOrganizationViewCounts(propertyId: string) {
  const now = new Date();

  const [all, notContacted, awaitingReply, visitedNotActive, overdue, unassigned] = await Promise.all([
    db.partnerOrganization.count({ where: { propertyId } }),
    db.partnerOrganization.count({ where: { propertyId, status: "not_contacted" } }),
    db.partnerOrganization.count({ where: { propertyId, status: "awaiting_reply" } }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        visitStatus: "visited",
        status: { not: "active_partner" },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        nextActionAt: { lt: now },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        OR: [{ ownerUserId: null }, { ownerUserId: "" }, { ownerUserName: null }, { ownerUserName: "" }],
      },
    }),
  ]);

  return {
    all,
    not_contacted: notContacted,
    awaiting_reply: awaitingReply,
    visited_not_active: visitedNotActive,
    overdue,
    unassigned,
  } satisfies Record<SavedOrganizationView, number>;
}

export async function getOrganizationDetail(id: string, propertyId: string) {
  const organization = await db.partnerOrganization.findFirst({
    where: { id, propertyId },
    include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      touches: {
        orderBy: { happenedAt: "desc" },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const now = Date.now();
  return {
    ...organization,
    tasks: organization.tasks.map((task) => ({
      ...task,
      isOverdue: task.status === "open" && task.dueAt.getTime() < now,
    })),
  };
}

export async function listDueFollowUps(propertyId: string, filters: FollowUpFilters = {}) {
  const now = new Date();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const bucket = filters.bucket ?? "all";

  const andClauses: Prisma.FollowUpTaskWhereInput[] = [
    {
      organization: { propertyId },
      status: "open",
    },
  ];

  if (filters.assignee?.trim()) {
    andClauses.push({ assignedToUserName: filters.assignee.trim() });
  }

  if (bucket === "overdue") {
    andClauses.push({ dueAt: { lt: now } });
  } else if (bucket === "this_week") {
    andClauses.push({ dueAt: { gte: now, lte: weekFromNow } });
  } else if (bucket === "mine") {
    andClauses.push({ assignedToUserName: filters.assignee?.trim() ?? "" });
  }

  const tasks = await db.followUpTask.findMany({
    where: { AND: andClauses },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          status: true,
          visitStatus: true,
          ownerUserName: true,
        },
      },
      contact: {
        select: { id: true, fullName: true },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  return tasks.map((task) => ({
    ...task,
    isOverdue: task.status === "open" && task.dueAt.getTime() < now.getTime(),
  }));
}

export async function createOrganization(
  context: PartnersRequestContext,
  input: {
    name: string;
    type: PartnerType;
    country?: string;
    city?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    website?: string;
    source?: string;
    marketNotes?: string;
    nextActionAt?: string;
  }
) {
  if (!input.name.trim()) {
    throw new Error("Organization name is required");
  }

  return db.partnerOrganization.create({
    data: {
      propertyId: context.propertyId,
      name: input.name.trim(),
      type: input.type,
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      website: input.website?.trim() || null,
      source: input.source?.trim() || null,
      marketNotes: input.marketNotes?.trim() || null,
      ownerUserId: context.userId,
      ownerUserName: context.userName,
      nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
    },
  });
}

export async function addContact(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    fullName: string;
    roleTitle?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    preferredChannel?: OutreachChannel;
    notes?: string;
    isPrimary?: boolean;
  }
) {
  const organization = await db.partnerOrganization.findFirst({
    where: { id: input.organizationId, propertyId: context.propertyId },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!input.fullName.trim()) {
    throw new Error("Contact name is required");
  }

  if (input.isPrimary) {
    await db.partnerContact.updateMany({
      where: { organizationId: input.organizationId },
      data: { isPrimary: false },
    });
  }

  return db.partnerContact.create({
    data: {
      organizationId: input.organizationId,
      fullName: input.fullName.trim(),
      roleTitle: input.roleTitle?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      preferredChannel: input.preferredChannel ?? null,
      notes: input.notes?.trim() || null,
      isPrimary: Boolean(input.isPrimary),
    },
  });
}

export async function logOutreachTouch(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    contactId?: string;
    channel: OutreachChannel;
    happenedAt?: string;
    subject?: string;
    summary: string;
    outcome?: string;
    nextStep?: string;
  }
) {
  if (!input.summary.trim()) {
    throw new Error("Outreach summary is required");
  }

  const organization = await db.partnerOrganization.findFirst({
    where: { id: input.organizationId, propertyId: context.propertyId },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Organization not found");
  }

  const happenedAt = input.happenedAt ? new Date(input.happenedAt) : new Date();

  return db.$transaction(async (tx) => {
    const touch = await tx.outreachTouch.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId || null,
        channel: input.channel,
        happenedAt,
        subject: input.subject?.trim() || null,
        summary: input.summary.trim(),
        outcome: input.outcome?.trim() || null,
        nextStep: input.nextStep?.trim() || null,
        createdByUserId: context.userId,
        createdByUserName: context.userName,
      },
    });

    await tx.partnerOrganization.update({
      where: { id: input.organizationId },
      data: {
        lastContactedAt: happenedAt,
        status: "contacted",
      },
    });

    if (input.contactId) {
      await tx.partnerContact.update({
        where: { id: input.contactId },
        data: {
          lastContactedAt: happenedAt,
        },
      });
    }

    return touch;
  });
}

export async function scheduleFollowUpTask(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    contactId?: string;
    title: string;
    description?: string;
    dueAt: string;
    assignedToUserId?: string;
    assignedToUserName?: string;
  }
) {
  if (!input.title.trim()) {
    throw new Error("Task title is required");
  }

  const organization = await db.partnerOrganization.findFirst({
    where: { id: input.organizationId, propertyId: context.propertyId },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Organization not found");
  }

  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    throw new Error("A valid due date is required");
  }

  return db.$transaction(async (tx) => {
    const task = await tx.followUpTask.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueAt,
        assignedToUserId: input.assignedToUserId?.trim() || context.userId,
        assignedToUserName: input.assignedToUserName?.trim() || context.userName,
        createdByUserId: context.userId,
        createdByUserName: context.userName,
      },
    });

    await tx.partnerOrganization.update({
      where: { id: input.organizationId },
      data: {
        nextActionAt: dueAt,
      },
    });

    return task;
  });
}

export async function updateOrganizationStatus(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    status: RelationshipStatus;
    visitStatus: VisitStatus;
    visitNotes?: string;
  }
) {
  const organization = await db.partnerOrganization.findFirst({
    where: { id: input.organizationId, propertyId: context.propertyId },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Organization not found");
  }

  return db.partnerOrganization.update({
    where: { id: input.organizationId },
    data: {
      status: input.status,
      visitStatus: input.visitStatus,
      visitNotes: input.visitNotes?.trim() || null,
      lastVisitedAt: input.visitStatus === "visited" ? new Date() : null,
    },
  });
}

export async function updateOrganizationProfile(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    source?: string;
    marketNotes?: string;
    nextActionAt?: string;
    ownerUserId?: string;
    ownerUserName?: string;
    priority?: number;
  }
) {
  const organization = await db.partnerOrganization.findFirst({
    where: { id: input.organizationId, propertyId: context.propertyId },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Organization not found");
  }

  const nextActionAt = input.nextActionAt?.trim() ? new Date(input.nextActionAt) : null;
  if (input.nextActionAt?.trim() && (!nextActionAt || Number.isNaN(nextActionAt.getTime()))) {
    throw new Error("A valid next action date is required");
  }

  return db.partnerOrganization.update({
    where: { id: input.organizationId },
    data: {
      source: input.source?.trim() || null,
      marketNotes: input.marketNotes?.trim() || null,
      nextActionAt,
      ownerUserId: input.ownerUserId?.trim() || null,
      ownerUserName: input.ownerUserName?.trim() || null,
      priority: typeof input.priority === "number" && Number.isFinite(input.priority) ? input.priority : 0,
    },
  });
}

export async function assignOrganizationOwnerToSelf(
  context: PartnersRequestContext,
  organizationId: string
) {
  return updateOrganizationProfile(context, {
    organizationId,
    ownerUserId: context.userId,
    ownerUserName: context.userName,
  });
}

export async function bulkUpdateOrganizations(
  context: PartnersRequestContext,
  input: {
    organizationIds: string[];
    action: "mark_contacted" | "mark_awaiting_reply" | "assign_to_me";
  }
) {
  const organizationIds = Array.from(new Set(input.organizationIds.filter(Boolean)));
  if (organizationIds.length === 0) {
    throw new Error("Select at least one organization");
  }

  const organizations = await db.partnerOrganization.findMany({
    where: {
      id: { in: organizationIds },
      propertyId: context.propertyId,
    },
    select: { id: true },
  });

  if (organizations.length !== organizationIds.length) {
    throw new Error("One or more organizations could not be found");
  }

  if (input.action === "assign_to_me") {
    return db.partnerOrganization.updateMany({
      where: { id: { in: organizationIds } },
      data: {
        ownerUserId: context.userId,
        ownerUserName: context.userName,
      },
    });
  }

  const status: RelationshipStatus = input.action === "mark_awaiting_reply" ? "awaiting_reply" : "contacted";
  const lastContactedAt = input.action === "mark_contacted" ? new Date() : undefined;

  return db.partnerOrganization.updateMany({
    where: { id: { in: organizationIds } },
    data: {
      status,
      lastContactedAt,
    },
  });
}

export async function bulkScheduleFollowUpTasks(
  context: PartnersRequestContext,
  input: {
    organizationIds: string[];
    title: string;
    description?: string;
    dueAt: string;
  }
) {
  const organizationIds = Array.from(new Set(input.organizationIds.filter(Boolean)));
  if (organizationIds.length === 0) {
    throw new Error("Select at least one organization");
  }
  if (!input.title.trim()) {
    throw new Error("Follow-up title is required");
  }

  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    throw new Error("A valid due date is required");
  }

  const organizations = await db.partnerOrganization.findMany({
    where: {
      id: { in: organizationIds },
      propertyId: context.propertyId,
    },
    select: { id: true },
  });

  if (organizations.length !== organizationIds.length) {
    throw new Error("One or more organizations could not be found");
  }

  await db.$transaction(async (tx) => {
    await tx.followUpTask.createMany({
      data: organizationIds.map((organizationId) => ({
        organizationId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueAt,
        assignedToUserId: context.userId,
        assignedToUserName: context.userName,
        createdByUserId: context.userId,
        createdByUserName: context.userName,
      })),
    });

    await tx.partnerOrganization.updateMany({
      where: { id: { in: organizationIds } },
      data: { nextActionAt: dueAt },
    });
  });
}

export async function completeFollowUpTask(context: PartnersRequestContext, taskId: string) {
  const task = await db.followUpTask.findFirst({
    where: {
      id: taskId,
      organization: { propertyId: context.propertyId },
    },
    select: { id: true },
  });
  if (!task) {
    throw new Error("Task not found");
  }

  return db.followUpTask.update({
    where: { id: taskId },
    data: {
      status: "done",
      completedAt: new Date(),
    },
  });
}

export async function updateFollowUpAssignee(
  context: PartnersRequestContext,
  input: { taskId: string; assignedToUserId?: string; assignedToUserName?: string }
) {
  const task = await db.followUpTask.findFirst({
    where: {
      id: input.taskId,
      organization: { propertyId: context.propertyId },
    },
    select: { id: true },
  });
  if (!task) {
    throw new Error("Task not found");
  }

  return db.followUpTask.update({
    where: { id: input.taskId },
    data: {
      assignedToUserId: input.assignedToUserId?.trim() || null,
      assignedToUserName: input.assignedToUserName?.trim() || null,
    },
  });
}

export async function reopenFollowUpTask(context: PartnersRequestContext, taskId: string) {
  const task = await db.followUpTask.findFirst({
    where: {
      id: taskId,
      organization: { propertyId: context.propertyId },
    },
    select: { id: true },
  });
  if (!task) {
    throw new Error("Task not found");
  }

  return db.followUpTask.update({
    where: { id: taskId },
    data: {
      status: "open",
      completedAt: null,
    },
  });
}

export function draftIntroEmail(organization: { name: string; country: string | null }) {
  const market = organization.country ? ` from ${organization.country}` : "";

  return {
    subject: "Introducing Owl's Watch for your travelers",
    body: `Hello ${organization.name} team,\n\nI’m reaching out from Owl's Watch to introduce our property and explore whether it could be a fit for your travelers${market}.\n\nWe’d love to share more about the experience we offer, answer questions, and explore a visit or follow-up call.\n\nBest,\nOwl's Watch`,
  };
}
