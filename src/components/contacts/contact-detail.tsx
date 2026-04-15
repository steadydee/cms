"use client";

import { useState, useTransition, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Save,
  Tag as TagIcon,
  UserRound,
} from "lucide-react";
import type { RelationshipStatus, VisitStatus } from "@prisma/client";
import {
  archiveContactAction,
  logTemplatedEmailAction,
  saveContactFieldAction,
  saveContactNoteAction,
  saveContactPersonAction,
  saveContactStageAction,
  saveContactTagAction,
  saveOutreachTouchAction,
  saveTaskAction,
  sendTemplatedEmailAction,
  setTaskStatusAction,
  removeContactTagAction,
} from "@/app/(app)/contacts/actions";
import { CONTACT_STAGE_META, getStatusDisplayLabel } from "@/lib/partners-ui";
import type { getContactDetailPage } from "@/lib/services/partners";

type ContactDetailData = NonNullable<Awaited<ReturnType<typeof getContactDetailPage>>>;

const fieldClassName =
  "w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]";

const relationshipStatuses: RelationshipStatus[] = [
  "not_contacted",
  "contacted",
  "awaiting_reply",
  "engaged",
  "visit_scheduled",
  "visited",
  "proposal_sent",
  "active_partner",
  "inactive",
  "not_interested",
];

type ContactDetailProps = {
  contact: ContactDetailData;
  backHref?: string;
};

type SaveState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

function buildDateTimeLocalValue(date: Date | null | undefined) {
  if (!date) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatShortDate(date: Date | null | undefined) {
  if (!date) return "No due date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "Not set";
  return date.toLocaleString();
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function mergeTemplate(body: string, subject: string, company: string, name: string) {
  return {
    subject: subject.replaceAll("{company}", company).replaceAll("{name}", name),
    body: body.replaceAll("{company}", company).replaceAll("{name}", name),
  };
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

function StageBadge({ stage }: { stage: ContactDetailData["displayStage"] }) {
  const meta = CONTACT_STAGE_META[stage];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.className}`}>{meta.label}</span>;
}

function StreamBadge({ type }: { type: ContactDetailData["activityStream"][number]["type"] }) {
  const styles: Record<string, { label: string; className: string }> = {
    note: { label: "Note", className: "bg-white text-[#3d6b4f] border-[#e8e0d4]" },
    research: { label: "AI", className: "bg-[#f3eef8] text-[#6b4c8a] border-[#e4daee]" },
    email: { label: "Email", className: "bg-[#fff3eb] text-[#c4713b] border-[#f0d9c9]" },
    call: { label: "Call", className: "bg-[#fff3eb] text-[#c4713b] border-[#f0d9c9]" },
    whatsapp: { label: "WhatsApp", className: "bg-[#edf7ee] text-[#3d6b4f] border-[#d6e8d9]" },
    visit: { label: "Visit", className: "bg-[#ebf3fa] text-[#2d6fa0] border-[#d8e6f1]" },
    meeting: { label: "Meeting", className: "bg-[#ebf3fa] text-[#2d6fa0] border-[#d8e6f1]" },
    other: { label: "Touch", className: "bg-[#fff3eb] text-[#c4713b] border-[#f0d9c9]" },
    task_done: { label: "Task", className: "bg-[#f5f1ea] text-[#6d614d] border-[#e7ddd0]" },
  };

  const style = styles[type];
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${style.className}`}>{style.label}</span>;
}

export function ContactDetail({ contact, backHref = "/contacts" }: ContactDetailProps) {
  const router = useRouter();
  const defaultTemplate = contact.emailTemplates[0] ?? null;
  const defaultMergedTemplate = defaultTemplate
    ? mergeTemplate(
        defaultTemplate.body,
        defaultTemplate.subject,
        contact.name,
        contact.primaryContact?.fullName || contact.name
      )
    : { subject: "", body: "" };
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const [noteText, setNoteText] = useState("");
  const [logType, setLogType] = useState<"email" | "phone" | "whatsapp" | "meeting" | null>(null);
  const [logText, setLogText] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(defaultTemplate?.id ?? null);
  const [composeSubject, setComposeSubject] = useState(defaultMergedTemplate.subject);
  const [composeBody, setComposeBody] = useState(defaultMergedTemplate.body);
  const [showResearch, setShowResearch] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [nextActionMode, setNextActionMode] = useState(false);
  const [tagName, setTagName] = useState("");
  const [statusValue, setStatusValue] = useState<RelationshipStatus>(contact.status);
  const visitStatusValue: VisitStatus = contact.visitStatus;

  async function runAction(
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
    formData: FormData,
    successMessage: string
  ) {
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setSaveState({ kind: "error", message: result.error || "Save failed." });
        return;
      }

      setSaveState({ kind: "success", message: successMessage });
      router.refresh();
    });
  }

  const mailtoHref = contact.primaryContact?.email || contact.email
    ? `mailto:${encodeURIComponent(contact.primaryContact?.email || contact.email || "")}?subject=${encodeURIComponent(composeSubject)}&body=${encodeURIComponent(composeBody)}`
    : null;

  return (
    <div className="space-y-6">
      <StatusNotice state={saveState} />

      <section className="rounded-[20px] border border-[#e8e0d4] bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href={backHref} className="text-[12px] font-medium text-[#8c7e6a]">
              ← Back
            </Link>
            <h1 className="mt-2 font-serif text-[30px] font-semibold tracking-tight text-[#2c2416]">{contact.name}</h1>
            <p className="mt-2 text-[14px] text-[#8c7e6a]">
              {contact.primaryContact
                ? `${contact.primaryContact.fullName}${contact.primaryContact.roleTitle ? ` · ${contact.primaryContact.roleTitle}` : ""}`
                : "No primary person yet"}
              {(contact.city || contact.country) ? ` · ${[contact.city, contact.country].filter(Boolean).join(", ")}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StageBadge stage={contact.displayStage} />
              {contact.tags.map((entry) => (
                <span key={entry.tag.id} className="rounded-full bg-[#f3ede4] px-2.5 py-1 text-[11px] font-medium text-[#6b5d4a]">
                  {entry.tag.name}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full max-w-[320px] rounded-2xl border border-[#f0d9c9] bg-[#fef7f0] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c4713b]">Next action</p>
                <p className="mt-2 text-[14px] font-medium text-[#2c2416]">
                  {contact.nextActionTask?.title || "No next action set"}
                </p>
                <p className="mt-1 text-[12px] text-[#a15d35]">
                  {contact.nextActionTask?.dueAt ? `Due ${formatDateTime(contact.nextActionTask.dueAt)}` : "Add a task to keep this visible"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNextActionMode((value) => !value)}
                className="rounded-lg border border-[#e7c9b6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#8c5b3f]"
              >
                {nextActionMode ? "Close" : "Edit"}
              </button>
            </div>

            {nextActionMode ? (
              <TaskEditor
                initialTitle={contact.nextActionTask?.title || ""}
                initialDueAt={buildDateTimeLocalValue(contact.nextActionTask?.dueAt)}
                submitLabel={contact.nextActionTask ? "Save next action" : "Create next action"}
                onSubmit={(title, dueAt) => {
                  const formData = new FormData();
                  formData.set("organizationId", contact.id);
                  if (contact.nextActionTask) formData.set("taskId", contact.nextActionTask.id);
                  formData.set("title", title);
                  formData.set("dueAt", dueAt);
                  return runAction(saveTaskAction, formData, "Next action saved.");
                }}
                disabled={isPending}
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-5">
          <div className="rounded-[20px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && noteText.trim()) {
                  const formData = new FormData();
                  formData.set("organizationId", contact.id);
                  formData.set("text", noteText);
                  runAction(saveContactNoteAction, formData, "Note saved.");
                  setNoteText("");
                }
              }}
              placeholder="Add a note... (⌘+Enter to save)"
              className="min-h-[96px] w-full rounded-xl border border-[#e8e0d4] bg-[#fdfaf6] px-4 py-3 text-[14px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#8c7e6a]">Freeform notes stay at the top of the activity stream.</p>
              <button
                type="button"
                disabled={!noteText.trim() || isPending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("organizationId", contact.id);
                  formData.set("text", noteText);
                  runAction(saveContactNoteAction, formData, "Note saved.");
                  setNoteText("");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save note
              </button>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <ActionButton icon={Mail} label="Compose" onClick={() => { setShowCompose(true); setLogType(null); }} />
              <ActionButton icon={MessageSquareText} label="Log email" onClick={() => { setLogType("email"); setShowCompose(false); }} />
              <ActionButton icon={Phone} label="Call" onClick={() => { setLogType("phone"); setShowCompose(false); }} />
              <ActionButton icon={MessageSquareText} label="WhatsApp" onClick={() => { setLogType("whatsapp"); setShowCompose(false); }} />
              <ActionButton icon={UserRound} label="Visit" onClick={() => { setLogType("meeting"); setShowCompose(false); }} />
            </div>

            {logType ? (
              <div className="mt-4 rounded-xl border border-[#f0d9c9] bg-[#fff7f0] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#a15d35]">Log {logType === "meeting" ? "visit" : logType}</p>
                  <button type="button" className="text-[12px] text-[#8c7e6a]" onClick={() => setLogType(null)}>
                    Close
                  </button>
                </div>
                <textarea
                  value={logText}
                  onChange={(event) => setLogText(event.target.value)}
                  placeholder="What happened?"
                  className="mt-3 min-h-[88px] w-full rounded-lg border border-[#ead8ca] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#c4713b]"
                />
                <button
                  type="button"
                  disabled={!logText.trim() || isPending}
                  onClick={() => {
                    const formData = new FormData();
                    formData.set("organizationId", contact.id);
                    formData.set("channel", logType);
                    formData.set("summary", logText);
                    if (contact.primaryContact?.id) formData.set("contactId", contact.primaryContact.id);
                    runAction(saveOutreachTouchAction, formData, "Touch logged.");
                    setLogText("");
                    setLogType(null);
                  }}
                  className="mt-3 rounded-lg bg-[#c4713b] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                >
                  Save touch
                </button>
              </div>
            ) : null}

            {showCompose ? (
              <div className="mt-4 rounded-xl border border-[#e8e0d4] bg-[#fdfaf6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#2c2416]">Compose email</p>
                  <button type="button" className="text-[12px] text-[#8c7e6a]" onClick={() => setShowCompose(false)}>
                    Close
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contact.emailTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        const merged = mergeTemplate(
                          template.body,
                          template.subject,
                          contact.name,
                          contact.primaryContact?.fullName || contact.name
                        );
                        setComposeSubject(merged.subject);
                        setComposeBody(merged.body);
                      }}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                        selectedTemplateId === template.id
                          ? "bg-[#ebf3ed] text-[#3d6b4f]"
                          : "bg-white text-[#6d614d] ring-1 ring-[#e8e0d4]"
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
                <input
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  className={`${fieldClassName} mt-4`}
                />
                <textarea
                  value={composeBody}
                  onChange={(event) => setComposeBody(event.target.value)}
                  className="mt-3 min-h-[180px] w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {mailtoHref ? (
                    <a
                      href={mailtoHref}
                      className="rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white"
                    >
                      Open in email app
                    </a>
                  ) : (
                    <button type="button" disabled className="rounded-lg bg-[#d5d0c6] px-4 py-2 text-[13px] font-medium text-white">
                      Open in email app
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("organizationId", contact.id);
                      formData.set("subject", composeSubject);
                      formData.set("recipientLabel", contact.primaryContact?.fullName || contact.name);
                      if (contact.primaryContact?.id) formData.set("contactId", contact.primaryContact.id);
                      runAction(logTemplatedEmailAction, formData, "Email logged as sent.");
                    }}
                    className="rounded-lg border border-[#2c2416] px-4 py-2 text-[13px] font-medium text-[#2c2416]"
                  >
                    Log as sent
                  </button>
                  {contact.primaryContact?.email || contact.email ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("organizationId", contact.id);
                        formData.set("subject", composeSubject);
                        formData.set("body", composeBody);
                        formData.set("recipientEmail", contact.primaryContact?.email || contact.email || "");
                        formData.set("recipientLabel", contact.primaryContact?.fullName || contact.name);
                        if (contact.primaryContact?.id) formData.set("contactId", contact.primaryContact.id);
                        runAction(sendTemplatedEmailAction, formData, "Email sent with Resend.");
                      }}
                      className="rounded-lg border border-[#c4713b] px-4 py-2 text-[13px] font-medium text-[#c4713b]"
                    >
                      Send with Resend
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[20px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Activity stream</p>
                <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#2c2416]">Latest context</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {contact.activityStream.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
                  No activity yet.
                </div>
              ) : (
                contact.activityStream.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#ece4d8] bg-[#fffdfa] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <StreamBadge type={item.type} />
                        <span className="text-[12px] font-medium text-[#6d614d]">{item.author}</span>
                      </div>
                      <span className="text-[11px] text-[#9a8e7a]">{timeAgo(item.happenedAt)}</span>
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#2c2416]">{item.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <CardSection title="Contact info">
            <EditableField
              key={`email:${contact.email ?? ""}`}
              icon={Mail}
              label="Email"
              initialValue={contact.email || ""}
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "email");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "Email updated.");
              }}
            />
            <EditableField
              key={`phone:${contact.phone ?? ""}`}
              icon={Phone}
              label="Phone"
              initialValue={contact.phone || ""}
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "phone");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "Phone updated.");
              }}
            />
            <EditableField
              key={`whatsapp:${contact.whatsapp ?? ""}`}
              icon={MessageSquareText}
              label="WhatsApp"
              initialValue={contact.whatsapp || ""}
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "whatsapp");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "WhatsApp updated.");
              }}
            />
            <EditableField
              key={`website:${contact.website ?? ""}`}
              icon={TagIcon}
              label="Website"
              initialValue={contact.website || ""}
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "website");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "Website updated.");
              }}
            />
            <EditableField
              key={`city:${contact.city ?? ""}`}
              icon={UserRound}
              label="City"
              initialValue={contact.city || ""}
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "city");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "City updated.");
              }}
            />
            <EditableField
              key={`country:${contact.country ?? ""}`}
              icon={UserRound}
              label="Country"
              initialValue={contact.country || ""}
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "country");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "Country updated.");
              }}
            />
          </CardSection>

          <CardSection title={`People (${contact.contacts.length})`}>
            <div className="space-y-3">
              {contact.contacts.map((person) => (
                <div key={person.id} className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] p-3">
                  {editingPerson === person.id ? (
                    <PersonEditor
                      initialPerson={person}
                      disabled={isPending}
                      onSubmit={(values) => {
                        const formData = new FormData();
                        formData.set("organizationId", contact.id);
                        formData.set("contactId", person.id);
                        Object.entries(values).forEach(([key, value]) => {
                          formData.set(key, typeof value === "boolean" ? (value ? "on" : "") : value);
                        });
                        return runAction(saveContactPersonAction, formData, "Person updated.");
                      }}
                      onClose={() => setEditingPerson(null)}
                    />
                  ) : (
                    <button type="button" className="w-full text-left" onClick={() => setEditingPerson(person.id)}>
                      <div className="text-[13px] font-semibold text-[#2c2416]">
                        {person.fullName}
                        {person.isPrimary ? (
                          <span className="ml-2 rounded-full bg-[#ebf3ed] px-2 py-0.5 text-[10px] font-medium text-[#3d6b4f]">
                            primary
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-[#8c7e6a]">{person.roleTitle || "No role title"}</p>
                      {person.email ? <p className="mt-1 text-[12px] text-[#2d6fa0]">{person.email}</p> : null}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {showAddPerson ? (
              <div className="mt-3 rounded-xl border border-[#e8e0d4] bg-[#fdfaf6] p-3">
                <PersonEditor
                  disabled={isPending}
                  onSubmit={(values) => {
                    const formData = new FormData();
                    formData.set("organizationId", contact.id);
                    Object.entries(values).forEach(([key, value]) => {
                      formData.set(key, typeof value === "boolean" ? (value ? "on" : "") : value);
                    });
                    return runAction(saveContactPersonAction, formData, "Person added.");
                  }}
                  onClose={() => setShowAddPerson(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddPerson(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-[#d8d0c4] px-3 py-2 text-[12px] font-medium text-[#6d614d]"
              >
                <Plus className="h-4 w-4" />
                Add person
              </button>
            )}
          </CardSection>

          <CardSection title="Stage">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Contact status</label>
            <select
              value={statusValue}
              onChange={(event) => {
                const value = event.target.value as RelationshipStatus;
                setStatusValue(value);
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("status", value);
                formData.set("visitStatus", visitStatusValue);
                runAction(saveContactStageAction, formData, "Stage updated.");
              }}
              className={`${fieldClassName} mt-2`}
            >
              {relationshipStatuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusDisplayLabel(status)}
                </option>
              ))}
            </select>
          </CardSection>

          <CardSection title="Tags">
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((entry) => (
                <button
                  key={entry.tag.id}
                  type="button"
                  onClick={() => {
                    const formData = new FormData();
                    formData.set("organizationId", contact.id);
                    formData.set("tagId", entry.tag.id);
                    runAction(removeContactTagAction, formData, "Tag removed.");
                  }}
                  className="rounded-full bg-[#f3ede4] px-2.5 py-1 text-[11px] font-medium text-[#6b5d4a]"
                >
                  {entry.tag.name} ×
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="Add a tag"
                className={fieldClassName}
              />
              <button
                type="button"
                disabled={!tagName.trim() || isPending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("organizationId", contact.id);
                  formData.set("tagName", tagName);
                  runAction(saveContactTagAction, formData, "Tag added.");
                  setTagName("");
                }}
                className="rounded-lg bg-[#2c2416] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </CardSection>

          <CardSection title={`Tasks (${contact.openTasks.length} open)`}>
            <div className="space-y-3">
              {contact.openTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      onChange={(event) => {
                        const formData = new FormData();
                        formData.set("organizationId", contact.id);
                        formData.set("taskId", task.id);
                        formData.set("status", event.target.checked ? "done" : "open");
                        runAction(setTaskStatusAction, formData, event.target.checked ? "Task completed." : "Task reopened.");
                      }}
                      className="mt-1 h-4 w-4 rounded border-[#d2c6b7]"
                    />
                    <div className="min-w-0 flex-1">
                      {editingTask === task.id ? (
                        <TaskEditor
                          initialTitle={task.title}
                          initialDueAt={buildDateTimeLocalValue(task.dueAt)}
                          submitLabel="Save task"
                          onSubmit={(title, dueAt) => {
                            const formData = new FormData();
                            formData.set("organizationId", contact.id);
                            formData.set("taskId", task.id);
                            formData.set("title", title);
                            formData.set("dueAt", dueAt);
                            return runAction(saveTaskAction, formData, "Task saved.");
                          }}
                          onClose={() => setEditingTask(null)}
                          disabled={isPending}
                        />
                      ) : (
                        <>
                          <p className="text-[13px] font-medium text-[#2c2416]">{task.title}</p>
                          <p className={`mt-1 text-[11px] ${task.isOverdue ? "text-[#c4713b]" : "text-[#8c7e6a]"}`}>
                            Due {formatShortDate(task.dueAt)}
                          </p>
                          <button type="button" onClick={() => setEditingTask(task.id)} className="mt-2 text-[11px] font-medium text-[#3d6b4f]">
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            {showAddTask ? (
              <div className="mt-3 rounded-xl border border-[#e8e0d4] bg-[#fdfaf6] p-3">
                <TaskEditor
                  initialTitle=""
                  initialDueAt=""
                  submitLabel="Add task"
                  onSubmit={(title, dueAt) => {
                    const formData = new FormData();
                    formData.set("organizationId", contact.id);
                    formData.set("title", title);
                    formData.set("dueAt", dueAt);
                    return runAction(saveTaskAction, formData, "Task added.");
                  }}
                  onClose={() => setShowAddTask(false)}
                  disabled={isPending}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTask(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-[#d8d0c4] px-3 py-2 text-[12px] font-medium text-[#6d614d]"
              >
                <Plus className="h-4 w-4" />
                Add task
              </button>
            )}
          </CardSection>

          <CardSection title="Source">
            <EditableField
              key={`source:${contact.source ?? ""}`}
              icon={TagIcon}
              label="Source"
              initialValue={contact.source || ""}
              placeholder="manual"
              onSave={(value) => {
                const formData = new FormData();
                formData.set("organizationId", contact.id);
                formData.set("field", "source");
                formData.set("value", value);
                return runAction(saveContactFieldAction, formData, "Source updated.");
              }}
            />
          </CardSection>

          <CardSection title="Research">
            <button
              type="button"
              onClick={() => setShowResearch((value) => !value)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-[13px] font-medium text-[#2c2416]">Market notes and linked findings</span>
              {showResearch ? <ChevronDown className="h-4 w-4 text-[#8c7e6a]" /> : <ChevronRight className="h-4 w-4 text-[#8c7e6a]" />}
            </button>
            {showResearch ? (
              <div className="mt-3 space-y-3">
                <textarea
                  defaultValue={contact.marketNotes || ""}
                  placeholder="Capture research or positioning notes"
                  onBlur={(event) => {
                    const formData = new FormData();
                    formData.set("organizationId", contact.id);
                    formData.set("field", "marketNotes");
                    formData.set("value", event.target.value);
                    runAction(saveContactFieldAction, formData, "Research notes updated.");
                  }}
                  className="min-h-[120px] w-full rounded-lg border border-[#e8e0d4] bg-[#faf7f2] px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#6b4c8a]"
                />
                <div className="space-y-2">
                  {contact.researchFindings.length === 0 ? (
                    <p className="text-[12px] text-[#8c7e6a]">No linked research findings yet.</p>
                  ) : (
                    contact.researchFindings.map((finding) => (
                      <div key={finding.id} className="rounded-lg border border-[#e4daee] bg-[#f7f2fb] px-3 py-2">
                        <p className="text-[12px] font-medium text-[#6b4c8a]">{finding.observedName || "Untitled finding"}</p>
                        <p className="mt-1 text-[12px] text-[#5c5265]">{finding.observedText || "No summary saved."}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </CardSection>

          <form action={archiveContactAction}>
            <input type="hidden" name="organizationId" value={contact.id} />
            <input type="hidden" name="returnTo" value={`/contacts/${contact.id}`} />
            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#f0d9c9] bg-[#fff7f0] px-4 py-3 text-[13px] font-medium text-[#c4713b]">
              <Archive className="h-4 w-4" />
              Archive contact
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-[#e8e0d4] bg-[#fffdfa] px-3 py-2 text-[12px] font-medium text-[#5f5547]"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#e8e0d4] bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EditableField({
  icon: Icon,
  label,
  initialValue,
  placeholder = "Add...",
  onSave,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  return (
    <div className="border-b border-[#f0ebe3] py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-[#8c7e6a]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#aa9c87]">{label}</span>
        </div>
        {!editing ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-[#e8e0d4] px-2 py-1 text-[11px] font-medium text-[#6d614d]"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 pl-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setEditing(false);
                  void onSave(value);
                }

                if (event.key === "Escape") {
                  setValue(initialValue);
                  setEditing(false);
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
            />
            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                type="button"
                className="rounded-md bg-[#2c2416] px-3 py-2 text-[11px] font-medium text-white"
                onClick={() => {
                  setEditing(false);
                  void onSave(value);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-md border border-[#e8e0d4] px-3 py-2 text-[11px] font-medium text-[#6d614d]"
                onClick={() => {
                  setValue(initialValue);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 pl-7 text-[15px] text-[#2c2416]">
          {value || <span className="text-[#aa9c87]">{placeholder}</span>}
        </div>
      )}
    </div>
  );
}

function PersonEditor({
  initialPerson,
  submitLabel = "Save person",
  onSubmit,
  onClose,
  disabled,
}: {
  initialPerson?: {
    fullName: string;
    roleTitle: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    isPrimary: boolean;
  };
  submitLabel?: string;
  onSubmit: (values: {
    fullName: string;
    roleTitle: string;
    email: string;
    phone: string;
    whatsapp: string;
    isPrimary: boolean;
  }) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [fullName, setFullName] = useState(initialPerson?.fullName || "");
  const [roleTitle, setRoleTitle] = useState(initialPerson?.roleTitle || "");
  const [email, setEmail] = useState(initialPerson?.email || "");
  const [phone, setPhone] = useState(initialPerson?.phone || "");
  const [whatsapp, setWhatsapp] = useState(initialPerson?.whatsapp || "");
  const [isPrimary, setIsPrimary] = useState(initialPerson?.isPrimary || false);

  return (
    <div className="space-y-2">
      <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className={fieldClassName} />
      <input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="Role title" className={fieldClassName} />
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className={fieldClassName} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className={fieldClassName} />
        <input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="WhatsApp" className={fieldClassName} />
      </div>
      <label className="flex items-center gap-2 text-[12px] text-[#6d614d]">
        <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
        Primary contact
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!fullName.trim() || disabled}
          onClick={() => onSubmit({ fullName, roleTitle, email, phone, whatsapp, isPrimary })}
          className="rounded-lg bg-[#2c2416] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-[#e8e0d4] px-3 py-2 text-[12px] font-medium text-[#6d614d]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function TaskEditor({
  initialTitle,
  initialDueAt,
  submitLabel,
  onSubmit,
  onClose,
  disabled,
}: {
  initialTitle: string;
  initialDueAt: string;
  submitLabel: string;
  onSubmit: (title: string, dueAt: string) => void;
  onClose?: () => void;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [dueAt, setDueAt] = useState(initialDueAt);

  return (
    <div className="mt-3 space-y-2">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" className={fieldClassName} />
      <input value={dueAt} onChange={(event) => setDueAt(event.target.value)} type="datetime-local" className={fieldClassName} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title.trim() || !dueAt || disabled}
          onClick={() => onSubmit(title, dueAt)}
          className="rounded-lg bg-[#2c2416] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onClose ? (
          <button type="button" onClick={onClose} className="rounded-lg border border-[#e8e0d4] px-3 py-2 text-[12px] font-medium text-[#6d614d]">
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
