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

## Current MVP In This Repo

The first implementation includes:

- Hub handoff auth route at `/auth/handoff`
- local Partners session handling
- dashboard
- organizations list and creation
- organization detail with contacts, outreach touches, and follow-up tasks
- follow-up queue
- tool discovery at `/.well-known/ow-tools`
- first read and draft tools at `/api/tools/[tool]`

## Environment

The current app expects these variables:

- `DATABASE_URL`: Postgres database for Partners data
- `OW_PARTNERS_SESSION_SECRET`: local session signing secret
- `OW_MODULE_HANDOFF_SECRET`: Hub-to-Partners handoff verification secret
- `OW_PARTNERS_AGENT_TOKEN`: machine token for the current lightweight agent mode
- `RESEND_API_KEY`: Resend API key for app-triggered email sends
- `OW_PARTNERS_EMAIL_FROM`: verified sender, for example `info@owlswatch.com`
- `OW_PARTNERS_EMAIL_REPLY_TO`: reply target, for example `info@owlswatch.com`

Recommended email setup:

- use Resend to send from `OW_PARTNERS_EMAIL_FROM`
- route replies back to the Owl's Watch inbox through `OW_PARTNERS_EMAIL_REPLY_TO`
- if both should be the same inbox, set both to `info@owlswatch.com`

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
