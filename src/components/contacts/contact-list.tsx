import Link from "next/link";
import type { ContactStage } from "@/lib/partners-ui";
import { CONTACT_STAGE_META } from "@/lib/partners-ui";
import type { ControlTableOption, listContactsIndex } from "@/lib/services/partners";
import { QuickAddContact } from "@/components/contacts/quick-add-contact";

type ContactListItem = Awaited<ReturnType<typeof listContactsIndex>>[number];

const stageFilters: Array<{ value: "all" | ContactStage; label: string }> = [
  { value: "all", label: "All" },
  { value: "researching", label: "Researching" },
  { value: "ready", label: "Ready to Contact" },
  { value: "outreach_sent", label: "Outreach Sent" },
  { value: "in_conversation", label: "In Conversation" },
  { value: "active_partner", label: "Active Partner" },
  { value: "dormant", label: "Dormant" },
];

function buildContactsHref(searchParams: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...searchParams, ...patch })) {
    if (value && value !== "all") params.set(key, value);
  }

  const query = params.toString();
  return query ? `/contacts?${query}` : "/contacts";
}

export function ContactList({
  items,
  selectedId,
  searchParams,
  compact = false,
  typeOptions,
}: {
  items: ContactListItem[];
  selectedId?: string;
  searchParams: Record<string, string | undefined>;
  compact?: boolean;
  typeOptions: ControlTableOption[];
}) {
  return (
    <section className={`rounded-[22px] border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] ${compact ? "h-full" : ""}`}>
      <div className={`border-b border-[var(--line)] ${compact ? "px-4 py-4" : "px-6 py-5"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Directory</p>
            <h1 className="mt-2 font-serif text-[28px] font-semibold tracking-tight text-[var(--ink)]">Accounts</h1>
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{items.length} matching accounts</p>
            <p className="mt-1 text-[12px] text-[var(--ink-faint)]">Each account is one operator or agency. Add people and outreach from the detail page.</p>
          </div>
          <QuickAddContact compact returnTo="/contacts" typeOptions={typeOptions} />
        </div>

        <form className="mt-5">
          <input
            name="query"
            defaultValue={searchParams.query || ""}
            placeholder="Search account, tag, location, or person"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          />
          {searchParams.stage && searchParams.stage !== "all" ? <input type="hidden" name="stage" value={searchParams.stage} /> : null}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {stageFilters.map((filter) => {
            const isActive = (searchParams.stage || "all") === filter.value;
            const href = buildContactsHref(searchParams, {
              stage: filter.value === "all" ? undefined : filter.value,
            });

            return (
              <Link
                key={filter.value}
                href={href}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                  isActive ? "bg-[var(--ink)] text-[var(--accent-contrast)]" : "bg-[var(--line-soft)] text-[var(--ink-soft)]"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className={`${compact ? "max-h-[calc(100vh-260px)] overflow-y-auto p-3" : "p-4"} space-y-2`}>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-[13px] text-[var(--ink-faint)]">
            No accounts match this view.
          </div>
        ) : (
          items.map((item) => {
            const stageMeta = CONTACT_STAGE_META[item.displayStage];
            const isSelected = selectedId === item.id;

            return (
              <Link
                key={item.id}
                href={`/contacts/${item.id}`}
                className={`block rounded-xl border px-4 py-3 transition ${
                  isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--card)] hover:bg-[var(--line-soft)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[var(--ink)]">{item.name}</p>
                    <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                      {item.primaryPerson?.fullName || "No primary person"}
                      {(item.city || item.country) ? ` · ${[item.city, item.country].filter(Boolean).join(", ")}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${stageMeta.className}`}>
                    {stageMeta.label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.tagNames.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-[var(--line-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-soft)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-[var(--ink-soft)]">
                  {item.nextActionTask?.dueAt ? (
                    <span className={item.nextActionIsOverdue ? "text-[var(--warm)]" : undefined}>
                      {item.nextActionTask.title} · {item.nextActionTask.dueAt.toLocaleDateString()}
                    </span>
                  ) : (
                    "No next action set"
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
