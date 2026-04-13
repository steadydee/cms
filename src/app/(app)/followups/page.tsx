import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { listDueFollowUps } from "@/lib/services/partners";
import {
  assignFollowUpToMeAction,
  completeFollowUpTaskAction,
} from "@/app/(app)/followups/actions";

type FollowupSearchParams = {
  bucket?: string;
};

const buckets = [
  { key: "all", label: "All open" },
  { key: "overdue", label: "Overdue" },
  { key: "this_week", label: "Due this week" },
  { key: "mine", label: "Assigned to me" },
] as const;

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<FollowupSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const { bucket } = await searchParams;
  const activeBucket = parseBucket(bucket);
  const tasks = await listDueFollowUps(context.propertyId, {
    bucket: activeBucket,
    assignee: activeBucket === "mine" ? context.userName : undefined,
  });

  const overdueCount = tasks.filter((task) => task.isOverdue).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Follow-up queue</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Tasks that need attention</h1>
            <p className="mt-2 text-[14px] text-[#64748b]">
              Keep overdue outreach visible and claim work directly from the queue.
            </p>
          </div>
          <div className="flex gap-3">
            <SummaryCard label="Open tasks" value={tasks.length} />
            <SummaryCard label="Overdue" value={overdueCount} tone="red" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {buckets.map((bucketOption) => {
            const href = bucketOption.key === "all" ? "/followups" : `/followups?bucket=${bucketOption.key}`;
            const isActive = activeBucket === bucketOption.key;

            return (
              <Link
                key={bucketOption.key}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                  isActive
                    ? "border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]"
                    : "border-[#d7d2c9] bg-white text-[#475569] hover:bg-[#faf8f4]"
                }`}
              >
                {bucketOption.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">
              No follow-up tasks are open for this view.
            </div>
          ) : (
            tasks.map((task) => {
              return (
                <div
                  key={task.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    task.isOverdue ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#ece7df]"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/organizations/${task.organization.id}`} className="font-medium text-[#1e293b]">
                          {task.organization.name}
                        </Link>
                        {task.isOverdue ? (
                          <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b91c1c]">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[14px] text-[#475569]">{task.title}</p>
                      {task.description && <p className="mt-2 text-[13px] text-[#64748b]">{task.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[#94a3b8]">
                        <span>Due {task.dueAt.toLocaleString()}</span>
                        {task.contact ? <span>Contact {task.contact.fullName}</span> : null}
                        <span>Owner {task.organization.ownerUserName || "Unassigned"}</span>
                        <span>Assignee {task.assignedToUserName || "Unassigned"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={assignFollowUpToMeAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button type="submit" className="rounded-lg border border-[#1e293b] px-3 py-2 text-[13px] font-medium text-[#1e293b]">
                          Assign to me
                        </button>
                      </form>
                      <form action={completeFollowUpTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button type="submit" className="rounded-lg border border-[#0f766e] px-3 py-2 text-[13px] font-medium text-[#0f766e]">
                          Mark done
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function parseBucket(value: string | undefined) {
  return value === "overdue" || value === "this_week" || value === "mine" ? value : "all";
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "red";
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === "red" ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#ece7df] bg-[#faf8f4]"}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-tight text-[#1e293b]">{value}</p>
    </div>
  );
}
