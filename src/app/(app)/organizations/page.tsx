import Link from "next/link";
import { ArrowUpRight, Inbox, Search, SlidersHorizontal } from "lucide-react";
import { getPartnersRequestContext } from "@/lib/auth";
import {
  getOrganizationFilterOptions,
  listRecentlyActiveOrganizations,
  listOrganizationsPage,
  getOrganizationViewCounts,
  ORGANIZATION_VIEW_LABELS,
  type SavedOrganizationView,
} from "@/lib/services/partners";
import { bulkOrganizationAction } from "@/app/(app)/organizations/actions";
import { AccountIntakePanel } from "@/components/organizations/account-intake-panel";

type OrganizationSearchParams = {
  status?: string;
  visitStatus?: string;
  type?: string;
  source?: string;
  owner?: string;
  query?: string;
  view?: string;
  page?: string;
  pageSize?: string;
};

const savedViews: SavedOrganizationView[] = [
  "all",
  "not_contacted",
  "awaiting_reply",
  "visited_not_active",
  "overdue",
  "unassigned",
  "archived",
];

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<OrganizationSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const filters = await searchParams;
  const activeView = parseSavedView(filters.view);
  const page = parsePage(filters.page);
  const pageSize = parsePageSize(filters.pageSize);

  const [organizationPage, filterOptions, viewCounts, recentActiveAccounts] = await Promise.all([
    listOrganizationsPage(context.propertyId, {
      status: parseStatus(filters.status),
      visitStatus: parseVisitStatus(filters.visitStatus),
      type: parsePartnerType(filters.type),
      source: filters.source || "",
      owner: filters.owner || "",
      query: filters.query || "",
      view: activeView,
      page,
      pageSize,
    }),
    getOrganizationFilterOptions(context.propertyId),
    getOrganizationViewCounts(context.propertyId),
    listRecentlyActiveOrganizations(context.propertyId, 5),
  ]);

  const organizations = organizationPage.items;
  const currentHref = buildOrganizationsHref(filters, { page: String(page), pageSize: String(pageSize) });

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Accounts</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[#1e293b]">Outreach accounts that need movement</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">
              Keep the list clean, work from saved views, and only open a full account when there is a real next step to take.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/research?tab=inbox"
              className="rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]"
            >
              Review research inbox
            </Link>
            <AccountIntakePanel />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Accounts" value={viewCounts.all} />
          <MiniStat label="Needs first outreach" value={viewCounts.not_contacted} tone="amber" />
          <MiniStat label="Awaiting reply" value={viewCounts.awaiting_reply} tone="blue" />
          <MiniStat label="Unassigned owner" value={viewCounts.unassigned} tone="slate" />
        </div>
      </section>

      <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Saved views</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#1e293b]">Work from a queue, not a giant list</h2>
          </div>
          <p className="text-[13px] text-[#64748b]">{organizationPage.total} matching accounts</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {savedViews.map((view) => {
            const href = buildOrganizationsHref(filters, {
              view: view === "all" ? "" : view,
              page: "1",
              pageSize: String(pageSize),
            });
            const isActive = activeView === view;

            return (
              <Link
                key={view}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                  isActive
                    ? "border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]"
                    : "border-[#d7d2c9] bg-white text-[#475569] hover:bg-[#faf8f4]"
                }`}
              >
                {ORGANIZATION_VIEW_LABELS[view]} · {viewCounts[view]}
              </Link>
            );
          })}
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input
              name="query"
              defaultValue={filters.query || ""}
              placeholder="Search account, market, source, owner"
              className="w-full rounded-xl border border-[#d7d2c9] bg-white py-2.5 pl-9 pr-3 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
            />
          </div>
          <select name="status" defaultValue={filters.status || "all"} className={inputClassName}>
            <option value="all">All statuses</option>
            <option value="not_contacted">Not contacted</option>
            <option value="contacted">Contacted</option>
            <option value="awaiting_reply">Awaiting reply</option>
            <option value="engaged">Engaged</option>
            <option value="visit_scheduled">Visit scheduled</option>
            <option value="visited">Visited</option>
            <option value="proposal_sent">Proposal sent</option>
            <option value="active_partner">Active partner</option>
            <option value="inactive">Inactive</option>
            <option value="not_interested">Not interested</option>
          </select>
          <select name="visitStatus" defaultValue={filters.visitStatus || "all"} className={inputClassName}>
            <option value="all">All visit states</option>
            <option value="never_invited">Never invited</option>
            <option value="invited">Invited</option>
            <option value="scheduled">Scheduled</option>
            <option value="visited">Visited</option>
          </select>
          <select name="type" defaultValue={filters.type || "all"} className={inputClassName}>
            <option value="all">All account types</option>
            <option value="agency">Agency</option>
            <option value="operator">Operator</option>
            <option value="travel_advisor">Travel advisor</option>
            <option value="media">Media</option>
            <option value="other">Other</option>
          </select>
          <input name="view" type="hidden" value={activeView} />
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[13px] font-medium text-white">
              Apply filters
            </button>
            <Link href="/organizations" className="rounded-lg border border-[#d7d2c9] px-4 py-2.5 text-[13px] font-medium text-[#475569]">
              Reset
            </Link>
          </div>
          <select name="source" defaultValue={filters.source || ""} className={inputClassName}>
            <option value="">All sources</option>
            {filterOptions.sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          <select name="owner" defaultValue={filters.owner || ""} className={inputClassName}>
            <option value="">All owners</option>
            {filterOptions.owners.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          <input type="hidden" name="pageSize" value={String(pageSize)} />
        </form>

        <details className="mt-5 rounded-2xl border border-[#ece7df] bg-[#faf8f4] p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#334155]">
            <SlidersHorizontal className="h-4 w-4" />
            Bulk actions
          </summary>
          <form action={bulkOrganizationAction} className="mt-4 space-y-4">
            <input type="hidden" name="returnTo" value={currentHref} />
            <div className="grid gap-3 md:grid-cols-[1.3fr_1.4fr_1fr_1fr_auto]">
              <select name="bulkAction" defaultValue="" className={inputClassName}>
                <option value="">Choose action</option>
                <option value="mark_contacted">Mark contacted</option>
                <option value="mark_awaiting_reply">Mark awaiting reply</option>
                <option value="assign_to_me">Assign owner to me</option>
                <option value="schedule_followup">Create task</option>
              </select>
              <input name="followUpTitle" placeholder="Task title" className={inputClassName} />
              <input name="followUpDescription" placeholder="Optional note" className={inputClassName} />
              <input name="followUpDueAt" type="datetime-local" className={inputClassName} />
              <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[13px] font-medium text-white">
                Run action
              </button>
            </div>
          </form>
        </details>

        {recentActiveAccounts.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-[#ece7df] bg-[#faf8f4] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Recently active</p>
                <p className="mt-2 text-[15px] font-medium text-[#1e293b]">Start here if you just want to remember what is already in motion.</p>
              </div>
              <span className="text-[12px] text-[#64748b]">Last 5 active accounts</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {recentActiveAccounts.map((account) => (
                <Link key={account.id} href={`/organizations/${account.id}`} className="rounded-2xl border border-[#ece7df] bg-white p-4 transition hover:bg-[#fcfbf8]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-[#1e293b]">{account.name}</p>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 text-[#94a3b8]" />
                  </div>
                  <p className="mt-1 text-[12px] capitalize text-[#64748b]">{labelize(account.status)}</p>
                  <p className="mt-2 text-[12px] text-[#94a3b8]">
                    {[account.source, account.country, account.city].filter(Boolean).join(" · ") || "No market details"}
                  </p>
                  <div className="mt-3 text-[12px] text-[#64748b]">
                    <p>{account.lastContactedAt ? `Last touch ${account.lastContactedAt.toLocaleDateString()}` : "No touch logged"}</p>
                    <p>{account.nextActionAt ? `Next step ${account.nextActionAt.toLocaleDateString()}` : "No next step set"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <form action={bulkOrganizationAction} className="mt-5 space-y-4">
          <input type="hidden" name="returnTo" value={currentHref} />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Visible accounts</p>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-[#1e293b]">Accounts on this page</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#64748b]">
              <span>Show</span>
              {[10, 20, 50].map((size) => (
                <Link
                  key={size}
                  href={buildOrganizationsHref(filters, { page: "1", pageSize: String(size) })}
                  className={`rounded-full border px-3 py-1 ${
                    pageSize === size
                      ? "border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]"
                      : "border-[#d7d2c9] bg-white text-[#475569]"
                  }`}
                >
                  {size}
                </Link>
              ))}
              <span>per page</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#ece7df]">
            <table className="min-w-full text-left text-[14px]">
              <thead className="bg-[#faf8f4] text-[#64748b]">
                <tr className="border-b border-[#ece7df]">
                  <th className="px-3 py-2 font-medium">Pick</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Signals</th>
                  <th className="px-3 py-2 font-medium">Touches</th>
                  <th className="px-3 py-2 font-medium">Tasks</th>
                  <th className="px-3 py-2 font-medium">Next step</th>
                </tr>
              </thead>
              <tbody>
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-[#94a3b8]">
                      No accounts match these filters.
                    </td>
                  </tr>
                ) : (
                  organizations.map((organization) => (
                    <tr key={organization.id} className="border-b border-[#f1ede6] align-top">
                      <td className="px-3 py-4">
                        <input type="checkbox" name="organizationId" value={organization.id} />
                      </td>
                      <td className="px-3 py-4">
                        <Link href={`/organizations/${organization.id}`} className="inline-flex items-center gap-1 font-medium text-[#1e293b]">
                          {organization.name}
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#94a3b8]" />
                        </Link>
                        <p className="mt-1 text-[12px] text-[#94a3b8]">
                          {[organization.type, organization.country, organization.city].filter(Boolean).join(" · ") || "No market details yet"}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusChip>{labelize(organization.status)}</StatusChip>
                          <SoftChip>{labelize(organization.visitStatus)}</SoftChip>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-[#475569]">{organization.ownerUserName || "Unassigned"}</td>
                      <td className="px-3 py-4">
                        <div className="space-y-1 text-[12px] text-[#64748b]">
                          <p>{organization.source || "No source"}</p>
                          <p>Priority {organization.priority}</p>
                          {organization.isOverdueNextAction ? (
                            <p className="font-medium text-[#b91c1c]">Next step overdue</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">{organization._count.touches}</td>
                      <td className="px-3 py-4">{organization._count.tasks}</td>
                      <td className="px-3 py-4">
                        <p className={organization.isOverdueNextAction ? "font-medium text-[#b91c1c]" : "text-[#64748b]"}>
                          {organization.nextActionAt ? organization.nextActionAt.toLocaleString() : "No next step set"}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {organizationPage.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-[#64748b]">
                Showing {(organizationPage.page - 1) * organizationPage.pageSize + 1}
                {"–"}
                {Math.min(organizationPage.page * organizationPage.pageSize, organizationPage.total)}
                {" "}of {organizationPage.total}
              </p>
              <div className="flex flex-wrap gap-2">
                {organizationPage.page > 1 ? (
                  <Link href={buildOrganizationsHref(filters, { page: String(organizationPage.page - 1), pageSize: String(pageSize) })} className="rounded-lg border border-[#d7d2c9] px-3 py-2 text-[13px] font-medium text-[#475569]">
                    Previous
                  </Link>
                ) : null}
                {Array.from({ length: organizationPage.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={buildOrganizationsHref(filters, { page: String(pageNumber), pageSize: String(pageSize) })}
                    className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${
                      pageNumber === organizationPage.page
                        ? "border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]"
                        : "border-[#d7d2c9] bg-white text-[#475569]"
                    }`}
                  >
                    {pageNumber}
                  </Link>
                ))}
                {organizationPage.page < organizationPage.totalPages ? (
                  <Link href={buildOrganizationsHref(filters, { page: String(organizationPage.page + 1), pageSize: String(pageSize) })} className="rounded-lg border border-[#d7d2c9] px-3 py-2 text-[13px] font-medium text-[#475569]">
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </form>

        {!organizations.length ? null : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <QueueHint
              icon={Inbox}
              title="Need a first-touch queue?"
              body="Use the Not contacted saved view when you want a clean list of accounts that should get their first outreach."
            />
            <QueueHint
              icon={Search}
              title="Need to enrich the pipeline?"
              body="Use Research Inbox first, then promote only the findings that are worth working as real accounts."
            />
            <QueueHint
              icon={SlidersHorizontal}
              title="Need to move several accounts at once?"
              body="Use bulk actions only after filtering to a deliberate subset so the queue stays trustworthy."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function parseSavedView(value: string | undefined): SavedOrganizationView {
  return savedViews.includes(value as SavedOrganizationView) ? (value as SavedOrganizationView) : "all";
}

function parseStatus(value: string | undefined) {
  if (
    value === "not_contacted"
    || value === "contacted"
    || value === "awaiting_reply"
    || value === "engaged"
    || value === "visit_scheduled"
    || value === "visited"
    || value === "proposal_sent"
    || value === "active_partner"
    || value === "inactive"
    || value === "not_interested"
  ) {
    return value;
  }
  return "all" as const;
}

function parseVisitStatus(value: string | undefined) {
  if (value === "never_invited" || value === "invited" || value === "scheduled" || value === "visited") {
    return value;
  }
  return "all" as const;
}

function parsePartnerType(value: string | undefined) {
  if (value === "agency" || value === "operator" || value === "travel_advisor" || value === "media" || value === "other") {
    return value;
  }
  return "all" as const;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parsePageSize(value: string | undefined) {
  const pageSize = Number(value);
  return pageSize === 20 || pageSize === 50 ? pageSize : 10;
}

function buildOrganizationsHref(
  filters: OrganizationSearchParams,
  overrides: Partial<Record<keyof OrganizationSearchParams, string>>
) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    status: filters.status,
    visitStatus: filters.visitStatus,
    type: filters.type,
    source: filters.source,
    owner: filters.owner,
    query: filters.query,
    view: filters.view,
    page: filters.page,
    pageSize: filters.pageSize,
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value && value.trim()) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/organizations?${query}` : "/organizations";
}

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "blue" | "slate";
}) {
  const toneClassName =
    tone === "amber" ? "bg-[#fff7ed] border-[#fed7aa]" :
    tone === "blue" ? "bg-[#eff6ff] border-[#bfdbfe]" :
    tone === "slate" ? "bg-[#f8fafc] border-[#cbd5e1]" :
    "bg-white border-[#ddd6cc]";

  return (
    <div className={`rounded-3xl border p-5 ${toneClassName}`}>
      <p className="text-[12px] font-medium text-[#64748b]">{label}</p>
      <p className="mt-3 text-[30px] font-semibold tracking-tight text-[#1e293b]">{value}</p>
    </div>
  );
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-medium capitalize text-[#1d4ed8]">{children}</span>;
}

function SoftChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium capitalize text-[#475569]">{children}</span>;
}

function QueueHint({
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

const inputClassName =
  "rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]";
