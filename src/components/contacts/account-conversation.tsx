"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Mail, Paperclip, RefreshCw, Reply, Send, WandSparkles, X } from "lucide-react";
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

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DISPLAY_LOCALE = "en-US";
const DISPLAY_TIME_ZONE = "America/Bogota";

function mergeTemplate(body: string, subject: string, company: string, name: string) {
  return {
    subject: subject.replaceAll("{company}", company).replaceAll("{name}", name),
    body: body.replaceAll("{company}", company).replaceAll("{name}", name),
  };
}

function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(date));
}

function getReplySubject(subject: string | null | undefined) {
  const value = subject?.trim() || "";
  if (!value) return "Re:";
  return /^re:/i.test(value) ? value : `Re: ${value}`;
}

function formatInboxTime(date: Date | string) {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(date));
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusNotice({ state }: { state: SaveState }) {
  if (state.kind === "idle" || !state.message) return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-[13px] ${
        state.kind === "error"
          ? "border-[var(--destructive-soft)] bg-[var(--destructive-soft)] text-[var(--destructive)]"
          : "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent-deep)]"
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
  const deliveryLine = outbound
    ? `From ${message.fromEmail || "mailbox"} · To ${toEmails || "recipient"}`
    : `From ${message.fromEmail || "sender"}`;

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            {outbound ? "Sent" : "Reply"}
          </p>
          <p className="mt-2 text-[14px] font-medium text-[var(--ink)]">
            {deliveryLine}
          </p>
        </div>
        <p className="whitespace-nowrap text-[12px] text-[var(--ink-soft)]">{formatDateTime(message.sentAt)}</p>
      </div>
      <div className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">
        {message.bodyText}
      </div>
    </div>
  );
}

export function AccountConversation({ contact }: AccountConversationProps) {
  const router = useRouter();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

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
  const [activeThreadId, setActiveThreadId] = useState(contact.emailThreads[0]?.id ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [fromEmail, setFromEmail] = useState(contact.mailbox.fromOptions[0]?.email ?? contact.mailbox.connectedEmail ?? "");
  const [toEmail, setToEmail] = useState(defaultRecipient?.email ?? "");
  const [contactId, setContactId] = useState(defaultRecipient?.contactId ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const activeThread = contact.emailThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const currentRecipientKey = recipientOptions.find((option) => {
    const optionContactId = option.contactId ?? "";
    return option.email.toLowerCase() === toEmail.toLowerCase() && optionContactId === contactId;
  })?.key ?? "";
  const conversationReturnTo = `/contacts/${contact.id}`;

  function clearAttachment() {
    setAttachment(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  function openNewDraft() {
    setActiveThreadId("");
    setSelectedTemplateId("");
    setSubject("");
    setBody("");
    clearAttachment();
    setSaveState({ kind: "idle" });
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
    clearAttachment();
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
    <section className="rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Conversation</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[var(--ink)]">Email threads and replies</h2>
          <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[var(--ink-soft)]">
            Send 1:1 partner outreach from the connected Gmail inbox. Replies sync back into this account so the thread stays visible here and in Gmail.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[12px] text-[var(--ink-soft)]">
          {contact.mailbox.connected ? (
            <>
              <p className="font-medium text-[var(--ink)]">{contact.mailbox.connectedEmail}</p>
              <p className="mt-1">
                {contact.mailbox.lastSyncedAt
                  ? `Last synced ${formatDateTime(contact.mailbox.lastSyncedAt)}`
                  : "Connected. Sync inbox to import replies."}
              </p>
              {contact.mailbox.fromOptions.length > 1 ? (
                <p className="mt-1">{contact.mailbox.fromOptions.length - 1} send alias{contact.mailbox.fromOptions.length === 2 ? "" : "es"} available</p>
              ) : null}
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
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {isPending ? "Syncing..." : "Sync inbox"}
          </button>
        ) : (
          <Link
            href={`/auth/gmail/connect?returnTo=${encodeURIComponent(conversationReturnTo)}`}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--accent-contrast)] ${
              contact.mailbox.configured ? "bg-[var(--accent)]" : "bg-[var(--ink-faint)] pointer-events-none"
            }`}
          >
            <Mail className="h-4 w-4" />
            Connect Gmail
          </Link>
        )}

        <button
          type="button"
          onClick={openNewDraft}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--line-soft)] px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)]"
        >
          <Inbox className="h-4 w-4" />
          New email
        </button>

        {activeThread ? (
          <button
            type="button"
            onClick={replyToThread}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)]"
          >
            <Reply className="h-4 w-4" />
            Reply to thread
          </button>
        ) : null}
      </div>

      {contact.mailbox.lastSyncError ? (
        <div className="mt-4 rounded-xl border border-[var(--destructive-soft)] bg-[var(--destructive-soft)] px-4 py-3 text-[13px] text-[var(--destructive)]">
          Gmail sync error: {contact.mailbox.lastSyncError}
        </div>
      ) : null}

      <div className="mt-6 space-y-5">
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line-soft)]">
          <div className="flex items-center justify-between gap-3">
            <p className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Threads</p>
            <span className="px-4 py-3 text-[11px] text-[var(--ink-soft)]">{contact.emailThreads.length}</span>
          </div>

          <div className="border-t border-[var(--line)]">
            {contact.emailThreads.length === 0 ? (
              <div className="px-4 py-5 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                No synced email threads yet. Connect Gmail, send the first message, then sync replies here.
              </div>
            ) : (
              contact.emailThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    clearAttachment();
                    setSaveState({ kind: "idle" });
                  }}
                  className={`grid w-full grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--line)] px-4 py-3 text-left transition first:border-t-0 ${
                    activeThreadId === thread.id
                      ? "bg-[var(--accent-soft)]"
                      : "bg-[var(--card)] hover:bg-[var(--line-soft)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--ink)]">
                      {thread.contact?.fullName || contact.name}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[var(--ink)]">
                      <span className="font-medium">{thread.subject || "Untitled thread"}</span>
                      <span className="text-[var(--ink-soft)]">{" — "}{thread.snippet || "No preview"}</span>
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-[11px] text-[var(--ink-faint)]">
                    {formatInboxTime(thread.lastMessageAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          {activeThread ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
              <div className="max-h-[520px] overflow-y-auto divide-y divide-[var(--line)]">
                {activeThread.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2">
              <WandSparkles className="h-4 w-4 text-[var(--warm)]" />
              <p className="text-[13px] font-medium text-[var(--ink)]">
                {activeThread ? "Reply composer" : "Email composer"}
              </p>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Template</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => {
                  const nextTemplateId = event.target.value;
                  setSelectedTemplateId(nextTemplateId);

                  if (!nextTemplateId) {
                    return;
                  }

                  const template = contact.emailTemplates.find((entry) => entry.id === nextTemplateId);
                  if (!template) {
                    return;
                  }

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
                className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              >
                <option value="">No template</option>
                {contact.emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)]">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">From</label>
                <select
                  value={fromEmail}
                  onChange={(event) => setFromEmail(event.target.value)}
                  disabled={!contact.mailbox.connected}
                  className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
                >
                  {contact.mailbox.fromOptions.length > 0 ? (
                    contact.mailbox.fromOptions.map((option) => (
                      <option key={option.email} value={option.email}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">Connect Gmail</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Saved recipient</label>
                <select
                  value={currentRecipientKey}
                  onChange={(event) => applyRecipient(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
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
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">To</label>
                <input
                  value={toEmail}
                  onChange={(event) => setToEmail(event.target.value)}
                  placeholder="partner@example.com"
                  className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
              Edit canonical account or person emails in the right rail if you want this address saved permanently.
            </p>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Subject</label>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Body</label>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-2 min-h-[220px] w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Attachment</p>
                  <p className="mt-1 text-[12px] text-[var(--ink-faint)]">One file, sent only with this email.</p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  <Paperclip className="h-4 w-4" />
                  {attachment ? "Replace file" : "Attach file"}
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) {
                        clearAttachment();
                        return;
                      }

                      if (file.size > MAX_ATTACHMENT_BYTES) {
                        clearAttachment();
                        setSaveState({ kind: "error", message: "Attachments are limited to 10 MB." });
                        return;
                      }

                      setAttachment(file);
                      setSaveState({ kind: "idle" });
                    }}
                  />
                </label>
              </div>

              {attachment ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
                  <Paperclip className="h-4 w-4 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1 truncate">
                    {attachment.name} · {formatAttachmentSize(attachment.size)}
                  </span>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="rounded-md p-1 text-[var(--ink-faint)] transition hover:bg-[var(--line-soft)] hover:text-[var(--ink)]"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!contact.mailbox.connected || !fromEmail.trim() || !toEmail.trim() || !subject.trim() || !body.trim() || isPending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("organizationId", contact.id);
                  formData.set("fromEmail", fromEmail);
                  formData.set("toEmail", toEmail);
                  formData.set("subject", subject);
                  formData.set("body", body);
                  if (contactId) formData.set("contactId", contactId);
                  if (activeThread) formData.set("threadId", activeThread.id);
                  if (attachment) formData.set("attachment", attachment);
                  runAction(
                    sendAccountEmailAction,
                    formData,
                    activeThread ? "Reply sent through Gmail." : "Email sent through Gmail.",
                    () => {
                      clearAttachment();
                      if (!activeThread) {
                        setBody("");
                      }
                    }
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-contrast)] disabled:opacity-60"
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
