import "server-only";
import { Prisma } from "@prisma/client";
import type { PartnersRequestContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailAddress } from "@/lib/email-delivery";
import { getEmailRuntimeLabel } from "@/lib/email-safety";
import { assertPolicyIdentity, assertApprovedContent, assertOutreachEvidence, outreachSnapshot,
  outreachSearchQueries, outreachDay, SYNC_MAX_AGE_MS } from "@/lib/daily-outreach";

export async function getDailyOutreachStatus(context: PartnersRequestContext) {
  const policy = await db.dailyOutreachPolicy.findUnique({ where: { propertyId: context.propertyId } });
  const day = outreachDay();
  const attempts = await db.emailSendAttempt.findMany({ where: { propertyId: context.propertyId,
    reviewOnly: false, createdAt: { gte: day.start, lt: day.end } },
    select: { id: true, state: true, createdAt: true, simulated: true, dailyOutreachKey: true } });
  return { policy, date: day.date, inSendWindow: day.inWindow, attempts,
    mailbox: await db.mailboxConnection.findUnique({ where: { propertyId: context.propertyId },
      select: { emailAddress: true, lastSyncedAt: true, lastSyncError: true } }) };
}

export async function saveDailyOutreachPolicy(context: PartnersRequestContext, input: {
  enabled: boolean; agentId: string; credentialId: string; templateId: string;
  attachmentSha256: string; attachmentName: string; businessMailbox: string; personalMailbox: string;
  startsAt: string; expiresAt: string;
}) {
  if (context.source === "agent" || context.role !== "admin") throw new Error("Only a human administrator may approve or change outreach policy.");
  const startsAt = new Date(input.startsAt), expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= startsAt
    || expiresAt.getTime() - Date.now() > 90 * 86400000 || expiresAt <= new Date()) throw new Error("Choose a valid policy expiry within 90 days.");
  if (!input.agentId.trim() || !input.credentialId.trim() || !/^[a-f0-9]{64}$/.test(input.attachmentSha256)
    || !input.attachmentName.endsWith(".pdf")) throw new Error("Worker, credential and approved PDF checksum are required.");
  const template = await db.emailTemplate.findFirst({ where: { id: input.templateId, propertyId: context.propertyId } });
  if (!template || !template.body.includes("{name}")) throw new Error("Choose an approved template containing {name}.");
  const businessMailbox = emailAddress(input.businessMailbox), personalMailbox = emailAddress(input.personalMailbox);
  if (businessMailbox === personalMailbox) throw new Error("Two distinct Gmail accounts are required.");
  if (getEmailRuntimeLabel() === "test" && ![businessMailbox, personalMailbox].every(email => email.endsWith(".invalid"))) {
    throw new Error("Test policy must use synthetic .invalid mailboxes.");
  }
  const data = { enabled: input.enabled, agentId: input.agentId.trim(), credentialId: input.credentialId.trim(),
    templateId: template.id, templateSubject: template.subject, templateBody: template.body,
    attachmentSha256: input.attachmentSha256, attachmentName: input.attachmentName,
    senderEmail: "info@owlswatch.com", businessMailbox, personalMailbox, startsAt, expiresAt,
    approvedById: context.userId, approvedByName: context.userName, approvedAt: new Date() };
  return db.$transaction(async tx => {
    const policy = await tx.dailyOutreachPolicy.upsert({ where: { propertyId: context.propertyId },
      create: { propertyId: context.propertyId, ...data }, update: data });
    await tx.toolActionAudit.create({ data: { toolName: "save_daily_outreach_policy", classification: "restricted",
      actorType: "human", actorId: context.userId, actorLabel: context.userName, propertyId: context.propertyId,
      requestSource: "ui", status: "success", targetEntityType: "daily_outreach_policy", targetEntityId: policy.id,
      outputSummary: JSON.stringify({ approvalMode: "manual", ...data, templateBody: outreachSnapshot(data.templateBody) }) } });
    return policy;
  });
}

export async function pauseDailyOutreachPolicy(context: PartnersRequestContext) {
  if (context.source === "agent" || context.role !== "admin") throw new Error("Only an administrator may change outreach policy.");
  return db.$transaction(async tx => {
    await tx.dailyOutreachPolicy.updateMany({ where: { propertyId: context.propertyId }, data: { enabled: false } });
    await tx.toolActionAudit.create({ data: { toolName: "pause_daily_outreach_policy", classification: "restricted",
      actorType: "human", actorId: context.userId, actorLabel: context.userName, propertyId: context.propertyId,
      requestSource: "ui", status: "success", outputSummary: "Daily outreach paused" } });
  });
}

export async function getDailyOutreachPreflight(context: PartnersRequestContext, draftId: string,
  options: { client?: Prisma.TransactionClient; now?: Date; simulated?: boolean; evidence?: unknown; forSend?: boolean } = {}) {
  const client = options.client ?? db, now = options.now ?? new Date();
  const policy = assertPolicyIdentity(await client.dailyOutreachPolicy.findUnique({ where: { propertyId: context.propertyId } }), context, now);
  const draft = await client.emailDraft.findFirst({ where: { id: draftId, propertyId: context.propertyId }, omit: { attachmentContent: true } });
  if (!draft?.organizationId) throw new Error("An account draft is required.");
  const account = await client.partnerOrganization.findFirst({ where: { id: draft.organizationId, propertyId: context.propertyId },
    include: { contacts: { orderBy: { id: "asc" } }, notes: { orderBy: { id: "asc" } },
      tags: { include: { tag: true }, orderBy: { tagId: "asc" } }, tasks: { orderBy: { id: "asc" } } } });
  if (!account || account.archivedAt || account.type !== "operator") throw new Error("Only active birding-operator accounts are eligible.");
  const contact = account.contacts.find(c => c.id === draft.contactId);
  const name = contact?.fullName || account.name;
  const current = await client.emailTemplate.findFirst({ where: { id: policy.templateId, propertyId: context.propertyId } });
  if (!current || current.body !== policy.templateBody || current.subject !== policy.templateSubject) throw new Error("Approved template changed; a human must review and approve it again.");
  assertApprovedContent(policy, draft, name);
  const snapshot = outreachSnapshot({ policy, draft, account });
  const day = outreachDay(now);
  const dailySentQuery = `in:sent from:${policy.senderEmail} after:${Math.floor(day.start.getTime()/1000)} before:${Math.floor(day.end.getTime()/1000)}`;
  const queries = [...outreachSearchQueries(account), dailySentQuery];
  const dailyOutreachKey = `${context.propertyId}:${day.date}`;
  if (options.forSend) {
    if (!day.inWindow) throw new Error("Daily outreach is allowed only on weekdays from 09:00 to 09:29 America/Bogota. No catch-up sends.");
    assertOutreachEvidence(options.evidence, policy, snapshot, queries, now);
    const previous = await client.emailSendAttempt.findFirst({ where: { propertyId: context.propertyId, reviewOnly: false,
      OR: [{ dailyOutreachKey }, { createdAt: { gte: day.start, lt: day.end } },
        { state: { in: ["pending", "uncertain"] } }, { state: "sent", stored: false }] } });
    if (previous) throw new Error("Daily outreach blocked: an attempt already exists today or an earlier delivery needs reconciliation.");
    if (!options.simulated) {
      const connection = await client.mailboxConnection.findUnique({ where: { propertyId: context.propertyId } });
      const age = now.getTime() - (connection?.lastSyncedAt?.getTime() ?? 0);
      if (!connection || connection.emailAddress.toLowerCase() !== policy.businessMailbox || connection.lastSyncError
        || age < 0 || age > SYNC_MAX_AGE_MS) throw new Error("Gmail sync is missing, unhealthy or more than 30 minutes old.");
    }
  }
  return { policy, snapshot, queries, name, dailyOutreachKey, date: day.date,
    dailySentQuery };
}
