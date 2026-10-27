// Portable read-only runner: the worker supplies the actual Gmail connector and clock.
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];
const FRESH_MS = 4 * 60_000;
const BUDGET_MS = 8 * 60_000;

function temporaryLimit(result) {
  const data = result?.structuredContent;
  const error = data?.error_data;
  return result?.isError === true && [error?.reason, error?.code, data?.error_code]
    .some(code => ["RATE_LIMIT_EXCEEDED", "rateLimitExceeded", "userRateLimitExceeded"].includes(code));
}

async function collectMailboxChecks({ preflight, mailboxes, extraQueries = [], search, sleep, now = Date.now }) {
  const started = now();
  const dayStart = Date.parse(`${preflight.date}T09:00:00-05:00`);
  const cutoff = dayStart + 29 * 60_000;
  const deadline = Math.min(started + BUDGET_MS, cutoff);
  const expected = [preflight.policy.businessMailbox, preflight.policy.personalMailbox];
  if (!Number.isFinite(dayStart) || [0, 6].includes(new Date(dayStart).getUTCDay())
    || started < dayStart || started >= cutoff) throw new Error("Outside weekday outreach read window; no catch-up.");
  if (!preflight.snapshot || expected[0] === expected[1] || mailboxes.length !== 2
    || new Set(mailboxes.map(m => m.linkId)).size !== 2
    || expected.some(email => !mailboxes.some(m => m.email === email && m.linkId))) {
    throw new Error("Two verified policy mailbox profiles are required.");
  }
  if (!preflight.dailySentQuery || !Array.isArray(preflight.queries) || !preflight.queries.includes(preflight.dailySentQuery)
    || preflight.queries.length < 2 || !Array.isArray(extraQueries)) throw new Error("Incomplete preflight queries.");
  const queries = [...new Set([preflight.dailySentQuery, ...preflight.queries, ...extraQueries])];
  if (queries.some(q => typeof q !== "string" || !q.trim())) throw new Error("Invalid search query.");
  const checks = new Map();
  let retries = 0;
  const inTime = () => {
    if (now() >= deadline || now() < started) throw new Error("Mailbox read budget/cutoff reached; send nothing.");
  };
  const read = async (mailbox, query) => {
    for (let attempt = 0; ; attempt++) {
      inTime();
      // A thrown transport error is ambiguous, never a successful empty search.
      const result = await search({ link_id: mailbox.linkId, query, max_results: 1 });
      inTime();
      if (temporaryLimit(result) && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (now() + delay >= deadline) throw new Error("Rate limit cannot recover before the read deadline; send nothing.");
        retries++;
        await sleep(delay);
        continue;
      }
      const data = result?.structuredContent;
      if (result?.isError !== false || !Array.isArray(data?.message_ids)) throw new Error("Mailbox search failed or was incomplete; send nothing.");
      if (data.message_ids.length) return { blocked: query === preflight.dailySentQuery ? "daily_sent" : "prior_contact",
        mailbox: mailbox.email, query, retries };
      if (data.next_page_token !== null) throw new Error("Mailbox search failed or was incomplete; send nothing.");
      checks.set(`${mailbox.email}\n${query}`, { mailbox: mailbox.email, query, checkedAt: new Date(now()).toISOString(), matches: 0, complete: true });
      return null;
    }
  };
  // Daily Sent is checked in both mailboxes first. Refresh old successes after backoff.
  for (let pass = 0; pass < 3; pass++) {
    for (const query of queries) {
      for (const mailbox of mailboxes) {
        inTime();
        const check = checks.get(`${mailbox.email}\n${query}`);
        if (check && now() - Date.parse(check.checkedAt) < FRESH_MS) continue;
        const blocked = await read(mailbox, query);
        if (blocked) return blocked;
      }
    }
    inTime();
    if ([...checks.values()].every(c => now() - Date.parse(c.checkedAt) < FRESH_MS)) {
      return { snapshot: preflight.snapshot, reviewedAt: new Date(now()).toISOString(), checks: [...checks.values()], retries };
    }
  }
  throw new Error("Could not obtain fresh complete mailbox evidence; send nothing.");
}

module.exports = { collectMailboxChecks };
