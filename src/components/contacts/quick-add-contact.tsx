"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createQuickContactAction } from "@/app/(app)/contacts/actions";
import type { ControlTableOption } from "@/lib/services/partners";

const inputClassName =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

export function QuickAddContact({
  compact = false,
  returnTo = "/contacts",
  typeOptions,
}: {
  compact?: boolean;
  returnTo?: string;
  typeOptions: ControlTableOption[];
}) {
  const [open, setOpen] = useState(false);
  const defaultTypeValue = typeOptions[0]?.value ?? "";

  return (
    <div className={compact ? "w-full" : "w-full max-w-[360px]"}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition ${
          open ? "border border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)]" : "bg-[var(--accent)] text-[var(--accent-contrast)]"
        }`}
      >
        {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {open ? "Close" : "Add Account"}
      </button>

      {open ? (
        <form action={createQuickContactAction} className="mt-4 space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow)]">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Name</label>
            <input name="name" required placeholder="Operator or agency name" className={`${inputClassName} mt-2`} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Type</label>
            <select name="type" defaultValue={defaultTypeValue} className={`${inputClassName} mt-2`}>
              {typeOptions.map((option) => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
              Email or WhatsApp
            </label>
            <input
              name="emailOrWhatsapp"
              placeholder="name@example.com or +57..."
              className={`${inputClassName} mt-2`}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-[var(--accent-contrast)]"
          >
            Create account
          </button>
        </form>
      ) : null}
    </div>
  );
}
