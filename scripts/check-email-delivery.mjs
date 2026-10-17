import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const origin = "https://partners-env-test-dennis-projects-b028c121.vercel.app";
if (process.env.TEST_BASE_URL && process.env.TEST_BASE_URL !== origin) throw new Error("This UAT only supports the stable CMS test environment.");
if (process.env.VERCEL_TARGET_ENV !== "test" || !process.env.OW_INTERNAL_SHARED_SECRET) throw new Error("Load the Vercel test environment first.");
if (process.env.OW_PARTNERS_ALLOW_LIVE_EMAIL_SENDS?.toLowerCase() === "true") throw new Error("Disable live sending before UAT.");
const run = randomUUID();
const created = [];
const passed = [];
const headers = {
  "x-ow-internal-secret": process.env.OW_INTERNAL_SHARED_SECRET,
  "x-ow-user-id": "email-safeguards-uat", "x-ow-user-name": "Acme UAT",
  "x-ow-user-role": "admin", "x-ow-property-id": "owlswatch", "content-type": "application/json",
};
function request(path, input, extraHeaders = {}) {
  const config = [`request = "${input === undefined ? "GET" : "POST"}"`, ...Object.entries({ ...headers, ...extraHeaders }).filter(([,v]) => v).map(([k,v]) => `header = ${JSON.stringify(`${k}: ${v}`)}`)];
  if (input !== undefined) config.push(`data = ${JSON.stringify(JSON.stringify({ input }))}`);
  const result = spawnSync("vercel", ["curl", path, "--deployment", origin, "--", "--silent", "--show-error", "--include", "--max-time", "45", "--config", "-"], { input: config.join("\n"), timeout: 60000 });
  if (result.status !== 0) throw new Error(`Transport failed: ${path}`);
  const raw = result.stdout;
  const split = raw.indexOf("\r\n\r\n");
  if (split < 0) throw new Error("Missing HTTP response");
  return { status: Number(/^HTTP\/\S+\s+(\d+)/m.exec(raw.subarray(0, split).toString())?.[1]), bytes: raw.subarray(split + 4) };
}
function tool(name, input, expected = true, overrides = {}) {
  const response = request(`/api/tools/${name}`, input, overrides);
  const body = JSON.parse(response.bytes.toString());
  assert.equal(body.success, expected, `${name}: ${body.message || response.status}`);
  return expected ? body.data : body;
}
function pass(name) { passed.push(name); console.log(`PASS ${name}`); }
function upload(input, content) {
  const path = `/tmp/cms-attachment-${run}.pdf`;
  fs.writeFileSync(path, content, { mode: 0o600 });
  try {
    const config = [...Object.entries(headers).filter(([key]) => key !== "content-type").map(([key,value]) => `header = ${JSON.stringify(`${key}: ${value}`)}`), `form-string = ${JSON.stringify(`input=${JSON.stringify(input)}`)}`, `form = ${JSON.stringify(`attachment=@${path};filename=Acme-large-2027.pdf;type=application/pdf`)}`].join("\n");
    const result = spawnSync("vercel", ["curl", "/api/tools/save_partner_email_draft", "--deployment", origin, "--", "--silent", "--show-error", "--max-time", "60", "--config", "-"], { input: config, timeout: 75000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0);
    const body = JSON.parse(result.stdout.toString());
    assert.equal(body.success, true, body.message);
    return body.data;
  } finally { fs.unlinkSync(path); }
}
const content = Buffer.from("%PDF-1.7\nAcme synthetic UAT attachment\n%%EOF");
const attachment = { filename: "Acme-rates-2027.pdf", contentType: "application/pdf", base64: content.toString("base64") };
function account(suffix) {
  const data = tool("create_partner_account", { name: `Acme UAT ${suffix} ${run.slice(0, 8)}`, email: `acme-${run}-${suffix}@example.invalid`, source: "email-safeguards-uat" });
  created.push(data.id);
  return data;
}
function draft(account, extra = {}) {
  return tool("save_partner_email_draft", { organizationId: account.id, toEmail: account.email, subject: "Acme UAT", body: "Synthetic test only.", firstOutreach: true, attachment, ...extra });
}
function simulate(draftId, requestId, simulation = "success", expected = true) {
  return tool("simulate_email_draft_send", { draftId, requestId, simulation }, expected);
}
try {
  const a = account("attachment");
  let d = draft(a);
  const sha = createHash("sha256").update(content).digest("hex");
  assert.equal(d.attachmentSha256, sha);
  assert.equal("attachmentContent" in d, false);
  assert.equal(tool("get_partner_email_draft", { draftId: d.id }).attachmentSha256, sha);
  assert.deepEqual(request(`/api/email-drafts/${d.id}/attachment`).bytes, content);
  pass("saved attachment survives reload and downloads byte-for-byte without leaking bytes in metadata");
  const largePdf = Buffer.alloc(4374915, 32);
  content.copy(largePdf);
  const large = upload({ organizationId: a.id, draftId: d.id, toEmail: a.email, subject: "Acme UAT", body: "Synthetic large PDF only." }, largePdf);
  assert.equal(large.attachmentSha256, createHash("sha256").update(largePdf).digest("hex"));
  assert.equal(large.attachmentSize, largePdf.length);
  d = draft(a, { draftId: d.id });
  pass("4.4 MB original PDF uploads as binary multipart without base64 request expansion");
  d = draft(a, { draftId: d.id, attachment: undefined, body: "Edited without changing the file." });
  assert.equal(d.attachmentSha256, sha);
  pass("text-only draft update preserves attachment");
  d = draft(a, { draftId: d.id, attachment: { ...attachment, base64: Buffer.from("%PDF-1.7 replacement").toString("base64") } });
  assert.notEqual(d.attachmentSha256, sha);
  d = draft(a, { draftId: d.id, attachment: null });
  assert.equal(d.attachmentName, null);
  assert.equal(request(`/api/email-drafts/${d.id}/attachment`).status, 404);
  pass("attachment replacement and explicit removal persist");
  assert.match(simulate(d.id, `${run}-missing-pdf`, "success", false).message, /PDF attachment/);
  pass("first outreach without PDF is blocked");
  d = draft(a, { draftId: d.id });
  tool("get_partner_email_draft", { draftId: d.id }, false, { "x-ow-property-id": "uat-other-property" });
  assert.equal(request(`/api/email-drafts/${d.id}/attachment`, undefined, { "x-ow-property-id": "uat-other-property" }).status, 404);
  pass("cross-property draft and attachment reads denied");
  assert.match(tool("send_partner_email_draft", { draftId: d.id, requestId: `${run}-blocked-live` }, false).message, /External email sending is disabled/);
  pass("live sends remain blocked in test");
  const payload = Buffer.from(JSON.stringify({ iss: "owhub", typ: "agent_access", aud: "partners", agentId: "uat-agent", credentialId: "uat-key", actorLabel: "Acme UAT", permissions: ["partners.admin", "partners.outreach.send"], propertyIds: ["owlswatch"], allowedToolClassifications: ["restricted"], activePropertyId: "owlswatch", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300, jti: run })).toString("base64url");
  const token = `${payload}.${createHmac("sha256", process.env.OW_AGENT_TOKEN_SECRET.trim()).update(payload).digest("base64url")}`;
  const denied = tool("send_partner_email_draft", { draftId: d.id, requestId: `${run}-agent` }, false, { "x-ow-internal-secret": "", authorization: `Bearer ${token}` });
  assert.equal(denied.errorCode, "APPROVAL_REQUIRED");
  pass("scoped agent cannot send before approval");
  const first = simulate(d.id, `${run}-once`);
  assert.equal(first.reused, false);
  assert.equal(simulate(d.id, `${run}-once`).providerMessageId, first.providerMessageId);
  assert.equal(simulate(d.id, `${run}-different-request`).reused, true);
  pass("same request and different request with identical content reuse one receipt");
  d = draft(a, { draftId: d.id, body: "Changed after delivery." });
  assert.match(simulate(d.id, `${run}-once`, "success", false).message, /different email/);
  assert.match(simulate(d.id, `${run}-new-body`, "success", false).message, /earlier delivery attempt/);
  pass("request mutation and second first-outreach attempt blocked");
  const b = account("history");
  const bd = draft(b);
  tool("update_partner_status", { organizationId: b.id, status: "contacted", visitStatus: "never_invited" });
  assert.match(simulate(bd.id, `${run}-history`, "success", false).message, /contact or visit history/);
  pass("existing CMS contact history blocked");
  const c = account("uncertain");
  const cd = draft(c);
  assert.match(simulate(cd.id, `${run}-gmail-history`, "prior_gmail_contact", false).message, /Gmail already contains correspondence/);
  pass("existing Gmail correspondence blocked even without CMS history");
  assert.match(simulate(cd.id, `${run}-uncertain`, "timeout", false).message, /locked against retries/);
  assert.equal(tool("get_email_send_attempt", { requestId: `${run}-uncertain` }).state, "uncertain");
  assert.match(simulate(cd.id, `${run}-uncertain`, "success", false).message, /pending or uncertain/);
  pass("uncertain delivery stays locked across requests");
  const e = account("after-send");
  const ed = draft(e);
  const failedSync = simulate(ed.id, `${run}-after-send`, "post_send_failure");
  assert.equal(failedSync.stored, false);
  assert.ok(failedSync.warning);
  const replay = simulate(ed.id, `${run}-after-send`);
  assert.equal(replay.reused, true);
  assert.equal(replay.providerMessageId, failedSync.providerMessageId);
  pass("post-send sync failure retains receipt; retry reconciles without another send");
  const review = tool("save_partner_email_draft", { reviewOnly: true, toEmail: "wrong@example.invalid", subject: "Review UAT", body: "Acme review only", attachment });
  assert.equal(review.organizationId, null);
  assert.equal(review.toEmail, "reviewer@example.invalid");
  const reviewed = simulate(review.id, `${run}-review`);
  const reviewAttempt = tool("get_email_send_attempt", { attemptId: reviewed.attemptId });
  assert.equal(reviewAttempt.reviewOnly, true);
  assert.equal(reviewAttempt.organizationId, null);
  assert.equal(reviewAttempt.toEmail, "reviewer@example.invalid");
  pass("review recipient is fixed and review does not modify an operator");
  fs.writeFileSync("/tmp/cms-email-uat-fixtures.json", JSON.stringify({ run, organizationId: a.id, draftId: d.id, created, passed }), { mode: 0o600 });
  console.log(JSON.stringify({ environment: "test", url: origin, passed: passed.length, emailsSent: 0, fixtureReport: "/tmp/cms-email-uat-fixtures.json" }));
} finally {
  for (const id of created) {
    if (process.argv.includes("--keep-ui-fixture") && id === created[0]) continue;
    tool("archive_partner_account", { organizationId: id });
  }
}
