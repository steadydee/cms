import Link from "next/link";
import type { ResearchFindingStatus, ResearchSourceType } from "@prisma/client";
import { getPartnersRequestContext } from "@/lib/auth";
import { listResearchFindings } from "@/lib/services/partners";
import {
  createResearchFindingAction,
  discardResearchFindingAction,
  markResearchFindingReviewedAction,
  promoteResearchFindingAction,
} from "@/app/(app)/research/actions";

type ResearchSearchParams = {
  query?: string;
  status?: string;
  sourceType?: string;
};

const statuses: Array<{ value: "all" | ResearchFindingStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "promoted", label: "Promoted" },
  { value: "discarded", label: "Discarded" },
  { value: "merged", label: "Merged" },
];

const sourceTypes: Array<{ value: "all" | ResearchSourceType; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "manual", label: "Manual" },
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "directory", label: "Directory" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<ResearchSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const resolvedSearchParams = await searchParams;
  const status = parseStatus(resolvedSearchParams.status);
  const sourceType = parseSourceType(resolvedSearchParams.sourceType);
  const findings = await listResearchFindings(context.propertyId, {
    query: resolvedSearchParams.query || "",
    status,
    sourceType,
  });

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <section className="rounded-[24px] border border-[#e8e0d4] bg-white px-6 py-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Inbox</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-[28px] font-semibold tracking-tight text-[#2c2416]">Research</h1>
            <p className="mt-2 text-[13px] text-[#8c7e6a]">Capture leads, review raw findings, and promote the good ones into partner accounts.</p>
          </div>
          <Link href="/contacts" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
            View accounts
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Capture a finding</p>
          <form action={createResearchFindingAction} className="mt-4 space-y-3">
            <input type="hidden" name="returnTo" value="/research" />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Observed name</label>
              <input
                name="observedName"
                placeholder="Birding operator or agency name"
                className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Source type</label>
                <select
                  name="sourceType"
                  defaultValue="manual"
                  className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
                >
                  {sourceTypes.filter((item) => item.value !== "all").map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Handle or directory</label>
                <input
                  name="sourceHandle"
                  placeholder="@agency or listing name"
                  className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Source URL</label>
              <input
                name="sourceUrl"
                placeholder="https://..."
                className="mt-2 w-full rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">What did you learn?</label>
              <textarea
                name="observedText"
                placeholder="Birding niche, destinations served, likely fit, key contacts, visit potential..."
                className="mt-2 min-h-[140px] w-full rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
              />
            </div>
            <button type="submit" className="rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white">
              Save finding
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <input
              name="query"
              defaultValue={resolvedSearchParams.query || ""}
              placeholder="Search name, handle, notes, or URL"
              className="rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
            />
            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              name="sourceType"
              defaultValue={sourceType}
              className="rounded-lg border border-[#e8e0d4] bg-[#fdfaf6] px-3 py-2.5 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
            >
              {sourceTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </form>

          <div className="mt-5 space-y-3">
            {findings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
                No research findings match this view.
              </div>
            ) : (
              findings.map((finding) => (
                <div key={finding.id} className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-[#2c2416]">{finding.observedName || "Untitled finding"}</p>
                        <span className="rounded-full bg-[#f3ede4] px-2 py-0.5 text-[10px] font-medium text-[#6b5d4a]">
                          {finding.status.replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full bg-[#f3eef8] px-2 py-0.5 text-[10px] font-medium text-[#6b4c8a]">
                          {finding.sourceType}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-[#8c7e6a]">
                        {[finding.sourceHandle, finding.sourceUrl].filter(Boolean).join(" · ") || "No source metadata"}
                      </p>
                      {finding.observedText ? (
                        <p className="mt-3 text-[13px] leading-relaxed text-[#4f4639]">{finding.observedText}</p>
                      ) : null}
                      {finding.proposedOrganization ? (
                        <p className="mt-3 text-[12px] text-[#3d6b4f]">
                          Linked to{" "}
                          <Link href={`/contacts/${finding.proposedOrganization.id}`} className="font-medium hover:underline">
                            {finding.proposedOrganization.name}
                          </Link>
                        </p>
                      ) : null}
                    </div>

                    {(finding.status === "new" || finding.status === "reviewed") ? (
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <form action={promoteResearchFindingAction}>
                          <input type="hidden" name="findingId" value={finding.id} />
                          <input type="hidden" name="returnTo" value="/research" />
                          <button type="submit" className="w-full rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white">
                            Promote to account
                          </button>
                        </form>
                        {finding.status === "new" ? (
                          <form action={markResearchFindingReviewedAction}>
                            <input type="hidden" name="findingId" value={finding.id} />
                            <input type="hidden" name="returnTo" value="/research" />
                            <button type="submit" className="w-full rounded-lg border border-[#2c2416] px-4 py-2 text-[13px] font-medium text-[#2c2416]">
                              Mark reviewed
                            </button>
                          </form>
                        ) : null}
                        <form action={discardResearchFindingAction}>
                          <input type="hidden" name="findingId" value={finding.id} />
                          <input type="hidden" name="returnTo" value="/research" />
                          <button type="submit" className="w-full rounded-lg border border-[#f0d9c9] px-4 py-2 text-[13px] font-medium text-[#c4713b]">
                            Discard
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function parseStatus(value: string | undefined) {
  return value === "new"
    || value === "reviewed"
    || value === "promoted"
    || value === "discarded"
    || value === "merged"
    ? value
    : "all";
}

function parseSourceType(value: string | undefined) {
  return value === "instagram"
    || value === "website"
    || value === "directory"
    || value === "manual"
    || value === "referral"
    || value === "other"
    ? value
    : "all";
}
