import { getPartnersRequestContext } from "@/lib/auth";
import { listPartnerTypeOptions } from "@/lib/services/partners";
import { PartnerTypeTable } from "@/components/setup/partner-type-table";

export default async function SetupPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const partnerTypes = await listPartnerTypeOptions(context.propertyId, { includeInactive: true });

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <section className="rounded-[24px] border border-[#d8ccb9] bg-white px-6 py-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Setup</p>
        <h1 className="mt-2 font-serif text-[30px] font-semibold tracking-tight text-[#2c2416]">Control tables</h1>
        <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-[#8c7e6a]">
          Manage the runtime values that drive account creation, filtering, and automation. Start with account types here, then extend this page with more control tables as needed.
        </p>
      </section>

      <PartnerTypeTable rows={partnerTypes} />
    </div>
  );
}
