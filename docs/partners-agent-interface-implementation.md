# Partners Agent Interface Implementation Brief

This document is the implementation brief for bringing `projects/cms` up to the same agent-interface standard already applied to PMS.

The app domain is still **Partners**, even though the repo path is `cms`.

Do not redesign this into a generic CMS tool surface.
Implement the Owl's Watch platform runtime for the **Partners** domain.

## Human IA Alignment

The human-facing app should now use the same working areas the machine runtime will expose:

- `Dashboard`
- `Accounts`
- `Tasks`

Use `account` or `organization` for the operator or agency record.
Use `contact` only for the people inside an account.

Research findings can remain available to the machine runtime and internal workflows, but they should no longer appear as a first-class human workspace in the browser UI.

## Source Standards

Use these four Hub documents as the authoritative standard:

- [agent-platform-spec.md](/Users/dennis/Projects/owhub/docs/agent-platform-spec.md)
- [agent-tool-runtime-spec.md](/Users/dennis/Projects/owhub/docs/agent-tool-runtime-spec.md)
- [machine-auth-and-scope-spec.md](/Users/dennis/Projects/owhub/docs/machine-auth-and-scope-spec.md)
- [approval-and-audit-spec.md](/Users/dennis/Projects/owhub/docs/approval-and-audit-spec.md)

Use PMS as the implementation reference:

- [pms-access.ts](/Users/dennis/Projects/pms/src/lib/auth/pms-access.ts)
- [pms-tool-runtime.ts](/Users/dennis/Projects/pms/src/lib/tools/pms-tool-runtime.ts)
- [ow-tools route](/Users/dennis/Projects/pms/src/app/.well-known/ow-tools/route.ts)
- [tool route](/Users/dennis/Projects/pms/src/app/api/tools/[tool]/route.ts)

## Goal

Replace the current lightweight Partners agent mode with the same Hub-issued, scoped, auditable machine interface pattern used by PMS.

After this work:

- Hub-managed agent keys should exchange into short-lived `partners` access tokens
- Partners should verify those tokens locally
- tool discovery should be authenticated
- tool invocation should use the standard request and response envelope
- permissions and property scope should be enforced per request
- meaningful writes should be audited
- restricted actions should be clearly separated from normal guarded writes

## Current State In This Repo

The current implementation is partial and not yet PMS-grade.

### What already exists

- `/.well-known/ow-tools`
- `POST /api/tools/[tool]`
- a small tool catalog in [src/lib/tools/definitions.ts](../src/lib/tools/definitions.ts)
- a simple runtime in [src/lib/tools/runtime.ts](../src/lib/tools/runtime.ts)
- current handlers in [src/lib/tools/handlers.ts](../src/lib/tools/handlers.ts)
- service-layer business logic in [src/lib/services/partners.ts](../src/lib/services/partners.ts)

### What is still wrong

1. Machine auth is still based on a single static token.
   - [src/lib/auth.ts](../src/lib/auth.ts) currently accepts `OW_PARTNERS_AGENT_TOKEN`
   - it trusts actor labels and property context from request headers
   - it does not verify Hub-issued scoped machine tokens like PMS does

2. Discovery is unauthenticated.
   - [src/app/.well-known/ow-tools/route.ts](../src/app/.well-known/ow-tools/route.ts) currently returns the catalog without access checks

3. The tool runtime is too thin.
   - there is no explicit tool-level execution context model
   - there is no classification-scope enforcement for machine tokens
   - there is no durable audit trail for guarded writes

4. Tool coverage is incomplete.
   - only a few read tools and one guarded write exist
   - the current UI can do much more than the machine interface can

5. Approval-sensitive actions are not separated.
   - app-triggered email send is a customer-facing outbound action and should not be a normal guarded write for agents

## Non-Negotiable Rules

1. Do not let tool handlers bypass `src/lib/services/partners.ts`.
2. Do not keep `OW_PARTNERS_AGENT_TOKEN` as the real production machine-auth model.
3. Do not expose anonymous tool discovery or invocation.
4. Do not turn this into a giant generic mutation endpoint.
5. Do not invent a second “agent-only” business logic path.
6. Keep the app id and token audience as `partners`.

## Target Runtime Contract

Partners should match the PMS pattern:

### Discovery

- `GET /.well-known/ow-tools`

Requirements:

- require authenticated read access
- return:
  - `app: "partners"`
  - `specVersion: "1.0"`
  - `toolCatalogVersion`
  - `authModes: ["hub_session", "machine_token"]`
  - declared tools

### Tool introspection

- `GET /api/tools/[tool]`

Requirements:

- require access for the tool
- return metadata for the one tool:
  - `name`
  - `classification`
  - `description`
  - `requiredPermissions`
  - `inputSummary`
  - `outputSummary`

### Tool invocation

- `POST /api/tools/[tool]`

Requirements:

- require access for the tool
- parse request input
- execute through shared runtime
- return standard envelope

## Auth And Scope Implementation

### Replace current lightweight machine auth

Update [src/lib/auth.ts](../src/lib/auth.ts) to follow the PMS model.

Keep:

- Hub handoff session flow
- local session cookie
- dev fallback for local development only

Replace:

- `OW_PARTNERS_AGENT_TOKEN`

With:

- `OW_AGENT_TOKEN_SECRET`

### Required machine token shape

Partners should verify Hub-issued tokens with claims equivalent to PMS:

```ts
type HubAgentPayload = {
  iss: string;
  typ: string;
  aud: string;
  agentId: string;
  credentialId: string;
  actorLabel: string;
  permissions: string[];
  propertyIds: string[];
  allowedToolClassifications: string[];
  activePropertyId: string | null;
  iat: number;
  exp: number;
  jti: string;
};
```

Rules:

- `typ` must be `agent_access`
- `aud` must be `partners`
- `activePropertyId` must be present
- `activePropertyId` must be inside `propertyIds`
- token must be rejected if expired

### Request context

Extend `PartnersRequestContext` to match the PMS shape more closely:

```ts
type PartnersRequestContext = {
  userId: string;
  userName: string;
  email?: string;
  role: PartnersRole;
  propertyId: string;
  source: "shell" | "agent" | "dev";
  actorType?: "human" | "agent";
  permissions?: string[];
  allowedToolClassifications?: string[];
  credentialId?: string;
};
```

### Authorization behavior

For human sessions:

- current role-based access can stay for browser behavior

For agent requests:

- role must not be the main trust boundary
- permission checks must come from token scope
- tool classification scope must be enforced

### Required auth resolution order

1. valid machine bearer token
2. valid Partners cookie session
3. valid dev fallback in non-production
4. reject

## Permissions Standard

Use the `partners.*` namespace, not `cms.*`.

Recommended minimum permissions:

- `partners.organizations.read`
- `partners.organizations.write`
- `partners.contacts.read`
- `partners.contacts.write`
- `partners.outreach.read`
- `partners.outreach.write`
- `partners.outreach.send`
- `partners.tasks.read`
- `partners.tasks.write`
- `partners.research.read`
- `partners.research.write`
- `partners.admin`

### Permission mapping guidance

- read-only list/get tools should require `*.read`
- mutation tools should require `*.write`
- outbound send tools should require `partners.outreach.send`
- restricted operational tools should require `partners.admin`

## Tool Catalog To Implement

The next Codex should expand the tool surface so it meaningfully covers the current UI.

### Read tools

- `get_dashboard_summary`
- `get_partner_account`
- `find_partner_accounts`
- `list_recent_active_accounts`
- `list_saved_view_counts`
- `list_tasks`
- `list_research_findings`
- `get_research_finding`

### Draft tools

- `draft_intro_email`
- `draft_followup_email`
- `draft_whatsapp_intro`

### Guarded write tools

- `create_partner_account`
- `update_partner_profile`
- `update_partner_status`
- `add_partner_contact`
- `log_outreach_touch`
- `create_task`
- `assign_task`
- `complete_task`
- `reopen_task`
- `create_research_finding`
- `review_research_finding`
- `discard_research_finding`
- `promote_research_finding`

### Restricted tools

- `send_intro_email`
- `send_followup_email`
- `archive_partner_account`
- `unarchive_partner_account`
- `bulk_update_accounts`

Notes:

- restricted tools should not be hidden inside generic “write” paths
- if approval execution is not fully implemented yet, restricted tools should still be declared and should fail cleanly with `APPROVAL_REQUIRED` or explicit restricted-access denial

## Tool Classification Rules

### Read

- no mutation
- no audit required by default

### Draft

- no mutation
- may be logged later if desired

### Guarded write

- validated mutation
- permission checked
- property scoped
- audited every time

### Restricted

- customer-facing outbound send
- bulk write
- archive/unarchive if treated as high-impact
- must be auditable
- should be approval-ready

## Runtime Refactor Instructions

Refactor the tool runtime to mirror PMS more closely.

### Files to update

- [src/lib/auth.ts](../src/lib/auth.ts)
- [src/lib/tools/definitions.ts](../src/lib/tools/definitions.ts)
- [src/lib/tools/runtime.ts](../src/lib/tools/runtime.ts)
- [src/lib/tools/handlers.ts](../src/lib/tools/handlers.ts) or split into `handlers/*`
- [src/app/.well-known/ow-tools/route.ts](../src/app/.well-known/ow-tools/route.ts)
- [src/app/api/tools/[tool]/route.ts](../src/app/api/tools/[tool]/route.ts)
- [src/lib/services/partners.ts](../src/lib/services/partners.ts)
- [prisma/schema.prisma](../prisma/schema.prisma)

### Runtime requirements

Add:

- correlation id resolution
- machine token classification enforcement
- tool access enforcement by permission
- consistent status-code mapping
- structured runtime execution context
- audit hooks for guarded writes and restricted tools

Recommended runtime pieces:

- `findToolDefinition`
- `listPartnerTools`
- `executePartnerTool`
- `ToolError`
- `ensureToolAccess`
- `createActorFromContext`
- `summarizeInput`
- `summarizeOutput`

## Audit Implementation

Add a durable audit model similar to PMS.

### Recommended Prisma model

```prisma
model ToolActionAudit {
  id              String   @id @default(cuid())
  app             String
  toolName        String
  classification  String
  actorType       String
  actorId         String
  actorLabel      String
  credentialId    String?
  requestSource   String
  propertyId      String?
  targetType      String?
  targetId        String?
  inputSummary    String?
  outputSummary   String?
  correlationId   String
  status          String
  errorCode       String?
  createdAt       DateTime @default(now())

  @@index([app, toolName, createdAt])
  @@index([propertyId, createdAt])
}
```

Minimum audit rules:

- audit every guarded write
- audit every restricted action
- audit success and failure
- include `credentialId` for agent calls when available

### Target summary guidance

Examples:

- `targetType: "partner_organization"`
- `targetType: "research_finding"`
- `targetType: "follow_up_task"`

## Approval Guidance

This repo should be **approval-ready**, even if a full approval UI is not built in the same pass.

For now:

- `send_intro_email`
- `send_followup_email`
- `bulk_update_accounts`

should be treated as restricted.

If there is no full approval request model implemented yet, return a structured failure:

- `errorCode: "APPROVAL_REQUIRED"`

or restrict execution to privileged direct callers only:

- human admin session
- admin-scoped agent with `restricted` classification allowed

Document which choice was implemented.

## Environment Changes

### Remove from the real auth path

- `OW_PARTNERS_AGENT_TOKEN`

### Add

- `OW_AGENT_TOKEN_SECRET`

Keep:

- `OW_PARTNERS_SESSION_SECRET`
- `OW_MODULE_HANDOFF_SECRET`
- `RESEND_API_KEY`
- `OW_PARTNERS_EMAIL_FROM`
- `OW_PARTNERS_EMAIL_REPLY_TO`

## Route Behavior Requirements

### `/.well-known/ow-tools`

- require `read` access
- no anonymous discovery

### `/api/tools/[tool]`

- support `GET` for tool metadata
- support `POST` for execution
- no generic “call any tool by body name” endpoint is required

## Current UI To Tool Mapping

The next Codex should ensure the tool surface maps cleanly onto existing UI capabilities.

### Accounts page

- create account
- list and filter accounts
- bulk update

### Account detail

- update profile
- update stage
- add contact
- log outreach touch
- create task
- archive / unarchive

### First outreach

- draft intro email
- send intro email
- log manual send

### Research

- create finding
- mark reviewed
- discard
- promote

### Tasks

- list tasks
- assign to me
- mark done
- reopen

## Definition Of Done

The implementation is done when all of these are true:

1. Partners accepts Hub-issued machine tokens with `aud: "partners"`.
2. `OW_PARTNERS_AGENT_TOKEN` is no longer the real production machine-auth model.
3. `GET /.well-known/ow-tools` requires auth and returns the expanded catalog.
4. `GET /api/tools/[tool]` exists and returns metadata.
5. `POST /api/tools/[tool]` uses shared runtime with correlation id, auth, and permission enforcement.
6. guarded writes are audited.
7. restricted tools are classified separately and handled as restricted.
8. the tool catalog covers the main current UI capabilities.
9. property scope is enforced on every property-scoped tool call.
10. lint and build pass.

## Verification Checklist

After implementation:

1. Create a Hub agent with `Partners` app access
2. Grant property scope for the correct property
3. Grant `partners.*` permissions
4. Exchange Hub key for a `partners` app token
5. Call `GET /.well-known/ow-tools`
6. Call `GET /api/tools/get_partner_account`
7. Call `POST /api/tools/find_partner_accounts`
8. Call one guarded write like `create_research_finding`
9. Verify audit row exists
10. Verify an out-of-scope agent is denied

## Delivery Expectation For The Next Codex

The next Codex should:

1. inspect PMS reference files before coding
2. implement the runtime and auth changes in this repo
3. expand the tool catalog
4. add the audit model and migration
5. run `pnpm lint`
6. run `pnpm build`
7. push to `origin/main`

Do not stop at writing docs.
This brief is for implementation.
