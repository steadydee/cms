import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { CONTACT_STAGE_META } from "@/lib/partners-ui";
import { getDashboardOverview } from "@/lib/services/partners";
import { QuickAddContact } from "@/components/contacts/quick-add-contact";

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const dashboard = await getDashboardOverview(context.propertyId);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
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
          <Link href="/ops" className="rounded-full bg-[#f3ede4] px-3 py-1.5 font-medium text-[#6b5d4a]">
            Ops
          </Link>
        </div>
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
      ) : null}

      <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Recently updated</p>
        <div className="mt-4 space-y-3">
          {dashboard.recentlyUpdated.map((item) => {
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
          })}
        </div>
      </section>
    </div>
  );
}
