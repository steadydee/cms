import assert from "node:assert/strict";
import test from "node:test";
import { assertNeverContacted, attachmentFields, deliverEmailOnce, deliveryAttemptIds, emailAddress, emailPayloadHash, priorContactQuery, type DeliveryClaim } from "../src/lib/email-delivery";

const pdf = Buffer.from("%PDF-1.7\nAcme test document\n%%EOF");

test("review sync identifies the original send and reply references without trusting subject text", () => {
  assert.deepEqual(deliveryAttemptIds([null, "<cmtest123@mail.owlswatch.com>", "<unrelated@example.invalid> <cmtest123@mail.owlswatch.com> <cmtest456@mail.owlswatch.com>"]), ["cmtest123", "cmtest456"]);
  assert.deepEqual(deliveryAttemptIds(["[REVIEW ONLY]", "<cmtest123@mail.owlswatch.com.attacker.invalid>"]), []);
});

test("draft attachment persists exact bytes and a checksum; omission preserves it and null removes it", () => {
  const saved = attachmentFields({ filename: "rates-2027.pdf", contentType: "application/pdf", content: pdf, size: pdf.length });
  assert.deepEqual(Buffer.from(saved.attachmentContent!), pdf);
  assert.equal(saved.attachmentSha256?.length, 64);
  assert.equal(saved.attachmentSize, pdf.length);
  assert.deepEqual(attachmentFields(undefined), {});
  assert.equal(attachmentFields(null).attachmentContent, null);
  assert.notEqual(saved.attachmentSha256, attachmentFields({ filename: "rates-2027.pdf", content: Buffer.from("replacement"), size: 11 }).attachmentSha256);
});

test("rejects empty, oversized, mislabeled-size and header-injection attachments", () => {
  const attachment = { filename: "rates.pdf", content: pdf, size: pdf.length };
  assert.throws(() => attachmentFields({ ...attachment, content: Buffer.alloc(0), size: 0 }));
  assert.throws(() => attachmentFields({ ...attachment, size: 1 }));
  assert.throws(() => attachmentFields({ ...attachment, content: Buffer.alloc(10 * 1024 * 1024 + 1), size: 10 * 1024 * 1024 + 1 }));
  assert.throws(() => attachmentFields({ ...attachment, filename: "rates.pdf\r\nBcc: other@example.invalid" }));
});

test("recipient parsing rejects multiple recipients and Gmail-query injection", () => {
  assert.equal(emailAddress(" Test+review@Example.invalid "), "test+review@example.invalid");
  for (const value of ["a@example.invalid,b@example.invalid", "a@example.invalid\r\nBcc:x@example.invalid", "a}from:x@example.invalid"]) assert.throws(() => emailAddress(value));
  assert.equal(priorContactQuery(["a@example.invalid", "A@example.invalid"]), "in:anywhere {from:a@example.invalid to:a@example.invalid}");
});

test("content fingerprint is stable and changes for attachment, recipient, and review mode", () => {
  assert.equal(emailPayloadHash({ body: "Hello", to: "a@example.invalid" }), emailPayloadHash({ to: "a@example.invalid", body: "Hello" }));
  const original = { body: "Hello", to: "a@example.invalid", sha: "one", reviewOnly: false };
  for (const change of [{ sha: "two" }, { to: "b@example.invalid" }, { reviewOnly: true }]) assert.notEqual(emailPayloadHash(original), emailPayloadHash({ ...original, ...change }));
});

test("never-contacted check rejects status, visit, contact timestamps, all touches and email history", () => {
  const account = { status: "not_contacted", archivedAt: null, lastContactedAt: null, visitStatus: "never_invited", lastVisitedAt: null, contacts: [], _count: { touches: 0, emailMessages: 0, emailThreads: 0 } };
  assert.doesNotThrow(() => assertNeverContacted(account));
  const changes = [
    { status: "not_interested" }, { status: "active_partner" }, { archivedAt: new Date() },
    { lastContactedAt: new Date() }, { visitStatus: "invited" }, { lastVisitedAt: new Date() },
    { contacts: [{ lastContactedAt: new Date() }] },
    ...["touches", "emailMessages", "emailThreads"].map((key) => ({ _count: { ...account._count, [key]: 1 } })),
  ];
  for (const change of changes) assert.throws(() => assertNeverContacted({ ...account, ...change }));
});

function fixture(failure?: "delivery" | "receipt") {
  let record: DeliveryClaim | null = null;
  let sends = 0;
  const receipt = { providerMessageId: "gmail-one", providerThreadId: "thread-one" };
  const dependencies = {
    claim: async () => {
      if (record) return { ...record, fresh: false };
      record = { id: "claim-one", fresh: true, state: "pending", providerMessageId: null, providerThreadId: null };
      return { ...record };
    },
    send: async () => { sends++; if (failure === "delivery") throw new Error("Accepted but connection lost"); return receipt; },
    accepted: async () => { if (failure === "receipt") throw new Error("DB unavailable"); Object.assign(record!, receipt, { state: "sent" }); },
    uncertain: async () => { record!.state = "uncertain"; },
  };
  return { dependencies, sends: () => sends, record: () => record };
}

test("successful replay returns original receipt and never sends again", async () => {
  const f = fixture();
  const first = await deliverEmailOnce(f.dependencies);
  const second = await deliverEmailOnce(f.dependencies);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(first.providerMessageId, second.providerMessageId);
  assert.equal(f.sends(), 1);
});

test("concurrent duplicate calls invoke the provider once", async () => {
  const f = fixture();
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => deliverEmailOnce(f.dependencies)));
  assert.ok(results.some((r) => r.status === "fulfilled"));
  assert.equal(f.sends(), 1);
});

test("uncertain provider result is locked and cannot be retried", async () => {
  const f = fixture("delivery");
  await assert.rejects(deliverEmailOnce(f.dependencies), /locked against retries/);
  await assert.rejects(deliverEmailOnce(f.dependencies), /pending or uncertain/);
  assert.equal(f.record()?.state, "uncertain");
  assert.equal(f.sends(), 1);
});

test("provider acceptance followed by receipt DB failure still cannot resend", async () => {
  const f = fixture("receipt");
  await assert.rejects(deliverEmailOnce(f.dependencies), /accepted the email/);
  await assert.rejects(deliverEmailOnce(f.dependencies), /pending or uncertain/);
  assert.equal(f.sends(), 1);
});

test("claim failure prevents calling the provider", async () => {
  const f = fixture();
  await assert.rejects(deliverEmailOnce({ ...f.dependencies, claim: async () => { throw new Error("Prior outreach"); } }), /Prior outreach/);
  assert.equal(f.sends(), 0);
});
