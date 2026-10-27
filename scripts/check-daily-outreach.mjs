import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import mailboxChecks from "./outreach-mailbox-checks.cjs";

const cms = "https://partners-env-test-dennis-projects-b028c121.vercel.app";
const hub = "https://hub-env-test-dennis-projects-b028c121.vercel.app";
if (process.env.VERCEL_TARGET_ENV !== "test" || !process.env.DATABASE_URL?.includes("owpartners_test") || process.env.OW_PARTNERS_ALLOW_LIVE_EMAIL_SENDS === "true") throw new Error("Isolated Test configuration with live sends disabled required.");
const fixture = JSON.parse(readFileSync("/tmp/cms-outreach-uat-agent.json", "utf8"));
const db = new PrismaClient();
const passed = [];
const vercelArgs = process.env.VERCEL_GLOBAL_CONFIG ? ["--global-config", process.env.VERCEL_GLOBAL_CONFIG] : [];
const now = new Date();
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
let testTime = new Date(`${localDate}T09:05:00-05:00`);
if ([0,6].includes(testTime.getUTCDay())) throw new Error("Run this suite on a weekday; weekend rejection is tested separately.");
const pdf = Buffer.from("%PDF-1.7\nAcme synthetic daily UAT\n%%EOF");
const sha = createHash("sha256").update(pdf).digest("hex");
function transport(origin, path, body, headers = {}, concurrent = false) {
  const config = [`request = "${body === undefined ? "GET" : "POST"}"`, ...Object.entries({ "content-type": "application/json", ...headers }).filter(([,v])=>v).map(([k,v]) => `header = ${JSON.stringify(`${k}: ${v}`)}`)];
  if (body !== undefined) config.push(`data = ${JSON.stringify(JSON.stringify(body))}`);
  const args = [...vercelArgs, "curl", path, "--deployment", origin, "--", "--silent", "--show-error", "--include", "--max-time", "60", "--config", "-"];
  const parse = raw => { const split = raw.indexOf("\r\n\r\n"); assert.ok(split>0); const text = raw.subarray(split+4).toString(); return { status: Number(/^HTTP\/\S+\s+(\d+)/m.exec(raw.subarray(0,split).toString())?.[1]), body: JSON.parse(text) }; };
  if (!concurrent) {
    const result = spawnSync("vercel", args, { input: config.join("\n"), timeout: 75000, maxBuffer: 8*1024*1024 });
    assert.equal(result.status, 0, "Vercel transport failed; credentials omitted"); return parse(result.stdout);
  }
  return new Promise((resolve, reject) => {
    const child = spawn("vercel", args); const chunks = [];
    child.stdout.on("data", chunk => chunks.push(chunk)); child.stderr.resume();
    child.on("error", reject); child.on("close", code => { try { assert.equal(code,0); resolve(parse(Buffer.concat(chunks))); } catch(e) { reject(e); } });
    child.stdin.end(config.join("\n"));
  });
}
function human(property) { return { "x-ow-internal-secret": process.env.OW_INTERNAL_SHARED_SECRET, "x-ow-user-id": "daily-outreach-uat", "x-ow-user-name": "Acme UAT", "x-ow-user-role": "admin", "x-ow-property-id": property }; }
function exchange(property) {
  const response = transport(hub, "/api/agent-auth/exchange", { app: "partners", propertyId: property }, { authorization: `Bearer ${fixture.rawKey}` });
  assert.equal(response.status,200); assert.deepEqual(response.body.permissions,["partners.outreach.send","partners.read","partners.write"]);
  return { authorization: `Bearer ${response.body.token}` };
}
function tool(name, input, headers, expected = true) {
  const response = transport(cms, `/api/tools/${name}`, { input }, headers);
  assert.equal(response.body.success, expected, `${name}: ${response.body.message || response.status}`);
  return expected ? response.body.data : response.body;
}
function pass(name) { passed.push(name); console.log(`PASS ${name}`); }
async function setup(suffix) {
  const property = `${fixture.prefix}-${suffix}`, admin = human(property), agent = exchange(property);
  const template = await db.emailTemplate.create({ data: { propertyId: property, name: "Acme synthetic birding", subject: "Acme invitation", body: "Hello {name},\nAcme invitation for two representatives." } });
  const policy = { enabled: true, agentId: fixture.agentId, credentialId: fixture.credentialId, templateId: template.id,
    attachmentSha256: sha, attachmentName: "Acme.pdf", businessMailbox: "work@example.invalid", personalMailbox: "personal@example.invalid",
    startsAt: new Date(testTime.getTime()-86400000).toISOString(), expiresAt: new Date(now.getTime()+7*86400000).toISOString() };
  const saved = transport(cms, "/api/daily-outreach-policy", policy, admin); assert.equal(saved.body.success,true, saved.body.error);
  const account = tool("create_partner_account", { name: `Acme ${suffix}`, type: "operator", email: `${suffix}@example.invalid` }, admin);
  const draftInput = { organizationId: account.id, toEmail: account.email, fromEmail: "info@owlswatch.com", subject: template.subject,
    body: template.body.replace("{name}",account.name), firstOutreach: true,
    attachment: { filename: "Acme.pdf", contentType: "application/pdf", base64: pdf.toString("base64") } };
  const draft = tool("save_partner_email_draft", draftInput, agent);
  return { property, admin, agent, policy, account, draft, draftInput };
}
function evidence(f) {
  const preflight = tool("get_daily_outreach_preflight", { draftId: f.draft.id }, f.agent);
  return { snapshot: preflight.snapshot, reviewedAt: testTime.toISOString(), birdingConfirmed: true, noPriorRelationship: true,
    noOptOutOrBounce: true, notCompetitor: true, aliasesChecked: true,
    checks: ["work@example.invalid","personal@example.invalid"].flatMap(mailbox => preflight.queries.map(query => ({ mailbox, query, checkedAt: testTime.toISOString(), matches: 0, complete: true }))) };
}
function simulate(f, outreachEvidence = evidence(f), extra = {}, expected = true) {
  return tool("simulate_daily_outreach_send", { draftId: f.draft.id, requestId: "ignored-worker-id", outreachEvidence, simulation: "success", testNow: testTime.toISOString(), ...extra }, f.agent, expected);
}
try {
  const a = await setup("access");
  assert.equal(transport(cms,"/.well-known/ow-tools",undefined,a.agent).status,200);
  tool("get_dashboard_summary",{},a.agent); tool("find_partner_accounts",{},a.agent); tool("get_partner_account",{organizationId:a.account.id},a.agent);
  assert.equal(tool("add_note",{organizationId:a.account.id,text:"must not write"},a.agent,false).errorCode,"TOOL_NOT_ALLOWED");
  assert.equal(transport(cms,"/api/daily-outreach-policy",a.policy,a.agent).status,403);
  assert.equal(transport(cms,"/api/tools/send_intro_email",undefined,a.agent).status,403);
  assert.equal(transport(hub,"/api/agent-auth/exchange",{app:"reservations",propertyId:a.property},{authorization:`Bearer ${fixture.rawKey}`}).status,403);
  pass("real Hub exchange, CMS reads/drafts, named-tool isolation, human-only policy and other-app denial");
  const packed = tool("get_daily_outreach_preflight", { draftId: a.draft.id }, a.agent);
  assert.equal(packed.queries.length, 2);
  assert.ok(packed.queries.some(q => q.startsWith("in:anywhere {") && q.includes(`from:${a.account.email}`) && q.includes(`to:${a.account.email}`) && q.includes(`"${a.account.name}"`)));
  let clock = testTime.getTime(), reads = 0;
  const runnerInput = { preflight: packed, mailboxes: [{ email: "work@example.invalid", linkId: "synthetic-work" }, { email: "personal@example.invalid", linkId: "synthetic-personal" }],
    now: () => clock, sleep: async ms => { clock += ms; }, search: async () => ++reads === 1
      ? { isError: true, structuredContent: { error_data: { reason: "RATE_LIMIT_EXCEEDED" } } }
      : { isError: false, structuredContent: { message_ids: [], next_page_token: null } } };
  const recovered = await mailboxChecks.collectMailboxChecks(runnerInput);
  assert.equal(recovered.retries, 1); assert.equal(recovered.checks.length, 4); assert.equal(reads, 5);
  const runnerEvidence = { ...evidence(a), ...recovered };
  const recoveredSend = simulate(a, runnerEvidence, { testNow: new Date(clock).toISOString() });
  assert.equal(tool("get_email_send_attempt", { attemptId: recoveredSend.attemptId }, a.agent).simulated, true);
  const blocked = await mailboxChecks.collectMailboxChecks({ ...runnerInput, search: async ({ query }) => ({ isError: false, structuredContent: { message_ids: query === packed.dailySentQuery ? [] : ["synthetic-prior-contact"], next_page_token: null } }) });
  assert.equal(blocked.blocked, "prior_contact"); assert.equal(blocked.checks, undefined);
  pass("packed deployed preflight plus read-only throttle recovery produces accepted evidence; prior contact still blocks");
  const changed = await setup("changed"); const old = evidence(changed);
  tool("save_partner_email_draft",{...changed.draftInput,draftId:changed.draft.id,body:"Altered"},changed.agent);
  assert.match(simulate(changed,old,{},false).message,/differs/);
  pass("changed approved body rejected before provider");
  const stale = await setup("stale"); const staleEvidence=evidence(stale); staleEvidence.reviewedAt=new Date(testTime-3600000).toISOString();
  assert.match(simulate(stale,staleEvidence,{},false).message,/stale/);
  const missing = await setup("missing"); const missingEvidence=evidence(missing); missingEvidence.checks=missingEvidence.checks.filter(c=>c.mailbox.startsWith("work"));
  assert.match(simulate(missing,missingEvidence,{},false).message,/Both Gmail/);
  pass("stale evidence and missing personal Gmail checks rejected");
  const history = await setup("history"); const he=evidence(history);
  tool("update_partner_status",{organizationId:history.account.id,status:"contacted",visitStatus:"never_invited"},history.admin);
  assert.match(simulate(history,he,{},false).message,/match the account/);
  assert.match(simulate(history,evidence(history),{},false).message,/contact or visit history/);
  pass("account changes invalidate evidence and previous CMS contact blocks outreach");
  const shared = await setup("shared");
  const duplicate = tool("create_partner_account", { name: "Acme duplicate", type: "operator", email: shared.account.email }, shared.admin);
  tool("update_partner_status", { organizationId: duplicate.id, status: "contacted", visitStatus: "never_invited" }, shared.admin);
  assert.match(simulate(shared,evidence(shared),{},false).message,/contact or visit history/);
  pass("another CMS account sharing the recipient also blocks first outreach");
  const prior=await setup("prior"); const pe=evidence(prior); pe.checks[0].matches=1;
  assert.match(simulate(prior,pe,{},false).message,/Both Gmail|correspondence/);
  assert.match(simulate(prior,evidence(prior),{simulation:"prior_gmail_contact"},false).message,/Gmail already/);
  pass("personal/business search matches and live-service Gmail history guard reject prior contact");
  const weekend=await setup("weekend");
  assert.match(simulate(weekend,evidence(weekend),{testNow:`${localDate}T10:00:00-05:00`},false).message,/09:00/);
  pass("out-of-window delivery rejected without catch-up");
  const expiry=await setup("expiry"); const ee=evidence(expiry);
  await db.dailyOutreachPolicy.update({where:{propertyId:expiry.property},data:{expiresAt:new Date(Date.now()-1000)}});
  assert.equal(simulate(expiry,ee,{},false).errorCode,"APPROVAL_REQUIRED");
  pass("expired policy rejects a previously prepared send");
  const paused=await setup("paused"); const pae=evidence(paused);
  assert.equal(transport(cms,"/api/daily-outreach-policy",{action:"pause"},paused.admin).body.success,true);
  assert.equal(simulate(paused,pae,{},false).errorCode,"APPROVAL_REQUIRED");
  pass("human pause immediately blocks machine send");
  const happy=await setup("happy"); const sent=simulate(happy);
  const receipt=tool("get_email_send_attempt",{attemptId:sent.attemptId},happy.agent);
  assert.equal(receipt.approvalMode,"policy"); assert.equal(receipt.simulated,true); assert.equal(receipt.dailyOutreachKey,`${happy.property}:${localDate}`);
  assert.ok(receipt.outreachEvidence.workerEvidence.checks.length>1);
  assert.match(simulate(happy,evidence(happy),{requestId:"new-id"},false).message,/attempt already exists/);
  pass("approved simulated send persists policy/evidence and daily claim; changing request ID cannot send twice");
  const uncertain=await setup("uncertain"); const ue=evidence(uncertain);
  assert.match(simulate(uncertain,ue,{simulation:"timeout"},false).message,/locked against retries/);
  assert.match(simulate(uncertain,ue,{},false).message,/attempt already exists/);
  pass("uncertain daily send remains locked");
  const race=await setup("race"); const re=evidence(race);
  const payload={input:{draftId:race.draft.id,requestId:"race",outreachEvidence:re,simulation:"success",testNow:testTime.toISOString()}};
  const otherAccount=tool("create_partner_account",{name:"Acme second race",type:"operator",email:"second-race@example.invalid"},race.admin);
  const otherDraft=tool("save_partner_email_draft",{...race.draftInput,organizationId:otherAccount.id,toEmail:otherAccount.email,body:"Hello Acme second race,\nAcme invitation for two representatives."},race.agent);
  const otherEvidence=evidence({...race,account:otherAccount,draft:otherDraft});
  const first=transport(cms,"/api/tools/simulate_daily_outreach_send",payload,race.agent,true);
  const second=transport(cms,"/api/tools/simulate_daily_outreach_send",{input:{...payload.input,draftId:otherDraft.id,requestId:"different-race",outreachEvidence:otherEvidence}},race.agent,true);
  const results=[await first,await second];
  assert.ok(results.some(r=>r.body.success));
  assert.equal(await db.emailSendAttempt.count({where:{propertyId:race.property}}),1);
  pass("concurrent requests for different recipients create exactly one durable provider attempt");
  const live = tool("send_partner_email_draft",{draftId:a.draft.id,requestId:"live-block",outreachEvidence:evidence(a)},a.agent,false);
  assert.match(live.message,/External email sending is disabled/);
  assert.equal(await db.emailSendAttempt.count({where:{propertyId:{in:fixture.properties},simulated:false}}),0);
  pass("live Gmail delivery remains blocked throughout Test");
  writeFileSync("/tmp/cms-daily-uat-report.json",JSON.stringify({url:cms,hub,passed,emailsSent:0,fixturePrefix:fixture.prefix}),{mode:0o600});
  console.log(JSON.stringify({passed:passed.length,emailsSent:0,url:cms}));
} finally {
  await db.dailyOutreachPolicy.updateMany({where:{propertyId:{in:fixture.properties}},data:{enabled:false}});
  await db.partnerOrganization.updateMany({where:{propertyId:{in:fixture.properties}},data:{archivedAt:new Date()}});
  await db.$disconnect();
}
