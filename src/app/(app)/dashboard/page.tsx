import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/services/partners";

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const summary = await getDashboardSummary(context.propertyId);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Organizations" value={summary.totalOrganizations} />
        <StatCard label="Not contacted" value={summary.notContacted} />
        <StatCard label="Awaiting reply" value={summary.awaitingReply} />
        <StatCard label="Follow-ups due" value={summary.dueFollowUps} />
        <StatCard label="Visited" value={summary.visitedPartners} />
        <StatCard label="Active partners" value={summary.activePartners} />
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
                  <p className="mt-3 text-[12px] text-[#94a3b8]">{touch.happenedAt.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Suggested views</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Work queues</h2>
          <div className="mt-6 space-y-3 text-[14px]">
            <QueueLink href="/organizations?status=not_contacted">Never contacted</QueueLink>
            <QueueLink href="/organizations?status=awaiting_reply">Awaiting reply</QueueLink>
            <QueueLink href="/organizations?visitStatus=visited">Visited partners</QueueLink>
            <QueueLink href="/followups">Follow-up queue</QueueLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">
      {text}
    </div>
  );
}
