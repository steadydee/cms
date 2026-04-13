import {
  OutreachChannel,
  RelationshipStatus,
  type PartnerType,
  type VisitStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { PartnersRequestContext } from "@/lib/auth";

export type OrganizationFilters = {
  status?: RelationshipStatus | "all";
  visitStatus?: VisitStatus | "all";
  query?: string;
};

export async function getDashboardSummary(propertyId: string) {
  const [
    totalOrganizations,
    notContacted,
    awaitingReply,
    activePartners,
    visitedPartners,
    dueFollowUps,
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
        dueAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
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
    recentlyTouched,
  };
}

export async function listOrganizations(propertyId: string, filters: OrganizationFilters = {}) {
  return db.partnerOrganization.findMany({
    where: {
      propertyId,
      status: filters.status && filters.status !== "all" ? filters.status : undefined,
      visitStatus: filters.visitStatus && filters.visitStatus !== "all" ? filters.visitStatus : undefined,
      OR: filters.query
        ? [
            { name: { contains: filters.query, mode: "insensitive" } },
            { country: { contains: filters.query, mode: "insensitive" } },
            { city: { contains: filters.query, mode: "insensitive" } },
            { email: { contains: filters.query, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      _count: {
        select: {
          contacts: true,
          tasks: true,
          touches: true,
        },
      },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getOrganizationDetail(id: string, propertyId: string) {
  return db.partnerOrganization.findFirst({
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
}

export async function listDueFollowUps(propertyId: string) {
  return db.followUpTask.findMany({
    where: {
      organization: { propertyId },
      status: "open",
    },
    include: {
      organization: {
        select: { id: true, name: true, status: true, visitStatus: true },
      },
      contact: {
        select: { id: true, fullName: true },
      },
    },
    orderBy: { dueAt: "asc" },
  });
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

export function draftIntroEmail(organization: { name: string; country: string | null }) {
  const market = organization.country ? ` from ${organization.country}` : "";

  return {
    subject: `Introducing Owl's Watch for your travelers`,
    body: `Hello ${organization.name} team,\n\nI’m reaching out from Owl's Watch to introduce our property and explore whether it could be a fit for your travelers${market}.\n\nWe’d love to share more about the experience we offer, answer questions, and explore a visit or follow-up call.\n\nBest,\nOwl's Watch`,
  };
}
