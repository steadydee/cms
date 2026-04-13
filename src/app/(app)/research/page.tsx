import { getPartnersRequestContext } from "@/lib/auth";
import { listResearchFindings, type ResearchFindingFilters } from "@/lib/services/partners";
import { createResearchFindingAction } from "@/app/(app)/research/actions";

type ResearchSearchParams = {
  status?: string;
  sourceType?: string;
  query?: string;
};

const statuses = ["all", "new", "reviewed", "promoted", "discarded", "merged"] as const;
const sourceTypes = ["all", "instagram", "website", "directory", "manual", "referral", "other"] as const;

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<ResearchSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const filters = await searchParams;
  const findings = await listResearchFindings(context.propertyId, {
    status: parseStatus(filters.status),
    sourceType: parseSourceType(filters.sourceType),
    query: filters.query || "",
  });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Research intake</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Raw findings before CRM promotion</h1>
        <p className="mt-2 text-[14px] text-[#64748b]">
          Agents and humans can save incomplete findings here first, then review them before creating or merging partner accounts.
        </p>

        <form action={createResearchFindingAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <select name="sourceType" defaultValue="manual" className={inputClassName}>
            {sourceTypes.filter((value) => value !== "all").map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <input name="observedName" placeholder="Observed name" className={inputClassName} />
          <input name="sourceHandle" placeholder="Instagram handle or source handle" className={inputClassName} />
          <input name="sourceUrl" placeholder="Source URL" className="rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6] md:col-span-2 xl:col-span-2" />
          <input name="confidence" type="number" min="0" max="1" step="0.01" placeholder="Confidence 0-1" className={inputClassName} />
          <textarea
            name="observedText"
            placeholder="Observed notes or snippet"
            className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6] md:col-span-2 xl:col-span-3"
          />
          <textarea
            name="extractedDataJson"
            placeholder='Optional extracted JSON, e.g. {"email":"hello@example.com","city":"Manizales"}'
            className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6] md:col-span-2 xl:col-span-3"
          />
          <div className="xl:col-span-3">
            <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
              Save research finding
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Research inbox</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight">Review before promotion</h2>
          </div>
          <p className="text-[13px] text-[#64748b]">{findings.length} results</p>
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            name="query"
            defaultValue={filters.query || ""}
            placeholder="Search name, handle, URL, notes"
            className="rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6] xl:col-span-2"
          />
          <select name="status" defaultValue={filters.status || "all"} className={inputClassName}>
            {statuses.map((status) => (
              <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
            ))}
          </select>
          <select name="sourceType" defaultValue={filters.sourceType || "all"} className={inputClassName}>
            {sourceTypes.map((sourceType) => (
              <option key={sourceType} value={sourceType}>{sourceType.replaceAll("_", " ")}</option>
            ))}
          </select>
          <div className="flex gap-3 xl:col-span-4">
            <button type="submit" className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[13px] font-medium text-white">
              Apply filters
            </button>
          </div>
        </form>

        <div className="mt-6 space-y-3">
          {findings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">
              No research findings match these filters.
            </div>
          ) : (
            findings.map((finding) => (
              <div key={finding.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-[#1e293b]">{finding.observedName || "Unnamed finding"}</p>
                    <p className="mt-1 text-[13px] text-[#64748b]">
                      {[finding.sourceType, finding.sourceHandle, finding.sourceUrl].filter(Boolean).join(" · ") || "No source details"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-[#f8fafc] px-3 py-1 font-medium capitalize text-[#475569]">
                      {finding.status}
                    </span>
                    {typeof finding.confidence === "number" ? (
                      <span className="rounded-full bg-[#ecfdf5] px-3 py-1 font-medium text-[#0f766e]">
                        Confidence {finding.confidence.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {finding.observedText ? (
                  <p className="mt-3 text-[14px] text-[#475569]">{finding.observedText}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[#94a3b8]">
                  <span>Saved by {finding.createdByActorLabel}</span>
                  <span>{finding.createdAt.toLocaleString()}</span>
                  {finding.proposedOrganization ? <span>Linked to {finding.proposedOrganization.name}</span> : null}
                </div>

                {finding.extractedDataJson ? (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-[#f8fafc] px-3 py-3 text-[12px] text-[#475569]">
                    {JSON.stringify(finding.extractedDataJson, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function parseStatus(value: string | undefined): ResearchFindingFilters["status"] {
  return value === "new" || value === "reviewed" || value === "promoted" || value === "discarded" || value === "merged"
    ? value
    : "all";
}

function parseSourceType(value: string | undefined): ResearchFindingFilters["sourceType"] {
  return value === "instagram"
    || value === "website"
    || value === "directory"
    || value === "manual"
    || value === "referral"
    || value === "other"
    ? value
    : "all";
}

const inputClassName =
  "w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]";
