# Partners Email Workspace

## Intent

The account page should be the working surface for 1:1 partner outreach.

Humans should be able to:

- connect the Owl's Watch Gmail inbox once
- compose and send from the account page
- see the same outbound messages in Gmail
- sync replies and sent mail back into Partners
- keep email, notes, calls, WhatsApp, and follow-up tasks visible in one record

This is not a broadcast system.
For account-level relationship outreach, Gmail is the primary send path.

## Product Shape

The account detail page now has a dedicated `Conversation` section with:

- Gmail connection state
- sync status and manual inbox sync
- thread list for the current account
- conversation view for the active thread
- template-assisted plain-text composer

The old `mailto` helper and manual `Log as sent` flow should no longer be treated as the primary email workflow.

## Data Model

### `MailboxConnection`

Stores one connected Gmail mailbox per property:

- connected email address
- encrypted refresh token
- Gmail history cursor
- label id / label name
- last sync timestamp and last sync error

### `EmailThread`

Stores Gmail thread state for one account:

- Gmail `threadId`
- mapped account and optional person
- subject, snippet, participant emails
- last inbound / outbound timestamps

### `EmailMessage`

Stores each imported or app-sent Gmail message:

- Gmail `messageId`
- optional RFC822 `Message-Id`
- direction (`outbound`, `inbound`)
- plain text / html body
- sender and recipient addresses
- sent timestamp
- match source (`thread_id`, `participant_email`, `manual`)

## Gmail Flow

### Connect

1. User clicks `Connect Gmail` from the account page.
2. Partners redirects to Google OAuth.
3. Google returns to `/auth/gmail/callback`.
4. Partners exchanges the code, stores the encrypted refresh token, and ensures the `Owls Watch / Partners` Gmail label exists.

### Send

1. User composes in the account page.
2. Partners sends through Gmail API using the connected mailbox.
3. The sent Gmail message is fetched back from Gmail and stored locally as an `EmailMessage`.
4. Partners also writes an `OutreachTouch` summary so existing dashboards and next-step logic keep working.

### Sync

1. User clicks `Sync inbox`.
2. Partners uses Gmail history when available, or falls back to a recent mailbox import.
3. Incoming and outgoing messages are matched by:
   - existing thread mapping first
   - participant email match second
4. Matched messages are stored under the account and shown in the account conversation workspace.

Unmatched messages are skipped for now rather than creating an inbox queue.

## Current Constraints

- Compose is plain text first, not rich text.
- Attachments are not included in this pass.
- Sync is manual in this pass.
- Resend remains in the repo for legacy/system paths, but not as the primary account-level outreach path.

## Required Environment

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OW_PARTNERS_GMAIL_TOKEN_SECRET`

Google OAuth redirect URIs must include:

- local: `http://localhost:3002/api/auth/gmail/callback`
- production: `https://partners-six-gamma.vercel.app/api/auth/gmail/callback`

Add any additional test/staging origins that need Gmail connection.
