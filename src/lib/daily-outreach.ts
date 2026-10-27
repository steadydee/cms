import { createHash } from "node:crypto";
import { normalizeEmailTemplateBody } from "./email-template-utils";
import { emailAddress } from "./email-delivery";
import type { PartnersRequestContext } from "./auth";

export const OUTREACH_TOOL = "send_partner_email_draft";
export const OUTREACH_TIMEZONE = "America/Bogota";
export const EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000;
export const SYNC_MAX_AGE_MS = 30 * 60 * 1000;

export type OutreachPolicy = {
  id: string; propertyId: string; enabled: boolean; agentId: string; credentialId: string;
  templateId: string; templateSubject: string; templateBody: string;
  attachmentSha256: string; attachmentName: string; senderEmail: string;
  businessMailbox: string; personalMailbox: string; startsAt: Date; expiresAt: Date;
};

export function outreachDay(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: OUTREACH_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const start = new Date(`${date}T00:00:00-05:00`);
  return { date, start, end: new Date(start.getTime() + 86400000),
    inWindow: !["Sat", "Sun"].includes(parts.weekday) && parts.hour === "09" && Number(parts.minute) < 30 };
}

export function assertPolicyIdentity(policy: OutreachPolicy | null, context: PartnersRequestContext, now = new Date()) {
  if (!policy?.enabled || policy.propertyId !== context.propertyId || policy.agentId !== context.userId
    || policy.credentialId !== context.credentialId || context.source !== "agent"
    || policy.startsAt > now || policy.expiresAt <= now) throw new Error("APPROVAL_REQUIRED: no current policy for this worker and property.");
  if (!context.allowedTools?.includes(OUTREACH_TOOL) || !context.allowedToolClassifications?.includes("restricted")
    || !context.permissions?.includes("partners.outreach.send")) throw new Error("APPROVAL_REQUIRED: explicit named send scope is required.");
  return policy;
}

export function outreachSnapshot(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function renderOutreachBody(body: string, name: string) {
  if (!name.trim() || /[\r\n{}]/.test(name)) throw new Error("A verified recipient name is required.");
  return normalizeEmailTemplateBody(body).replaceAll("{name}", name.trim()).trim();
}

export function assertApprovedContent(policy: OutreachPolicy, draft: {
  reviewOnly: boolean; firstOutreach: boolean; emailThreadId: string | null;
  fromEmail: string | null; subject: string | null; bodyText: string;
  attachmentSha256: string | null; attachmentName: string | null;
}, name: string) {
  if (draft.reviewOnly || !draft.firstOutreach || draft.emailThreadId
    || draft.fromEmail?.toLowerCase() !== policy.senderEmail
    || draft.subject !== policy.templateSubject
    || normalizeEmailTemplateBody(draft.bodyText).trim() !== renderOutreachBody(policy.templateBody, name)
    || draft.attachmentSha256 !== policy.attachmentSha256 || draft.attachmentName !== policy.attachmentName) {
    throw new Error("Outreach blocked: draft differs from the approved template, sender or PDF.");
  }
}

function quoted(term: string) { return `"${term.replace(/["\\\r\n]/g, " ").trim()}"`; }
export const OUTREACH_QUERY_MAX_LENGTH = 1500;
const PUBLIC_DOMAINS = new Set(["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "aol.com"]);
export function outreachSearchQueries(account: { name: string; email: string | null; website: string | null; contacts: { fullName: string; email: string | null }[] }) {
  if (!account.name.trim()) throw new Error("Verify the account name before outreach.");
  const addresses = [...new Set([account.email, ...account.contacts.map(c => c.email)].filter((s): s is string => Boolean(s?.trim())).map(emailAddress))];
  const terms = new Set([account.name, ...account.contacts.map(c => c.fullName)]);
  for (const address of addresses) {
    const domain = address.split("@")[1];
    if (domain && !PUBLIC_DOMAINS.has(domain)) terms.add(domain);
  }
  if (account.website) {
    try {
      const url = new URL(account.website);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw new Error("Invalid website");
      terms.add(url.hostname.replace(/^www\./, ""));
    } catch { throw new Error("Verify the account website before outreach."); }
  }
  // Gmail braces match ANY term. Keep the full union, but make fewer mailbox reads.
  const atoms = [...new Set([...addresses.flatMap(email => [`from:${email}`, `to:${email}`]),
    ...[...terms].filter(term => term.trim()).map(quoted)])].sort();
  const queries: string[] = [];
  let chunk: string[] = [];
  const query = (parts: string[]) => `in:anywhere {${parts.join(" ")}}`;
  for (const atom of atoms) {
    if (atom === '""' || query([atom]).length > OUTREACH_QUERY_MAX_LENGTH) throw new Error("Verify the account search terms before outreach.");
    if (query([...chunk, atom]).length > OUTREACH_QUERY_MAX_LENGTH) {
      queries.push(query(chunk));
      chunk = [];
    }
    chunk.push(atom);
  }
  if (chunk.length) queries.push(query(chunk));
  return queries;
}

export type OutreachEvidence = {
  snapshot: string; reviewedAt: string; birdingConfirmed: true; noPriorRelationship: true;
  noOptOutOrBounce: true; notCompetitor: true; aliasesChecked: true;
  checks: { mailbox: string; query: string; checkedAt: string; matches: number; complete: boolean }[];
};

export function assertOutreachEvidence(value: unknown, policy: OutreachPolicy, snapshot: string, queries: string[], now = new Date()): asserts value is OutreachEvidence {
  if (!value || typeof value !== "object") throw new Error("Fresh two-mailbox evidence is required.");
  const evidence = value as OutreachEvidence;
  const fresh = (date: string) => { const age = now.getTime() - new Date(date).getTime(); return Number.isFinite(age) && age >= 0 && age <= EVIDENCE_MAX_AGE_MS; };
  if (evidence.snapshot !== snapshot || !fresh(evidence.reviewedAt)
    || evidence.birdingConfirmed !== true || evidence.noPriorRelationship !== true
    || evidence.noOptOutOrBounce !== true || evidence.notCompetitor !== true || evidence.aliasesChecked !== true
    || !Array.isArray(evidence.checks)) throw new Error("Outreach review is missing, stale or does not match the account and draft.");
  for (const mailbox of [policy.businessMailbox, policy.personalMailbox]) {
    for (const query of queries) {
      if (!evidence.checks.some(check => check.mailbox === mailbox && check.query === query
        && check.matches === 0 && check.complete === true && fresh(check.checkedAt))) {
        throw new Error("Both Gmail accounts must have fresh, complete, zero-match searches for every required query.");
      }
    }
  }
  if (evidence.checks.some(check => check.matches !== 0 || check.complete !== true || !fresh(check.checkedAt))) {
    throw new Error("Prior or ambiguous correspondence blocks outreach.");
  }
}
