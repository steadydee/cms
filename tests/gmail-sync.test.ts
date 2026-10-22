import assert from "node:assert/strict";
import test from "node:test";
import { GmailApiError, isMissingGmailResource, readGmailSyncItem } from "../src/lib/gmail-errors";
import {
  buildTrackedGmailThreadImports,
  collectGmailHistoryMessageRefs,
} from "../src/lib/gmail-sync";

test("sync continues past deleted messages and threads to read later mail", async () => {
  for (const kind of ["messages", "threads"]) {
    const imported: string[] = [];
    let missing = 0;
    for (const id of ["deleted", "reply"]) {
      const path = `${kind}/${id}`;
      const item = await readGmailSyncItem(path, async () => {
        if (id === "deleted") throw new GmailApiError(404, "GET", `${path}?format=full`, "Not found");
        return { id };
      });
      if (item) imported.push(item.id);
      else missing += 1;
    }
    assert.deepEqual(imported, ["reply"]);
    assert.equal(missing, 1);
  }
});

test("sync does not swallow authorization, quota, network, or unrelated 404 failures", async () => {
  const path = "messages/missing";
  for (const error of [
    ...[401, 403, 429, 500].map((status) => new GmailApiError(status, "GET", path, "Failure")),
    new GmailApiError(404, "POST", path, "Failure"),
    new GmailApiError(404, "GET", "labels/missing", "Failure"),
    new Error("Gmail API request failed (404): untyped failure"),
    new Error("Network timeout"),
  ]) {
    await assert.rejects(readGmailSyncItem(path, async () => { throw error; }), (actual) => actual === error);
  }
});

test("expired history is distinguished from missing mail and other Gmail errors", async () => {
  assert.equal(isMissingGmailResource(new GmailApiError(404, "GET", "history?startHistoryId=123", "Expired"), "history"), true);
  assert.equal(isMissingGmailResource(new GmailApiError(404, "GET", "messages/123", "Deleted"), "history"), false);
  for (const path of ["history", "labels/missing", "messages", "messages/123/modify"]) {
    await assert.rejects(readGmailSyncItem(path, async () => ({})), /Only individual Gmail messages and threads/);
  }
});

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
