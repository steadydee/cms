import Link from "next/link";
import { ArrowRight, PlusSquare } from "lucide-react";
import { getPartnersRequestContext } from "@/lib/auth";
import { listResearchFindings, type ResearchFindingFilters } from "@/lib/services/partners";
import {
  createResearchFindingAction,
  discardResearchFindingAction,
  markResearchFindingReviewedAction,
  promoteResearchFindingAction,
} from "@/app/(app)/research/actions";

type ResearchSearchParams = {
  status?: string;
  sourceType?: string;
  query?: string;
  tab?: string;
};

const statuses = ["all", "new", "reviewed", "promoted", "discarded", "merged"] as const;
const sourceTypes = ["all", "instagram", "website", "directory", "manual", "referral", "other"] as const;
const tabs = ["inbox", "capture"] as const;
type ResearchTab = (typeof tabs)[number];

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<ResearchSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const filters = await searchParams;
  const activeTab = parseTab(filters.tab);
  const findings = await listResearchFindings(context.propertyId, {
    status: parseStatus(filters.status),
    sourceType: parseSourceType(filters.sourceType),
    query: filters.query || "",
  });

  const triageCount = findings.filter((finding) => finding.status === "new" || finding.status === "reviewed").length;

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Research</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[#1e293b]">Triage findings before they become accounts</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">
              Capture rough findings when you need to, but default to the inbox so the team can review, discard, or promote items deliberately.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryStat label="Needs review" value={triageCount} tone="amber" />
            <SummaryStat label="Total results" value={findings.length} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={tab === "inbox" ? "/research" : `/research?tab=${tab}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === tab
                  ? "border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]"
                  : "border-[#d7d2c9] bg-white text-[#475569] hover:bg-[#faf8f4]"
              }`}
            >
              {tab === "inbox" ? "Inbox" : "Capture"}
            </Link>
          ))}
        </div>
      </section>

      {activeTab === "inbox" ? (
        <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Inbox</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#1e293b]">Review before promotion</h2>
              <p className="mt-2 text-[14px] text-[#64748b]">
                Treat research like triage. Promote only the items worth becoming real relationship records.
              </p>
            </div>
            <Link href="/research?tab=capture" className="inline-flex items-center gap-2 rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]">
              <PlusSquare className="h-4 w-4" />
              Capture new finding
            </Link>
          </div>

          <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              name="query"
              defaultValue={filters.query || ""}
              placeholder="Search name, handle, URL, notes"
              className="rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e] xl:col-span-2"
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
            <button type="submit" className="w-fit rounded-lg bg-[#0f766e] px-4 py-2.5 text-[13px] font-medium text-white">
              Apply filters
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {findings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">
                No research findings match these filters.
              </div>
            ) : (
              findings.map((finding) => (
                <div key={finding.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[#1e293b]">{finding.observedName || "Unnamed finding"}</p>
                        <StatusBadge status={finding.status} />
                        {typeof finding.confidence === "number" ? <ConfidenceBadge confidence={finding.confidence} /> : null}
                      </div>
                      <p className="mt-2 text-[13px] text-[#64748b]">
                        {[finding.sourceType, finding.sourceHandle, finding.sourceUrl].filter(Boolean).join(" · ") || "No source details"}
                      </p>
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

                    <div className="flex min-w-[230px] flex-col gap-2">
                      <form action={promoteResearchFindingAction}>
                        <input type="hidden" name="findingId" value={finding.id} />
                        <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[13px] font-medium text-white">
                          Promote to account
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                      <form action={markResearchFindingReviewedAction}>
                        <input type="hidden" name="findingId" value={finding.id} />
                        <button type="submit" className="w-full rounded-lg border border-[#1e293b] px-4 py-2.5 text-[13px] font-medium text-[#1e293b]">
                          Mark reviewed
                        </button>
                      </form>
                      <form action={discardResearchFindingAction}>
                        <input type="hidden" name="findingId" value={finding.id} />
                        <button type="submit" className="w-full rounded-lg border border-[#c2410c] px-4 py-2.5 text-[13px] font-medium text-[#c2410c]">
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
      ) : null}

      {activeTab === "capture" ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Capture</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#1e293b]">Save a rough finding quickly</h2>
            <p className="mt-2 text-[14px] text-[#64748b]">
              This is for incomplete leads and raw observations. If you already know it deserves real follow-up, promote it from the inbox right after capture.
            </p>

            <form action={createResearchFindingAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <select name="sourceType" defaultValue="manual" className={inputClassName}>
                {sourceTypes.filter((value) => value !== "all").map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <input name="observedName" placeholder="Observed name" className={inputClassName} />
              <input name="sourceHandle" placeholder="Instagram handle or source handle" className={inputClassName} />
              <input name="sourceUrl" placeholder="Source URL" className="rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e] md:col-span-2 xl:col-span-2" />
              <input name="confidence" type="number" min="0" max="1" step="0.01" placeholder="Confidence 0-1" className={inputClassName} />
              <textarea
                name="observedText"
                placeholder="Observed notes or snippet"
                className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e] md:col-span-2 xl:col-span-3"
              />
              <textarea
                name="extractedDataJson"
                placeholder='Optional extracted JSON, e.g. {"email":"hello@example.com","city":"Manizales"}'
                className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e] md:col-span-2 xl:col-span-3"
              />
              <div className="xl:col-span-3">
                <button type="submit" className="rounded-lg bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
                  Save research finding
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[28px] border border-[#ddd6cc] bg-white p-6 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">How to use this</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#1e293b]">Capture first, then triage</h2>
            <div className="mt-6 space-y-4 text-[14px] text-[#475569]">
              <InstructionCard title="When capture makes sense">
                You found something incomplete, messy, or uncertain and want it saved before you forget it.
              </InstructionCard>
              <InstructionCard title="When not to stay here">
                If you already know it deserves outreach, promote it quickly so it lands in Accounts and the work queue.
              </InstructionCard>
              <InstructionCard title="What the inbox is for">
                Review, discard, or promote findings so Research stays a triage tool instead of becoming a second CRM.
              </InstructionCard>
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}

function parseTab(value: string | undefined): ResearchTab {
  return tabs.includes(value as ResearchTab) ? (value as ResearchTab) : "inbox";
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

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber";
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === "amber" ? "border-[#fed7aa] bg-[#fff7ed]" : "border-[#ece7df] bg-[#faf8f4]"}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-tight text-[#1e293b]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "promoted" ? "bg-[#ecfdf5] text-[#0f766e]" :
    status === "discarded" ? "bg-[#fef2f2] text-[#b91c1c]" :
    status === "reviewed" ? "bg-[#eff6ff] text-[#1d4ed8]" :
    "bg-[#fff7ed] text-[#c2410c]";

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${className}`}>{status}</span>;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
      Confidence {confidence.toFixed(2)}
    </span>
  );
}

function InstructionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#ece7df] px-4 py-4">
      <p className="font-medium text-[#1e293b]">{title}</p>
      <p className="mt-2 text-[14px] text-[#64748b]">{children}</p>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]";
