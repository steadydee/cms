import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { CONTACT_STAGE_META } from "@/lib/partners-ui";
import { getDashboardOverview, getOpsOverview } from "@/lib/services/partners";
import { QuickAddContact } from "@/components/contacts/quick-add-contact";
import {
  discardResearchFindingAction,
  markResearchFindingReviewedAction,
  promoteResearchFindingAction,
} from "@/app/(app)/research/actions";

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const [dashboard, ops] = await Promise.all([
    getDashboardOverview(context.propertyId),
    getOpsOverview(context.propertyId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <section className="rounded-[24px] border border-[#e8e0d4] bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Dashboard</p>
            <p className="mt-3 text-[14px] text-[#8c7e6a]">
              {dashboard.totalContacts} contacts · {dashboard.overdueCount} overdue · {dashboard.dueThisWeekCount} due this week
            </p>
          </div>
          <QuickAddContact returnTo="/dashboard" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-[12px]">
          <Link href="/contacts" className="rounded-full bg-[#f3ede4] px-3 py-1.5 font-medium text-[#6b5d4a]">
            Contacts
          </Link>
        </div>
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
        <SummaryCard label="Total contacts" value={ops.summary.totalContacts} />
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
                  {item.nextActionAt ? `Due ${item.nextActionAt.toLocaleDateString()}` : "Open contact"}
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
            body="No contacts are due this week."
          />
        )}

        <QueueCard title="Awaiting reply" items={ops.queues.awaitingReply} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <QueueCard title="Not yet contacted" items={ops.queues.notYetContacted} />

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

      <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Research triage</p>
            <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#2c2416]">Inbox</h2>
          </div>
          <Link href="/contacts" className="text-[12px] font-medium text-[#3d6b4f]">
            Contacts
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {ops.researchInbox.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
              No research items need review.
            </div>
          ) : (
            ops.researchInbox.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] px-4 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#2c2416]">{finding.observedName || "Untitled finding"}</p>
                    <p className="mt-1 text-[12px] text-[#8c7e6a]">
                      {[finding.sourceType, finding.sourceHandle, finding.sourceUrl].filter(Boolean).join(" · ") || "No source details"}
                    </p>
                    {finding.observedText ? <p className="mt-3 text-[13px] leading-relaxed text-[#4f4639]">{finding.observedText}</p> : null}
                  </div>
                  <div className="flex min-w-[220px] flex-col gap-2">
                    <form action={promoteResearchFindingAction}>
                      <input type="hidden" name="findingId" value={finding.id} />
                      <input type="hidden" name="returnTo" value="/dashboard" />
                      <button type="submit" className="w-full rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white">
                        Promote to contact
                      </button>
                    </form>
                    <form action={markResearchFindingReviewedAction}>
                      <input type="hidden" name="findingId" value={finding.id} />
                      <input type="hidden" name="returnTo" value="/dashboard" />
                      <button type="submit" className="w-full rounded-lg border border-[#2c2416] px-4 py-2 text-[13px] font-medium text-[#2c2416]">
                        Mark reviewed
                      </button>
                    </form>
                    <form action={discardResearchFindingAction}>
                      <input type="hidden" name="findingId" value={finding.id} />
                      <input type="hidden" name="returnTo" value="/dashboard" />
                      <button type="submit" className="w-full rounded-lg border border-[#f0d9c9] px-4 py-2 text-[13px] font-medium text-[#c4713b]">
                        Discard
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Email templates</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {ops.templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] p-4">
                <p className="text-[13px] font-semibold text-[#2c2416]">{template.name}</p>
                <p className="mt-2 text-[12px] font-medium text-[#6d614d]">{template.subject}</p>
                <p className="mt-3 line-clamp-4 text-[12px] leading-relaxed text-[#8c7e6a]">{template.body}</p>
              </div>
            ))}
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
