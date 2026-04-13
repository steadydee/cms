import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import {
  getOrganizationFilterOptions,
  getOrganizationViewCounts,
  listOrganizations,
  ORGANIZATION_VIEW_LABELS,
  type SavedOrganizationView,
} from "@/lib/services/partners";
import { bulkOrganizationAction, createOrganizationAction } from "@/app/(app)/organizations/actions";

type OrganizationSearchParams = {
  status?: string;
  visitStatus?: string;
  type?: string;
  source?: string;
  owner?: string;
  query?: string;
  view?: string;
};

const savedViews: SavedOrganizationView[] = [
  "all",
  "not_contacted",
  "awaiting_reply",
  "visited_not_active",
  "overdue",
  "unassigned",
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

  const [organizations, filterOptions, viewCounts] = await Promise.all([
    listOrganizations(context.propertyId, {
      status: parseStatus(filters.status),
      visitStatus: parseVisitStatus(filters.visitStatus),
      type: parsePartnerType(filters.type),
      source: filters.source || "",
      owner: filters.owner || "",
      query: filters.query || "",
      view: activeView,
    }),
    getOrganizationFilterOptions(context.propertyId),
    getOrganizationViewCounts(context.propertyId),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">New organization</p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-tight">Add an operator or agency</h2>
        <form action={createOrganizationAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input name="name" placeholder="Organization name" required className={inputClassName} />
          <select name="type" className={inputClassName} defaultValue="agency">
            <option value="agency">Agency</option>
            <option value="operator">Operator</option>
            <option value="travel_advisor">Travel advisor</option>
            <option value="media">Media</option>
            <option value="other">Other</option>
          </select>
          <input name="country" placeholder="Country" className={inputClassName} />
          <input name="city" placeholder="City" className={inputClassName} />
          <input name="email" placeholder="General email" type="email" className={inputClassName} />
          <input name="phone" placeholder="Phone" className={inputClassName} />
          <input name="whatsapp" placeholder="WhatsApp" className={inputClassName} />
          <input name="website" placeholder="Website" className={inputClassName} />
          <input name="source" placeholder="Campaign or source" className={inputClassName} />
          <input name="nextActionAt" type="datetime-local" className={inputClassName} />
          <textarea
            name="marketNotes"
            placeholder="Market notes"
            className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6] md:col-span-2 xl:col-span-3"
          />
          <div className="xl:col-span-3">
            <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
              Create organization
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Organizations</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight">Outreach targets</h2>
            <p className="mt-2 text-[13px] text-[#64748b]">
              Saved views, segmentation, and bulk workflow for partner outreach.
            </p>
          </div>
          <p className="text-[13px] text-[#64748b]">{organizations.length} results</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {savedViews.map((view) => {
            const href = view === "all" ? "/organizations" : `/organizations?view=${view}`;
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
          <input
            name="query"
            defaultValue={filters.query || ""}
            placeholder="Search name, market, owner, source"
            className="xl:col-span-2 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]"
          />
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
            <option value="all">All partner types</option>
            <option value="agency">Agency</option>
            <option value="operator">Operator</option>
            <option value="travel_advisor">Travel advisor</option>
            <option value="media">Media</option>
            <option value="other">Other</option>
          </select>
          <input name="view" type="hidden" value={activeView} />
          <div className="flex gap-3 xl:col-span-1">
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
        </form>

        <form action={bulkOrganizationAction} className="mt-6 space-y-4">
          <div className="grid gap-3 rounded-2xl border border-[#ece7df] bg-[#faf8f4] p-4 md:grid-cols-[1.3fr_1.4fr_1fr_1fr_auto]">
            <select name="bulkAction" defaultValue="mark_contacted" className={inputClassName}>
              <option value="mark_contacted">Mark contacted</option>
              <option value="mark_awaiting_reply">Mark awaiting reply</option>
              <option value="assign_to_me">Assign owner to me</option>
              <option value="schedule_followup">Schedule follow-up task</option>
            </select>
            <input name="followUpTitle" placeholder="Bulk follow-up title" className={inputClassName} />
            <input name="followUpDescription" placeholder="Optional note" className={inputClassName} />
            <input name="followUpDueAt" type="datetime-local" className={inputClassName} />
            <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[13px] font-medium text-white">
              Run bulk action
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[14px]">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#ece7df]">
                  <th className="px-3 py-2 font-medium">Pick</th>
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Visit</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Contacts</th>
                  <th className="px-3 py-2 font-medium">Touches</th>
                  <th className="px-3 py-2 font-medium">Next action</th>
                </tr>
              </thead>
              <tbody>
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-[#94a3b8]">
                      No organizations match these filters.
                    </td>
                  </tr>
                ) : (
                  organizations.map((organization) => {
                    return (
                      <tr key={organization.id} className="border-b border-[#f1ede6] align-top">
                        <td className="px-3 py-4">
                          <input type="checkbox" name="organizationId" value={organization.id} />
                        </td>
                        <td className="px-3 py-4">
                          <Link href={`/organizations/${organization.id}`} className="font-medium text-[#1e293b]">
                            {organization.name}
                          </Link>
                          <p className="mt-1 text-[12px] text-[#94a3b8]">
                            {[organization.type, organization.country, organization.city].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="px-3 py-4 capitalize">{organization.status.replaceAll("_", " ")}</td>
                        <td className="px-3 py-4 capitalize">{organization.visitStatus.replaceAll("_", " ")}</td>
                        <td className="px-3 py-4 text-[#475569]">{organization.ownerUserName || "Unassigned"}</td>
                        <td className="px-3 py-4 text-[#475569]">{organization.source || "—"}</td>
                        <td className="px-3 py-4">{organization._count.contacts}</td>
                        <td className="px-3 py-4">{organization._count.touches}</td>
                        <td className="px-3 py-4">
                          <p className={organization.isOverdueNextAction ? "font-medium text-[#b91c1c]" : "text-[#64748b]"}>
                            {organization.nextActionAt ? organization.nextActionAt.toLocaleString() : "None set"}
                          </p>
                          <p className="mt-1 text-[12px] text-[#94a3b8]">Priority {organization.priority}</p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </form>
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

const inputClassName =
  "rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]";
