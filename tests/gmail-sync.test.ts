import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrackedGmailThreadImports,
  collectGmailHistoryMessageRefs,
} from "../src/lib/gmail-sync";

test("Gmail history collection includes all paginated message references without duplicates", () => {
  const result = collectGmailHistoryMessageRefs([
    {
      historyId: "100",
      history: [
        {
          messagesAdded: [{ message: { id: "msg-1", threadId: "thread-1" } }],
          messages: [{ id: "msg-2", threadId: "thread-2" }],
        },
      ],
    },
    {
      historyId: "101",
      history: [
        {
          messagesAdded: [{ message: { id: "msg-3", threadId: "thread-3" } }],
          messages: [{ id: "msg-2", threadId: "thread-2" }],
        },
      ],
    },
  ]);

  assert.equal(result.latestHistoryId, "101");
  assert.deepEqual(Array.from(result.messageRefs.values()), [
    { id: "msg-1", threadId: "thread-1" },
    { id: "msg-2", threadId: "thread-2" },
    { id: "msg-3", threadId: "thread-3" },
  ]);
});

test("tracked Gmail thread imports include unlabeled inbound replies by forced CMS match", () => {
  const imports = buildTrackedGmailThreadImports(
    {
      organizationId: "org-1",
      contactId: "contact-1",
      providerThreadId: "thread-1",
    },
    {
      id: "thread-1",
      messages: [
        { id: "sent-1", threadId: "thread-1", labelIds: ["SENT", "Label_1"] },
        { id: "reply-1", threadId: "thread-1", labelIds: ["INBOX"] },
      ],
    }
  );

  assert.deepEqual(imports, [
    {
      gmailMessage: { id: "sent-1", threadId: "thread-1", labelIds: ["SENT", "Label_1"] },
      forcedMatch: { organizationId: "org-1", contactId: "contact-1" },
    },
    {
      gmailMessage: { id: "reply-1", threadId: "thread-1", labelIds: ["INBOX"] },
      forcedMatch: { organizationId: "org-1", contactId: "contact-1" },
    },
  ]);
});
