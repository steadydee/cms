import { getPartnersRequestContext } from "@/lib/auth";
import { listOrganizations } from "@/lib/services/partners";
import { createOrganizationAction } from "@/app/(app)/organizations/actions";
import Link from "next/link";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; visitStatus?: string; query?: string }>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const filters = await searchParams;
  const organizations = await listOrganizations(context.propertyId, {
    status: (filters.status as "all") || "all",
    visitStatus: (filters.visitStatus as "all") || "all",
    query: filters.query || "",
  });

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
          <input name="source" placeholder="Source or campaign" className={inputClassName} />
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Organizations</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight">Outreach targets</h2>
          </div>
          <p className="text-[13px] text-[#64748b]">{organizations.length} results</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-[14px]">
            <thead className="text-[#64748b]">
              <tr className="border-b border-[#ece7df]">
                <th className="px-3 py-2 font-medium">Organization</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Visit</th>
                <th className="px-3 py-2 font-medium">Contacts</th>
                <th className="px-3 py-2 font-medium">Touches</th>
                <th className="px-3 py-2 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-[#94a3b8]">
                    No organizations yet.
                  </td>
                </tr>
              ) : (
                organizations.map((organization) => (
                  <tr key={organization.id} className="border-b border-[#f1ede6] align-top">
                    <td className="px-3 py-4">
                      <Link href={`/organizations/${organization.id}`} className="font-medium text-[#1e293b]">
                        {organization.name}
                      </Link>
                      <p className="mt-1 text-[12px] text-[#94a3b8]">
                        {[organization.type, organization.country, organization.city].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-3 py-4 capitalize">{organization.status.replaceAll("_", " ")}</td>
                    <td className="px-3 py-4 capitalize">{organization.visitStatus}</td>
                    <td className="px-3 py-4">{organization._count.contacts}</td>
                    <td className="px-3 py-4">{organization._count.touches}</td>
                    <td className="px-3 py-4 text-[#64748b]">
                      {organization.nextActionAt ? organization.nextActionAt.toLocaleString() : "None set"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const inputClassName =
  "rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]";
