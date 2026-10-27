import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const { collectMailboxChecks } = createRequire(import.meta.url)("../scripts/outreach-mailbox-checks.cjs");

const empty = { isError: false, structuredContent: { message_ids: [], next_page_token: null } };
const limited = { isError: true, structuredContent: { error_code: "FORBIDDEN", error_data: { reason: "RATE_LIMIT_EXCEEDED" } } };
const preflight = { date: "2026-10-27", snapshot: "fresh-snapshot", dailySentQuery: "in:sent from:info@owlswatch.com after:1793077200 before:1793163600",
  queries: ["in:anywhere {\"Acme\" from:acme@example.invalid}", "in:sent from:info@owlswatch.com after:1793077200 before:1793163600"],
  policy: { businessMailbox: "work@example.invalid", personalMailbox: "personal@example.invalid" } };
const mailboxes = [{ email: "work@example.invalid", linkId: "work" }, { email: "personal@example.invalid", linkId: "personal" }];
type Query = { link_id: string; query: string; max_results: number };
function setup(search: (q: Query, index: number) => unknown = () => empty, date = "2026-10-27T14:05:00Z") {
  let time = Date.parse(date);
  const calls: Query[] = [], waits: number[] = [];
  return { calls, waits, advance: (ms: number) => { time += ms; },
    options: { preflight, mailboxes, now: () => time,
      sleep: async (ms: number) => { waits.push(ms); time += ms; },
      search: async (q: Query) => { calls.push(q); return search(q, calls.length); } } };
}

test("reads daily Sent first in both verified mailboxes and records exact real queries", async () => {
  const run = setup();
  const result = await collectMailboxChecks({ ...run.options, extraQueries: ['in:anywhere "Acme alias"'] });
  assert.equal(run.calls.length, 6);
  assert.deepEqual(run.calls.slice(0, 2).map(q => q.query), [preflight.dailySentQuery, preflight.dailySentQuery]);
  assert.ok(run.calls.every(q => q.max_results === 1));
  assert.equal(result.checks.length, 6);
  assert.equal(result.snapshot, preflight.snapshot);
  assert.equal(result.birdingConfirmed, undefined);
  assert.ok(result.checks.every((c: { matches: number; complete: boolean }) => c.matches === 0 && c.complete === true));
});
test("temporary read throttling retries only that query with bounded backoff", async () => {
  const run = setup((q, i) => i <= 2 ? limited : empty);
  const result = await collectMailboxChecks(run.options);
  assert.deepEqual(run.waits, [30_000, 60_000]);
  assert.equal(result.retries, 2);
  assert.deepEqual(run.calls[0], run.calls[1]);
  assert.deepEqual(run.calls[1], run.calls[2]);
  assert.equal(result.checks.length, 4);
});
test("persistent throttling fails closed after three retries without a send or new candidate", async () => {
  const run = setup(() => limited);
  await assert.rejects(collectMailboxChecks(run.options), /failed or was incomplete/);
  assert.deepEqual(run.waits, [30_000, 60_000, 120_000]);
  assert.equal(run.calls.length, 4);
});
test("errors, partial pagination and unrecognized connector results never become empty evidence", async () => {
  for (const result of [
    { isError: true, structuredContent: { error_code: "UNAUTHORIZED" } },
    { isError: true, structuredContent: { error_code: "FORBIDDEN" } },
    { isError: false, structuredContent: { message_ids: [], next_page_token: "more" } },
    { isError: false, structuredContent: { message_ids: [] } },
    { structuredContent: { message_ids: [], next_page_token: null } },
    { isError: false, structuredContent: { resultSizeEstimate: 0 } },
  ]) {
    const run = setup(() => result);
    await assert.rejects(collectMailboxChecks(run.options), /failed or was incomplete/);
    assert.equal(run.calls.length, 1);
    assert.deepEqual(run.waits, []);
  }
  const run = setup(() => { throw new Error("Transport failed"); });
  await assert.rejects(collectMailboxChecks(run.options), /Transport failed/);
  assert.equal(run.calls.length, 1);
});
test("any actual daily Sent or prior-contact match blocks and returns no usable checks", async () => {
  for (const position of [1, 2, 3, 4]) {
    const run = setup((q, i) => i === position ? { isError: false, structuredContent: { message_ids: ["found"], next_page_token: "more-matches" } } : empty);
    const result = await collectMailboxChecks(run.options);
    assert.equal(result.blocked, position < 3 ? "daily_sent" : "prior_contact");
    assert.equal(result.checks, undefined);
    assert.equal(run.calls.length, position);
  }
});
test("successes older than four minutes are actually searched again after slow reads", async () => {
  const run = setup((q, i) => { if (i === 4) run.advance(241_000); return empty; });
  const result = await collectMailboxChecks(run.options);
  assert.equal(run.calls.length, 7);
  assert.ok(result.checks.every((c: { checkedAt: string }) => run.options.now() - Date.parse(c.checkedAt) < 240_000));
});
test("wrong profiles, duplicate connectors and incomplete plans fail before reads", async () => {
  for (const change of [
    { mailboxes: [mailboxes[0]] },
    { mailboxes: [mailboxes[0], { email: mailboxes[1].email, linkId: "work" }] },
    { mailboxes: [mailboxes[0], { email: "wrong@example.invalid", linkId: "personal" }] },
    { preflight: { ...preflight, queries: [preflight.dailySentQuery] } },
    { extraQueries: [""] },
  ]) {
    const run = setup();
    await assert.rejects(collectMailboxChecks({ ...run.options, ...change }));
    assert.equal(run.calls.length, 0);
  }
});
test("weekend, wrong date, early run and 09:29 cutoff fail before reads", async () => {
  for (const date of ["2026-10-27T13:59:59Z", "2026-10-27T14:29:00Z", "2026-10-28T14:05:00Z", "2026-10-24T14:05:00Z"]) {
    const run = setup(() => empty, date);
    await assert.rejects(collectMailboxChecks(run.options));
    assert.equal(run.calls.length, 0);
  }
});
test("cutoff during backoff or a search and total eight-minute budget fail closed", async () => {
  const late = setup(() => limited, "2026-10-27T14:28:40Z");
  await assert.rejects(collectMailboxChecks(late.options), /deadline/);
  assert.deepEqual(late.waits, []);
  const slow = setup(() => { slow.advance(480_000); return empty; });
  await assert.rejects(collectMailboxChecks(slow.options), /budget\/cutoff/);
  assert.equal(slow.calls.length, 1);
  const oversleep = setup(() => limited, "2026-10-27T14:28:00Z");
  await assert.rejects(collectMailboxChecks({ ...oversleep.options, sleep: async () => oversleep.advance(61_000) }), /budget\/cutoff/);
  assert.equal(oversleep.calls.length, 1);
});
