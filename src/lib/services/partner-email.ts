import "server-only";

import { Prisma, RelationshipStatus } from "@prisma/client";
import type { PartnersRequestContext } from "@/lib/auth";
import {
  addLabelToGmailMessage,
  buildRawGmailMessage,
  decryptRefreshToken,
  encryptRefreshToken,
  ensureGmailLabel,
  exchangeGmailCode,
  extractGmailParticipants,
  getGmailHeader,
  getGmailMessage,
  getGmailProfile,
  getGmailThread,
  GMAIL_SYNC_LABEL,
  isGmailConfigured,
  parseGmailMessageBody,
  refreshGmailAccessToken,
  sendGmailRawMessage,
  listRecentGmailMessages,
  listGmailHistory,
  searchGmailMessages,
  type GmailMessage,
} from "@/lib/gmail";
import { buildTrackedGmailThreadImports, type TrackedGmailThreadTarget } from "@/lib/gmail-sync";
import { isMissingGmailResource, readGmailSyncItem } from "@/lib/gmail-errors";
import { db } from "@/lib/db";
import { assertLiveEmailSendsAllowed, getEmailRuntimeLabel } from "@/lib/email-safety";
import { normalizeEmailTemplateBody } from "@/lib/email-template-utils";
import { attachmentFields, assertNeverContacted, deliverEmailOnce, deliveryAttemptIds, emailAddress, emailPayloadHash, priorContactQuery, type EmailAttachment } from "@/lib/email-delivery";

const GMAIL_SYNC_ACTOR_ID = "gmail-sync";
const GMAIL_SYNC_ACTOR_NAME = "Gmail sync";
const DEFAULT_TRACKED_THREAD_SYNC_LIMIT = 200;

export type MailboxFromOption = {
  email: string;
  label: string;
  name: string | null;
  source: "mailbox" | "alias";
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function toDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || email;
  const words = localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  return words
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ") || email;
}

function parseEmailIdentity(value: string): { email: string; name: string | null } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const bracketMatch = trimmed.match(/^(.*?)<([^<>]+)>$/);
  if (bracketMatch) {
    const email = normalizeEmail(bracketMatch[2] || "");
    const name = (bracketMatch[1] || "").replace(/^"|"$/g, "").trim() || null;
    if (email.includes("@")) return { email, name };
    return null;
  }

  const email = normalizeEmail(trimmed);
  if (!email.includes("@")) return null;
  return { email, name: toDisplayNameFromEmail(email) };
}

function formatIdentityLabel(identity: { email: string; name: string | null }, suffix: string) {
  const base = identity.name ? `${identity.name} <${identity.email}>` : identity.email;
  return `${base} · ${suffix}`;
}

function getConfiguredAliasEntries() {
  const configured = process.env.OW_PARTNERS_EMAIL_FROM_ALIASES?.trim()
    || process.env.OW_PARTNERS_GMAIL_FROM_ALIASES?.trim()
    || "";

  return configured
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getTrackedThreadSyncLimit() {
  const configured = Number(process.env.OW_PARTNERS_GMAIL_SYNC_THREAD_LIMIT || "");
  if (Number.isInteger(configured) && configured > 0) {
    return Math.min(configured, 1000);
  }
  return DEFAULT_TRACKED_THREAD_SYNC_LIMIT;
}

export function getMailboxFromOptions(connectedEmail: string | null | undefined): MailboxFromOption[] {
  const options: MailboxFromOption[] = [];
  const seen = new Set<string>();

  const addOption = (option: MailboxFromOption | null) => {
    if (!option) return;
    const key = normalizeEmail(option.email);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };

  const mailboxIdentity = connectedEmail ? parseEmailIdentity(connectedEmail) : null;
  if (mailboxIdentity) {
    addOption({
      email: mailboxIdentity.email,
      name: mailboxIdentity.name,
      label: formatIdentityLabel(mailboxIdentity, "connected mailbox"),
      source: "mailbox",
    });
  }

  for (const entry of getConfiguredAliasEntries()) {
    const identity = parseEmailIdentity(entry);
    if (!identity) continue;
    addOption({
      email: identity.email,
      name: identity.name,
      label: formatIdentityLabel(identity, "alias"),
      source: "alias",
    });
  }

  return options;
}

function resolveMailboxFromOption(connectedEmail: string, requestedEmail?: string): MailboxFromOption {
  const options = getMailboxFromOptions(connectedEmail);
  const fallback = options[0];
  if (!fallback) {
    throw new Error("Connected mailbox is missing a sender address.");
  }

  const requested = normalizeEmail(requestedEmail || "");
  if (!requested) return fallback;

  const option = options.find((entry) => normalizeEmail(entry.email) === requested);
  if (!option) {
    throw new Error("Choose a configured sender alias.");
  }

  return option;
}

function isOwnMailboxIdentity(fromEmail: string | null, ownEmails: string[]) {
  if (!fromEmail) return false;
  const normalized = normalizeEmail(fromEmail);
  return ownEmails.some((email) => normalizeEmail(email) === normalized);
}

function hasEmailStatusPriority(status: RelationshipStatus) {
  return status === "active_partner"
    || status === "proposal_sent"
    || status === "visit_scheduled"
    || status === "visited";
}

function getReplyStatus(currentStatus: RelationshipStatus, direction: "inbound" | "outbound") {
  if (hasEmailStatusPriority(currentStatus)) {
    return currentStatus;
  }

  if (direction === "inbound") return "engaged";

  return currentStatus === "not_contacted"
    || currentStatus === "contacted"
    || currentStatus === "awaiting_reply"
    ? "awaiting_reply"
    : currentStatus;
}

function maxDate(current: Date | null | undefined, candidate: Date) {
  if (!current) return candidate;
  return current > candidate ? current : candidate;
}

async function getScopedOrganization(propertyId: string, organizationId: string) {
  return db.partnerOrganization.findFirst({
    where: {
      id: organizationId,
      propertyId,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  });
}

async function assertContactBelongsToOrganization(organizationId: string, contactId: string) {
  const contact = await db.partnerContact.findFirst({
    where: {
      id: contactId,
      organizationId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  if (!contact) {
    throw new Error("Contact not found for account");
  }

  return contact;
}

async function assertThreadBelongsToOrganization(organizationId: string, threadId: string) {
  const thread = await db.emailThread.findFirst({
    where: {
      id: threadId,
      organizationId,
    },
    select: {
      id: true,
      providerThreadId: true,
      subject: true,
    },
  });

  if (!thread) {
    throw new Error("Thread not found for account.");
  }

  return thread;
}

async function getMailboxConnection(propertyId: string) {
  return db.mailboxConnection.findUnique({
    where: { propertyId },
  });
}

async function getMailboxAuthorization(propertyId: string) {
  const connection = await getMailboxConnection(propertyId);
  if (!connection) {
    throw new Error("Connect Gmail before sending or syncing email.");
  }

  const refreshToken = decryptRefreshToken(connection.refreshTokenEncrypted);
  const token = await refreshGmailAccessToken(refreshToken);

  return {
    connection,
    accessToken: token.access_token,
  };
}

function summarizeOutboundMessage(message: GmailMessage, recipientEmail: string | null) {
  const subject = getGmailHeader(message, "subject");
  if (recipientEmail && subject) {
    return `Sent "${subject}" to ${recipientEmail}.`;
  }
  if (recipientEmail) {
    return `Sent email to ${recipientEmail}.`;
  }
  return "Sent email from connected Gmail inbox.";
}

function summarizeInboundMessage(message: GmailMessage, senderEmail: string | null) {
  const subject = getGmailHeader(message, "subject");
  if (senderEmail && subject) {
    return `Received "${subject}" from ${senderEmail}.`;
  }
  if (senderEmail) {
    return `Received email from ${senderEmail}.`;
  }
  return "Received email reply.";
}

type MatchResult = {
  organizationId: string;
  contactId?: string | null;
  source: "thread_id" | "participant_email" | "manual";
};

async function findParticipantMatch(propertyId: string, participantEmails: string[]): Promise<MatchResult | null> {
  const normalizedEmails = Array.from(
    new Set(participantEmails.map(normalizeEmail).filter(Boolean))
  );
  if (normalizedEmails.length === 0) return null;

  const contactMatch = await db.partnerContact.findFirst({
    where: {
      organization: {
        propertyId,
        archivedAt: null,
      },
      OR: normalizedEmails.map((email) => ({
        email: {
          equals: email,
          mode: "insensitive",
        },
      })),
    },
    orderBy: [
      { isPrimary: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (contactMatch) {
    return {
      organizationId: contactMatch.organizationId,
      contactId: contactMatch.id,
      source: "participant_email",
    };
  }

  const organizationMatch = await db.partnerOrganization.findFirst({
    where: {
      propertyId,
      archivedAt: null,
      OR: normalizedEmails.map((email) => ({
        email: {
          equals: email,
          mode: "insensitive",
        },
      })),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
    },
  });

  if (!organizationMatch) return null;

  return {
    organizationId: organizationMatch.id,
    contactId: null,
    source: "participant_email",
  };
}

async function resolveMessageMatch(input: {
  propertyId: string;
  mailboxConnectionId: string;
  providerThreadId: string;
  participantEmails: string[];
  forcedMatch?: { organizationId: string; contactId?: string | null } | null;
}): Promise<MatchResult | null> {
  if (input.forcedMatch) {
    return {
      organizationId: input.forcedMatch.organizationId,
      contactId: input.forcedMatch.contactId ?? null,
      source: "manual",
    };
  }

  const existingThread = await db.emailThread.findUnique({
    where: {
      mailboxConnectionId_providerThreadId: {
        mailboxConnectionId: input.mailboxConnectionId,
        providerThreadId: input.providerThreadId,
      },
    },
    select: {
      organizationId: true,
      contactId: true,
    },
  });

  if (existingThread) {
    return {
      organizationId: existingThread.organizationId,
      contactId: existingThread.contactId,
      source: "thread_id",
    };
  }

  return findParticipantMatch(input.propertyId, input.participantEmails);
}

async function createEmailTouch(tx: Prisma.TransactionClient, input: {
  organizationId: string;
  contactId?: string | null;
  direction: "inbound" | "outbound";
  subject?: string | null;
  summary: string;
  happenedAt: Date;
  createdByUserId: string;
  createdByUserName: string;
}) {
  return tx.outreachTouch.create({
    data: {
      organizationId: input.organizationId,
      contactId: input.contactId ?? null,
      channel: "email",
      direction: input.direction,
      happenedAt: input.happenedAt,
      subject: input.subject?.trim() || null,
      summary: input.summary.trim(),
      outcome: input.direction === "outbound" ? "Awaiting reply" : "Replied",
      nextStep: input.direction === "outbound" ? "Review reply or follow up." : "Reply or schedule next action.",
      createdByUserId: input.createdByUserId,
      createdByUserName: input.createdByUserName,
    },
  });
}

async function storeGmailMessage(input: {
  propertyId: string;
  mailboxConnectionId: string;
  mailboxEmail: string;
  outboundIdentityEmails?: string[];
  gmailMessage: GmailMessage;
  forcedMatch?: { organizationId: string; contactId?: string | null } | null;
  actorUserId: string;
  actorUserName: string;
}) {
  // Review messages and replies must never affect an operator, even during later syncs.
  const reviewAttempt = await db.emailSendAttempt.findFirst({
    where: {
      propertyId: input.propertyId, reviewOnly: true, simulated: false,
      OR: [
        { providerMessageId: input.gmailMessage.id },
        { providerThreadId: input.gmailMessage.threadId },
        { id: { in: deliveryAttemptIds(["message-id", "in-reply-to", "references"].map((header) => getGmailHeader(input.gmailMessage, header))) } },
      ],
    },
    select: { id: true },
  });
  if (reviewAttempt) return { imported: false, reason: "review" as const };

  const existingMessage = await db.emailMessage.findUnique({
    where: {
      mailboxConnectionId_providerMessageId: {
        mailboxConnectionId: input.mailboxConnectionId,
        providerMessageId: input.gmailMessage.id,
      },
    },
    select: { id: true },
  });

  if (existingMessage) {
    return {
      imported: false,
      reason: "existing" as const,
    };
  }

  const participants = extractGmailParticipants(input.gmailMessage);
  const match = await resolveMessageMatch({
    propertyId: input.propertyId,
    mailboxConnectionId: input.mailboxConnectionId,
    providerThreadId: input.gmailMessage.threadId,
    participantEmails: participants.allEmails,
    forcedMatch: input.forcedMatch,
  });

  if (!match) {
    return {
      imported: false,
      reason: "unmatched" as const,
    };
  }

  const body = parseGmailMessageBody(input.gmailMessage);
  const subject = getGmailHeader(input.gmailMessage, "subject");
  const internalDate = input.gmailMessage.internalDate ? Number(input.gmailMessage.internalDate) : Date.now();
  const sentAt = Number.isFinite(internalDate) ? new Date(internalDate) : new Date();
  const mailboxEmail = normalizeEmail(input.mailboxEmail);
  const outboundIdentityEmails = Array.from(new Set([
    mailboxEmail,
    ...getMailboxFromOptions(input.mailboxEmail).map((option) => option.email),
    ...(input.outboundIdentityEmails ?? []),
  ]));
  const fromEmail = participants.from[0]?.email || null;
  const recipientEmail = participants.to[0]?.email || null;
  const direction = isOwnMailboxIdentity(fromEmail, outboundIdentityEmails) ? "outbound" : "inbound";
  const summary = direction === "outbound"
    ? summarizeOutboundMessage(input.gmailMessage, recipientEmail)
    : summarizeInboundMessage(input.gmailMessage, fromEmail);

  const result = await db.$transaction(async (tx) => {
    const organization = await tx.partnerOrganization.findUnique({
      where: { id: match.organizationId },
      select: {
        id: true,
        status: true,
        lastContactedAt: true,
      },
    });

    if (!organization) {
      throw new Error("Matched account no longer exists");
    }

    const existingThread = await tx.emailThread.findUnique({
      where: {
        mailboxConnectionId_providerThreadId: {
          mailboxConnectionId: input.mailboxConnectionId,
          providerThreadId: input.gmailMessage.threadId,
        },
      },
      select: {
        id: true,
        participantEmails: true,
        contactId: true,
        lastMessageAt: true,
        lastInboundAt: true,
        lastOutboundAt: true,
      },
    });

    const participantEmails = Array.from(
      new Set([
        ...(Array.isArray(existingThread?.participantEmails) ? existingThread.participantEmails : []),
        ...participants.allEmails,
      ])
    );

    const thread = existingThread
      ? await tx.emailThread.update({
          where: { id: existingThread.id },
          data: {
            organizationId: match.organizationId,
            contactId: match.contactId ?? existingThread.contactId ?? null,
            subject: subject?.trim() || undefined,
            snippet: input.gmailMessage.snippet?.trim() || undefined,
            participantEmails,
            lastMessageAt: maxDate(existingThread.lastMessageAt, sentAt),
            lastInboundAt: direction === "inbound" ? maxDate(existingThread.lastInboundAt, sentAt) : existingThread.lastInboundAt,
            lastOutboundAt: direction === "outbound" ? maxDate(existingThread.lastOutboundAt, sentAt) : existingThread.lastOutboundAt,
          },
        })
      : await tx.emailThread.create({
          data: {
            mailboxConnectionId: input.mailboxConnectionId,
            organizationId: match.organizationId,
            contactId: match.contactId ?? null,
            providerThreadId: input.gmailMessage.threadId,
            subject: subject?.trim() || null,
            snippet: input.gmailMessage.snippet?.trim() || null,
            participantEmails,
            lastMessageAt: sentAt,
            lastInboundAt: direction === "inbound" ? sentAt : null,
            lastOutboundAt: direction === "outbound" ? sentAt : null,
          },
        });

    const message = await tx.emailMessage.create({
      data: {
        mailboxConnectionId: input.mailboxConnectionId,
        emailThreadId: thread.id,
        organizationId: match.organizationId,
        contactId: match.contactId ?? null,
        providerMessageId: input.gmailMessage.id,
        internetMessageId: getGmailHeader(input.gmailMessage, "message-id"),
        direction,
        subject: subject?.trim() || null,
        snippet: input.gmailMessage.snippet?.trim() || null,
        bodyText: body.text || input.gmailMessage.snippet?.trim() || "(No body)",
        bodyHtml: body.html,
        fromEmail,
        fromName: participants.from[0]?.name || null,
        toEmails: participants.to.map((entry) => entry.email),
        ccEmails: participants.cc.map((entry) => entry.email),
        sentAt,
        syncedAt: new Date(),
        matchSource: match.source,
      },
    });

    await createEmailTouch(tx, {
      organizationId: match.organizationId,
      contactId: match.contactId ?? null,
      direction,
      subject,
      summary,
      happenedAt: sentAt,
      createdByUserId: input.actorUserId,
      createdByUserName: input.actorUserName,
    });

    await tx.partnerOrganization.update({
      where: { id: match.organizationId },
      data: {
        lastContactedAt: maxDate(organization.lastContactedAt, sentAt),
        status: getReplyStatus(organization.status, direction),
      },
    });

    if (match.contactId) {
      await tx.partnerContact.updateMany({
        where: {
          id: match.contactId,
          OR: [
            { lastContactedAt: null },
            { lastContactedAt: { lt: sentAt } },
          ],
        },
        data: {
          lastContactedAt: sentAt,
        },
      });
    }

    return { threadId: thread.id, messageId: message.id };
  });

  return {
    imported: true,
    reason: "stored" as const,
    ...result,
  };
}

export async function getMailboxStatus(propertyId: string) {
  const connection = await getMailboxConnection(propertyId);
  const fromOptions = getMailboxFromOptions(connection?.emailAddress ?? null);

  return {
    configured: isGmailConfigured(),
    connected: Boolean(connection),
    connectedEmail: connection?.emailAddress ?? null,
    fromOptions,
    labelName: connection?.labelName ?? null,
    lastSyncedAt: connection?.lastSyncedAt ?? null,
    lastSyncError: connection?.lastSyncError ?? null,
  };
}

export async function listOrganizationEmailDrafts(organizationId: string, propertyId: string) {
  const organization = await getScopedOrganization(propertyId, organizationId);
  if (!organization) {
    throw new Error("Account not found.");
  }

  return db.emailDraft.findMany({
    omit: { attachmentContent: true },
    where: {
      organizationId,
      propertyId,
    },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      emailThread: {
        select: {
          id: true,
          subject: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function saveEmailDraft(
  context: PartnersRequestContext,
  input: {
    draftId?: string;
    organizationId?: string;
    reviewOnly?: boolean;
    firstOutreach?: boolean;
    attachment?: EmailAttachment | null;
    contactId?: string;
    threadId?: string;
    fromEmail?: string;
    toEmail?: string;
    subject?: string;
    body: string;
  }
) {
  const organizationId = input.organizationId?.trim() || "";
  const reviewOnly = input.reviewOnly === true;
  if (reviewOnly && (context.source === "agent" || context.role !== "admin")) throw new Error("Only an administrator may prepare a review-only email.");
  const attachmentData = attachmentFields(input.attachment);
  const draftId = input.draftId?.trim() || "";
  const contactId = input.contactId?.trim() || "";
  const threadId = input.threadId?.trim() || "";
  const fromEmail = input.fromEmail?.trim() || null;
  const toEmail = reviewOnly ? reviewEmailAddress() : input.toEmail?.trim() || null;
  const subject = input.subject?.trim() || null;
  const bodyText = normalizeEmailTemplateBody(input.body);

  if (!organizationId && !reviewOnly) {
    throw new Error("Account is required.");
  }

  if (!toEmail && !subject && !bodyText.trim()) {
    throw new Error("Add a recipient, subject, or body before saving a draft.");
  }

  const organization = organizationId ? await getScopedOrganization(context.propertyId, organizationId) : null;
  if ((!organization && !reviewOnly) || (reviewOnly && organizationId)) {
    throw new Error("Account not found.");
  }

  const contact = contactId ? await assertContactBelongsToOrganization(organizationId, contactId) : null;
  const thread = threadId ? await assertThreadBelongsToOrganization(organizationId, threadId) : null;

  if (draftId) {
    const existing = await db.emailDraft.findFirst({
      where: {
        id: draftId,
        propertyId: context.propertyId,
        organizationId: organizationId || null,
        reviewOnly,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Draft not found for account.");
    }

    return db.emailDraft.update({
      omit: { attachmentContent: true },
      where: { id: draftId },
      data: {
        contactId: contact?.id ?? null,
        emailThreadId: thread?.id ?? null,
        fromEmail,
        toEmail,
        subject,
        bodyText,
        firstOutreach: input.firstOutreach,
        ...attachmentData,
        createdByUserId: context.userId,
        createdByUserName: context.userName,
      },
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        emailThread: {
          select: {
            id: true,
            subject: true,
          },
        },
      },
    });
  }

  return db.emailDraft.create({
    omit: { attachmentContent: true },
    data: {
      propertyId: context.propertyId,
      organizationId: organizationId || null,
      reviewOnly,
      firstOutreach: input.firstOutreach ?? false,
      ...attachmentData,
      contactId: contact?.id ?? null,
      emailThreadId: thread?.id ?? null,
      fromEmail,
      toEmail,
      subject,
      bodyText,
      createdByUserId: context.userId,
      createdByUserName: context.userName,
    },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      emailThread: {
        select: {
          id: true,
          subject: true,
        },
      },
    },
  });
}

export async function deleteEmailDraft(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    draftId: string;
  }
) {
  const organizationId = input.organizationId.trim();
  const draftId = input.draftId.trim();

  if (!organizationId || !draftId) {
    throw new Error("Draft is required.");
  }

  const existing = await db.emailDraft.findFirst({
    where: {
      id: draftId,
      organization: {
        id: organizationId,
        propertyId: context.propertyId,
        archivedAt: null,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Draft not found for account.");
  }

  return db.emailDraft.delete({
    omit: { attachmentContent: true },
    where: { id: draftId },
  });
}

function reviewEmailAddress() {
  const configured = process.env.OW_PARTNERS_REVIEW_EMAIL?.trim();
  if (!configured) throw new Error("The administrator review email has not been configured.");
  return emailAddress(configured);
}

export async function getEmailDraft(propertyId: string, draftId: string) {
  const draft = await db.emailDraft.findFirst({ where: { id: draftId, propertyId }, omit: { attachmentContent: true } });
  if (!draft) throw new Error("Draft not found.");
  return draft;
}

export async function sendSavedEmailDraft(context: PartnersRequestContext, input: { draftId: string; requestId: string; simulation?: EmailSimulation }) {
  const draft = await getEmailDraft(context.propertyId, input.draftId);
  return sendAccountEmail(context, {
    organizationId: draft.organizationId || undefined,
    draftId: draft.id,
    requestId: input.requestId,
    fromEmail: draft.fromEmail || undefined,
    toEmail: draft.toEmail || "",
    subject: draft.subject || "",
    body: draft.bodyText,
    contactId: draft.contactId || undefined,
    threadId: draft.emailThreadId || undefined,
    firstOutreach: draft.firstOutreach,
    simulation: input.simulation,
  });
}

export async function connectPropertyMailbox(input: {
  propertyId: string;
  origin: string;
  code: string;
}) {
  const existingConnection = await getMailboxConnection(input.propertyId);
  const token = await exchangeGmailCode({
    origin: input.origin,
    code: input.code,
  });

  const refreshToken = token.refresh_token?.trim() || null;
  if (!refreshToken && !existingConnection) {
    throw new Error("Google did not return a refresh token. Reconnect with consent enabled.");
  }

  const profile = await getGmailProfile(token.access_token);
  const label = await ensureGmailLabel(token.access_token, GMAIL_SYNC_LABEL);

  return db.mailboxConnection.upsert({
    where: { propertyId: input.propertyId },
    create: {
      propertyId: input.propertyId,
      provider: "gmail",
      emailAddress: profile.emailAddress,
      displayName: profile.emailAddress,
      refreshTokenEncrypted: encryptRefreshToken(refreshToken || decryptRefreshToken(existingConnection!.refreshTokenEncrypted)),
      scope: token.scope || null,
      historyId: profile.historyId || null,
      labelId: label.id,
      labelName: label.name,
      lastSyncError: null,
    },
    update: {
      emailAddress: profile.emailAddress,
      displayName: profile.emailAddress,
      refreshTokenEncrypted: encryptRefreshToken(refreshToken || decryptRefreshToken(existingConnection!.refreshTokenEncrypted)),
      scope: token.scope || existingConnection?.scope || null,
      historyId: profile.historyId || existingConnection?.historyId || null,
      labelId: label.id,
      labelName: label.name,
      lastSyncError: null,
    },
  });
}

async function listTrackedGmailThreadTargets(input: {
  propertyId: string;
  mailboxConnectionId: string;
}): Promise<TrackedGmailThreadTarget[]> {
  return db.emailThread.findMany({
    where: {
      mailboxConnectionId: input.mailboxConnectionId,
      organization: {
        propertyId: input.propertyId,
        archivedAt: null,
      },
    },
    orderBy: [
      { lastMessageAt: "desc" },
      { updatedAt: "desc" },
    ],
    take: getTrackedThreadSyncLimit(),
    select: {
      organizationId: true,
      contactId: true,
      providerThreadId: true,
    },
  });
}

async function labelSyncedGmailMessage(input: {
  accessToken: string;
  labelId?: string | null;
  message: GmailMessage;
}) {
  if (!input.labelId) return false;
  if (input.message.labelIds?.includes(input.labelId)) return false;

  try {
    await addLabelToGmailMessage(input.accessToken, input.message.id, input.labelId);
    return true;
  } catch (error) {
    console.warn("Failed to label synced Gmail message", {
      messageId: input.message.id,
      error,
    });
    return false;
  }
}

async function syncPropertyMailbox(propertyId: string) {
  const { connection, accessToken } = await getMailboxAuthorization(propertyId);

  try {
    // Never advance to a cursor captured after imports: it could skip mail arriving mid-sync.
    const profile = await getGmailProfile(accessToken);
    const messageRefs = new Map<string, { id: string; threadId: string }>();
    let latestHistoryId: string | null = connection.historyId || null;
    let trackedThreadsChecked = 0;
    let labeled = 0;
    let missingMessages = 0;
    let missingThreads = 0;

    if (connection.historyId) {
      try {
        const history = await listGmailHistory(accessToken, connection.historyId);
        latestHistoryId = history.historyId || connection.historyId;

        for (const entry of history.history ?? []) {
          for (const item of entry.messagesAdded ?? []) {
            messageRefs.set(item.message.id, item.message);
          }
          for (const item of entry.messages ?? []) {
            messageRefs.set(item.id, item);
          }
        }
      } catch (error) {
        if (!isMissingGmailResource(error, "history")) {
          throw error;
        }
        latestHistoryId = null;
      }
    }

    if (messageRefs.size === 0) {
      const recent = await listRecentGmailMessages(accessToken, 50);
      for (const item of recent.messages ?? []) {
        messageRefs.set(item.id, item);
      }
    }

    let imported = 0;
    let unmatched = 0;
    let skipped = 0;

    for (const reference of messageRefs.values()) {
      const message = await readGmailSyncItem(`messages/${reference.id}`, () => getGmailMessage(accessToken, reference.id));
      if (!message) {
        missingMessages += 1;
        continue;
      }
      const result = await storeGmailMessage({
        propertyId,
        mailboxConnectionId: connection.id,
        mailboxEmail: connection.emailAddress,
        outboundIdentityEmails: getMailboxFromOptions(connection.emailAddress).map((option) => option.email),
        gmailMessage: message,
        actorUserId: GMAIL_SYNC_ACTOR_ID,
        actorUserName: GMAIL_SYNC_ACTOR_NAME,
      });

      if (result.imported) {
        imported += 1;
        if (await labelSyncedGmailMessage({ accessToken, labelId: connection.labelId, message })) {
          labeled += 1;
        }
      } else if (result.reason === "unmatched") {
        unmatched += 1;
      } else {
        skipped += 1;
      }
    }

    const trackedThreads = await listTrackedGmailThreadTargets({
      propertyId,
      mailboxConnectionId: connection.id,
    });

    for (const target of trackedThreads) {
      const thread = await readGmailSyncItem(`threads/${target.providerThreadId}`, () => getGmailThread(accessToken, target.providerThreadId));
      trackedThreadsChecked += 1;
      if (!thread) {
        missingThreads += 1;
        continue;
      }

      for (const item of buildTrackedGmailThreadImports(target, thread)) {
        const result = await storeGmailMessage({
          propertyId,
          mailboxConnectionId: connection.id,
          mailboxEmail: connection.emailAddress,
          outboundIdentityEmails: getMailboxFromOptions(connection.emailAddress).map((option) => option.email),
          gmailMessage: item.gmailMessage,
          forcedMatch: item.forcedMatch,
          actorUserId: GMAIL_SYNC_ACTOR_ID,
          actorUserName: GMAIL_SYNC_ACTOR_NAME,
        });

        if (result.imported) {
          imported += 1;
          if (await labelSyncedGmailMessage({ accessToken, labelId: connection.labelId, message: item.gmailMessage })) {
            labeled += 1;
          }
        } else {
          skipped += 1;
        }
      }
    }

    latestHistoryId = latestHistoryId || profile.historyId || null;

    await db.mailboxConnection.update({
      where: { id: connection.id },
      data: {
        historyId: latestHistoryId,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });

    return {
      imported,
      unmatched,
      skipped,
      labeled,
      trackedThreadsChecked,
      missingMessages,
      missingThreads,
    };
  } catch (error) {
    await db.mailboxConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncError: error instanceof Error ? error.message : "Mailbox sync failed",
      },
    });
    throw error;
  }
}

export async function syncMailbox(context: PartnersRequestContext) {
  return syncPropertyMailbox(context.propertyId);
}

export async function syncAllConnectedMailboxes() {
  const connections = await db.mailboxConnection.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      propertyId: true,
      emailAddress: true,
    },
  });

  const results: Array<{
    propertyId: string;
    emailAddress: string;
    ok: boolean;
    imported?: number;
    unmatched?: number;
    skipped?: number;
    labeled?: number;
    trackedThreadsChecked?: number;
    error?: string;
  }> = [];

  for (const connection of connections) {
    try {
      const result = await syncPropertyMailbox(connection.propertyId);
      results.push({
        propertyId: connection.propertyId,
        emailAddress: connection.emailAddress,
        ok: true,
        ...result,
      });
    } catch (error) {
      results.push({
        propertyId: connection.propertyId,
        emailAddress: connection.emailAddress,
        ok: false,
        error: error instanceof Error ? error.message : "Mailbox sync failed",
      });
    }
  }

  return {
    mailboxes: results.length,
    failed: results.filter((result) => !result.ok).length,
    imported: results.reduce((sum, result) => sum + (result.imported ?? 0), 0),
    unmatched: results.reduce((sum, result) => sum + (result.unmatched ?? 0), 0),
    skipped: results.reduce((sum, result) => sum + (result.skipped ?? 0), 0),
    labeled: results.reduce((sum, result) => sum + (result.labeled ?? 0), 0),
    trackedThreadsChecked: results.reduce((sum, result) => sum + (result.trackedThreadsChecked ?? 0), 0),
    results,
  };
}

export type EmailSimulation = "success" | "timeout" | "post_send_failure" | "prior_gmail_contact";

const historyInclude = {
  contacts: true,
  _count: { select: { touches: true, emailMessages: true, emailThreads: true } },
} satisfies Prisma.PartnerOrganizationInclude;

async function checkFirstOutreach(propertyId: string, organizationId: string, recipient: string, client: Prisma.TransactionClient = db) {
  const organization = await client.partnerOrganization.findFirst({
    where: { id: organizationId, propertyId }, include: historyInclude,
  });
  if (!organization) throw new Error("Account not found.");
  assertNeverContacted(organization);
  const addresses = [organization.email, ...organization.contacts.map((person) => person.email)]
    .filter((value): value is string => Boolean(value?.trim())).map(emailAddress);
  if (!addresses.includes(recipient)) throw new Error("First outreach recipient must belong to this account.");
  const related = await client.partnerOrganization.findMany({
    where: { propertyId, id: { not: organizationId }, OR: [
      ...addresses.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
      { contacts: { some: { OR: addresses.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) } } },
    ] }, include: historyInclude,
  });
  for (const account of related) assertNeverContacted(account);
  const previous = await client.emailSendAttempt.findFirst({
    where: { propertyId, reviewOnly: false, OR: [{ organizationId }, { toEmail: { in: addresses } }] },
    select: { id: true },
  });
  if (previous) throw new Error("First outreach blocked: an earlier delivery attempt already exists.");
  return addresses;
}

export async function sendAccountEmail(
  context: PartnersRequestContext,
  input: {
    organizationId?: string;
    draftId?: string;
    requestId?: string;
    firstOutreach?: boolean;
    simulation?: EmailSimulation;
    contactId?: string;
    threadId?: string;
    fromEmail?: string;
    toEmail: string;
    subject: string;
    body: string;
    attachment?: EmailAttachment | null;
  }
) {
  if (context.source === "agent") throw new Error("APPROVAL_REQUIRED: automated outreach has not been activated.");
  const simulation = input.simulation;
  if (simulation && (getEmailRuntimeLabel() !== "test" || context.role !== "admin" || !["success", "timeout", "post_send_failure", "prior_gmail_contact"].includes(simulation))) {
    throw new Error("Email simulation is restricted to administrators in the test environment.");
  }
  if (!simulation) assertLiveEmailSendsAllowed();
  const organizationId = input.organizationId?.trim() || "";
  const draft = input.draftId ? await db.emailDraft.findFirst({ where: { id: input.draftId, propertyId: context.propertyId } }) : null;
  if (input.draftId && (!draft || (draft.organizationId || "") !== organizationId)) throw new Error("Draft not found for account.");
  const reviewOnly = draft?.reviewOnly === true;
  if (reviewOnly && context.role !== "admin") throw new Error("Only an administrator may send a review-only email.");
  const toEmail = emailAddress(reviewOnly ? reviewEmailAddress() : input.toEmail);
  const subject = `${reviewOnly && !input.subject.startsWith("[REVIEW ONLY]") ? "[REVIEW ONLY] " : ""}${input.subject.trim()}`;
  const body = normalizeEmailTemplateBody(input.body).trim();
  const attachment = input.attachment === undefined && draft?.attachmentContent
    ? { filename: draft.attachmentName!, contentType: draft.attachmentType, content: Buffer.from(draft.attachmentContent), size: draft.attachmentSize! }
    : input.attachment;
  const attachmentData = attachmentFields(attachment);
  if (draft?.attachmentContent && input.attachment === undefined && attachmentData.attachmentSha256 !== draft.attachmentSha256) throw new Error("Saved attachment integrity check failed.");
  if (simulation && !toEmail.endsWith(".invalid")) throw new Error("Simulation recipients must use .invalid addresses.");

  if (!organizationId && !reviewOnly) {
    throw new Error("Account is required.");
  }

  if (!toEmail) {
    throw new Error("Recipient email is required.");
  }

  if (!subject) {
    throw new Error("Subject is required.");
  }

  if (!body) {
    throw new Error("Body is required.");
  }

  const organization = organizationId ? await getScopedOrganization(context.propertyId, organizationId) : null;
  if (!organization && !reviewOnly) {
    throw new Error("Account not found.");
  }

  const contact = input.contactId?.trim()
    ? await assertContactBelongsToOrganization(organizationId, input.contactId.trim())
    : null;

  const authorization = simulation ? null : await getMailboxAuthorization(context.propertyId);
  const connection = authorization?.connection;
  const accessToken = authorization?.accessToken;
  const fromOption = simulation ? { email: "sender@example.invalid", name: "Acme UAT" }
    : resolveMailboxFromOption(connection!.emailAddress, reviewOnly ? "info@owlswatch.com" : input.fromEmail);
  const fromEmail = emailAddress(fromOption.email);
  const firstOutreach = !reviewOnly && (input.firstOutreach === true || draft?.firstOutreach === true || (organization?.status === "not_contacted" && !input.threadId));
  if ((firstOutreach || reviewOnly) && (!attachment || attachment.content.subarray(0, 5).toString() !== "%PDF-")) {
    throw new Error("First outreach and review emails require the saved PDF attachment.");
  }
  let threadRecord:
    | {
        id: string;
        providerThreadId: string;
      }
    | null = null;

  if (input.threadId?.trim()) {
    threadRecord = await db.emailThread.findFirst({
      where: {
        id: input.threadId.trim(),
        organizationId,
        mailboxConnectionId: connection?.id,
      },
      select: {
        id: true,
        providerThreadId: true,
      },
    });

    if (!threadRecord) {
      throw new Error("Thread not found for account.");
    }
  }

  let inReplyTo: string | null = null;
  let references: string[] = [];

  if (threadRecord) {
    const recentMessages = await db.emailMessage.findMany({
      where: {
        emailThreadId: threadRecord.id,
        internetMessageId: {
          not: null,
        },
      },
      orderBy: { sentAt: "asc" },
      select: {
        internetMessageId: true,
      },
      take: 10,
    });

    references = recentMessages
      .map((message) => message.internetMessageId?.trim())
      .filter((value): value is string => Boolean(value));
    inReplyTo = references[references.length - 1] ?? null;
  }

  const payloadHash = emailPayloadHash({ organizationId, fromEmail, toEmail, subject, body,
    threadId: threadRecord?.id || null, attachmentSha256: attachmentData.attachmentSha256 || null,
    attachmentName: attachment?.filename || null, attachmentType: attachment?.contentType || null, reviewOnly, simulated: Boolean(simulation),
  });
  const requestKey = input.requestId?.trim() || payloadHash;
  if (requestKey.length > 200) throw new Error("Request ID is too long.");
  const dedupeKey = `${context.propertyId}:${payloadHash}`;
  const findExisting = () => db.emailSendAttempt.findFirst({ where: { propertyId: context.propertyId, OR: [{ requestKey }, { dedupeKey }] } });
  const validateExisting = (attempt: NonNullable<Awaited<ReturnType<typeof findExisting>>>) => {
    if (attempt.payloadHash !== payloadHash) throw new Error("This request ID was already used for a different email.");
    return { ...attempt, fresh: false };
  };
  const sent = await deliverEmailOnce({
    claim: async () => {
      const existing = await findExisting();
      if (existing) return validateExisting(existing);
      if (firstOutreach) {
        const addresses = await checkFirstOutreach(context.propertyId, organizationId, toEmail);
        if (!simulation && addresses.some((address) => getMailboxFromOptions(connection!.emailAddress).some((own) => emailAddress(own.email) === address))) {
          throw new Error("First outreach cannot be sent to an internal mailbox.");
        }
        const previous = simulation ? { messages: simulation === "prior_gmail_contact" ? [{ id: "simulated-prior" }] : [] }
          : await searchGmailMessages(accessToken!, priorContactQuery(addresses));
        if (previous.messages?.length) throw new Error("First outreach blocked: Gmail already contains correspondence with this account.");
      }
      try {
        const attempt = await db.$transaction(async (tx) => {
          if (firstOutreach) await checkFirstOutreach(context.propertyId, organizationId, toEmail, tx);
          return tx.emailSendAttempt.create({ data: {
            propertyId: context.propertyId, organizationId: organizationId || null, draftId: draft?.id,
            requestKey, payloadHash, dedupeKey,
            firstOutreachKey: firstOutreach ? `${context.propertyId}:${organizationId}` : null,
            firstRecipientKey: firstOutreach ? `${context.propertyId}:${toEmail}` : null,
            reviewOnly, simulated: Boolean(simulation), toEmail, fromEmail, subject,
            attachmentName: attachment?.filename, attachmentSha256: attachmentData.attachmentSha256,
            actorId: context.userId, actorLabel: context.userName,
          } });
        }, { isolationLevel: "Serializable" });
        return { ...attempt, fresh: true };
      } catch (error) {
        const raced = await findExisting();
        if (raced) return validateExisting(raced);
        throw error;
      }
    },
    send: async (attemptId) => {
      if (simulation === "timeout") throw new Error("Simulated uncertain delivery");
      if (simulation) return { providerMessageId: `simulated-${attemptId}`, providerThreadId: `simulated-thread-${attemptId}` };
      const raw = buildRawGmailMessage({
        fromEmail, fromName: fromOption.name, toEmail, subject, bodyText: body,
        messageId: attemptId, inReplyTo, references,
        attachment: attachment || null,
      });
      const response = await sendGmailRawMessage(accessToken!, {
        raw, threadId: threadRecord?.providerThreadId,
      });
      return { providerMessageId: response.id, providerThreadId: response.threadId };
    },
    accepted: async (id, receipt) => {
      await db.emailSendAttempt.update({ where: { id }, data: { state: "sent", ...receipt } });
    },
    uncertain: async (id) => {
      await db.emailSendAttempt.update({ where: { id }, data: { state: "uncertain", errorCode: "DELIVERY_UNCONFIRMED" } });
    },
  });

  // Delivery is already durable. Label/import failures must never invite another send.
  let stored = false;
  try {
    if (simulation === "post_send_failure") throw new Error("Simulated import failure");
    if (!simulation && !reviewOnly) {
      if (connection!.labelId) await addLabelToGmailMessage(accessToken!, sent.providerMessageId, connection!.labelId);
      const gmailMessage = await getGmailMessage(accessToken!, sent.providerMessageId);
      const result = await storeGmailMessage({
        propertyId: context.propertyId,
        mailboxConnectionId: connection!.id,
        mailboxEmail: connection!.emailAddress,
        outboundIdentityEmails: getMailboxFromOptions(connection!.emailAddress).map((option) => option.email),
        gmailMessage,
        forcedMatch: { organizationId: organization!.id, contactId: contact?.id ?? null },
        actorUserId: context.userId, actorUserName: context.userName,
      });
      stored = result.imported || result.reason === "existing";
    } else stored = true;
    await db.emailSendAttempt.update({ where: { id: sent.attemptId }, data: { stored, errorCode: null } });
  } catch {
    await db.emailSendAttempt.update({ where: { id: sent.attemptId }, data: { errorCode: "POST_SEND_SYNC_FAILED" } }).catch(() => undefined);
  }
  return { ...sent, stored, reviewOnly, warning: stored ? null : "Email accepted by Gmail; CMS sync needs reconciliation. Do not resend." };
}

export async function reconcileEmailSend(context: PartnersRequestContext, attemptId: string) {
  const attempt = await db.emailSendAttempt.findFirst({ where: { id: attemptId, propertyId: context.propertyId } });
  if (!attempt) throw new Error("Delivery attempt not found.");
  if (attempt.simulated) throw new Error("Simulated deliveries are not in Gmail.");
  const { connection, accessToken } = await getMailboxAuthorization(context.propertyId);
  const match = attempt.providerMessageId || (await searchGmailMessages(accessToken, `in:anywhere rfc822msgid:${attempt.id}@mail.owlswatch.com`)).messages?.[0]?.id;
  if (!match) return { ...attempt, reconciled: false };
  const message = await getGmailMessage(accessToken, match);
  const participants = extractGmailParticipants(message);
  if (!participants.from.some((person) => person.email.toLowerCase() === attempt.fromEmail) || !participants.to.some((person) => person.email.toLowerCase() === attempt.toEmail)) {
    throw new Error("Gmail receipt does not match the intended sender and recipient.");
  }
  let stored = attempt.reviewOnly;
  if (!attempt.reviewOnly && attempt.organizationId) {
    const result = await storeGmailMessage({
      propertyId: context.propertyId, mailboxConnectionId: connection.id, mailboxEmail: connection.emailAddress,
      outboundIdentityEmails: getMailboxFromOptions(connection.emailAddress).map((option) => option.email),
      gmailMessage: message, forcedMatch: { organizationId: attempt.organizationId },
      actorUserId: context.userId, actorUserName: context.userName,
    });
    stored = result.imported || result.reason === "existing";
  }
  const updated = await db.emailSendAttempt.update({ where: { id: attempt.id }, data: {
    state: "sent", providerMessageId: message.id, providerThreadId: message.threadId, stored,
    errorCode: stored ? null : "POST_SEND_SYNC_FAILED",
  } });
  return { ...updated, reconciled: true };
}

export async function listOrganizationEmailThreads(organizationId: string, propertyId: string) {
  const organization = await getScopedOrganization(propertyId, organizationId);
  if (!organization) {
    throw new Error("Account not found.");
  }

  return db.emailThread.findMany({
    where: {
      organizationId,
    },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          subject: true,
          bodyText: true,
          bodyHtml: true,
          snippet: true,
          fromEmail: true,
          fromName: true,
          toEmails: true,
          ccEmails: true,
          sentAt: true,
          internetMessageId: true,
        },
      },
    },
    orderBy: [
      { lastMessageAt: "desc" },
      { updatedAt: "desc" },
    ],
  });
}
