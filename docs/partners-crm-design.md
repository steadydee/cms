# Owl's Watch Partners CRM Design

## Recommendation

What you need is not a traditional CMS.

It is a lightweight **partners and outreach CRM** that lives inside the Owl's Watch Hub shell as its own bounded app.

Suggested app names:

- `Partners`
- `Outreach`
- `CRM`

My recommendation is **Partners**.

Why:

- it is clearer than CMS
- it matches the actual domain
- it avoids mixing content management with relationship management

The CMS can still exist later for reusable content, brochures, templates, and knowledge.
The Partners app should own the relationship and outreach workflow.

## Core Goal

The app should let Owl's Watch track:

- which operators and agencies exist
- who the contacts are
- who has been contacted
- who has not been contacted
- who has visited the property
- who has not visited
- what channel was used
- what the last outcome was
- what the next action is

It should support outreach across:

- email
- WhatsApp
- phone calls

## Platform Position

This app should sit inside Hub like PMS and Chatbot.

### Hub owns

- employee login
- session initiation
- user and invite management
- module launch and handoff

### Partners app owns

- organizations
- contacts
- outreach history
- visit history
- follow-up tasks
- campaign grouping
- partner relationship stage

### PMS owns

- reservation and finance truth

### Chatbot owns

- guest messaging truth

The Partners app can later read from PMS and CMS, but it should own its own CRM state.

## MVP Scope

Build this first. Do not overbuild campaign automation on day one.

### 1. Organizations

Track each operator or agency as one organization record.

Fields:

- `id`
- `name`
- `type` (`agency`, `operator`, `travel_advisor`, `media`, `other`)
- `country`
- `city`
- `website`
- `whatsapp`
- `phone`
- `email`
- `source`
- `marketNotes`
- `ownerUserId`
- `priority`
- `status`
- `visitStatus`
- `lastContactedAt`
- `nextActionAt`
- `createdAt`
- `updatedAt`

### 2. Contacts

Track people inside each organization.

Fields:

- `id`
- `organizationId`
- `fullName`
- `roleTitle`
- `email`
- `phone`
- `whatsapp`
- `preferredChannel`
- `isPrimary`
- `notes`
- `lastContactedAt`

### 3. Outreach Touches

Every outreach action should be logged as a touch.

Fields:

- `id`
- `organizationId`
- `contactId`
- `channel` (`email`, `whatsapp`, `phone`, `meeting`, `other`)
- `direction` (`outbound`, `inbound`)
- `happenedAt`
- `subject`
- `summary`
- `outcome`
- `nextStep`
- `createdByUserId`

### 4. Visit Tracking

You specifically need to know who has visited and who has not.

Keep this explicit.

Fields:

- `visitStatus` (`never_invited`, `invited`, `scheduled`, `visited`)
- `lastVisitedAt`
- `visitNotes`

This can live on the organization record at first.
If visits become more complex later, split them into their own `PartnerVisit` table.

### 5. Follow-Up Tasks

Manual outreach dies when follow-ups disappear.

Fields:

- `id`
- `organizationId`
- `contactId`
- `title`
- `description`
- `dueAt`
- `status` (`open`, `done`, `cancelled`)
- `assignedToUserId`
- `createdByUserId`

### 6. Campaign Grouping

Keep this light in v1.

Fields:

- `campaignTag`
- `segment`
- `source`

Examples:

- `2026-q2-colombia-operators`
- `familiarization-trip-prospects`
- `birding-agencies-priority`

Do not build a full marketing automation engine first.

## Recommended Status Model

Keep the status model simple and operational.

### Relationship Status

- `not_contacted`
- `contacted`
- `awaiting_reply`
- `engaged`
- `visit_scheduled`
- `visited`
- `proposal_sent`
- `active_partner`
- `inactive`
- `not_interested`

### Visit Status

- `never_invited`
- `invited`
- `scheduled`
- `visited`

These two fields are enough for the first version.

## Primary Screens

### 1. Dashboard

Show:

- total organizations
- not contacted
- awaiting reply
- follow-ups due this week
- visit scheduled
- visited but not active
- active partners

### 2. Organizations List

Main working table with filters:

- type
- status
- visit status
- owner
- channel used
- country
- campaign tag

Saved views should include:

- never contacted
- contacted no reply
- visited but not followed up
- follow-up overdue
- active partners

### 3. Organization Detail

One screen with:

- org summary
- contacts
- outreach history timeline
- visit info
- notes
- follow-up tasks
- campaign tags

### 4. Contacts View

Useful for lists like:

- people to email
- people to WhatsApp
- people with missing contact info

### 5. Tasks / Follow-Ups

Simple queue:

- due today
- due this week
- overdue
- completed

### 6. Campaign / Segment View

At first, this can just be a filtered list by tag or segment.
Do not build a Mailchimp clone.

## Core Workflows

### Workflow 1: Add a new agency

1. Create organization
2. Add primary contact
3. Set status to `not_contacted`
4. Assign owner
5. Set next action date

### Workflow 2: Send first outreach

1. Open organization
2. Log touch as `email` or `whatsapp`
3. Set outcome
4. Move status to `contacted`
5. Create follow-up task

### Workflow 3: No reply follow-up

1. Filter `awaiting_reply` or overdue tasks
2. Log another touch
3. Update notes and next action

### Workflow 4: Property visit

1. Mark visit as scheduled
2. After visit, mark `visited`
3. Add visit notes
4. Create next action task

### Workflow 5: Convert to active partner

1. Update relationship status to `active_partner`
2. Keep touch history and notes intact
3. Later, connect to PMS performance or booking reporting

## Suggested Service Layer

The app should be structured like the other Owl's Watch projects.

Examples:

- `createOrganization`
- `updateOrganizationStatus`
- `addContact`
- `logOutreachTouch`
- `scheduleFollowUpTask`
- `completeFollowUpTask`
- `markVisitScheduled`
- `markVisitCompleted`
- `listOutreachTargets`
- `listDueFollowUps`

## Agent-Friendly Tool Surface

Because you want automation, design the app with tools from day one.

### Read Tools

- `get_partner_organization`
- `find_partner_organizations`
- `list_not_contacted_partners`
- `list_partners_awaiting_reply`
- `list_visited_partners`
- `list_followups_due`
- `get_partner_contact_list`
- `get_partner_outreach_timeline`

### Draft Tools

- `draft_intro_email`
- `draft_whatsapp_outreach`
- `draft_followup_email`
- `draft_phone_call_script`
- `draft_visit_invitation`

### Guarded Writes

- `create_partner_organization`
- `add_partner_contact`
- `log_outreach_touch`
- `schedule_followup_task`
- `update_partner_status`
- `mark_partner_visit_status`

### Restricted Actions Later

- `send_campaign_batch`
- `bulk_update_partner_status`
- `archive_partner_organization`

## Integrations

### Hub

Required.

Use the same pattern as PMS:

- Hub owns login and initial shell session
- Partners app verifies handoff internally
- Partners app creates its own local session
- permissions are enforced inside the app

### PMS

Later integration.

Useful future reads:

- which operators or agencies have produced bookings
- revenue or stay counts by partner
- last referred reservation date

Do not make PMS a dependency for the MVP.

### Chatbot

Optional later integration.

If partner conversations ever happen through chatbot-managed channels, Partners can reference those conversations.

But do not make Chatbot the CRM source of truth.

### CMS

Future integration.

This is where a real CMS becomes useful:

- outreach email templates
- visit invitation copy
- brochures
- partnership collateral
- standardized WhatsApp templates

So the sequence should be:

- build Partners CRM first
- build CMS later
- let Partners consume CMS content assets

## Permissions

Suggested permissions:

- `partners.organizations.read`
- `partners.organizations.write`
- `partners.contacts.read`
- `partners.contacts.write`
- `partners.outreach.read`
- `partners.outreach.write`
- `partners.tasks.read`
- `partners.tasks.write`
- `partners.campaigns.manage`

## Audit Requirements

Audit these actions:

- organization created
- contact added
- outreach touch logged
- status changed
- visit status changed
- follow-up created or completed

You will want to know later whether something was done by:

- a human
- an agent
- an automation

## Recommended MVP Data Model

Start with these tables:

### `PartnerOrganization`

- core organization record

### `PartnerContact`

- people at that organization

### `OutreachTouch`

- all emails, WhatsApp messages, calls, meetings, and notes

### `FollowUpTask`

- action queue

Optional v1.5:

### `PartnerTag`

- normalized tagging if campaign tags get messy

Optional v2:

### `PartnerVisit`

- separate event table if visit tracking grows beyond one field

## Recommended UI Shape

Inside Hub, the app should feel similar to PMS:

- dashboard
- organizations
- contacts
- follow-ups
- campaigns
- settings later

Do not start with a giant complex CRM layout.
Build the operator workflow first.

## Suggested MVP Build Order

1. Organizations list and detail page
2. Contacts support
3. Outreach timeline
4. Follow-up tasks
5. Dashboard filters and saved views
6. Basic draft tools for email, WhatsApp, and call scripts
7. Real sending integrations later

## What Not To Build First

Do not start with:

- full email automation
- WhatsApp send integration
- complex sequence builders
- score models
- pipeline graphs
- public CMS features
- PMS deep coupling

Those are second-phase features.

## Definition Of Done For MVP

The first real version is good enough when:

- you can add an operator or agency
- you can add one or more contacts
- you can mark whether they have visited
- you can log email, WhatsApp, and phone outreach
- you can filter who has not been contacted
- you can filter who has visited but is not active
- you can assign and complete follow-up tasks
- you can see the full outreach timeline for one organization
- the app works inside Hub auth and session flow

## My Recommendation

Build this as **Partners**, not CMS.

If you want the cleanest Owl's Watch platform shape:

- Hub = shell and identity
- PMS = reservations and finance
- Chatbot = guest conversation workflow
- Partners = operator and agency CRM
- CMS = reusable content and assets later

That keeps your domain boundaries clean and gives you the exact app you actually need right now.
