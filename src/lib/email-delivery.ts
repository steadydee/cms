import { createHash } from "node:crypto";

export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export type EmailAttachment = { filename: string; contentType?: string | null; content: Buffer; size: number };

export function emailAddress(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    throw new Error("A single valid email address is required.");
  }
  return email;
}

export function attachmentFields(attachment: EmailAttachment | null | undefined) {
  if (attachment === undefined) return {};
  if (attachment === null) return { attachmentName: null, attachmentType: null, attachmentSize: null, attachmentSha256: null, attachmentContent: null };
  if (!attachment.content.length || attachment.content.length > MAX_EMAIL_ATTACHMENT_BYTES || attachment.size !== attachment.content.length) {
    throw new Error("Attachment must contain 1 byte to 10 MB and match its declared size.");
  }
  if (!attachment.filename.trim() || /[\r\n\x00]/.test(attachment.filename)) throw new Error("Invalid attachment name.");
  return {
    attachmentName: attachment.filename.trim(),
    attachmentType: attachment.contentType || "application/octet-stream",
    attachmentSize: attachment.content.length,
    attachmentSha256: createHash("sha256").update(attachment.content).digest("hex"),
    attachmentContent: new Uint8Array(attachment.content),
  };
}

export function emailPayloadHash(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
}

export function assertNeverContacted(account: {
  status: string; archivedAt: Date | null; lastContactedAt: Date | null;
  visitStatus: string; lastVisitedAt: Date | null;
  contacts: { lastContactedAt: Date | null }[];
  _count: { touches: number; emailMessages: number; emailThreads: number };
}) {
  if (account.archivedAt || account.status !== "not_contacted" || account.lastContactedAt
    || account.visitStatus !== "never_invited" || account.lastVisitedAt
    || account.contacts.some((person) => person.lastContactedAt)
    || account._count.touches || account._count.emailMessages || account._count.emailThreads) {
    throw new Error("First outreach blocked: this account already has contact or visit history.");
  }
}

export function priorContactQuery(addresses: string[]) {
  return `in:anywhere {${[...new Set(addresses.map(emailAddress))].map((email) => `from:${email} to:${email}`).join(" ")}}`;
}

export function deliveryAttemptIds(headers: Array<string | null | undefined>) {
  return [...new Set(headers.flatMap((header) => [...(header || "").matchAll(/<([a-z0-9]+)@mail\.owlswatch\.com>/gi)].map((match) => match[1])))];
}

export type DeliveryReceipt = { providerMessageId: string; providerThreadId: string };
export type DeliveryClaim = { id: string; fresh: boolean; state: string; providerMessageId: string | null; providerThreadId: string | null };

// Never release a claim after starting delivery: a timeout can mean Gmail accepted it.
export async function deliverEmailOnce(deps: {
  claim: () => Promise<DeliveryClaim>;
  send: (id: string) => Promise<DeliveryReceipt>;
  accepted: (id: string, receipt: DeliveryReceipt) => Promise<void>;
  uncertain: (id: string) => Promise<void>;
}) {
  const claim = await deps.claim();
  if (!claim.fresh) {
    if (claim.state === "sent" && claim.providerMessageId && claim.providerThreadId) {
      return { attemptId: claim.id, providerMessageId: claim.providerMessageId, providerThreadId: claim.providerThreadId, reused: true };
    }
    throw new Error("This send is pending or uncertain. Check Gmail and reconcile the existing attempt; do not resend.");
  }
  let receipt: DeliveryReceipt;
  try {
    receipt = await deps.send(claim.id);
  } catch {
    await deps.uncertain(claim.id).catch(() => undefined);
    throw new Error("Gmail delivery could not be confirmed. The send is locked against retries; check Gmail before taking further action.");
  }
  try {
    await deps.accepted(claim.id, receipt);
  } catch {
    throw new Error("Gmail accepted the email but the receipt could not be saved. Do not resend; reconcile the existing attempt.");
  }
  return { attemptId: claim.id, ...receipt, reused: false };
}
