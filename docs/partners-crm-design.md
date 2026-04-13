# Owl's Watch Partners Upgrade Design

## Intent

This repository can stay at `cms` for now, but the product it is becoming is **Partners**.

This app is not a generic content system. It is the relationship and outreach CRM for Owl's Watch:

- operators and agencies that can bring guests
- travel advisors and media contacts
- birding guides, drivers, and other influential local contacts
- any person or company that can help Owl's Watch become part of more itineraries

The app should help Owl's Watch move a record from "we found this name on Instagram" to "this partner reliably sends guests."

## How Owl's Watch Will Use It

The real operating model is:

1. Find candidate partners from Instagram, websites, referrals, directories, and manual research.
2. Store incomplete data immediately instead of waiting for a perfect contact record.
3. Enrich the record over time with names, emails, WhatsApp numbers, notes, and source evidence.
4. Start outreach with email, WhatsApp, calls, or a visit invitation.
5. Keep follow-ups from getting lost.
6. Track who replies, who visits, who sends a first client, and which outreach approach works best.
7. Let humans, agents, and automations all work through the same app contracts.

That means the app must support both messy lead collection and disciplined relationship progression.

## Platform Position

### Hub owns

- employee auth
- module launch and signed handoff
- cross-app identity
- canonical platform standards for tools, machine auth, approvals, audit, and jobs

### Partners owns

- partner records
- people and contact points
- research intake and promotion
- relationship stage
- outreach timeline
- follow-up tasks
- visit workflow
- communication templates, variants, and sequences
- outbound communication policy and execution records for this domain

### PMS owns

- reservation truth
- stay and revenue truth
- future attribution data for which partners produce bookings

### A future real CMS can own

- brochures
- reusable collateral
- long-form content
- public content assets

Partners may consume those assets later, but it should not wait on a future CMS.

## Current State In This Repo

The current implementation is a valid v0:

- `PartnerOrganization`
- `PartnerContact`
- `OutreachTouch`
- `FollowUpTask`
- dashboard, organizations list, detail page, and follow-up queue
- a basic tool runtime with read and draft tools

That is the right starting point, but it is still too narrow for the way Owl's Watch actually works.

Current strengths:

- Hub-style auth handoff already exists
- service layer exists in `src/lib/services/partners.ts`
- tool runtime shape already exists in `src/lib/tools`
- the app already thinks in terms of outreach, not generic content

Current gaps:

- the model is organization-centric, but some important contacts are individuals
- there is no research inbox or provenance model
- agents have nowhere safe to write partial findings first
- there is no template, variant, sequence, or send-attempt model
- there is no async batch/job pattern for outbound work
- there is no experiment tracking for "which outreach works"
- the current status model is too coarse for a real partner lifecycle

## Design Principles

1. This app is the system of record for partner relationship state.
2. The system must tolerate incomplete data from day one.
3. Raw research and canonical CRM records must be separate.
4. UI, agents, and automations must call the same services.
5. Drafting and sending are different operations.
6. Outbound side effects need approval, policy, audit, and job control.
7. The design should stay simpler than PMS, but not be ad hoc.

## Product Naming

### Product name

Use **Partners** in the UI.

### Repo name

`cms` can remain for now if renaming the repository would create friction.

### Navigation language

Move away from "Organizations" as the primary mental model.

Preferred top-level sections:

- Dashboard
- Accounts
- Research
- Follow-ups
- Templates
- Sequences
- Settings

Use "Accounts" rather than "Organizations" in the working UI because not every important relationship is a company.

## Domain Model

### 1. PartnerAccount

This becomes the main relationship record.

It should represent either an organization or an individual.

Recommended fields:

- `id`
- `propertyId`
- `accountKind` (`organization`, `individual`)
- `displayName`
- `partnerType` (`operator`, `agency`, `travel_advisor`, `guide`, `driver`, `media`, `other_lodge`, `influencer`, `other`)
- `relationshipStage`
- `visitStatus`
- `researchStatus`
- `ownerUserId`
- `ownerUserName`
- `priority`
- `country`
- `city`
- `website`
- `instagramHandle`
- `primaryEmail`
- `primaryPhone`
- `primaryWhatsapp`
- `source`
- `marketNotes`
- `campaignTag`
- `lastInboundAt`
- `lastOutboundAt`
- `lastVisitedAt`
- `nextActionAt`
- `firstReferredAt`
- `lastReferredAt`
- `createdAt`
- `updatedAt`

Implementation note:

- the current `PartnerOrganization` table can either be evolved into this shape or replaced by a future `PartnerAccount` migration
- service and UI naming should move toward `account` immediately, even if the table rename happens later

### 2. PartnerPerson

People attached to an account.

Recommended fields:

- `id`
- `accountId`
- `fullName`
- `roleTitle`
- `email`
- `phone`
- `whatsapp`
- `instagramHandle`
- `preferredChannel`
- `isPrimary`
- `isDecisionMaker`
- `notes`
- `lastInboundAt`
- `lastOutboundAt`
- `createdAt`
- `updatedAt`

For `accountKind = individual`, there may still be a `PartnerPerson` record, but the account itself remains the lifecycle owner.

### 3. AccountIdentity

This stores dedupe and contact points in a normalized way.

Examples:

- website URL
- email address
- WhatsApp number
- Instagram handle
- phone number

Recommended fields:

- `id`
- `accountId`
- `personId`
- `identityType`
- `value`
- `isPrimary`
- `isVerified`
- `source`

This keeps enrichment and matching cleaner than scattering identifiers across many columns forever.

### 4. ResearchFinding

Agents should write here first.

This is the raw evidence and extraction layer for messy lead discovery.

Recommended fields:

- `id`
- `propertyId`
- `sourceType` (`instagram`, `website`, `directory`, `manual`, `referral`, `other`)
- `sourceUrl`
- `sourceHandle`
- `observedName`
- `observedText`
- `extractedDataJson`
- `confidence`
- `status` (`new`, `reviewed`, `promoted`, `discarded`, `merged`)
- `proposedAccountId`
- `createdByActorType`
- `createdByActorId`
- `createdAt`
- `updatedAt`

Rules:

- research findings are not canonical CRM state
- promotion or merge is explicit
- provenance remains visible after promotion

### 5. OutreachTouch

Keep the current timeline concept.

This is the human-readable interaction log for:

- email
- WhatsApp
- phone calls
- meetings
- notes
- inbound replies

Recommended fields:

- `id`
- `accountId`
- `personId`
- `channel`
- `direction`
- `kind` (`initial_outreach`, `followup`, `reply`, `call`, `visit_invite`, `visit`, `note`, `other`)
- `happenedAt`
- `subject`
- `summary`
- `outcome`
- `nextStep`
- `campaignTag`
- `templateId`
- `templateVariantId`
- `sequenceId`
- `sequenceStepId`
- `communicationAttemptId`
- `createdByActorType`
- `createdByActorId`
- `createdByActorLabel`

### 6. FollowUpTask

Keep this as the action queue.

Recommended fields:

- `id`
- `accountId`
- `personId`
- `title`
- `description`
- `taskType` (`email_followup`, `whatsapp_followup`, `call`, `research`, `invite_visit`, `post_visit_followup`, `other`)
- `dueAt`
- `status`
- `assignedToUserId`
- `assignedToUserName`
- `createdByActorType`
- `createdByActorId`
- `createdByActorLabel`
- `completedAt`

### 7. Visit

The current app keeps visit status on the organization record.

That is acceptable for a first pass, but the target design should support explicit visits.

Recommended fields:

- `id`
- `accountId`
- `personId`
- `status` (`invited`, `scheduled`, `visited`, `cancelled`)
- `scheduledFor`
- `visitedAt`
- `summary`
- `notes`

Short-term rule:

- keep `visitStatus` and `lastVisitedAt` on the account
- do not overwrite historical visit dates on unrelated edits

### 8. Communication Entities

Use the shared platform vocabulary from Hub:

- `Template`
- `TemplateVariant`
- `Sequence`
- `SequenceStep`
- `CommunicationDraft`
- `CommunicationAttempt`

These are required if you want direct sending, experiment tracking, and safe automation.

## Lifecycle Model

The current status enum is too simple for the real workflow.

Use a relationship lifecycle that reflects how Owl's Watch actually courts partners.

### Relationship stage

- `discovered`
- `researching`
- `ready_for_outreach`
- `outreach_in_progress`
- `awaiting_reply`
- `engaged`
- `visit_invited`
- `visit_scheduled`
- `visited`
- `trial_partner`
- `active_partner`
- `dormant`
- `not_a_fit`

### Visit status

- `not_invited`
- `invited`
- `scheduled`
- `visited`

### Research status

- `unresearched`
- `partial`
- `enriched`
- `validated`

### Practical rules

- logging one touch should not blindly force the account into one generic status forever
- inbound replies should update `lastInboundAt`
- outbound touches should update `lastOutboundAt`
- stage transitions should happen from explicit service rules, not page-local guesses
- visit timestamps must change only on a real visit transition

## Incomplete Data Strategy

This is critical for your use case.

Many records will begin with only:

- an operator name
- an Instagram handle
- a website
- a single email
- a city
- a note from research

The app should allow account creation with minimal required fields:

- `displayName`
- `accountKind`
- one provenance hint such as source, URL, or note

Everything else can be missing at first.

Useful derived flags:

- `hasAnyContactPoint`
- `hasDecisionMaker`
- `isReadyForOutreach`
- `isMissingCriticalData`

These should be derived in service logic, not hard-coded into the UI only.

## Research Workflow

### Goal

Let ChatGPT or future agents collect information safely without writing noisy data directly into canonical accounts.

### Workflow

1. An agent monitors a source such as Instagram or a website.
2. The agent creates one or more `ResearchFinding` records.
3. The app groups possible duplicates by name, handle, URL, or existing account match.
4. A human or a trusted merge tool promotes the finding into a `PartnerAccount` and optional `PartnerPerson`.
5. The promoted account moves into `researching` or `ready_for_outreach`.

### Required capabilities

- research inbox
- dedupe suggestions
- promote-to-account action
- merge-into-existing-account action
- provenance display on the account detail page

## Communication Design

### Channels

Support:

- email
- WhatsApp
- phone
- meeting / visit invite
- internal note

### Template model

Templates should be owned inside Partners, not hidden in page code.

Recommended entities:

- `Template`
- `TemplateVariant`
- `Sequence`
- `SequenceStep`

This lets you answer:

- which intro email works best
- whether WhatsApp works better than email for a certain segment
- whether a visit invite performs better after one call or two emails

### Draft versus send

Separate these operations:

1. Draft communication
2. Review or approve communication
3. Send communication
4. Track delivery and reply state

That means:

- every sent message stores a snapshot of the rendered content
- templates remain editable without rewriting history
- sends can be audited and attributed to an actor

### Experiment tracking

Every outbound attempt should carry:

- `campaignTag`
- `templateId`
- `templateVariantId`
- `sequenceId`
- `sequenceStepId`

Later, Partners should be able to report:

- reply rate by template variant
- visit rate by sequence
- active partner conversion by channel
- first referral conversion by campaign

### Direct sending from the app

Yes, email sending should eventually happen directly from Partners.

But the design should be:

- draft first
- send through a provider-backed service
- respect opt-out or suppression rules
- record a `CommunicationAttempt`
- log an `OutreachTouch`
- require approval or approved policy for sensitive batch sends

For WhatsApp:

- first phase can be draft-and-log
- later phase can integrate direct sending if the provider and compliance path are ready

## Agent And Automation Design

Partners should fully adopt the Hub platform standards.

That means:

- tool discovery and invocation follow the Hub tool runtime
- machine callers use machine credentials, not employee passwords
- actor metadata is preserved on every write
- restricted side effects use approval or explicit policy
- long-running or batch actions use jobs

### Read tools

- `get_partner_account`
- `find_partner_accounts`
- `get_partner_people`
- `get_partner_timeline`
- `list_accounts_by_stage`
- `list_followups_due`
- `list_research_findings`
- `get_template_performance`

### Draft tools

- `draft_intro_email`
- `draft_followup_email`
- `draft_whatsapp_outreach`
- `draft_call_script`
- `draft_visit_invitation`
- `draft_sequence_step`

### Guarded write tools

- `create_partner_account`
- `add_partner_person`
- `promote_research_finding`
- `merge_partner_accounts`
- `log_outreach_touch`
- `schedule_followup_task`
- `update_partner_stage`
- `update_visit_status`
- `save_communication_draft`

### Restricted or job-backed tools

- `plan_followup_batch`
- `enqueue_followup_batch`
- `send_email`
- `send_followup_batch`
- `launch_sequence_for_accounts`
- `sync_research_monitor`
- `archive_partner_account`

### Example supported command

This should become a valid supported workflow:

"Send followups for any operator who did not respond to our initial email 60 days ago."

The runtime path should be:

1. `list_accounts_needing_followup`
2. `plan_followup_batch`
3. `enqueue_followup_batch`
4. approval or policy check
5. send attempts plus touch logging
6. job status and audit trail

## UI Upgrade Shape

### 1. Dashboard

Show:

- discovered leads
- ready for outreach
- awaiting reply
- follow-ups overdue
- visits scheduled
- visited
- active partners
- research inbox count

### 2. Accounts list

This replaces the purely organization-centric working table.

Filters:

- account kind
- partner type
- relationship stage
- visit status
- owner
- source
- campaign tag
- research status
- ready-for-outreach flag

Saved views:

- incomplete leads
- ready for outreach
- awaiting reply
- needs 60-day follow-up
- visit invited
- visited not active
- active partners
- unassigned

### 3. Research inbox

This is a first-class screen.

Show:

- new findings
- duplicate suggestions
- promote actions
- discard actions
- agent source and confidence

### 4. Account detail

Show:

- account summary
- people
- identity points
- timeline
- follow-up tasks
- visit state
- research provenance
- communication history
- template or sequence history

### 5. Follow-ups

Queues:

- overdue
- due this week
- mine
- sequence-generated
- blocked by missing contact info

### 6. Templates and sequences

This can begin simple.

Start with:

- template list
- variant list
- sequence steps
- approval mode

Do not build a giant visual automation builder first.

## Implementation Strategy

### Phase 0: Correct the current v0

Fix the current integrity and workflow issues before adding more surface area:

- follow-up queue scoping bug
- contact-to-organization validation
- visit timestamp preservation
- any additional service-level data integrity issues

### Phase 1: Reframe the app as Partners

- update product language in UI from generic CMS wording to Partners wording
- move service and tool naming toward `account` and `person`
- preserve current pages where possible, but align the mental model now

### Phase 2: Add research and better lifecycle state

- add `ResearchFinding`
- add richer stage model
- add incomplete-data and readiness derivations
- add research inbox UI and tools

### Phase 3: Add communications foundation

- add `Template`
- add `TemplateVariant`
- add `Sequence`
- add `SequenceStep`
- add `CommunicationDraft`
- add `CommunicationAttempt`

### Phase 4: Add job-backed outbound execution

- `plan_*` and `enqueue_*` tools
- batch follow-up jobs
- approval and policy enforcement
- audit for all sends

### Phase 5: Add attribution and reporting

- reply and visit conversion by variant
- active partner conversion by sequence
- PMS read integration for referred booking attribution

## Initial Schema Direction

If you want the fastest path without a massive migration, do this:

### Keep temporarily

- `PartnerOrganization`
- `PartnerContact`
- `OutreachTouch`
- `FollowUpTask`

### Add next

- `ResearchFinding`
- `Template`
- `TemplateVariant`
- `Sequence`
- `SequenceStep`
- `CommunicationDraft`
- `CommunicationAttempt`

### Then evolve

- rename or replace `PartnerOrganization` with `PartnerAccount`
- rename or replace `PartnerContact` with `PartnerPerson`
- add `AccountIdentity`
- add explicit `Visit`

That gives you forward motion without pretending the current schema is the final shape.

## Service Layer Direction

The service layer should become the real product API.

Recommended service set:

- `createPartnerAccount`
- `updatePartnerAccount`
- `addPartnerPerson`
- `createResearchFinding`
- `promoteResearchFinding`
- `mergePartnerAccounts`
- `logOutreachTouch`
- `scheduleFollowUpTask`
- `completeFollowUpTask`
- `updateRelationshipStage`
- `updateVisitStatus`
- `saveCommunicationDraft`
- `planFollowupBatch`
- `enqueueFollowupBatch`
- `recordCommunicationAttempt`
- `markInboundReply`

Page actions, REST endpoints, tool handlers, and jobs should all call these services.

## Permissions

Recommended permissions:

- `partners.accounts.read`
- `partners.accounts.write`
- `partners.people.read`
- `partners.people.write`
- `partners.research.read`
- `partners.research.write`
- `partners.outreach.read`
- `partners.outreach.write`
- `partners.outreach.send`
- `partners.tasks.read`
- `partners.tasks.write`
- `partners.templates.read`
- `partners.templates.write`
- `partners.sequences.manage`
- `partners.analytics.read`

## Audit Requirements

Audit these actions at minimum:

- account created
- account merged
- person added
- research finding promoted
- outreach touch logged
- follow-up task created or completed
- stage changed
- visit status changed
- draft created
- outbound send attempted
- approval granted or rejected

The audit model must distinguish:

- `human`
- `agent`
- `automation`
- `system`

## What Not To Build First

Do not start with:

- a public-facing CMS
- a generic WYSIWYG content system
- fully autonomous outbound messaging with no approval controls
- a complex drag-and-drop automation builder
- deep PMS write coupling
- a giant analytics suite before communication tracking exists

## Definition Of Success

The upgraded Partners app is doing its job when:

- a new lead can be created from incomplete research in under a minute
- agents can collect and store findings without polluting canonical CRM records
- the team can see who is ready for outreach and who is awaiting reply
- follow-ups do not disappear
- outreach history is visible and trustworthy
- email templates and variants can be tested
- direct sends are possible through controlled policies
- a command like "send followups for operators with no reply after 60 days" is supported safely
- the app remains consistent with the shared Hub agent platform

## Recommendation

Treat this repo as **Partners in implementation, `cms` in path only**.

The upgrade path should be:

- fix the current v0 issues
- adopt account and research concepts
- add communication primitives
- add job-backed sending
- add attribution later

That keeps the app small enough to move fast, while making it structurally correct for the way Owl's Watch will actually use it.
