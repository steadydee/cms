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
  GMAIL_SYNC_LABEL,
  isGmailConfigured,
  parseGmailMessageBody,
  refreshGmailAccessToken,
  sendGmailRawMessage,
  listRecentGmailMessages,
  listGmailHistory,
  type GmailMessage,
} from "@/lib/gmail";
import { db } from "@/lib/db";
import { assertLiveEmailSendsAllowed } from "@/lib/email-safety";
import { normalizeEmailTemplateBody } from "@/lib/email-template-utils";

const GMAIL_SYNC_ACTOR_ID = "gmail-sync";
const GMAIL_SYNC_ACTOR_NAME = "Gmail sync";
const MAX_ACCOUNT_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
  return status === "active_partner" || status === "proposal_sent" || status === "visited";
}

function getReplyStatus(currentStatus: RelationshipStatus, direction: "inbound" | "outbound") {
  if (hasEmailStatusPriority(currentStatus)) {
    return currentStatus;
  }

  return direction === "inbound" ? "engaged" : "awaiting_reply";
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
            lastMessageAt: sentAt,
            lastInboundAt: direction === "inbound" ? sentAt : existingThread.lastInboundAt,
            lastOutboundAt: direction === "outbound" ? sentAt : existingThread.lastOutboundAt,
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
        lastContactedAt: sentAt,
        status: getReplyStatus(organization.status, direction),
      },
    });

    if (match.contactId) {
      await tx.partnerContact.update({
        where: { id: match.contactId },
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

export async function syncMailbox(context: PartnersRequestContext) {
  const { connection, accessToken } = await getMailboxAuthorization(context.propertyId);

  try {
    const messageRefs = new Map<string, { id: string; threadId: string }>();
    let latestHistoryId: string | null = connection.historyId || null;

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
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("(404)")) {
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
      const message = await getGmailMessage(accessToken, reference.id);
      const result = await storeGmailMessage({
        propertyId: context.propertyId,
        mailboxConnectionId: connection.id,
        mailboxEmail: connection.emailAddress,
        outboundIdentityEmails: getMailboxFromOptions(connection.emailAddress).map((option) => option.email),
        gmailMessage: message,
        actorUserId: GMAIL_SYNC_ACTOR_ID,
        actorUserName: GMAIL_SYNC_ACTOR_NAME,
      });

      if (result.imported) {
        imported += 1;
      } else if (result.reason === "unmatched") {
        unmatched += 1;
      } else {
        skipped += 1;
      }
    }

    const profile = await getGmailProfile(accessToken);
    latestHistoryId = profile.historyId || latestHistoryId;

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

export async function sendAccountEmail(
  context: PartnersRequestContext,
  input: {
    organizationId: string;
    contactId?: string;
    threadId?: string;
    fromEmail?: string;
    toEmail: string;
    subject: string;
    body: string;
    attachment?: {
      filename: string;
      contentType?: string | null;
      content: Buffer;
      size: number;
    };
  }
) {
  const organizationId = input.organizationId.trim();
  const toEmail = input.toEmail.trim();
  const subject = input.subject.trim();
  const body = normalizeEmailTemplateBody(input.body).trim();
  const attachment = input.attachment;

  if (!organizationId) {
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

  if (attachment) {
    if (attachment.size > MAX_ACCOUNT_EMAIL_ATTACHMENT_BYTES) {
      throw new Error("Attachments are limited to 10 MB.");
    }

    if (!attachment.content.byteLength) {
      throw new Error("Attachment is empty.");
    }
  }

  assertLiveEmailSendsAllowed();

  const organization = await getScopedOrganization(context.propertyId, organizationId);
  if (!organization) {
    throw new Error("Account not found.");
  }

  const contact = input.contactId?.trim()
    ? await assertContactBelongsToOrganization(organizationId, input.contactId.trim())
    : null;

  const { connection, accessToken } = await getMailboxAuthorization(context.propertyId);
  const fromOption = resolveMailboxFromOption(connection.emailAddress, input.fromEmail);
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
        mailboxConnectionId: connection.id,
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

  const raw = buildRawGmailMessage({
    fromEmail: fromOption.email,
    fromName: fromOption.name,
    toEmail,
    subject,
    bodyText: body,
    inReplyTo,
    references,
    attachment: attachment
      ? {
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: attachment.content,
        }
      : null,
  });

  const sent = await sendGmailRawMessage(accessToken, {
    raw,
    threadId: threadRecord?.providerThreadId,
  });

  if (connection.labelId) {
    await addLabelToGmailMessage(accessToken, sent.id, connection.labelId);
  }

  const gmailMessage = await getGmailMessage(accessToken, sent.id);
  const result = await storeGmailMessage({
    propertyId: context.propertyId,
    mailboxConnectionId: connection.id,
    mailboxEmail: connection.emailAddress,
    outboundIdentityEmails: getMailboxFromOptions(connection.emailAddress).map((option) => option.email),
    gmailMessage,
    forcedMatch: {
      organizationId: organization.id,
      contactId: contact?.id ?? null,
    },
    actorUserId: context.userId,
    actorUserName: context.userName,
  });

  return {
    providerMessageId: sent.id,
    providerThreadId: sent.threadId,
    stored: result.imported,
  };
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
