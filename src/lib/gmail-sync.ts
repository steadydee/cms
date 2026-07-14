export type GmailMessageReference = {
  id: string;
  threadId: string;
};

export type GmailHistoryPage = {
  history?: Array<{
    messages?: GmailMessageReference[];
    messagesAdded?: Array<{ message: GmailMessageReference }>;
  }>;
  historyId?: string;
};

export type TrackedGmailThreadTarget = {
  organizationId: string;
  contactId?: string | null;
  providerThreadId: string;
};

export type TrackedGmailThread<TMessage extends GmailMessageReference> = {
  id: string;
  messages?: TMessage[];
};

export function collectGmailHistoryMessageRefs(pages: GmailHistoryPage[]) {
  const messageRefs = new Map<string, GmailMessageReference>();
  let latestHistoryId: string | null = null;

  for (const page of pages) {
    latestHistoryId = page.historyId || latestHistoryId;

    for (const entry of page.history ?? []) {
      for (const item of entry.messagesAdded ?? []) {
        messageRefs.set(item.message.id, item.message);
      }

      for (const item of entry.messages ?? []) {
        messageRefs.set(item.id, item);
      }
    }
  }

  return {
    latestHistoryId,
    messageRefs,
  };
}

export function buildTrackedGmailThreadImports<TMessage extends GmailMessageReference>(
  target: TrackedGmailThreadTarget,
  thread: TrackedGmailThread<TMessage>
) {
  if (thread.id !== target.providerThreadId) return [];

  return (thread.messages ?? []).map((gmailMessage) => ({
    gmailMessage,
    forcedMatch: {
      organizationId: target.organizationId,
      contactId: target.contactId ?? null,
    },
  }));
}
