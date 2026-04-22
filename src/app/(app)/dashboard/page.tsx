import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { CONTACT_STAGE_META } from "@/lib/partners-ui";
import { getDashboardOverview, getOpsOverview, listPartnerTypeOptions } from "@/lib/services/partners";
import { QuickAddContact } from "@/components/contacts/quick-add-contact";
import { EmailTemplateCard } from "@/components/dashboard/email-template-card";

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const [dashboard, ops, typeOptions] = await Promise.all([
    getDashboardOverview(context.propertyId),
    getOpsOverview(context.propertyId),
    listPartnerTypeOptions(context.propertyId),
  ]);
  const researchingCount = ops.pipelineSnapshot.find((item) => item.stage === "researching")?.count ?? 0;
  const readyCount = ops.pipelineSnapshot.find((item) => item.stage === "ready")?.count ?? 0;
  const outreachSentCount = ops.pipelineSnapshot.find((item) => item.stage === "outreach_sent")?.count ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <section className="rounded-[24px] border border-[#e8e0d4] bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Overview</p>
            <h1 className="mt-2 font-serif text-[28px] font-semibold tracking-tight text-[#2c2416]">Partners</h1>
            <p className="mt-2 text-[13px] text-[#8c7e6a]">
              Outreach CRM for birding operators and agencies in Colombia.
            </p>
          </div>
          <QuickAddContact returnTo="/dashboard" typeOptions={typeOptions} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-[12px]">
          <Link href="/contacts" className="rounded-full bg-[#f3ede4] px-3 py-1.5 font-medium text-[#6b5d4a]">
            Accounts
          </Link>
          <Link href="/tasks" className="rounded-full bg-[#f3ede4] px-3 py-1.5 font-medium text-[#6b5d4a]">
            Tasks
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <PriorityCard
          label="Accounts"
          value={dashboard.totalContacts}
          href="/contacts"
          note="All active operators and agencies"
        />
        <PriorityCard
          label="Needs first outreach"
          value={researchingCount + readyCount}
          href="/contacts?stage=ready"
          note="Researching and ready-to-contact accounts"
        />
        <PriorityCard
          label="Awaiting reply"
          value={outreachSentCount}
          href="/contacts?stage=outreach_sent"
          note="Outreach sent and waiting on response"
        />
      </section>

      <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Pipeline snapshot</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {ops.pipelineSnapshot.map((snapshot) => {
            const meta = CONTACT_STAGE_META[snapshot.stage];
            return (
              <div key={snapshot.stage} className={`rounded-xl border px-4 py-4 ${meta.cardClassName}`}>
                <p className="font-serif text-[28px] font-semibold">{snapshot.count}</p>
                <p className="mt-1 text-[12px] font-medium">{meta.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total accounts" value={ops.summary.totalContacts} />
        <SummaryCard label="Total touches" value={ops.summary.totalTouches} />
        <SummaryCard label="Total notes" value={ops.summary.totalNotes} />
        <SummaryCard label="Active partners" value={ops.summary.activePartners} />
      </section>

      {dashboard.overdue.length > 0 ? (
        <section className="rounded-[24px] border border-[#f0d9c9] bg-[#fff7f0] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c4713b]">Needs attention now</p>
          <div className="mt-4 space-y-3">
            {dashboard.overdue.map((item) => (
              <Link
                key={item.id}
                href={`/contacts/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#f0d9c9] bg-white px-4 py-3"
              >
                <div>
                  <p className="text-[14px] font-semibold text-[#2c2416]">{item.name}</p>
                  <p className="mt-1 text-[12px] text-[#8c7e6a]">{item.nextActionText}</p>
                </div>
                <span className="text-[12px] font-medium text-[#c4713b]">
                  {item.nextActionAt ? `Due ${item.nextActionAt.toLocaleDateString()}` : "Open account"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {dashboard.dueThisWeek.length > 0 ? (
          <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Due this week</p>
            <div className="mt-4 space-y-3">
              {dashboard.dueThisWeek.map((item) => {
                const stageMeta = CONTACT_STAGE_META[item.displayStage];
                return (
                  <Link
                    key={item.id}
                    href={`/contacts/${item.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#ebe3d8] bg-[#fffdfa] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stageMeta.className}`}>
                          {stageMeta.label}
                        </span>
                        <p className="truncate text-[14px] font-semibold text-[#2c2416]">{item.name}</p>
                      </div>
                      <p className="mt-1 text-[12px] text-[#8c7e6a]">{item.nextActionText}</p>
                    </div>
                    <span className="text-[12px] text-[#8c7e6a]">
                      {item.nextActionAt ? item.nextActionAt.toLocaleDateString() : "No date"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <EmptyCard
            title="Due this week"
            body="No accounts are due this week."
          />
        )}

        <QueueCard title="Awaiting reply" items={ops.queues.awaitingReply} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <QueueCard title="Needs first outreach" items={ops.queues.notYetContacted} />

        <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Recently updated</p>
          <div className="mt-4 space-y-3">
            {dashboard.recentlyUpdated.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
                Nothing has been updated yet.
              </div>
            ) : (
              dashboard.recentlyUpdated.map((item) => {
                const stageMeta = CONTACT_STAGE_META[item.displayStage];
                return (
                  <Link
                    key={item.id}
                    href={`/contacts/${item.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#ebe3d8] bg-[#fffdfa] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stageMeta.className}`}>
                          {stageMeta.label}
                        </span>
                        <p className="truncate text-[14px] font-semibold text-[#2c2416]">{item.name}</p>
                      </div>
                      <p className="mt-1 truncate text-[12px] text-[#8c7e6a]">{item.notePreview}</p>
                    </div>
                    <span className="text-[12px] text-[#8c7e6a]">{item.latestUpdateAt.toLocaleDateString()}</span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Email templates</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {ops.templates.map((template) => <EmailTemplateCard key={template.id} template={template} />)}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Source breakdown</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ops.sourceBreakdown.map((source) => (
              <span key={source.source} className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                {source.source} · {source.count}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-[#e8e0d4] bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">{label}</p>
      <p className="mt-3 font-serif text-[28px] font-semibold text-[#2c2416]">{value}</p>
    </div>
  );
}

function PriorityCard({
  label,
  value,
  href,
  note,
}: {
  label: string;
  value: number;
  href: string;
  note: string;
}) {
  return (
    <Link href={href} className="rounded-[20px] border border-[#e8e0d4] bg-[#fffdfa] px-5 py-4 shadow-sm transition hover:bg-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">{label}</p>
      <p className="mt-3 font-serif text-[28px] font-semibold text-[#2c2416]">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-[#8c7e6a]">{note}</p>
    </Link>
  );
}

function QueueCard({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    displayStage: keyof typeof CONTACT_STAGE_META;
    nextActionText: string;
    nextActionAt: Date | null;
  }>;
}) {
  return (
    <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
            Nothing here right now.
          </div>
        ) : (
          items.map((item) => {
            const meta = CONTACT_STAGE_META[item.displayStage];
            return (
              <Link
                key={item.id}
                href={`/contacts/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#ebe3d8] bg-[#fffdfa] px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                    <p className="text-[14px] font-semibold text-[#2c2416]">{item.name}</p>
                  </div>
                  <p className="mt-1 text-[12px] text-[#8c7e6a]">{item.nextActionText}</p>
                </div>
                <span className="text-[11px] text-[#8c7e6a]">
                  {item.nextActionAt ? item.nextActionAt.toLocaleDateString() : "No date"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">{title}</p>
      <div className="mt-4 rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
        {body}
      </div>
    </section>
  );
}
