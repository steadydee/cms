"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { savePartnerTypeSetupAction } from "@/app/(app)/setup/actions";
import type { ControlTableOption } from "@/lib/services/partners";

type PartnerTypeTableProps = {
  rows: ControlTableOption[];
};

type EditableRow = {
  clientId: string;
  id?: string;
  originalValue?: string;
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
};

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

export function PartnerTypeTable({ rows }: PartnerTypeTableProps) {
  const [draftRows, setDraftRows] = useState<EditableRow[]>(
    rows.map((row) => ({
      clientId: row.id,
      id: row.id,
      originalValue: row.value,
      value: row.value,
      label: row.label,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      usageCount: row.usageCount,
    }))
  );

  const rowsJson = useMemo(
    () => JSON.stringify(draftRows.map(({ id, originalValue, value, label, isActive, sortOrder }) => ({
      id,
      originalValue,
      value,
      label,
      isActive,
      sortOrder,
    }))),
    [draftRows]
  );

  return (
    <form action={savePartnerTypeSetupAction} className="rounded-[24px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
      <input type="hidden" name="returnTo" value="/setup" />
      <input type="hidden" name="rowsJson" value={rowsJson} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Control table</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[var(--ink)]">Account types</h2>
          <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[var(--ink-soft)]">
            These values drive the `type` field across the CRM. Edit labels, rename stored values, add new rows, or deactivate types you no longer want used for new accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDraftRows((current) => [
                ...current,
                {
                  clientId: makeClientId(),
                  value: "",
                  label: "",
                  isActive: true,
                  sortOrder: current.length,
                  usageCount: 0,
                },
              ])
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)]"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-[var(--accent-contrast)]"
          >
            Save types
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)]">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_110px_90px] gap-3 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
          <span>Label</span>
          <span>Value</span>
          <span>Usage</span>
          <span>Active</span>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {draftRows.map((row, index) => (
            <div key={row.clientId} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_110px_90px] gap-3 px-4 py-3">
              <input
                value={row.label}
                onChange={(event) =>
                  setDraftRows((current) =>
                    current.map((entry) =>
                      entry.clientId === row.clientId ? { ...entry, label: event.target.value, sortOrder: index } : entry
                    )
                  )
                }
                placeholder="Birding operator"
                className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
              <input
                value={row.value}
                onChange={(event) =>
                  setDraftRows((current) =>
                    current.map((entry) =>
                      entry.clientId === row.clientId ? { ...entry, value: event.target.value, sortOrder: index } : entry
                    )
                  )
                }
                placeholder="birding_operator"
                className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
              <div className="flex items-center text-[13px] text-[var(--ink-soft)]">
                {row.usageCount} accounts
              </div>
              <label className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(event) =>
                    setDraftRows((current) =>
                      current.map((entry) =>
                        entry.clientId === row.clientId ? { ...entry, isActive: event.target.checked, sortOrder: index } : entry
                      )
                    )
                  }
                  className="h-4 w-4 rounded border-[var(--line)]"
                />
                On
              </label>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[12px] text-[var(--ink-soft)]">
        Renaming a stored value updates existing accounts using that type. Deactivating a type keeps old accounts readable but removes it from new-account forms.
      </p>
    </form>
  );
}
