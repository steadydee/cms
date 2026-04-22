import { getPartnersRequestContext } from "@/lib/auth";
import { getOpsOverview, listPartnerTypeOptions } from "@/lib/services/partners";
import { EmailTemplateCard } from "@/components/dashboard/email-template-card";
import { PartnerTypeTable } from "@/components/setup/partner-type-table";

export default async function SetupPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const [partnerTypes, ops] = await Promise.all([
    listPartnerTypeOptions(context.propertyId, { includeInactive: true }),
    getOpsOverview(context.propertyId),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <section className="rounded-[24px] border border-[#d8ccb9] bg-white px-6 py-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Setup</p>
        <h1 className="mt-2 font-serif text-[30px] font-semibold tracking-tight text-[#2c2416]">Control tables</h1>
        <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-[#8c7e6a]">
          Manage the runtime values that drive account creation, filtering, automation, and outreach. Account types and reusable email templates now live here.
        </p>
      </section>

      <PartnerTypeTable rows={partnerTypes} />

      <section className="rounded-[24px] border border-[#d8ccb9] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Control table</p>
            <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#2c2416]">Email templates</h2>
            <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#8c7e6a]">
              Edit the reusable partner outreach templates used in the account composer. These stay available in Gmail send flows across the CRM.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {ops.templates.map((template) => <EmailTemplateCard key={template.id} template={template} />)}
        </div>
      </section>
    </div>
  );
}
