"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Mail, RefreshCw, Reply, Send, WandSparkles } from "lucide-react";
import { sendAccountEmailAction, syncMailboxAction } from "@/app/(app)/contacts/actions";
import type { getContactDetailPage } from "@/lib/services/partners";

type ContactDetailData = NonNullable<Awaited<ReturnType<typeof getContactDetailPage>>>;

type AccountConversationProps = {
  contact: ContactDetailData;
};

type SaveState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type RecipientOption = {
  key: string;
  label: string;
  email: string;
  contactId?: string;
};

function mergeTemplate(body: string, subject: string, company: string, name: string) {
  return {
    subject: subject.replaceAll("{company}", company).replaceAll("{name}", name),
    body: body.replaceAll("{company}", company).replaceAll("{name}", name),
  };
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReplySubject(subject: string | null | undefined) {
  const value = subject?.trim() || "";
  if (!value) return "Re:";
  return /^re:/i.test(value) ? value : `Re: ${value}`;
}

function StatusNotice({ state }: { state: SaveState }) {
  if (state.kind === "idle" || !state.message) return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-[13px] ${
        state.kind === "error"
          ? "border-[#f2c8c3] bg-[#fdf0ee] text-[#a03f35]"
          : "border-[#d3e3d8] bg-[#edf5ef] text-[#305340]"
      }`}
    >
      {state.message}
    </div>
  );
}

function MessageBubble({
  message,
}: {
  message: ContactDetailData["emailThreads"][number]["messages"][number];
}) {
  const outbound = message.direction === "outbound";
  const toEmails = Array.isArray(message.toEmails) ? message.toEmails.join(", ") : "";

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm ${
          outbound
            ? "border-[#d5e5da] bg-[#f1f7f3]"
            : "border-[#ebe3d8] bg-[#fffdfa]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8c7e6a]">
          <span className="font-semibold uppercase tracking-[0.14em]">
            {outbound ? "Sent" : "Reply"}
          </span>
          <span>{formatDateTime(message.sentAt)}</span>
        </div>
        <p className="mt-2 text-[12px] text-[#6d614d]">
          {outbound ? `To ${toEmails || "recipient"}` : `From ${message.fromEmail || "sender"}`}
        </p>
        <div className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[#2c2416]">
          {message.bodyText}
        </div>
      </div>
    </div>
  );
}

export function AccountConversation({ contact }: AccountConversationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const defaultTemplate = contact.emailTemplates[0] ?? null;

  const recipientOptions = useMemo<RecipientOption[]>(() => {
    const options: RecipientOption[] = [];
    const seen = new Set<string>();

    const addOption = (option: RecipientOption | null) => {
      if (!option) return;
      const key = `${option.contactId || "account"}:${option.email.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      options.push(option);
    };

    if (contact.primaryContact?.email) {
      addOption({
        key: `contact:${contact.primaryContact.id}`,
        label: `${contact.primaryContact.fullName} · primary person`,
        email: contact.primaryContact.email,
        contactId: contact.primaryContact.id,
      });
    }

    if (contact.email) {
      addOption({
        key: "account",
        label: `${contact.name} · account email`,
        email: contact.email,
      });
    }

    for (const person of contact.contacts) {
      if (!person.email) continue;
      addOption({
        key: `contact:${person.id}`,
        label: `${person.fullName}${person.roleTitle ? ` · ${person.roleTitle}` : ""}`,
        email: person.email,
        contactId: person.id,
      });
    }

    return options;
  }, [contact]);

  const defaultRecipient = recipientOptions[0] ?? null;
  const defaultMergedTemplate = defaultTemplate
    ? mergeTemplate(
        defaultTemplate.body,
        defaultTemplate.subject,
        contact.name,
        defaultRecipient?.label.split(" · ")[0] || contact.name
      )
    : { subject: "", body: "" };

  const [activeThreadId, setActiveThreadId] = useState(contact.emailThreads[0]?.id ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplate?.id ?? "");
  const [toEmail, setToEmail] = useState(defaultRecipient?.email ?? "");
  const [contactId, setContactId] = useState(defaultRecipient?.contactId ?? "");
  const [subject, setSubject] = useState(defaultMergedTemplate.subject);
  const [body, setBody] = useState(defaultMergedTemplate.body);

  const activeThread = contact.emailThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const conversationReturnTo = `/contacts/${contact.id}`;

  function resetToTemplate(templateId?: string) {
    const template = contact.emailTemplates.find((entry) => entry.id === (templateId || selectedTemplateId))
      ?? defaultTemplate;
    if (!template) return;

    const recipientLabel = recipientOptions.find((entry) => entry.contactId === contactId)?.label.split(" · ")[0]
      || defaultRecipient?.label.split(" · ")[0]
      || contact.name;
    const merged = mergeTemplate(template.body, template.subject, contact.name, recipientLabel);
    setSubject(merged.subject);
    setBody(merged.body);
  }

  function openNewDraft() {
    setActiveThreadId("");
    setSaveState({ kind: "idle" });
    resetToTemplate(defaultTemplate?.id);
  }

  function replyToThread() {
    if (!activeThread) return;

    const lastInbound = [...activeThread.messages].reverse().find((message) => message.direction === "inbound") ?? null;
    const fallbackEmail = activeThread.contact?.email || recipientOptions[0]?.email || "";
    const nextRecipientEmail = lastInbound?.fromEmail || fallbackEmail;

    const matchedRecipient = recipientOptions.find((option) => option.email.toLowerCase() === nextRecipientEmail.toLowerCase());
    setToEmail(nextRecipientEmail);
    setContactId(matchedRecipient?.contactId ?? activeThread.contact?.id ?? "");
    setSubject(getReplySubject(activeThread.subject));
    setBody("");
    setSaveState({ kind: "idle" });
  }

  function applyRecipient(key: string) {
    const selected = recipientOptions.find((option) => option.key === key);
    if (!selected) return;
    setToEmail(selected.email);
    setContactId(selected.contactId ?? "");
  }

  async function runAction(
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
    formData: FormData,
    successMessage: string,
    onSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setSaveState({ kind: "error", message: result.error || "Something went wrong." });
        return;
      }

      setSaveState({ kind: "success", message: successMessage });
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <section className="rounded-[20px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Conversation</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#2c2416]">Email threads and replies</h2>
          <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#8c7e6a]">
            Send 1:1 partner outreach from the connected Gmail inbox. Replies sync back into this account so the thread stays visible here and in Gmail.
          </p>
        </div>

        <div className="rounded-2xl border border-[#ebe3d8] bg-[#fdfaf6] px-4 py-3 text-[12px] text-[#6d614d]">
          {contact.mailbox.connected ? (
            <>
              <p className="font-medium text-[#2c2416]">{contact.mailbox.connectedEmail}</p>
              <p className="mt-1">
                {contact.mailbox.lastSyncedAt
                  ? `Last synced ${formatDateTime(contact.mailbox.lastSyncedAt)}`
                  : "Connected. Sync inbox to import replies."}
              </p>
            </>
          ) : contact.mailbox.configured ? (
            <p>Connect Gmail to send from the app and mirror replies back into this account.</p>
          ) : (
            <p>Google OAuth credentials still need to be configured before Gmail can be connected.</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <StatusNotice state={saveState} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {contact.mailbox.connected ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const formData = new FormData();
              formData.set("organizationId", contact.id);
              runAction(syncMailboxAction, formData, "Inbox synced. Latest Gmail messages were checked for this account.");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ddd2c4] px-4 py-2 text-[13px] font-medium text-[#6d614d] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {isPending ? "Syncing..." : "Sync inbox"}
          </button>
        ) : (
          <Link
            href={`/auth/gmail/connect?returnTo=${encodeURIComponent(conversationReturnTo)}`}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium text-white ${
              contact.mailbox.configured ? "bg-[#3d6b4f]" : "bg-[#b7b1a7] pointer-events-none"
            }`}
          >
            <Mail className="h-4 w-4" />
            Connect Gmail
          </Link>
        )}

        <button
          type="button"
          onClick={openNewDraft}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f3ede4] px-4 py-2 text-[13px] font-medium text-[#6b5d4a]"
        >
          <Inbox className="h-4 w-4" />
          New email
        </button>

        {activeThread ? (
          <button
            type="button"
            onClick={replyToThread}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ddd2c4] px-4 py-2 text-[13px] font-medium text-[#6d614d]"
          >
            <Reply className="h-4 w-4" />
            Reply to thread
          </button>
        ) : null}
      </div>

      {contact.mailbox.lastSyncError ? (
        <div className="mt-4 rounded-xl border border-[#f2c8c3] bg-[#fdf0ee] px-4 py-3 text-[13px] text-[#a03f35]">
          Gmail sync error: {contact.mailbox.lastSyncError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[#ebe3d8] bg-[#fcfaf7] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">Threads</p>
            <span className="text-[11px] text-[#8c7e6a]">{contact.emailThreads.length}</span>
          </div>

          <div className="mt-3 space-y-2">
            {contact.emailThreads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#ddd2c4] px-3 py-5 text-[12px] leading-relaxed text-[#8c7e6a]">
                No synced email threads yet. Connect Gmail, send the first message, then sync replies here.
              </div>
            ) : (
              contact.emailThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setSaveState({ kind: "idle" });
                  }}
                  className={`w-full rounded-xl border px-3 py-3 text-left ${
                    activeThreadId === thread.id
                      ? "border-[#d8e7dd] bg-[#eef5f0]"
                      : "border-[#ebe3d8] bg-white"
                  }`}
                >
                  <p className="text-[13px] font-medium text-[#2c2416]">{thread.subject || "Untitled thread"}</p>
                  <p className="mt-1 text-[12px] text-[#8c7e6a]">
                    {thread.contact?.fullName || contact.name}
                  </p>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[#6d614d]">
                    {thread.snippet || "No preview"}
                  </p>
                  <p className="mt-3 text-[11px] text-[#9a8e7a]">
                    {formatDateTime(thread.lastMessageAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-[#ebe3d8] bg-[#fcfaf7] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">
                  {activeThread ? "Active thread" : "New draft"}
                </p>
                <h3 className="mt-2 text-[18px] font-semibold text-[#2c2416]">
                  {activeThread?.subject || "Start a new account email"}
                </h3>
              </div>
              {activeThread ? (
                <p className="text-[12px] text-[#8c7e6a]">
                  {activeThread.messages.length} messages
                </p>
              ) : null}
            </div>

            {activeThread ? (
              <div className="mt-4 space-y-3">
                {activeThread.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#ddd2c4] px-4 py-5 text-[13px] leading-relaxed text-[#8c7e6a]">
                Use a template, choose the best recipient email, and send directly from Gmail without leaving this account.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#ebe3d8] bg-white p-4">
            <div className="flex items-center gap-2">
              <WandSparkles className="h-4 w-4 text-[#c4713b]" />
              <p className="text-[13px] font-medium text-[#2c2416]">
                {activeThread ? "Reply composer" : "Email composer"}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">Choose template</p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {contact.emailTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={selectedTemplateId === template.id}
                  onClick={() => {
                    setSelectedTemplateId(template.id);
                    const recipientLabel = recipientOptions.find((entry) => entry.contactId === contactId)?.label.split(" · ")[0]
                      || defaultRecipient?.label.split(" · ")[0]
                      || contact.name;
                    const merged = mergeTemplate(template.body, template.subject, contact.name, recipientLabel);
                    setSubject(merged.subject);
                    setBody(merged.body);
                    if (!activeThread) {
                      setActiveThreadId("");
                    }
                  }}
                  className={`rounded-xl border px-4 py-3 text-left text-[12px] font-semibold shadow-sm transition active:scale-[0.99] ${
                    selectedTemplateId === template.id
                      ? "border-[#3d6b4f] bg-[#ebf3ed] text-[#2f5540] shadow-[0_0_0_1px_rgba(61,107,79,0.08)]"
                      : "border-[#e8e0d4] bg-[#fcfaf7] text-[#5d5344] hover:border-[#d3c6b4] hover:bg-white"
                  }`}
                >
                  <span className="block">{template.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">Saved recipient</label>
                <select
                  value={recipientOptions.find((option) => option.email === toEmail && option.contactId === contactId)?.key || ""}
                  onChange={(event) => applyRecipient(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
                >
                  <option value="">Custom address</option>
                  {recipientOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">To</label>
                <input
                  value={toEmail}
                  onChange={(event) => setToEmail(event.target.value)}
                  placeholder="partner@example.com"
                  className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
                />
              </div>
            </div>

            <p className="mt-2 text-[12px] text-[#8c7e6a]">
              Edit canonical account or person emails in the right rail if you want this address saved permanently.
            </p>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">Subject</label>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
              />
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">Body</label>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-2 min-h-[220px] w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!contact.mailbox.connected || !toEmail.trim() || !subject.trim() || !body.trim() || isPending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("organizationId", contact.id);
                  formData.set("toEmail", toEmail);
                  formData.set("subject", subject);
                  formData.set("body", body);
                  if (contactId) formData.set("contactId", contactId);
                  if (activeThread) formData.set("threadId", activeThread.id);
                  runAction(
                    sendAccountEmailAction,
                    formData,
                    activeThread ? "Reply sent through Gmail." : "Email sent through Gmail.",
                    () => {
                      if (!activeThread) {
                        setBody("");
                      }
                    }
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isPending ? "Sending..." : "Send via Gmail"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
