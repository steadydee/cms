import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { getDashboardSummary, ORGANIZATION_VIEW_LABELS } from "@/lib/services/partners";

const queueLinks = [
  { href: "/organizations?view=not_contacted", label: ORGANIZATION_VIEW_LABELS.not_contacted },
  { href: "/organizations?view=awaiting_reply", label: ORGANIZATION_VIEW_LABELS.awaiting_reply },
  { href: "/organizations?view=visited_not_active", label: ORGANIZATION_VIEW_LABELS.visited_not_active },
  { href: "/organizations?view=overdue", label: ORGANIZATION_VIEW_LABELS.overdue },
  { href: "/followups?bucket=overdue", label: "Overdue follow-ups" },
  { href: "/organizations?view=unassigned", label: ORGANIZATION_VIEW_LABELS.unassigned },
];

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const summary = await getDashboardSummary(context.propertyId);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizations" value={summary.totalOrganizations} />
        <StatCard label="Not contacted" value={summary.notContacted} tone="amber" />
        <StatCard label="Awaiting reply" value={summary.awaitingReply} tone="blue" />
        <StatCard label="Active partners" value={summary.activePartners} tone="green" />
        <StatCard label="Visited" value={summary.visitedPartners} />
        <StatCard label="Due follow-ups" value={summary.dueFollowUps} tone="violet" />
        <StatCard label="Overdue follow-ups" value={summary.overdueFollowUps} tone="red" />
        <StatCard label="Unassigned owners" value={summary.unassignedOrganizations} tone="slate" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Outreach</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Recent touches</h2>
            </div>
            <Link href="/organizations" className="text-[13px] font-medium text-[#0f766e] underline underline-offset-4">
              Open organizations
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {summary.recentlyTouched.length === 0 ? (
              <EmptyState text="No outreach touches yet." />
            ) : (
              summary.recentlyTouched.map((touch) => (
                <div key={touch.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Link href={`/organizations/${touch.organization.id}`} className="font-medium text-[#1e293b]">
                        {touch.organization.name}
                      </Link>
                      <p className="mt-1 text-[13px] text-[#64748b]">{touch.subject || touch.summary}</p>
                    </div>
                    <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-medium capitalize text-[#475569]">
                      {touch.channel}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-[#94a3b8]">Logged by {touch.createdByUserName}</p>
                  <p className="mt-1 text-[12px] text-[#94a3b8]">{touch.happenedAt.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Suggested views</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Work queues</h2>
            <div className="mt-6 space-y-3 text-[14px]">
              {queueLinks.map((link) => (
                <QueueLink key={link.href} href={link.href}>
                  {link.label}
                </QueueLink>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#f3d3b2] bg-[#fff7ed] p-6 shadow-[0_8px_30px_rgba(234,88,12,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c2410c]">Attention</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[#7c2d12]">Operator reminders</h2>
            <div className="mt-5 space-y-3 text-[14px] text-[#9a3412]">
              <ReminderItem
                value={summary.overdueFollowUps}
                label="follow-up tasks are overdue"
                href="/followups?bucket=overdue"
              />
              <ReminderItem
                value={summary.overdueOrganizations}
                label="organizations have overdue next steps"
                href="/organizations?view=overdue"
              />
              <ReminderItem
                value={summary.unassignedOrganizations}
                label="organizations still need an owner"
                href="/organizations?view=unassigned"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "blue" | "green" | "violet" | "red" | "slate";
}) {
  const toneClassName =
    tone === "amber" ? "bg-[#fff7ed] border-[#fed7aa]" :
    tone === "blue" ? "bg-[#eff6ff] border-[#bfdbfe]" :
    tone === "green" ? "bg-[#ecfdf5] border-[#bbf7d0]" :
    tone === "violet" ? "bg-[#f5f3ff] border-[#ddd6fe]" :
    tone === "red" ? "bg-[#fef2f2] border-[#fecaca]" :
    tone === "slate" ? "bg-[#f8fafc] border-[#cbd5e1]" :
    "bg-white border-[#ddd6cc]";

  return (
    <div className={`rounded-3xl border p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)] ${toneClassName}`}>
      <p className="text-[12px] font-medium text-[#64748b]">{label}</p>
      <p className="mt-3 text-[34px] font-semibold tracking-tight text-[#1e293b]">{value}</p>
    </div>
  );
}

function QueueLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-2xl border border-[#ece7df] px-4 py-3 transition hover:bg-[#faf8f4]">
      {children}
    </Link>
  );
}

function ReminderItem({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-[#fed7aa] bg-white px-4 py-3">
      <span>{label}</span>
      <span className="rounded-full bg-[#fdba74] px-2.5 py-1 text-[12px] font-semibold text-[#7c2d12]">{value}</span>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">
      {text}
    </div>
  );
}
