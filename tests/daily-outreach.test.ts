import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertPolicyIdentity, assertApprovedContent, assertOutreachEvidence, outreachDay,
  outreachSearchQueries, type OutreachPolicy, type OutreachEvidence } from "../src/lib/daily-outreach";
import { hasAgentPermission, getAgentScopeDenial } from "../src/lib/tools/agent-scope";
import { validateAgentClaims } from "../src/lib/agent-claims";
import { areLiveEmailSendsAllowed } from "../src/lib/email-safety";
import { TOOL_DEFINITIONS } from "../src/lib/tools/definitions";
import type { PartnersRequestContext } from "../src/lib/auth";

const now = new Date("2026-10-23T14:05:00Z");
test("explicit live-send kill switch overrides production defaults", () => {
  assert.equal(areLiveEmailSendsAllowed({ VERCEL_TARGET_ENV: "production", OW_PARTNERS_ALLOW_LIVE_EMAIL_SENDS: "false" }), false);
});
const policy: OutreachPolicy = { id: "policy", propertyId: "test", enabled: true, agentId: "worker", credentialId: "key",
  templateId: "template", templateSubject: "Invitation", templateBody: "Hello {name},\nAcme birding invitation.",
  attachmentSha256: "a".repeat(64), attachmentName: "Acme.pdf", senderEmail: "info@owlswatch.com",
  businessMailbox: "work@example.invalid", personalMailbox: "personal@example.invalid",
  startsAt: new Date("2026-10-22"), expiresAt: new Date("2027-01-01") };
const context: PartnersRequestContext = { userId: "worker", userName: "Acme worker", role: "admin", source: "agent",
  actorType: "agent", propertyId: "test", credentialId: "key", permissions: ["partners.read", "partners.write", "partners.outreach.send"],
  allowedTools: ["send_partner_email_draft"], allowedToolClassifications: ["read", "draft", "guarded_write", "restricted"] };
const draft = { reviewOnly: false, firstOutreach: true, emailThreadId: null, fromEmail: policy.senderEmail,
  subject: policy.templateSubject, bodyText: "Hello Acme,\nAcme birding invitation.", attachmentSha256: policy.attachmentSha256, attachmentName: "Acme.pdf" };
function evidence(): OutreachEvidence { return { snapshot: "snapshot", reviewedAt: now.toISOString(), birdingConfirmed: true,
  noPriorRelationship: true, noOptOutOrBounce: true, notCompetitor: true, aliasesChecked: true,
  checks: [policy.businessMailbox, policy.personalMailbox].flatMap(mailbox => ["query1", "query2"].map(query => ({ mailbox, query, checkedAt: now.toISOString(), matches: 0, complete: true }))) }; }

test("Hub presets map only to the matching CMS read/write permissions, never sends/admin", () => {
  for (const area of ["organizations", "contacts", "outreach", "tasks", "research"]) {
    assert.ok(hasAgentPermission(["partners.read"], `partners.${area}.read`));
    assert.ok(hasAgentPermission(["partners.write"], `partners.${area}.write`));
    assert.equal(hasAgentPermission(["partners.read"], `partners.${area}.write`), false);
  }
  for (const permission of ["partners.admin", "partners.outreach.send", "pms.organizations.read", "partners.secrets.read"]) {
    assert.equal(hasAgentPermission(["partners.read", "partners.write"], permission), false);
  }
});
test("named tools and classifications are enforced independently of permissions", () => {
  const tool = TOOL_DEFINITIONS.find(t => t.name === "send_partner_email_draft")!;
  assert.equal(getAgentScopeDenial(tool, context), null);
  assert.equal(getAgentScopeDenial(tool, { ...context, allowedTools: ["get_dashboard_summary"] })?.code, "TOOL_NOT_ALLOWED");
  assert.equal(getAgentScopeDenial(tool, { ...context, allowedToolClassifications: [] })?.code, "CLASSIFICATION_NOT_ALLOWED");
  assert.equal(getAgentScopeDenial(tool, { ...context, allowedTools: undefined })?.code, "TOOL_NOT_ALLOWED");
});
test("malformed, expired, future, wrong-app and wildcard-only claims fail closed", () => {
  const claim = { iss: "owhub", typ: "agent_access", aud: "partners", agentId: "worker", credentialId: "key", actorLabel: "Acme",
    permissions: [], propertyIds: ["test"], activePropertyId: "test", allowedTools: [], allowedToolClassifications: [], iat: 100, exp: 300, jti: "id" };
  assert.ok(validateAgentClaims(claim, 200));
  for (const update of [{ exp: 199 }, { iat: 500 }, { exp: 2000 }, { aud: "pms" }, { allowedTools: undefined }, { permissions: null }, { propertyIds: ["*"] }]) {
    assert.equal(validateAgentClaims({ ...claim, ...update }, 200), null);
  }
});
test("Bogota window is weekday 09:00-09:29 with no UTC-date or weekend catch-up", () => {
  assert.equal(outreachDay(now).inWindow, true);
  for (const date of ["2026-10-23T13:59:59Z", "2026-10-23T14:30:00Z", "2026-10-24T14:05:00Z", "2026-10-25T14:05:00Z"]) assert.equal(outreachDay(new Date(date)).inWindow, false);
  assert.equal(outreachDay(new Date("2026-10-24T02:00:00Z")).date, "2026-10-23");
});
test("policy binds worker, credential, property, named send grant, activation and expiry", () => {
  assert.equal(assertPolicyIdentity(policy, context, now).id, "policy");
  for (const change of [{ enabled: false }, { agentId: "other" }, { credentialId: "other" }, { propertyId: "other" }, { startsAt: new Date("2026-11-01") }, { expiresAt: now }]) {
    assert.throws(() => assertPolicyIdentity({ ...policy, ...change }, context, now), /APPROVAL_REQUIRED/);
  }
  for (const change of [{ permissions: ["partners.admin"] }, { allowedTools: [] }, { allowedToolClassifications: ["guarded_write"] }]) assert.throws(() => assertPolicyIdentity(policy, { ...context, ...change }, now), /APPROVAL_REQUIRED/);
});
test("approved message, exact PDF and sender cannot be swapped or used for a reply/review", () => {
  assert.doesNotThrow(() => assertApprovedContent(policy, draft, "Acme"));
  for (const change of [{ reviewOnly: true }, { firstOutreach: false }, { emailThreadId: "thread" }, { fromEmail: "other@example.invalid" },
    { subject: "Changed" }, { bodyText: "Changed" }, { attachmentSha256: "b".repeat(64) }, { attachmentName: "other.pdf" }]) {
    assert.throws(() => assertApprovedContent(policy, { ...draft, ...change }, "Acme"), /differs/);
  }
});
test("Gmail queries include all stored contacts, company, website and business domain without searching all Gmail", () => {
  const queries = outreachSearchQueries({ name: "Acme Tours", email: "info@acme.invalid", website: "https://www.acme.invalid",
    contacts: [{ fullName: "Acme Contact", email: "contact@gmail.com" }] });
  assert.ok(queries.includes('in:anywhere "Acme Tours"'));
  assert.ok(queries.includes('in:anywhere "Acme Contact"'));
  assert.ok(queries.includes('in:anywhere "acme.invalid"'));
  assert.ok(queries.includes('in:anywhere {from:contact@gmail.com to:contact@gmail.com}'));
  assert.ok(!queries.includes('in:anywhere "gmail.com"'));
});
test("both mailboxes require fresh complete zero-match evidence bound to the current snapshot", () => {
  const validate = (value: unknown) => assertOutreachEvidence(value, policy, "snapshot", ["query1", "query2"], now);
  assert.doesNotThrow(() => validate(evidence()));
  for (const change of [{ snapshot: "old" }, { reviewedAt: "2026-10-23T13:00:00Z" }, { reviewedAt: "2026-10-23T15:00:00Z" },
    { birdingConfirmed: false }, { aliasesChecked: false }, { noOptOutOrBounce: false }, { noPriorRelationship: false },
    { checks: evidence().checks.slice(0,2) }, { checks: [] }]) assert.throws(() => validate({ ...evidence(), ...change }));
  for (const change of [{ matches: 1 }, { complete: false }, { checkedAt: "bad date" }]) {
    const e = evidence(); Object.assign(e.checks[0], change); assert.throws(() => validate(e));
  }
});
test("daily ledger and service enforce transactional checks without releasing claims", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const service = readFileSync("src/lib/services/partner-email.ts", "utf8");
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  assert.match(schema, /dailyOutreachKey\s+String\?\s+@unique/);
  assert.match(service, /client: tx, now: now\(\)/);
  assert.match(service, /outreachEvidence: policyPreflight/);
  assert.match(auth, /if \(!options.allowAgent\)/);
});
