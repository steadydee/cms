# Partners Agent Access

Hub issues agent tokens; Partners verifies them. Within each environment, Partners'
`OW_AGENT_TOKEN_SECRET` must equal Hub's current signing value. Test and production
must retain separate secrets. Never rotate Hub's value to repair a downstream mismatch,
and never put a signing secret on an outreach worker. Updating Vercel configuration
requires a new Partners deployment before it takes effect.

Use [Hub machine auth](../../owhub/docs/machine-auth-and-scope-spec.md) and the
[Partners interface guide](partners-agent-interface-implementation.md).

## Read-Only Verification

Use a dedicated Hub agent key scoped to `partners.organizations.read`, the `read`
classification, and property `owlswatch`. Supply the raw key through a protected
environment/secret store as `HUB_AGENT_KEY`; never put it in a command argument or logs.

- `pnpm test:agent-access` checks the stable deployed Hub and Partners test URLs.
- `pnpm test:agent-access --production-read-only` checks the production URLs.
- For Vercel-protected test deployments, supply the respective
  `HUB_VERCEL_AUTOMATION_BYPASS_SECRET` / `CMS_VERCEL_AUTOMATION_BYPASS_SECRET`
  through the secret store, or run the same checker with authenticated `vercel curl`
  as its request transport. Vercel protection and CMS bearer auth are separate layers.
- Deploy the current candidate to test first; a stale deployment is not valid UAT.
- The check exercises real Hub key exchange, CMS discovery, dashboard, account list,
  account details with contacts/touches, anonymous/invalid-token rejection, read-only
  send denial (metadata GET only), and out-of-scope property rejection.
- An existing fake account is required in test. Never copy production contacts into test.
- No send or mutation tools are invoked. Do not substitute a locally signed token for
  real Hub exchange, because that would fail to test the issuing service.
- Revoke temporary verification credentials after use. Do not revoke the outreach
  agent's existing key or change its grants as part of this check.

## Outreach Handoff: October 4, 2026

The access repair does not implement or activate outreach. Dennis's agreed settings:

- One email per weekday at 09:00 `America/Bogota`, never-contacted operators only.
- English/Spanish messages, sent from the verified `info@owlswatch.com` alias.
- Controlled through CMS, with the worker running on the Mac mini.
- Use the existing Gmail service, not the legacy Resend `send_intro_email` tool.
- Preserve the approved 2027 PDF with the prepared email; current saved drafts do
  not retain attachments.
- Add durable duplicate-send protection and check prior outreach before sending.
- Any later live test emails go only to Dennis's personal Gmail before activation.
  This access-repair task sends no email at all.

Before activation, recheck mailbox sync health and complete the sending/attachment/
duplicate-protection work separately. Do not infer eligibility from status alone.
