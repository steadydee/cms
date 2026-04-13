import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, CircleDashed, Mail, MessageSquareText, UserRound } from "lucide-react";
import { getPartnersRequestContext } from "@/lib/auth";
import { draftIntroEmail, getOrganizationDetail } from "@/lib/services/partners";
import { getEmailDeliveryStatus } from "@/lib/email";
import { FirstOutreachComposer } from "@/components/organizations/first-outreach-composer";
import {
  addContactAction,
  archiveOrganizationAction,
  createFollowUpTaskAction,
  logOutreachTouchAction,
  unarchiveOrganizationAction,
  updateOrganizationProfileAction,
  updateOrganizationStatusAction,
} from "@/app/(app)/organizations/actions";

const relationshipStatuses = [
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
] as const;

const visitStatuses = ["never_invited", "invited", "scheduled", "visited"] as const;
const tabs = ["overview", "people", "timeline", "tasks", "profile"] as const;
type OrganizationTab = (typeof tabs)[number];

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const [{ id }, rawSearchParams] = await Promise.all([params, searchParams]);
  const activeTab = parseTab(rawSearchParams.tab);

  const organization = await getOrganizationDetail(id, context.propertyId);
  if (!organization) {
    notFound();
  }

  const introEmail = draftIntroEmail(organization);
  const primaryEmailContact = organization.contacts.find((contact) => contact.isPrimary && contact.email)
    ?? organization.contacts.find((contact) => contact.email);
  const recipientEmail = primaryEmailContact?.email || organization.email || "";
  const recipientLabel = primaryEmailContact?.fullName || organization.name;
  const emailDelivery = getEmailDeliveryStatus();
  const latestTouch = organization.touches[0];
  const openTasks = organization.tasks.filter((task) => task.status === "open");
  const overdueTasks = openTasks.filter((task) => task.isOverdue);
  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Account</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[#1e293b]">{organization.name}</h1>
            <p className="mt-3 text-[14px] text-[#64748b]">
              {[organization.type, organization.country, organization.city].filter(Boolean).join(" · ") || "No market details yet"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">{labelize(organization.status)}</Badge>
              <Badge>{labelize(organization.visitStatus)}</Badge>
              <Badge tone="teal">{organization.ownerUserName || "Unassigned owner"}</Badge>
              {organization.archivedAt ? <Badge tone="amber">Archived</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/organizations" className="rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]">
              Back to accounts
            </Link>
            {organization.archivedAt ? (
              <form action={unarchiveOrganizationAction}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <button type="submit" className="rounded-xl border border-[#c2410c] px-4 py-2.5 text-[14px] font-medium text-[#c2410c]">
                  Unarchive
                </button>
              </form>
            ) : (
              <form action={archiveOrganizationAction}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <button type="submit" className="rounded-xl border border-[#c2410c] px-4 py-2.5 text-[14px] font-medium text-[#c2410c]">
                  Archive
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <HeroStat label="Next step due" value={organization.nextActionAt ? organization.nextActionAt.toLocaleString() : "None set"} icon={CalendarClock} />
          <HeroStat label="Last touch" value={latestTouch ? latestTouch.happenedAt.toLocaleDateString() : "No touches yet"} icon={MessageSquareText} />
          <HeroStat label="Open tasks" value={String(openTasks.length)} icon={CircleDashed} />
          <HeroStat label="Overdue tasks" value={String(overdueTasks.length)} icon={CheckCircle2} tone={overdueTasks.length ? "red" : "default"} />
          <HeroStat label="Primary email" value={recipientEmail || "No email yet"} icon={Mail} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={tab === "overview" ? `/organizations/${organization.id}` : `/organizations/${organization.id}?tab=${tab}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === tab
                  ? "border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]"
                  : "border-[#d7d2c9] bg-white text-[#475569] hover:bg-[#faf8f4]"
              }`}
            >
              {tabLabel(tab)}
            </Link>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            <Panel
              eyebrow="Next action"
              title={getOverviewTitle(organization.status)}
              description={getOverviewDescription(organization.status)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <GuidanceCard
                  icon={UserRound}
                  title="Owner"
                  body={organization.ownerUserName || "Assign someone so this account does not drift."}
                />
                <GuidanceCard
                  icon={CalendarClock}
                  title="Next step"
                  body={organization.nextActionAt ? organization.nextActionAt.toLocaleString() : "No due date yet. Pick one to keep this account visible."}
                />
                <GuidanceCard
                  icon={MessageSquareText}
                  title="Recent activity"
                  body={latestTouch ? `${latestTouch.channel} touch on ${latestTouch.happenedAt.toLocaleDateString()}` : "No outreach logged yet."}
                />
                <GuidanceCard
                  icon={CircleDashed}
                  title="Task pressure"
                  body={overdueTasks.length ? `${overdueTasks.length} overdue task(s)` : openTasks.length ? `${openTasks.length} open task(s)` : "No open tasks right now."}
                />
              </div>
            </Panel>

            <Panel
              eyebrow="First outreach"
              title="Draft the intro email before you log a touch"
              description="Treat the first outreach as a guided step, not just another form on the page."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <ToneBox
                  title="Delivery setup"
                  body={emailDelivery.resendConfigured ? "Resend is configured for app-triggered sends." : "Resend is not configured yet. Use your email app or finish sender setup."}
                  tone={emailDelivery.resendConfigured ? "green" : "amber"}
                />
                <ToneBox
                  title="Recipient"
                  body={recipientEmail ? `${recipientLabel} · ${recipientEmail}` : "Add an email on the account or a contact before you send the intro."}
                  tone={recipientEmail ? "blue" : "amber"}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-[#ece7df] bg-[#faf8f4] px-4 py-4">
                <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#94a3b8]">Recommended recipient</p>
                <p className="mt-2 text-[14px] text-[#1e293b]">{recipientEmail ? `${recipientLabel} · ${recipientEmail}` : "No email address yet"}</p>
              </div>

              <FirstOutreachComposer
                organizationId={organization.id}
                contactId={primaryEmailContact?.id}
                recipientEmail={recipientEmail}
                recipientLabel={recipientLabel}
                defaultSubject={introEmail.subject}
                defaultBody={introEmail.body}
                resendConfigured={emailDelivery.resendConfigured}
              />
            </Panel>

            <Panel
              eyebrow="Recent timeline"
              title="Latest touches"
              description="Keep just enough recent context visible before you dive into the full timeline."
            >
              <div className="space-y-3">
                {organization.touches.length === 0 ? (
                  <EmptyState text="No outreach touches yet." />
                ) : (
                  organization.touches.slice(0, 3).map((touch) => (
                    <TouchCard key={touch.id} touch={touch} />
                  ))
                )}
              </div>
              <div className="mt-4">
                <Link href={`/organizations/${organization.id}?tab=timeline`} className="text-[13px] font-medium text-[#0f766e] underline underline-offset-4">
                  Open full timeline
                </Link>
              </div>
            </Panel>
          </section>

          <section className="space-y-6">
            <Panel
              eyebrow="Tasks"
              title="Keep this relationship moving"
              description="Create the next task intentionally so the account stays in the right queue."
            >
              <div className="space-y-3">
                {openTasks.length === 0 ? <EmptyState text="No open tasks yet." /> : openTasks.slice(0, 4).map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>

              <form action={createFollowUpTaskAction} className="mt-6 grid gap-3">
                <input type="hidden" name="organizationId" value={organization.id} />
                <input name="title" placeholder="Task title" required className={inputClassName} />
                <textarea
                  name="description"
                  placeholder="What should happen next?"
                  className="min-h-24 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
                />
                <input name="assignedToUserName" placeholder="Assign to" defaultValue={context.userName} className={inputClassName} />
                <input name="dueAt" type="datetime-local" required className={inputClassName} />
                <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
                  Add task
                </button>
              </form>
            </Panel>

            <Panel
              eyebrow="At a glance"
              title="Profile snapshot"
              description="Keep the core operating details visible without dropping into profile edit mode."
            >
              <dl className="grid gap-3 md:grid-cols-2">
                <Info label="Owner" value={organization.ownerUserName || "Unassigned"} />
                <Info label="Source" value={organization.source || "No source"} />
                <Info label="Phone" value={organization.phone || "Not set"} />
                <Info label="WhatsApp" value={organization.whatsapp || "Not set"} />
                <Info label="Email" value={organization.email || "Not set"} />
                <Info label="Website" value={organization.website || "Not set"} />
              </dl>
              <div className="mt-4">
                <Link href={`/organizations/${organization.id}?tab=profile`} className="text-[13px] font-medium text-[#0f766e] underline underline-offset-4">
                  Edit profile and stage
                </Link>
              </div>
            </Panel>
          </section>
        </div>
      ) : null}

      {activeTab === "people" ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel eyebrow="People" title="Contacts at this account" description="Keep the right names and channels attached to the organization, not buried in notes.">
            <div className="space-y-3">
              {organization.contacts.length === 0 ? (
                <EmptyState text="No contacts yet." />
              ) : (
                organization.contacts.map((contact) => (
                  <div key={contact.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#1e293b]">
                          {contact.fullName}
                          {contact.isPrimary ? <span className="ml-2 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-semibold text-[#0f766e]">Primary</span> : null}
                        </p>
                        <p className="mt-1 text-[13px] text-[#64748b]">{contact.roleTitle || "No title"}</p>
                      </div>
                      {contact.preferredChannel ? <SoftBadge>{contact.preferredChannel}</SoftBadge> : null}
                    </div>
                    <p className="mt-2 text-[12px] text-[#94a3b8]">
                      {[contact.email, contact.whatsapp, contact.phone].filter(Boolean).join(" · ") || "No contact details yet"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel eyebrow="Add contact" title="Capture a real person, not just an account" description="This should stay lightweight so you actually keep the contact list current.">
            <form action={addContactAction} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input name="fullName" placeholder="Full name" required className={inputClassName} />
              <input name="roleTitle" placeholder="Role title" className={inputClassName} />
              <input name="email" placeholder="Email" type="email" className={inputClassName} />
              <input name="phone" placeholder="Phone" className={inputClassName} />
              <input name="whatsapp" placeholder="WhatsApp" className={inputClassName} />
              <select name="preferredChannel" defaultValue="email" className={inputClassName}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </select>
              <label className="flex items-center gap-2 text-[13px] text-[#475569]">
                <input type="checkbox" name="isPrimary" />
                Mark as primary contact
              </label>
              <button type="submit" className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-white">
                Add contact
              </button>
            </form>
          </Panel>
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <Panel eyebrow="Timeline" title="Log email, WhatsApp, and calls" description="Keep the outreach timeline readable first, then add the next touch below it.">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {organization.touches.length === 0 ? (
                <EmptyState text="No outreach touches yet." />
              ) : (
                organization.touches.map((touch) => <TouchCard key={touch.id} touch={touch} />)
              )}
            </div>

            <form action={logOutreachTouchAction} className="grid gap-3 rounded-2xl border border-[#ece7df] bg-[#faf8f4] p-4">
              <input type="hidden" name="organizationId" value={organization.id} />
              <select name="channel" defaultValue="email" className={inputClassName}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </select>
              <select name="contactId" defaultValue="" className={inputClassName}>
                <option value="">Organization-level touch</option>
                {organization.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.fullName}</option>
                ))}
              </select>
              <input name="subject" placeholder="Subject" className={inputClassName} />
              <input name="happenedAt" type="datetime-local" className={inputClassName} />
              <textarea
                name="summary"
                placeholder="What happened?"
                required
                className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
              />
              <input name="outcome" placeholder="Outcome" className={inputClassName} />
              <input name="nextStep" placeholder="Next step" className={inputClassName} />
              <button type="submit" className="rounded-lg bg-[#ea580c] px-4 py-2.5 text-[14px] font-medium text-white">
                Log outreach touch
              </button>
            </form>
          </div>
        </Panel>
      ) : null}

      {activeTab === "tasks" ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel eyebrow="Tasks" title="Open tasks" description="Tasks should make the next step obvious, not become a dumping ground.">
            <div className="space-y-3">
              {organization.tasks.length === 0 ? (
                <EmptyState text="No tasks yet." />
              ) : (
                organization.tasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </Panel>

          <Panel eyebrow="Add task" title="Create the next action intentionally" description="If there is no task or due date, the account can disappear from the queue.">
            <form action={createFollowUpTaskAction} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input name="title" placeholder="Task title" required className={inputClassName} />
              <textarea
                name="description"
                placeholder="What should happen next?"
                className="min-h-24 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
              />
              <input name="assignedToUserName" placeholder="Assign to" defaultValue={context.userName} className={inputClassName} />
              <input name="dueAt" type="datetime-local" required className={inputClassName} />
              <button type="submit" className="rounded-lg bg-[#7c3aed] px-4 py-2.5 text-[14px] font-medium text-white">
                Add task
              </button>
            </form>
          </Panel>
        </div>
      ) : null}

      {activeTab === "profile" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel eyebrow="Profile" title="Edit organization details" description="Keep the administrative fields here so the default view stays operational.">
            <form action={updateOrganizationProfileAction} className="space-y-4">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input name="ownerUserName" defaultValue={organization.ownerUserName || ""} placeholder="Owner name" className={inputClassName} />
              <input name="email" type="email" defaultValue={organization.email || ""} placeholder="General email" className={inputClassName} />
              <input name="whatsapp" defaultValue={organization.whatsapp || ""} placeholder="WhatsApp" className={inputClassName} />
              <input name="phone" defaultValue={organization.phone || ""} placeholder="Phone" className={inputClassName} />
              <input name="website" defaultValue={organization.website || ""} placeholder="Website" className={inputClassName} />
              <div className="grid gap-4 md:grid-cols-2">
                <input name="country" defaultValue={organization.country || ""} placeholder="Country" className={inputClassName} />
                <input name="city" defaultValue={organization.city || ""} placeholder="City" className={inputClassName} />
              </div>
              <input name="source" defaultValue={organization.source || ""} placeholder="Campaign or source" className={inputClassName} />
              <input name="priority" type="number" min="0" max="5" defaultValue={organization.priority} className={inputClassName} />
              <input name="nextActionAt" type="datetime-local" defaultValue={toDateTimeLocalValue(organization.nextActionAt)} className={inputClassName} />
              <textarea
                name="marketNotes"
                placeholder="Market notes"
                defaultValue={organization.marketNotes || ""}
                className="min-h-28 w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
              />
              <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
                Save profile
              </button>
            </form>
          </Panel>

          <Panel eyebrow="Stage" title="Update relationship stage" description="Change stage and visit state deliberately so the queues stay trustworthy.">
            <form action={updateOrganizationStatusAction} className="space-y-4">
              <input type="hidden" name="organizationId" value={organization.id} />
              <select name="status" defaultValue={organization.status} className={inputClassName}>
                {relationshipStatuses.map((status) => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
              <select name="visitStatus" defaultValue={organization.visitStatus} className={inputClassName}>
                {visitStatuses.map((status) => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
              <textarea
                name="visitNotes"
                placeholder="Visit notes"
                defaultValue={organization.visitNotes || ""}
                className="min-h-28 w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
              />
              <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
                Save stage
              </button>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function parseTab(value: string | undefined): OrganizationTab {
  return tabs.includes(value as OrganizationTab) ? (value as OrganizationTab) : "overview";
}

function tabLabel(tab: OrganizationTab) {
  switch (tab) {
    case "people":
      return "People";
    case "timeline":
      return "Timeline";
    case "tasks":
      return "Tasks";
    case "profile":
      return "Profile";
    case "overview":
    default:
      return "Overview";
  }
}

function getOverviewTitle(status: string) {
  if (status === "not_contacted") return "Start the first outreach cleanly";
  if (status === "awaiting_reply") return "Stay intentional while you wait";
  if (status === "visited") return "Use the visit momentum";
  if (status === "active_partner") return "Keep the relationship healthy";
  return "Keep the relationship moving";
}

function getOverviewDescription(status: string) {
  if (status === "not_contacted") return "This page should help you send the first message and set the next task without hunting through forms.";
  if (status === "awaiting_reply") return "Make the next step visible so this account does not disappear between touches.";
  if (status === "visited") return "Visited accounts should move toward proposal, activation, or an intentional follow-up.";
  return "The overview should surface the most useful context first, then let you drill down only when needed.";
}

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">{eyebrow}</p>
      <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#1e293b]">{title}</h2>
      <p className="mt-2 text-[14px] text-[#64748b]">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "red";
}) {
  return (
    <div className={`rounded-3xl border p-4 ${tone === "red" ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#ece7df] bg-[#faf8f4]"}`}>
      <div className="flex items-center gap-2 text-[#94a3b8]">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-[14px] font-medium text-[#1e293b]">{value}</p>
    </div>
  );
}

function GuidanceCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ece7df] bg-[#faf8f4] p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 text-[#0f766e]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-[#1e293b]">{title}</p>
          <p className="mt-1 text-[13px] text-[#64748b]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function ToneBox({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "green" | "blue" | "amber";
}) {
  const className =
    tone === "green" ? "border-[#bbf7d0] bg-[#ecfdf5]" :
    tone === "blue" ? "border-[#bfdbfe] bg-[#eff6ff]" :
    "border-[#fed7aa] bg-[#fff7ed]";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${className}`}>
      <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#94a3b8]">{title}</p>
      <p className="mt-2 text-[14px] text-[#1e293b]">{body}</p>
    </div>
  );
}

function TouchCard({
  touch,
}: {
  touch: {
    id: string;
    subject: string | null;
    summary: string;
    outcome: string | null;
    nextStep: string | null;
    happenedAt: Date;
    createdByUserName: string;
    channel: string;
    contact?: { fullName: string } | null;
  };
}) {
  return (
    <div className="rounded-2xl border border-[#ece7df] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-[#1e293b]">{touch.subject || touch.summary}</p>
          <p className="mt-1 text-[13px] text-[#64748b]">{touch.summary}</p>
        </div>
        <SoftBadge>{touch.channel}</SoftBadge>
      </div>
      <div className="mt-3 grid gap-2 text-[12px] text-[#94a3b8] md:grid-cols-2">
        <p>{touch.contact ? `Contact ${touch.contact.fullName}` : "Organization-level touch"}</p>
        <p>Logged by {touch.createdByUserName}</p>
        <p>{touch.happenedAt.toLocaleString()}</p>
        {touch.outcome ? <p>Outcome: {touch.outcome}</p> : null}
        {touch.nextStep ? <p className="md:col-span-2">Next step: {touch.nextStep}</p> : null}
      </div>
    </div>
  );
}

function TaskCard({
  task,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    dueAt: Date;
    status: string;
    isOverdue: boolean;
    assignedToUserName: string | null;
    contact?: { fullName: string } | null;
    createdByUserName: string;
  };
}) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${task.isOverdue ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#ece7df]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[#1e293b]">{task.title}</p>
          <p className="mt-1 text-[13px] text-[#64748b]">
            Due {task.dueAt.toLocaleString()} · {task.status}
          </p>
        </div>
        <SoftBadge>{task.assignedToUserName || "Unassigned"}</SoftBadge>
      </div>
      {task.description ? <p className="mt-2 text-[13px] text-[#475569]">{task.description}</p> : null}
      <p className="mt-2 text-[12px] text-[#94a3b8]">
        {task.contact ? `Contact ${task.contact.fullName} · ` : ""}
        Created by {task.createdByUserName}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ece7df] px-4 py-4">
      <dt className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#94a3b8]">{label}</dt>
      <dd className="mt-2 text-[14px] text-[#1e293b]">{value}</dd>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "teal" | "amber";
}) {
  const className =
    tone === "blue" ? "bg-[#eff6ff] text-[#1d4ed8]" :
    tone === "teal" ? "bg-[#ecfdf5] text-[#0f766e]" :
    tone === "amber" ? "bg-[#fff7ed] text-[#c2410c]" :
    "bg-[#f8fafc] text-[#475569]";

  return <span className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize ${className}`}>{children}</span>;
}

function SoftBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-medium capitalize text-[#475569]">{children}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">{text}</div>;
}

function toDateTimeLocalValue(value: Date | null) {
  if (!value) return "";

  const localValue = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

const inputClassName =
  "w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]";
