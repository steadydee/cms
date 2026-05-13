# Owl's Watch Partners UX Redesign

## Goal

Make `projects/cms` feel less like a collection of forms and more like a real operating tool.

Use the Hub [Design Standard](/Users/dennis/Projects/owhub/docs/design-standard.md) as the shared cross-app UX source of truth. This document keeps Partners-specific design notes only.

The product is not a generic CMS. It is a **Partners CRM** for outreach to operators, agencies, advisors, and related contacts.

The redesign should borrow the best parts of PMS:

- strong summary at the top
- clear work queues
- one obvious next action
- less interpretation required from the operator
- better drill-down from snapshot to detail

## Current Product Read

The underlying domain model is good enough for v1:

- organizations/accounts
- contacts
- outreach touches
- follow-up tasks
- research findings

The main problem is not lack of features. The main problem is **interaction design**.

Today the app feels clunky because:

1. Every page gives the same visual weight to too many different actions.
2. Major pages mix creation, filtering, bulk actions, and review into one long surface.
3. The detail page is a stack of separate forms instead of one guided workflow.
4. The dashboard reports counts, but it does not strongly tell the operator what to do next.
5. Research intake is technically correct, but it is presented in a way that feels like internal tooling rather than a polished product.

## Code-Level Review

### 1. Accounts page is overloaded

In [organizations/page.tsx](/Users/dennis/Projects/cms/src/app/(app)/organizations/page.tsx), one page currently contains:

- new organization form
- saved views
- filter bar
- bulk action bar
- results table

That is too much for the top-level working screen. The user has to scan through creation UI even when they are trying to manage existing accounts.

### 2. Organization detail page has too many peer-level modules

In [organizations/[id]/page.tsx](/Users/dennis/Projects/cms/src/app/(app)/organizations/[id]/page.tsx), the page contains:

- profile editing
- status update
- contacts
- first outreach composer
- follow-up tasks
- outreach timeline

All of these are useful, but the page currently presents them as equal siblings. That makes the workflow feel diffuse instead of directed.

### 3. Research page is built for storage, not flow

In [research/page.tsx](/Users/dennis/Projects/cms/src/app/(app)/research/page.tsx), the top section is a raw intake form, including extracted JSON, and the lower section is a review list.

That works technically, but the mental model is weak:

- intake and review are mixed
- "review before promotion" does not yet feel like an inbox
- there is no strong promote/merge workflow in the experience

### 4. Follow-ups page is cleaner, but disconnected

In [followups/page.tsx](/Users/dennis/Projects/cms/src/app/(app)/followups/page.tsx), the queue itself is understandable, but it still feels like a separate module rather than the natural next step of account work.

### 5. Visual system is not yet cohesive enough

The shared visual base in [globals.css](/Users/dennis/Projects/cms/src/app/globals.css) and [sidebar.tsx](/Users/dennis/Projects/cms/src/components/layout/sidebar.tsx) is fine, but the content areas rely heavily on repeated white cards and long vertical forms. The result is:

- too much empty space
- weak hierarchy
- too many "panels" with the same importance
- too little sense of current state vs next action

## What To Borrow From PMS

These are the strongest concepts from PMS that should be applied here.

### 1. Snapshot + Queue

PMS works better when it answers:

- what is happening now
- what needs attention now
- what needs attention soon

Partners should do the same.

### 2. Derived action state

PMS improved once labels became plain-language and time-aware.

Partners should use:

- `Needs first outreach`
- `Awaiting reply`
- `Follow-up due this week`
- `Overdue next step`
- `Visit scheduled`
- `Proposal follow-up`

instead of relying on the user to interpret status fields in isolation.

### 3. Progressive disclosure

PMS works best when high-level views drill into detail instead of making the top-level page do everything.

Partners should:

- show summary first
- then queue/work views
- then detailed account workflows

### 4. One clear primary action per context

PMS got better when screens told the user what to do next.

Partners should always make the primary action obvious:

- on dashboard: who to contact next
- on account page: send outreach, log reply, create follow-up, or move stage
- in research: promote, merge, discard

## Product Design Direction

## Product Identity

The app should present itself as:

- **Partners**
- subtitle: `Outreach CRM`

Not as a CMS.

## Core Operating Model

The user is trying to move a partner through a simple lifecycle:

1. Found
2. Qualified
3. Contacted
4. Awaiting reply
5. Engaged
6. Visit / meeting
7. Proposal / active conversation
8. Active partner
9. Dormant / inactive / not interested

The product should reflect that lifecycle directly.

## New Information Architecture

Recommended left-nav:

- `Dashboard`
- `Accounts`
- `Research`
- `Tasks`
- `Templates` (phase 2)
- `Reports` (phase 3)

Rename:

- `Follow-ups` -> `Tasks`

This is simpler and more normal for operators.

## Page-by-Page Redesign

## 1. Dashboard

### Purpose

The dashboard should be the operator's daily control center.

### Structure

Top strip:

- `Accounts`
- `Needs first outreach`
- `Awaiting reply`
- `Visits scheduled`
- `Proposal follow-up`
- `Overdue next steps`
- `Unassigned owners`

Main body:

- `Do today`
- `Due this week`
- `Recently active`
- `Research inbox`

### Content

#### Do today

Plain-language queue items:

- `3 accounts need first outreach`
- `2 accounts need follow-up today`
- `1 scheduled visit needs preparation`
- `1 proposal needs a response`

Each item should drill into filtered accounts.

#### Due this week

- follow-ups due
- visits scheduled
- accounts awaiting reply too long

#### Recently active

Keep the current recent touches list, but make it one card in a broader dashboard instead of the main content.

#### Research inbox

Show:

- new findings
- reviewed but not promoted
- duplicates needing merge

### Design principle

The dashboard should answer:

- What needs my attention first?

not:

- What are all the modules in the app?

## 2. Accounts list

### Current problem

The list page is doing creation, segmentation, bulk actions, and table management all at once.

### Redesign

Split this into:

- top action bar
- saved views / queue chips
- table
- secondary creation path

### Proposed layout

Header row:

- title: `Accounts`
- primary button: `Add account`
- secondary button: `Import from research`

Saved views row:

- `Needs first outreach`
- `Awaiting reply`
- `Visited, not active`
- `Overdue next step`
- `Unassigned owner`
- `Archived`

Filter bar:

- search
- stage
- visit status
- owner
- source
- type

Table:

Columns:

- account
- stage
- next step
- owner
- last touch
- due
- contacts
- activity

### Bulk actions

Bulk actions should remain, but only appear once rows are selected.

Do not show the bulky action composer at all times.

### New account creation

Move `Add account` into:

- a slide-over panel
- or a modal

Do not make the create form the first thing on the page.

## 3. Account detail

### Current problem

The detail page is the biggest UX issue.

It contains the right information, but it behaves like a settings page instead of a workflow page.

### New structure

Top summary header:

- account name
- type
- stage
- owner
- next action
- last touch
- next due date

Primary actions row:

- `Send first outreach`
- `Log touch`
- `Add follow-up`
- `Update stage`

Below that, use tabs:

- `Overview`
- `People`
- `Timeline`
- `Tasks`
- `Profile`

### Overview tab

This should be the default.

Show:

- stage card
- next step card
- first outreach card
- visit/proposal readiness card
- recent touches summary

The overview tab should feel operational, not administrative.

### People tab

Current contacts form/list should move here.

### Timeline tab

Current outreach timeline should move here.

Add filters:

- email
- WhatsApp
- phone
- meetings
- notes

### Tasks tab

Current follow-up task list and create form should move here.

### Profile tab

Current edit profile/status forms should move here.

This is important:

- profile and admin editing should not dominate the main detail page

## 4. Research

### Current problem

Research currently feels like an intake form attached to a list.

### New structure

Two tabs:

- `Inbox`
- `Capture`

#### Inbox

This becomes the default.

Show findings as inbox cards or table rows with:

- observed name
- source
- confidence
- extracted contact clues
- created by
- status
- actions:
  - `Promote to account`
  - `Merge into existing`
  - `Mark reviewed`
  - `Discard`

#### Capture

This holds the current manual intake form.

The extracted JSON field should remain, but not be the first thing users see.

### Product improvement

Research should feel like triage, not storage.

## 5. Tasks

### Rename

Rename `Follow-ups` to `Tasks`.

### Layout

Top cards:

- open
- due today
- due this week
- overdue
- assigned to me

Views:

- `My tasks`
- `Overdue`
- `Due this week`
- `All open`

### Detail behavior

Task actions should support:

- mark done
- reopen
- assign
- jump to account

The queue should feel like a worklist, not a log.

## Workflow Design

## Primary lifecycle actions

Each account should always expose one dominant next step:

- `Send intro`
- `Wait for reply`
- `Follow up`
- `Schedule visit`
- `Prepare proposal`
- `Activate partner`

This should be derived from:

- relationship stage
- last touch date
- nextActionAt
- open tasks

## First outreach

The current first-outreach composer in [first-outreach-composer.tsx](/Users/dennis/Projects/cms/src/components/organizations/first-outreach-composer.tsx) is useful, but it should be presented as a guided step card, not just another form block.

Recommended treatment:

- if stage = `not_contacted`, show this as the main CTA in Overview
- once sent, replace with:
  - `Awaiting reply`
  - suggested follow-up timing
  - quick action: `Create follow-up task`

## Better Product Model

## Add derived queue logic

The service layer should start deriving queue groupings like PMS lifecycle does.

Recommended derived views:

- `needs_first_outreach`
- `awaiting_reply`
- `follow_up_due`
- `visit_ready`
- `proposal_due`
- `inactive_after_visit`
- `unassigned_owner`

These should live in the service layer, not only in page components.

## Add stronger stage guidance

Current relationship stages are workable, but the UI should group them more clearly:

- `Prospect`
  - not_contacted
  - contacted
- `Conversation`
  - awaiting_reply
  - engaged
- `Visit`
  - visit_scheduled
  - visited
- `Commercial`
  - proposal_sent
  - active_partner
- `Closed`
  - inactive
  - not_interested

This gives you a cleaner board and better filtering language.

## Visual Design Direction

The layout should remain Tabler-compatible and keep the green/teal app identity, but with stronger structure:

- reduce giant empty white areas
- use tighter vertical rhythm
- reduce the number of equally prominent cards
- give headers more functional context
- use small chips for stage, due state, and owner
- surface primary CTA in each major view

### Use color for meaning, not decoration

Suggested semantics:

- green = active / healthy
- amber = waiting / needs follow-up
- red = overdue / blocked
- slate = neutral / metadata

Avoid making the user decode many pastel cards with unclear hierarchy.

## Immediate Product Changes

These would make a big difference without rewriting the whole app.

### Priority 1

1. Move account creation off the main Accounts page into a modal or slide-over.
2. Turn the dashboard into a queue-based command center.
3. Turn the account detail page into tabs with an Overview default.
4. Move profile/status editing into a Profile tab instead of the main workflow surface.
5. Rename `Follow-ups` to `Tasks`.

### Priority 2

1. Redesign Research as `Inbox` + `Capture`.
2. Show bulk actions only when accounts are selected.
3. Add derived queue views in the service layer.
4. Make first outreach a proper guided step card.

### Priority 3

1. Add board view for account pipeline.
2. Add templates and sequence support.
3. Add reporting views by stage, source, and outreach outcome.

## Suggested Implementation Order

### Phase A: workflow clarity

- dashboard redesign
- accounts page cleanup
- rename Follow-ups to Tasks

### Phase B: account detail redesign

- tabbed detail view
- overview tab
- move profile/forms into proper tabs

### Phase C: research workflow

- inbox/capture split
- promote/merge actions

### Phase D: smarter queues

- derived queue families
- board view
- better "next step" modeling

## Definition of Better

The redesign is successful when:

1. A user can open the dashboard and immediately know what to work on today.
2. The Accounts page feels like a pipeline, not a form dump.
3. The Account detail page feels guided instead of cluttered.
4. Research feels like an inbox and promotion workflow, not a raw storage screen.
5. Tasks feel like work management, not just overdue records.
6. The app feels like a polished CRM, not an internal admin surface.
