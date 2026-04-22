# Owl's Watch Partners

This repo is the starting point for the Owl's Watch **Partners CRM** app.

## What This App Is

This is not a traditional CMS.

The immediate business need is partner and outreach management:

- operators
- agencies
- contacts
- outreach history
- visit tracking
- follow-up tasks
- campaign segments

So this repo should become the Owl's Watch **Partners** app.

## Platform Role

Within the Owl's Watch platform:

- `Hub` owns login, shell, invites, and handoff
- `PMS` owns reservations and finance truth
- `Chatbot` owns guest conversation workflow
- `Partners` owns operator and agency relationship workflow
- a true `CMS` can still exist later for reusable content and assets

## Current Goal

Build a lightweight CRM for outreach campaigns so Owl's Watch can track:

- who exists
- who has been contacted
- who has not been contacted
- who has visited
- who has not visited
- what outreach happened by email, WhatsApp, or phone
- what the next follow-up action is

## Design Docs

- [Partners CRM Design](./docs/partners-crm-design.md)
- [Partners UX Redesign](./docs/partners-ux-redesign.md)
- [Partners Agent Interface Implementation](./docs/partners-agent-interface-implementation.md)

## Current MVP In This Repo

The first implementation includes:

- Hub handoff auth route at `/auth/handoff`
- local Partners session handling
- PMS-style shell-context auth for Hub and internal runtime callers
- dashboard
- organizations list and creation
- organization detail with contacts, Gmail-backed email conversations, outreach touches, and follow-up tasks
- follow-up queue
- tool discovery at `/.well-known/ow-tools`
- PMS-style machine-token auth through Hub-issued agent tokens
- read, draft, guarded-write, and restricted tools at `/api/tools/[tool]`
- write audit logging for guarded and restricted tool calls

## Environment

The current app expects these variables:

- `DATABASE_URL`: Postgres database for Partners data
- `OW_PARTNERS_SESSION_SECRET`: local session signing secret
- `OW_MODULE_HANDOFF_SECRET`: Hub-to-Partners handoff verification secret
- `OW_AGENT_TOKEN_SECRET`: shared secret used to verify Hub-issued machine tokens for `aud: "partners"`
- `OW_INTERNAL_SHARED_SECRET`: shared shell-context secret for Hub and internal runtime calls
- `GOOGLE_CLIENT_ID`: Google OAuth client id for Gmail connection
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret for Gmail connection
- `OW_PARTNERS_GMAIL_TOKEN_SECRET`: encryption/signing secret for stored Gmail refresh tokens and OAuth state
- `RESEND_API_KEY`: optional, only for legacy or future broadcast/system sends
- `OW_PARTNERS_EMAIL_FROM`: optional legacy sender, for example `info@owlswatch.com`
- `OW_PARTNERS_EMAIL_REPLY_TO`: optional legacy reply target, for example `info@owlswatch.com`

Recommended account email setup:

- register Google OAuth redirect URIs for each Partners origin using `/auth/gmail/callback`
- connect the working Owl's Watch Gmail inbox from an account detail page
- use `Sync inbox` to mirror recent replies and external sent mail into Partners

Legacy or optional email setup:

- keep Resend only for future broadcast or system mail
- do not use Resend as the primary send path for account-level relationship outreach

## Gmail Conversation Workspace

Each account detail page now includes a Gmail-backed `Conversation` workspace:

- send 1:1 outreach directly through Gmail
- sync replies and external sent mail back into the account
- keep templates, manual call/WhatsApp logs, notes, and tasks in the same workspace

Implementation details are documented in [Partners Email Workspace](./docs/partners-email-workspace.md).

## Recommended MVP

Build in this order:

1. organizations
2. contacts
3. outreach touch timeline
4. follow-up tasks
5. visit tracking
6. filtered outreach views
7. draft tools for outreach copy

## Agent / Platform Direction

This app should follow the Owl's Watch platform standards:

- service-layer business logic
- narrow tool contracts
- actor metadata
- permission enforcement
- property/workspace context where needed
- auditability for meaningful writes

The next coding pass should scaffold the app around those rules from day one.
