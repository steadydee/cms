import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { listDueFollowUps } from "@/lib/services/partners";
import {
  assignFollowUpToMeAction,
  completeFollowUpTaskAction,
} from "@/app/(app)/followups/actions";
import { getStatusDisplayLabel } from "@/lib/partners-ui";

type TasksSearchParams = {
  bucket?: string;
};

const buckets = [
  { value: "all", label: "All open" },
  { value: "overdue", label: "Overdue" },
  { value: "this_week", label: "Due this week" },
  { value: "mine", label: "Assigned to me" },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<TasksSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const resolvedSearchParams = await searchParams;
  const bucket = parseBucket(resolvedSearchParams.bucket);

  const [allTasks, overdueTasks, weekTasks, myTasks, visibleTasks] = await Promise.all([
    listDueFollowUps(context.propertyId, { bucket: "all" }),
    listDueFollowUps(context.propertyId, { bucket: "overdue" }),
    listDueFollowUps(context.propertyId, { bucket: "this_week" }),
    listDueFollowUps(context.propertyId, { bucket: "mine", assignee: context.userName }),
    listDueFollowUps(context.propertyId, {
      bucket,
      assignee: bucket === "mine" ? context.userName : undefined,
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <section className="rounded-[24px] border border-[#e8e0d4] bg-white px-6 py-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Queue</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-[28px] font-semibold tracking-tight text-[#2c2416]">Tasks</h1>
            <p className="mt-2 text-[13px] text-[#8c7e6a]">Follow-ups that keep partner outreach moving forward.</p>
          </div>
          <Link href="/contacts" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
            Back to accounts
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CountCard label="All open" value={allTasks.length} href="/tasks" />
        <CountCard label="Overdue" value={overdueTasks.length} href="/tasks?bucket=overdue" />
        <CountCard label="Due this week" value={weekTasks.length} href="/tasks?bucket=this_week" />
        <CountCard label="Assigned to me" value={myTasks.length} href="/tasks?bucket=mine" />
      </section>

      <section className="rounded-[24px] border border-[#e8e0d4] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {buckets.map((item) => {
            const active = bucket === item.value;
            const href = item.value === "all" ? "/tasks" : `/tasks?bucket=${item.value}`;

            return (
              <Link
                key={item.value}
                href={href}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                  active ? "bg-[#2c2416] text-white" : "bg-[#f3ede4] text-[#6b5d4a]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-5 space-y-3">
          {visibleTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ddd2c4] px-4 py-6 text-[13px] text-[#9a8e7a]">
              No open tasks in this view.
            </div>
          ) : (
            visibleTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/contacts/${task.organization.id}`} className="text-[15px] font-semibold text-[#2c2416] hover:underline">
                        {task.organization.name}
                      </Link>
                      <span className="rounded-full bg-[#f3ede4] px-2 py-0.5 text-[10px] font-medium text-[#6b5d4a]">
                        {getStatusDisplayLabel(task.organization.status)}
                      </span>
                      {task.contact ? (
                        <span className="rounded-full bg-[#ebf3fa] px-2 py-0.5 text-[10px] font-medium text-[#2d6fa0]">
                          {task.contact.fullName}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[14px] font-medium text-[#2c2416]">{task.title}</p>
                    {task.description ? <p className="mt-2 text-[13px] leading-relaxed text-[#6d614d]">{task.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[#8c7e6a]">
                      <span className={task.isOverdue ? "font-medium text-[#c4713b]" : undefined}>
                        Due {task.dueAt.toLocaleDateString()}
                      </span>
                      <span>
                        Assigned to {task.assignedToUserName || "nobody"}
                      </span>
                      <span>
                        Owner {task.organization.ownerUserName || "unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-2">
                    {task.assignedToUserName !== context.userName ? (
                      <form action={assignFollowUpToMeAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="returnTo" value={bucket === "all" ? "/tasks" : `/tasks?bucket=${bucket}`} />
                        <button type="submit" className="w-full rounded-lg border border-[#2c2416] px-4 py-2 text-[13px] font-medium text-[#2c2416]">
                          Assign to me
                        </button>
                      </form>
                    ) : null}
                    <form action={completeFollowUpTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="returnTo" value={bucket === "all" ? "/tasks" : `/tasks?bucket=${bucket}`} />
                      <button type="submit" className="w-full rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white">
                        Mark done
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function parseBucket(value: string | undefined) {
  return value === "overdue" || value === "this_week" || value === "mine" ? value : "all";
}

function CountCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-[20px] border border-[#e8e0d4] bg-white px-5 py-4 shadow-sm transition hover:bg-[#fffdfa]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">{label}</p>
      <p className="mt-3 font-serif text-[28px] font-semibold text-[#2c2416]">{value}</p>
    </Link>
  );
}
