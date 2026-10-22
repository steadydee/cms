# Gmail Delivery Safeguards

Follow the [Hub testing standard](../../owhub/docs/testing-standard.md) and
[approval/audit specification](../../owhub/docs/approval-and-audit-spec.md).

## Delivery Contract

- UI and machine draft sends use `sendAccountEmail`, the existing Gmail service.
  The legacy intro tool now uses that service too; no outreach path uses Resend.
- Drafts retain attachment bytes, filename, MIME type, size and SHA-256 in the
  database. Metadata responses omit bytes; authenticated, property-scoped download
  serves the original file. Omitting an attachment on save preserves it; `null`
  explicitly removes it. Replacement changes the checksum.
- The draft tool also accepts multipart `input` JSON plus an `attachment` file,
  avoiding base64 request expansion for the supplied 4.4 MB PDF. Vercel's request
  limit still applies; files larger than that need a separate upload design.
- A durable `EmailSendAttempt` is claimed before calling Gmail. Unique request and
  content keys prevent repeated requests, double clicks and concurrent copies.
  Changing content under an existing request ID is rejected.
- First outreach requires a PDF, a recipient on the account, no account/contact/
  visit/touch/email history, and no prior delivery attempt. Other accounts sharing
  those addresses are checked too. A live Gmail search checks all correspondence,
  including unlabeled, archived, spam and trash, before the claim. Search failure
  stops delivery. Unique account and recipient claims protect first outreach.
- A Gmail timeout is ambiguous: the record stays pending/uncertain and must never
  be automatically retried. After acceptance, receipt storage precedes labels and
  CMS import. Import failure is reported as sent-but-needs-sync, not as a failed
  send. `reconcile_email_send_attempt` looks up the deterministic Message-ID and
  repairs history without sending. No matching receipt leaves the claim locked.
- Review drafts have no operator association, always send to the configured
  `OW_PARTNERS_REVIEW_EMAIL`, use `info@owlswatch.com`, and prefix the subject with
  `[REVIEW ONLY]`. They require administrator access and a PDF. They cannot mark
  an operator contacted. Later Gmail sync also excludes the review and its reply
  thread, including recovery by Message-ID if the original receipt was lost.
  A review send is not campaign activation.
- Agent outbound calls remain `APPROVAL_REQUIRED` at both the tool and service
  boundaries. No schedule is created or enabled by this change. Activation must
  follow Dennis's review and establish a bounded approved policy, not remove the
  approval check or use a shared internal secret on a worker.

## Gmail Sync Recovery

- Gmail history can reference a message or tracked thread that has since been
  deleted in Gmail. A typed 404 from the matching individual GET is skipped and
  counted; existing CMS correspondence is retained. Authentication, quota,
  network, server and unrelated-resource errors still fail the sync.
- The sync cursor comes from the fetched history, or from the profile read before
  imports when recovering an expired history cursor. It must not advance to a
  profile read after imports, which could skip mail arriving during the run.
- `tests/gmail-sync.test.ts` covers deleted messages/threads followed by a valid
  reply, non-404 and unrelated-404 rejection, expired history recognition,
  paginated history and unlabeled tracked replies.
- For deployed sync smoke checks, Test must have its own `CRON_SECRET` and no
  connected real mailbox. Verify unauthenticated cron requests return 401 and
  authenticated requests report zero connected mailboxes. Never copy production
  Gmail credentials into Test. Verify real mailbox recovery in production through
  the normal sync job, not synthetic messages or a live-send test.

## Deployed Test Plan

1. Run `pnpm lint` and `pnpm test:ci` with the **test** environment injected.
   This build deliberately applies the additive migration to the test database.
2. Configure test review mail as `reviewer@example.invalid`. Keep external email
   sending disabled. Do not copy a production mailbox or contacts to test.
3. Deploy the current candidate to Vercel target `test`; inspect the stable alias
   to confirm the exact candidate is Ready.
4. Run `pnpm test:uat` with the pulled test environment. It uses authenticated
   `vercel curl` for deployment protection. It refuses production targets or an
   enabled live-send flag. All records use `Acme` and `.invalid` addresses.
   `VERCEL_GLOBAL_CONFIG` may point at a protected CLI config directory; never
   pass the token itself in command arguments or commit it to the repository.
5. The UAT covers byte-for-byte attachment reload/download, edit-preserve/replace/
   remove, property isolation, missing PDF, blocked live sends, agent approval,
   duplicate replay, changed request payload, prior CMS/Gmail history, uncertain
   delivery, post-send import failure and isolated review drafts. Simulation uses
   the normal claim/receipt pipeline but never contacts Gmail. Production rejects
   simulation regardless of caller privilege.
6. For browser UAT, add `--keep-ui-fixture` to the script. Open the resulting test
   account, load its saved draft, replace/save/reload/download the PDF, remove it,
   and verify desktop/mobile layout and console errors. The fixture IDs are in
   `/tmp/cms-email-uat-fixtures.json`. Archive the retained fixture after testing.
7. Push only after those gates pass, verify the production deployment and its
   restricted-agent/simulation rejection. Send an explicitly authorized review
   only to the configured personal mailbox; verify its attachment checksum and
   exact single delivery. Never use an operator as the test recipient.

The send ledger is deliberately retained for audit, even when a draft/account is
removed. Do not delete pending/uncertain claims to force a retry.
