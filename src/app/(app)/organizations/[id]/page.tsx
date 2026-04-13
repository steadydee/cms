import { notFound } from "next/navigation";
import { getPartnersRequestContext } from "@/lib/auth";
import { getOrganizationDetail } from "@/lib/services/partners";
import {
  addContactAction,
  assignOrganizationOwnerToMeAction,
  createFollowUpTaskAction,
  logOutreachTouchAction,
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

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const { id } = await params;
  const organization = await getOrganizationDetail(id, context.propertyId);
  if (!organization) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Organization</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">{organization.name}</h1>
              <p className="mt-2 text-[14px] text-[#64748b]">
                {[organization.type, organization.country, organization.city].filter(Boolean).join(" · ") || "No market metadata yet"}
              </p>
            </div>
            <form action={assignOrganizationOwnerToMeAction}>
              <input type="hidden" name="organizationId" value={organization.id} />
              <button type="submit" className="rounded-lg border border-[#0f766e] px-4 py-2.5 text-[13px] font-medium text-[#0f766e]">
                Assign to me
              </button>
            </form>
          </div>

          <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Info label="Status" value={organization.status.replaceAll("_", " ")} />
            <Info label="Visit" value={organization.visitStatus.replaceAll("_", " ")} />
            <Info label="Owner" value={organization.ownerUserName || "Unassigned"} />
            <Info label="Email" value={organization.email || "Not set"} />
            <Info label="WhatsApp" value={organization.whatsapp || "Not set"} />
            <Info label="Phone" value={organization.phone || "Not set"} />
            <Info label="Source" value={organization.source || "Not set"} />
            <Info label="Priority" value={String(organization.priority)} />
            <Info label="Next action" value={organization.nextActionAt?.toLocaleString() || "Not set"} />
          </dl>
        </div>

        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Profile and ownership</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Keep the record organized</h2>
          <form action={updateOrganizationProfileAction} className="mt-6 space-y-4">
            <input type="hidden" name="organizationId" value={organization.id} />
            <input name="ownerUserName" defaultValue={organization.ownerUserName || ""} placeholder="Owner name" className={inputClassName} />
            <input name="ownerUserId" defaultValue={organization.ownerUserId || ""} placeholder="Owner user id" className={inputClassName} />
            <input name="source" defaultValue={organization.source || ""} placeholder="Campaign or source" className={inputClassName} />
            <input name="priority" type="number" min="0" max="5" defaultValue={organization.priority} className={inputClassName} />
            <input name="nextActionAt" type="datetime-local" defaultValue={toDateTimeLocalValue(organization.nextActionAt)} className={inputClassName} />
            <textarea
              name="marketNotes"
              placeholder="Market notes"
              defaultValue={organization.marketNotes || ""}
              className="min-h-28 w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]"
            />
            <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
              Save profile
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Status update</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Update relationship stage</h2>
          <form action={updateOrganizationStatusAction} className="mt-6 space-y-4">
            <input type="hidden" name="organizationId" value={organization.id} />
            <select name="status" defaultValue={organization.status} className={inputClassName}>
              {relationshipStatuses.map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select name="visitStatus" defaultValue={organization.visitStatus} className={inputClassName}>
              {visitStatuses.map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </select>
            <textarea
              name="visitNotes"
              placeholder="Visit notes"
              defaultValue={organization.visitNotes || ""}
              className="min-h-28 w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]"
            />
            <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
              Save status
            </button>
          </form>
        </div>

        <Card title="Contacts" subtitle="People at this organization">
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
                    {contact.preferredChannel ? (
                      <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-medium capitalize text-[#475569]">
                        {contact.preferredChannel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[12px] text-[#94a3b8]">
                    {[contact.email, contact.whatsapp, contact.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </p>
                </div>
              ))
            )}
          </div>
          <form action={addContactAction} className="mt-6 grid gap-3">
            <input type="hidden" name="organizationId" value={organization.id} />
            <input name="fullName" placeholder="Full name" required className={inputClassName} />
            <input name="roleTitle" placeholder="Role title" className={inputClassName} />
            <input name="email" placeholder="Email" type="email" className={inputClassName} />
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
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Follow-up tasks" subtitle="Keep outreach moving">
          <div className="space-y-3">
            {organization.tasks.length === 0 ? (
              <EmptyState text="No follow-up tasks yet." />
            ) : (
              organization.tasks.map((task) => {
                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border px-4 py-4 ${
                      task.isOverdue ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#ece7df]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#1e293b]">{task.title}</p>
                        <p className="mt-1 text-[13px] text-[#64748b]">
                          Due {task.dueAt.toLocaleString()} · {task.status}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-medium text-[#475569]">
                        {task.assignedToUserName || "Unassigned"}
                      </span>
                    </div>
                    {task.description && <p className="mt-2 text-[13px] text-[#475569]">{task.description}</p>}
                    <p className="mt-2 text-[12px] text-[#94a3b8]">
                      {task.contact ? `Contact ${task.contact.fullName} · ` : ""}Created by {task.createdByUserName}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <form action={createFollowUpTaskAction} className="mt-6 grid gap-3">
            <input type="hidden" name="organizationId" value={organization.id} />
            <input name="title" placeholder="Follow-up title" required className={inputClassName} />
            <textarea
              name="description"
              placeholder="What should happen next?"
              className="min-h-24 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]"
            />
            <input name="assignedToUserName" placeholder="Assign to" defaultValue={context.userName} className={inputClassName} />
            <input name="dueAt" type="datetime-local" required className={inputClassName} />
            <button type="submit" className="rounded-lg bg-[#7c3aed] px-4 py-2.5 text-[14px] font-medium text-white">
              Add follow-up
            </button>
          </form>
        </Card>

        <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Outreach timeline</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Log email, WhatsApp, and calls</h2>
          <div className="mt-6 space-y-3">
            {organization.touches.length === 0 ? (
              <EmptyState text="No outreach touches yet." />
            ) : (
              organization.touches.map((touch) => (
                <div key={touch.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#1e293b]">{touch.subject || touch.summary}</p>
                      <p className="mt-1 text-[13px] text-[#64748b]">{touch.summary}</p>
                    </div>
                    <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-medium capitalize text-[#475569]">
                      {touch.channel}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-[12px] text-[#94a3b8] md:grid-cols-2">
                    <p>{touch.contact ? `Contact ${touch.contact.fullName}` : "Organization-level touch"}</p>
                    <p>Logged by {touch.createdByUserName}</p>
                    <p>{touch.happenedAt.toLocaleString()}</p>
                    {touch.outcome ? <p>Outcome: {touch.outcome}</p> : null}
                    {touch.nextStep ? <p className="md:col-span-2">Next step: {touch.nextStep}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <form action={logOutreachTouchAction} className="mt-6 grid gap-3 md:grid-cols-2">
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
              className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6] md:col-span-2"
            />
            <input name="outcome" placeholder="Outcome" className={inputClassName} />
            <input name="nextStep" placeholder="Next step" className={inputClassName} />
            <div className="md:col-span-2">
              <button type="submit" className="rounded-lg bg-[#ea580c] px-4 py-2.5 text-[14px] font-medium text-white">
                Log outreach touch
              </button>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">{title}</p>
      <h2 className="mt-2 text-[22px] font-semibold tracking-tight">{subtitle}</h2>
      {children}
    </section>
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

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">{text}</div>;
}

function toDateTimeLocalValue(value: Date | null) {
  if (!value) return "";

  const localValue = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

const inputClassName =
  "w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]";
