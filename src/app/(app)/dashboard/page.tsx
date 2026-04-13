import Link from "next/link";
import { ArrowRight, Inbox, ListTodo, Mail, UserRoundPlus } from "lucide-react";
import { getPartnersRequestContext } from "@/lib/auth";
import {
  getDashboardSummary,
  getOrganizationViewCounts,
  ORGANIZATION_VIEW_LABELS,
} from "@/lib/services/partners";

const queueLinks = [
  {
    title: "Needs first outreach",
    description: "New accounts that should get their first message next.",
    href: "/organizations?view=not_contacted",
    countKey: "not_contacted" as const,
    icon: Mail,
  },
  {
    title: "Awaiting reply",
    description: "Accounts that need a deliberate follow-up plan.",
    href: "/organizations?view=awaiting_reply",
    countKey: "awaiting_reply" as const,
    icon: Inbox,
  },
  {
    title: "Overdue next steps",
    description: "Accounts where the next action date has already passed.",
    href: "/organizations?view=overdue",
    countKey: "overdue" as const,
    icon: ListTodo,
  },
  {
    title: "Unassigned owner",
    description: "Relationships that still need a clear person responsible.",
    href: "/organizations?view=unassigned",
    countKey: "unassigned" as const,
    icon: UserRoundPlus,
  },
];

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const [summary, viewCounts] = await Promise.all([
    getDashboardSummary(context.propertyId),
    getOrganizationViewCounts(context.propertyId),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Today&apos;s control center</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[30px] font-semibold tracking-tight text-[#1e293b]">Keep outreach moving</h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#64748b]">
                Start with the items that need action now, then work forward into this week&apos;s queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/organizations" className="rounded-xl bg-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-white">
                Open accounts
              </Link>
              <Link href="/research?tab=inbox" className="rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]">
                Review research
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TopStat label="Accounts" value={summary.totalOrganizations} />
            <TopStat label="Needs first outreach" value={summary.notContacted} tone="amber" />
            <TopStat label="Awaiting reply" value={summary.awaitingReply} tone="blue" />
            <TopStat label="Overdue tasks" value={summary.overdueFollowUps} tone="red" />
            <TopStat label="Research inbox" value={summary.researchInboxCount} tone="slate" />
            <TopStat label="Visits scheduled" value={viewCounts.visited_not_active} tone="green" />
            <TopStat label="Due this week" value={summary.dueFollowUps} tone="violet" />
            <TopStat label="Unassigned owners" value={summary.unassignedOrganizations} tone="slate" />
          </div>
        </div>

        <div className="rounded-[28px] border border-[#e4d7c7] bg-[#fffaf3] p-6 shadow-[0_10px_35px_rgba(125,81,20,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b45309]">What to do first</p>
          <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[#7c2d12]">Do today</h2>
          <div className="mt-5 space-y-3">
            <QuickQueueLink
              href="/tasks?bucket=overdue"
              label="Overdue tasks"
              count={summary.overdueFollowUps}
              note="Tasks that should already have happened."
            />
            <QuickQueueLink
              href="/organizations?view=overdue"
              label="Overdue account next steps"
              count={summary.overdueOrganizations}
              note="Accounts with a due date that has already passed."
            />
            <QuickQueueLink
              href="/organizations?view=unassigned"
              label="Assign ownership"
              count={summary.unassignedOrganizations}
              note="Relationships that can drift because nobody owns them."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
        <QueueSection
          eyebrow="Do today"
          title="Action queues"
          description="Plain-language queues you can work through without hunting around the app."
          items={queueLinks.map((link) => ({
            ...link,
            count: viewCounts[link.countKey],
          }))}
        />

        <div className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Due this week</p>
          <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[#1e293b]">Work the runway</h2>
          <div className="mt-5 space-y-3">
            <QueuePill href="/tasks?bucket=this_week" label="Tasks due this week" value={summary.dueFollowUps} />
            <QueuePill href="/organizations?view=awaiting_reply" label={ORGANIZATION_VIEW_LABELS.awaiting_reply} value={viewCounts.awaiting_reply} />
            <QueuePill href="/organizations?view=visited_not_active" label={ORGANIZATION_VIEW_LABELS.visited_not_active} value={viewCounts.visited_not_active} />
            <QueuePill href="/research?tab=inbox" label="Research findings to triage" value={summary.researchInboxCount} />
          </div>
          <p className="mt-5 text-[13px] text-[#64748b]">
            Use the queues to decide what deserves proactive follow-up before the week gets away from you.
          </p>
        </div>

        <div className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Recently active</p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[#1e293b]">Latest outreach</h2>
            </div>
            <Link href="/organizations" className="text-[13px] font-medium text-[#0f766e] underline underline-offset-4">
              Open accounts
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {summary.recentlyTouched.length === 0 ? (
              <EmptyState text="No recent touches yet." />
            ) : (
              summary.recentlyTouched.map((touch) => (
                <div key={touch.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
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
      </section>
    </div>
  );
}

function QueueSection({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: Array<{ title: string; description: string; href: string; count: number; icon: React.ComponentType<{ className?: string }> }>;
}) {
  return (
    <div className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">{eyebrow}</p>
      <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[#1e293b]">{title}</h2>
      <p className="mt-2 text-[14px] text-[#64748b]">{description}</p>
      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-start gap-4 rounded-2xl border border-[#ece7df] px-4 py-4 transition hover:bg-[#faf8f4]">
              <div className="mt-0.5 rounded-xl bg-[#ecfdf5] p-2 text-[#0f766e]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[#1e293b]">{item.title}</p>
                  <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#334155]">
                    {item.count}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#64748b]">{item.description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#94a3b8]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TopStat({
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
    <div className={`rounded-3xl border p-5 ${toneClassName}`}>
      <p className="text-[12px] font-medium text-[#64748b]">{label}</p>
      <p className="mt-3 text-[34px] font-semibold tracking-tight text-[#1e293b]">{value}</p>
    </div>
  );
}

function QueuePill({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-[#ece7df] px-4 py-3 transition hover:bg-[#faf8f4]">
      <span className="text-[14px] text-[#334155]">{label}</span>
      <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#334155]">{value}</span>
    </Link>
  );
}

function QuickQueueLink({
  href,
  label,
  count,
  note,
}: {
  href: string;
  label: string;
  count: number;
  note: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl border border-[#fed7aa] bg-white px-4 py-4 transition hover:bg-[#fff5eb]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-[#7c2d12]">{label}</p>
        <span className="rounded-full bg-[#fdba74] px-2.5 py-1 text-[12px] font-semibold text-[#7c2d12]">{count}</span>
      </div>
      <p className="mt-2 text-[13px] text-[#9a3412]">{note}</p>
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
