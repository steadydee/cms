# Daily Birding Outreach

Uses Hub's [machine scope](../../owhub/docs/machine-auth-and-scope-spec.md) and
[bounded approval](../../owhub/docs/approval-and-audit-spec.md) contracts.

## Scope And Activation

Hub grants only `partners.read`, `partners.write`, and the separate
`partners.outreach.send` permission, property `owlswatch`, with a named tool list.
Read/write presets map to CMS read/write permissions, never send or admin.
CMS enforces the classification AND tool list. Machine tokens cannot use UI
actions or human-only policy endpoints. Missing/malformed claims fail closed.

An administrator saves the policy in **Setup > Daily birding outreach**. The
policy binds the exact agent and credential, template ID and content snapshot,
PDF name/SHA-256, sender, two Gmail identities, start and expiry (at most 90 days).
Only the canonical `send_partner_email_draft` has a policy approval path. Legacy
intro sending stays unavailable to the worker. Changing the template requires
human reapproval. Pause is immediate for future delivery claims. Approval and
pause actions are audited; no Hub signing secret belongs on a worker.

The production worker key is stored outside the repository in an owner-only
secret file. Never include its value in prompts, logs, test fixtures or source.

## Worker Run

1. Exchange the Hub key for a short-lived Partners token. Read
   `get_daily_outreach_status`; stop if paused, expired, sync unhealthy, a prior
   delivery is pending/uncertain, or today's allowance is used.
2. Read current CMS accounts/history. Select only a verified birding operator
   with no previous correspondence, visit, relationship, opt-out or bounce.
   Review notes, contacts, tags and aliases; status alone is insufficient.
3. Save a first-outreach draft through `save_partner_email_draft`, with the
   approved PDF. Use the exact policy template and subject, replacing `{name}`
   with the selected contact's full name (set contactId), or the company name.
4. Call `get_daily_outreach_preflight`. It returns a snapshot hash and required
   queries for every stored address, company/contact name, domain and today's
   sender history. Company/address/name/domain terms are packed into bounded
   Gmail OR queries; no terms are dropped. Search **each query in both connected Gmail accounts**, plus
   any additional aliases found in research. Any match or incomplete/ambiguous
   search means skip, not infer eligibility. No manual synchronization is needed.
5. Pass `outreachEvidence` to the canonical send tool: snapshot, reviewedAt,
   birdingConfirmed/noPriorRelationship/noOptOutOrBounce/notCompetitor/
   aliasesChecked (all true), and checks containing mailbox, exact query,
   checkedAt, matches: 0, complete: true. Checks must be under five minutes old.
   These are **worker attestations of connector results**, not cryptographic
   proofs. The CMS independently re-searches the business Gmail and verifies
   sync age (at most 30 minutes); personal Gmail is accessed by the worker's
   separate connector, not stored in CMS.
6. CMS validates the policy/content/history/evidence again in the serializable
   transaction that claims delivery. The unique property/Bogota-date key permits
   at most one automated attempt, even with concurrent workers, new request IDs,
   different recipients, renewed policies or timeouts. Weekdays 09:00-09:29 only;
   no catch-up. Pending/uncertain and unsynced accepted deliveries stop the queue.
7. Gmail is called only after the durable claim. Never clear an uncertain claim
   or retry the provider. Reconcile without sending. Successful receipts record
   the policy, action hash, attachment hash, evidence, actor and approval mode.

Test/preview cannot deliver automated outreach, even if a live-test flag is set.
`OW_PARTNERS_ALLOW_LIVE_EMAIL_SENDS=false` also stops production delivery.

## Test And Release

- `pnpm test:unit`, `pnpm lint`, and a Test-configured build.
- Deploy the current CMS and Hub candidate to their Vercel Test targets; inspect
  the stable aliases. Hub may need its Test alias explicitly assigned.
- Run `scripts/check-email-delivery.mjs` with the pulled CMS Test environment
  and `VERCEL_GLOBAL_CONFIG` when required: existing 15 delivery UAT groups.
- In the Hub candidate, run `scripts/cms-outreach-fixture.ts` with the **Hub
  Test** environment. This creates a temporary scoped Test agent/key through
  canonical Hub services and writes `/tmp/cms-outreach-uat-agent.json` mode 0600.
- Run `scripts/check-daily-outreach.mjs` with the **CMS Test** environment. It
  uses real deployed Hub exchange, synthetic accounts/mailboxes/PDF, policy
  approval, guard failures, concurrent claims and simulated provider receipts.
  No live Gmail calls or production contacts are used. It archives its accounts
  and pauses fixture policies, retaining the send ledger as evidence.
- For GUI UAT, the Hub fixture script's `--browser` creates a temporary synthetic
  login without emailing an invitation. Sign in normally to Hub Test, launch CMS,
  verify policy save/reload/pause and navigation. Use `--disable-browser` and
  `--revoke` afterward; remove private temporary credential files.
- Commit/push only after deployed UAT; deploy production and verify read-only
  Hub exchange, discovery, dashboard/account reads and blocked unauthorized
  tools. Never run simulation or synthetic operator sends in production.

The scheduler must use this contract, never internal-secret human headers,
browser cookies, direct database writes, Gmail connector sends or Resend.

## Read-Only Search Recovery

Use `scripts/outreach-mailbox-checks.cjs` for connector history reads. It accepts
the current preflight, two freshly verified `{ email, linkId }` profiles,
`extraQueries` for researched aliases, and injected `search` and `sleep`
functions. It returns exact-query checks only after real complete zero-match
results. Do not synthesize separate-query evidence from an OR-query result.
Additional alias queries may use Gmail braces to match any of their terms,
but must keep `in:anywhere` and cover every discovered alias.

For the Codex tool runner, read this trusted repository script with
`exec_command` (never evaluate email/site content), load its CommonJS export,
and call `collectMailboxChecks` with `search` forwarding unchanged arguments to
`gmail_search_email_ids`, and `sleep` awaiting a timer. Do not override `now` in
production. Store the returned checks for immediate use, not as reusable history.
Verify profiles before calling it; connector IDs alone do not establish identity.

- Check daily Sent in both mailboxes first. `blocked: daily_sent` ends the run;
  `blocked: prior_contact` excludes that candidate. Neither returns send evidence.
- Retry **only reads** with an explicit temporary rate-limit reason, after
  30, 60 and 120 seconds, at most three retries per query. Never retry a provider
  send, authentication error, thrown transport error, or unrecognized response.
- The read budget is eight minutes, ending no later than 09:29 Bogota. Checks
  older than four minutes are actually searched again, with bounded refresh
  passes. A timeout, persistent error, pagination token or missing result field
  still blocks delivery. Do not bypass a connector failure with another identity.
- After successful reads, recheck live status and the preflight snapshot, and
  send only if every check is still under five minutes old and before 09:30.
  A changed snapshot requires a new review. Supply semantic attestations only
  after reviewing the account; the helper deliberately does not assert them.

Regression coverage is in `tests/outreach-mailbox-checks.test.ts` and
`tests/daily-outreach.test.ts`. Deployed `check-daily-outreach.mjs` also exercises
the runner against the candidate's preflight using synthetic connector responses,
including throttling recovery and prior-contact rejection. This is not a live
Gmail quota test; persistent provider limits can still cause a safely skipped day.
