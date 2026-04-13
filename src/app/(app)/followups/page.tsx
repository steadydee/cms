import { getPartnersRequestContext } from "@/lib/auth";
import { listDueFollowUps } from "@/lib/services/partners";
import { completeFollowUpTaskAction } from "@/app/(app)/followups/actions";
import Link from "next/link";

export default async function FollowupsPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const tasks = await listDueFollowUps(context.propertyId);

  return (
    <section className="rounded-3xl border border-[#ddd6cc] bg-white p-6 shadow-[0_8px_30px_rgba(30,41,59,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Follow-up queue</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Tasks that need attention</h1>
      <div className="mt-6 space-y-4">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d7d2c9] px-4 py-6 text-[14px] text-[#94a3b8]">
            No follow-up tasks are open.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-[#ece7df] px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Link href={`/organizations/${task.organization.id}`} className="font-medium text-[#1e293b]">
                    {task.organization.name}
                  </Link>
                  <p className="mt-1 text-[14px] text-[#475569]">{task.title}</p>
                  {task.description && <p className="mt-2 text-[13px] text-[#64748b]">{task.description}</p>}
                  <p className="mt-3 text-[12px] text-[#94a3b8]">
                    Due {task.dueAt.toLocaleString()}
                    {task.contact ? ` · Contact ${task.contact.fullName}` : ""}
                  </p>
                </div>
                <form action={completeFollowUpTaskAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <button type="submit" className="rounded-lg border border-[#0f766e] px-3 py-2 text-[13px] font-medium text-[#0f766e]">
                    Mark done
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
