import {
  OutreachChannel,
  Prisma,
  ResearchFindingStatus,
  ResearchSourceType,
  RelationshipStatus,
  type PartnerType,
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
  | "unassigned"
  | "archived";

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

export type ResearchFindingFilters = {
  status?: ResearchFindingStatus | "all";
  sourceType?: ResearchSourceType | "all";
  query?: string;
};

export const ORGANIZATION_VIEW_LABELS: Record<SavedOrganizationView, string> = {
  all: "All organizations",
  not_contacted: "Not contacted",
  awaiting_reply: "Awaiting reply",
  visited_not_active: "Visited, not active",
  overdue: "Overdue next steps",
  unassigned: "Unassigned owner",
  archived: "Archived",
};

async function getScopedOrganization(
  propertyId: string,
  organizationId: string,
  select?: Prisma.PartnerOrganizationSelect
) {
  return db.partnerOrganization.findFirst({
    where: { id: organizationId, propertyId },
    select: select ?? { id: true },
  });
}

async function assertContactBelongsToOrganization(organizationId: string, contactId: string) {
  const contact = await db.partnerContact.findFirst({
    where: { id: contactId, organizationId },
    select: { id: true },
  });

  if (!contact) {
    throw new Error("Contact not found for this organization");
  }
}

function getActorType(context: PartnersRequestContext): "human" | "agent" {
  return context.source === "agent" ? "agent" : "human";
}

function normalizeExtractedDataJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function buildOrganizationWhere(propertyId: string, filters: OrganizationFilters): Prisma.PartnerOrganizationWhereInput {
  const now = new Date();
  const view = filters.view ?? "all";

  const andClauses: Prisma.PartnerOrganizationWhereInput[] = [{ propertyId }];

  if (view === "archived") {
    andClauses.push({ archivedAt: { not: null } });
  } else {
    andClauses.push({ archivedAt: null });
  }

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
    case "archived":
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
    researchInboxCount,
    dueFollowUps,
    overdueFollowUps,
    overdueOrganizations,
    unassignedOrganizations,
    recentlyTouched,
  ] = await Promise.all([
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null } }),
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null, status: "not_contacted" } }),
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null, status: "awaiting_reply" } }),
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null, status: "active_partner" } }),
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null, visitStatus: "visited" } }),
    db.researchFinding.count({
      where: {
        propertyId,
        status: { in: ["new", "reviewed"] },
      },
    }),
    db.followUpTask.count({
      where: {
        organization: { propertyId, archivedAt: null },
        status: "open",
        dueAt: { lte: weekFromNow },
      },
    }),
    db.followUpTask.count({
      where: {
        organization: { propertyId, archivedAt: null },
        status: "open",
        dueAt: { lt: now },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        archivedAt: null,
        nextActionAt: { lt: now },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        archivedAt: null,
        OR: [{ ownerUserId: null }, { ownerUserId: "" }, { ownerUserName: null }, { ownerUserName: "" }],
      },
    }),
    db.outreachTouch.findMany({
      where: { organization: { propertyId, archivedAt: null } },
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
    researchInboxCount,
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
    where: { propertyId, archivedAt: null },
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

  const [all, notContacted, awaitingReply, visitedNotActive, overdue, unassigned, archived] = await Promise.all([
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null } }),
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null, status: "not_contacted" } }),
    db.partnerOrganization.count({ where: { propertyId, archivedAt: null, status: "awaiting_reply" } }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        archivedAt: null,
        visitStatus: "visited",
        status: { not: "active_partner" },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        archivedAt: null,
        nextActionAt: { lt: now },
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        archivedAt: null,
        OR: [{ ownerUserId: null }, { ownerUserId: "" }, { ownerUserName: null }, { ownerUserName: "" }],
      },
    }),
    db.partnerOrganization.count({
      where: {
        propertyId,
        archivedAt: { not: null },
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
    archived,
  } satisfies Record<SavedOrganizationView, number>;
}

export async function listResearchFindings(propertyId: string, filters: ResearchFindingFilters = {}) {
  const andClauses: Prisma.ResearchFindingWhereInput[] = [{ propertyId }];

  if (filters.status && filters.status !== "all") {
    andClauses.push({ status: filters.status });
  }

  if (filters.sourceType && filters.sourceType !== "all") {
    andClauses.push({ sourceType: filters.sourceType });
  }

  if (filters.query?.trim()) {
    const query = filters.query.trim();
    andClauses.push({
      OR: [
        { observedName: { contains: query, mode: "insensitive" } },
        { sourceHandle: { contains: query, mode: "insensitive" } },
        { sourceUrl: { contains: query, mode: "insensitive" } },
        { observedText: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  return db.researchFinding.findMany({
    where: { AND: andClauses },
    include: {
      proposedOrganization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
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

export async function createResearchFinding(
  context: PartnersRequestContext,
  input: {
    sourceType?: ResearchSourceType;
    sourceUrl?: string;
    sourceHandle?: string;
    observedName?: string;
    observedText?: string;
    extractedDataJson?: unknown;
    confidence?: number;
    proposedOrganizationId?: string;
  }
) {
  const observedName = input.observedName?.trim() || null;
  const sourceUrl = input.sourceUrl?.trim() || null;
  const sourceHandle = input.sourceHandle?.trim() || null;
  const observedText = input.observedText?.trim() || null;

  if (!observedName && !sourceUrl && !sourceHandle && !observedText && input.extractedDataJson === undefined) {
    throw new Error("A research finding needs a name, source, notes, or extracted data");
  }

  if (input.proposedOrganizationId) {
    const organization = await getScopedOrganization(context.propertyId, input.proposedOrganizationId);
    if (!organization) {
      throw new Error("Proposed organization not found");
    }
  }

  const confidence = typeof input.confidence === "number" && Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(1, input.confidence))
    : null;

  return db.researchFinding.create({
    data: {
      propertyId: context.propertyId,
      sourceType: input.sourceType ?? "manual",
      sourceUrl,
      sourceHandle,
      observedName,
      observedText,
      extractedDataJson: normalizeExtractedDataJson(input.extractedDataJson),
      confidence,
      proposedOrganizationId: input.proposedOrganizationId?.trim() || null,
      createdByActorType: getActorType(context),
      createdByActorId: context.userId,
      createdByActorLabel: context.userName,
    },
  });
}

export async function updateResearchFindingStatus(
  context: PartnersRequestContext,
  input: {
    findingId: string;
    status: ResearchFindingStatus;
  }
) {
  const finding = await db.researchFinding.findFirst({
    where: { id: input.findingId, propertyId: context.propertyId },
    select: { id: true },
  });

  if (!finding) {
    throw new Error("Research finding not found");
  }

  return db.researchFinding.update({
    where: { id: input.findingId },
    data: { status: input.status },
  });
}

export async function promoteResearchFindingToOrganization(
  context: PartnersRequestContext,
  input: {
    findingId: string;
  }
) {
  const finding = await db.researchFinding.findFirst({
    where: { id: input.findingId, propertyId: context.propertyId },
    select: {
      id: true,
      observedName: true,
      sourceUrl: true,
      sourceHandle: true,
      sourceType: true,
      observedText: true,
      extractedDataJson: true,
      proposedOrganizationId: true,
    },
  });

  if (!finding) {
    throw new Error("Research finding not found");
  }

  if (finding.proposedOrganizationId) {
    return db.researchFinding.update({
      where: { id: input.findingId },
      data: { status: "promoted" },
      include: { proposedOrganization: true },
    });
  }

  const extracted = (finding.extractedDataJson ?? {}) as Record<string, unknown>;
  const name = finding.observedName?.trim() || String(extracted.name ?? extracted.organizationName ?? "").trim();
  if (!name) {
    throw new Error("This finding needs an observed name before it can be promoted");
  }

  const organization = await db.partnerOrganization.create({
    data: {
      propertyId: context.propertyId,
      name,
      type: "agency",
      website: finding.sourceUrl || String(extracted.website ?? "").trim() || null,
      email: String(extracted.email ?? "").trim() || null,
      phone: String(extracted.phone ?? "").trim() || null,
      whatsapp: String(extracted.whatsapp ?? extracted.whatsApp ?? "").trim() || null,
      country: String(extracted.country ?? "").trim() || null,
      city: String(extracted.city ?? "").trim() || null,
      source: finding.sourceHandle || finding.sourceType,
      marketNotes: finding.observedText || null,
      ownerUserId: context.userId,
      ownerUserName: context.userName,
      status: "not_contacted",
      visitStatus: "never_invited",
    },
  });

  await db.researchFinding.update({
    where: { id: input.findingId },
    data: {
      status: "promoted",
      proposedOrganizationId: organization.id,
    },
  });

  return organization;
}

export async function listDueFollowUps(propertyId: string, filters: FollowUpFilters = {}) {
  const now = new Date();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const bucket = filters.bucket ?? "all";

  const andClauses: Prisma.FollowUpTaskWhereInput[] = [
    {
      organization: { propertyId, archivedAt: null },
      status: "open",
    },
  ];

  if (bucket === "overdue") {
    andClauses.push({ dueAt: { lt: now } });
  } else if (bucket === "this_week") {
    andClauses.push({ dueAt: { gte: now, lte: weekFromNow } });
  } else if (bucket === "mine") {
    const assignee = filters.assignee?.trim();
    if (!assignee) {
      throw new Error("An assignee is required for the mine follow-up view");
    }
    andClauses.push({ assignedToUserName: assignee });
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
      status: "not_contacted",
      visitStatus: "never_invited",
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
  const organization = await getScopedOrganization(context.propertyId, input.organizationId);
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
    status?: RelationshipStatus;
  }
) {
  if (!input.summary.trim()) {
    throw new Error("Outreach summary is required");
  }

  const organization = await getScopedOrganization(context.propertyId, input.organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  if (input.contactId) {
    await assertContactBelongsToOrganization(input.organizationId, input.contactId);
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
        status: input.status ?? "contacted",
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

  const organization = await getScopedOrganization(context.propertyId, input.organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  if (input.contactId) {
    await assertContactBelongsToOrganization(input.organizationId, input.contactId);
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
  const organization = await getScopedOrganization(context.propertyId, input.organizationId, {
    id: true,
    visitStatus: true,
    lastVisitedAt: true,
  });
  if (!organization) {
    throw new Error("Organization not found");
  }

  const isNewVisit = organization.visitStatus !== "visited" && input.visitStatus === "visited";

  return db.partnerOrganization.update({
    where: { id: input.organizationId },
    data: {
      status: input.status,
      visitStatus: input.visitStatus,
      visitNotes: input.visitNotes?.trim() || null,
      lastVisitedAt: isNewVisit ? new Date() : organization.lastVisitedAt,
    },
  });
}

export async function updateOrganizationProfile(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    country?: string;
    city?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    website?: string;
    source?: string;
    marketNotes?: string;
    nextActionAt?: string;
    ownerUserId?: string;
    ownerUserName?: string;
    priority?: number;
  }
) {
  const organization = await getScopedOrganization(context.propertyId, input.organizationId);
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
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      website: input.website?.trim() || null,
      source: input.source?.trim() || null,
      marketNotes: input.marketNotes?.trim() || null,
      nextActionAt,
      ownerUserId: input.ownerUserId?.trim() || null,
      ownerUserName: input.ownerUserName?.trim() || null,
      priority: typeof input.priority === "number" && Number.isFinite(input.priority) ? input.priority : 0,
    },
  });
}

export async function archiveOrganization(
  context: PartnersRequestContext,
  organizationId: string
) {
  const organization = await getScopedOrganization(context.propertyId, organizationId, {
    id: true,
    archivedAt: true,
  });
  if (!organization) {
    throw new Error("Organization not found");
  }
  if (organization.archivedAt) {
    return organization;
  }

  return db.partnerOrganization.update({
    where: { id: organizationId },
    data: {
      archivedAt: new Date(),
    },
  });
}

export async function unarchiveOrganization(
  context: PartnersRequestContext,
  organizationId: string
) {
  const organization = await getScopedOrganization(context.propertyId, organizationId, {
    id: true,
    archivedAt: true,
  });
  if (!organization) {
    throw new Error("Organization not found");
  }
  if (!organization.archivedAt) {
    return organization;
  }

  return db.partnerOrganization.update({
    where: { id: organizationId },
    data: {
      archivedAt: null,
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
