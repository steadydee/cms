import { getPartnersRequestContext } from "@/lib/auth";
import { getOrganizationDetail } from "@/lib/services/partners";
import {
  addContactAction,
  createFollowUpTaskAction,
  logOutreachTouchAction,
  updateOrganizationStatusAction,
} from "@/app/(app)/organizations/actions";
import { notFound } from "next/navigation";

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
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Organization</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight">{organization.name}</h1>
          <p className="mt-2 text-[14px] text-[#64748b]">
            {[organization.type, organization.country, organization.city].filter(Boolean).join(" · ") || "No market metadata yet"}
          </p>

          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Status" value={organization.status.replaceAll("_", " ")} />
            <Info label="Visit" value={organization.visitStatus.replaceAll("_", " ")} />
            <Info label="Email" value={organization.email || "Not set"} />
            <Info label="WhatsApp" value={organization.whatsapp || "Not set"} />
            <Info label="Phone" value={organization.phone || "Not set"} />
            <Info label="Next action" value={organization.nextActionAt?.toLocaleString() || "Not set"} />
          </dl>

          {organization.marketNotes && (
            <div className="mt-6 rounded-2xl border border-[#ece7df] bg-[#faf8f4] px-4 py-4 text-[14px] text-[#475569]">
              {organization.marketNotes}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Status update</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Update relationship stage</h2>
          <form action={updateOrganizationStatusAction} className="mt-6 space-y-4">
            <input type="hidden" name="organizationId" value={organization.id} />
            <select name="status" defaultValue={organization.status} className={inputClassName}>
              {["not_contacted","contacted","awaiting_reply","engaged","visit_scheduled","visited","proposal_sent","active_partner","inactive","not_interested"].map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select name="visitStatus" defaultValue={organization.visitStatus} className={inputClassName}>
              {["never_invited","invited","scheduled","visited"].map((status) => (
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
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Contacts" subtitle="People at this organization">
          <div className="space-y-3">
            {organization.contacts.length === 0 ? (
              <EmptyState text="No contacts yet." />
            ) : (
              organization.contacts.map((contact) => (
                <div key={contact.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                  <p className="font-medium text-[#1e293b]">{contact.fullName}</p>
                  <p className="mt-1 text-[13px] text-[#64748b]">{contact.roleTitle || "No title"}</p>
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
            <label className="flex items-center gap-2 text-[13px] text-[#475569]">
              <input type="checkbox" name="isPrimary" />
              Mark as primary contact
            </label>
            <button type="submit" className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-white">
              Add contact
            </button>
          </form>
        </Card>

        <Card title="Follow-up tasks" subtitle="Keep outreach moving">
          <div className="space-y-3">
            {organization.tasks.length === 0 ? (
              <EmptyState text="No follow-up tasks yet." />
            ) : (
              organization.tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                  <p className="font-medium text-[#1e293b]">{task.title}</p>
                  <p className="mt-1 text-[13px] text-[#64748b]">
                    Due {task.dueAt.toLocaleString()} · {task.status}
                  </p>
                  {task.description && <p className="mt-2 text-[13px] text-[#475569]">{task.description}</p>}
                </div>
              ))
            )}
          </div>
          <form action={createFollowUpTaskAction} className="mt-6 grid gap-3">
            <input type="hidden" name="organizationId" value={organization.id} />
            <input name="title" placeholder="Follow-up title" required className={inputClassName} />
            <textarea name="description" placeholder="What should happen next?" className="min-h-24 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]" />
            <input name="dueAt" type="datetime-local" required className={inputClassName} />
            <button type="submit" className="rounded-lg bg-[#7c3aed] px-4 py-2.5 text-[14px] font-medium text-white">
              Add follow-up
            </button>
          </form>
        </Card>
      </section>

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
                  <p className="font-medium text-[#1e293b]">{touch.subject || touch.summary}</p>
                  <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-medium capitalize text-[#475569]">
                    {touch.channel}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-[#475569]">{touch.summary}</p>
                <p className="mt-3 text-[12px] text-[#94a3b8]">{touch.happenedAt.toLocaleString()}</p>
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
          <input name="subject" placeholder="Subject" className={inputClassName} />
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

const inputClassName =
  "w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]";
