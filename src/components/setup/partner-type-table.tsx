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
    <form action={savePartnerTypeSetupAction} className="rounded-[24px] border border-[#d8ccb9] bg-white p-5 shadow-sm">
      <input type="hidden" name="returnTo" value="/setup" />
      <input type="hidden" name="rowsJson" value={rowsJson} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Control table</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#2c2416]">Account types</h2>
          <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#8c7e6a]">
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
            className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccb9] bg-[#fdfaf6] px-4 py-2 text-[13px] font-medium text-[#6d614d]"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-[#2c2416] px-4 py-2 text-[13px] font-medium text-white"
          >
            Save types
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#d8ccb9]">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_110px_90px] gap-3 border-b border-[#d8ccb9] bg-[#fdfaf6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c7e6a]">
          <span>Label</span>
          <span>Value</span>
          <span>Usage</span>
          <span>Active</span>
        </div>

        <div className="divide-y divide-[#ded2c2]">
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
                className="rounded-lg border border-[#d8ccb9] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
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
                className="rounded-lg border border-[#d8ccb9] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]"
              />
              <div className="flex items-center text-[13px] text-[#6d614d]">
                {row.usageCount} accounts
              </div>
              <label className="flex items-center gap-2 text-[13px] text-[#6d614d]">
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
                  className="h-4 w-4 rounded border-[#d2c6b7]"
                />
                On
              </label>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[12px] text-[#8c7e6a]">
        Renaming a stored value updates existing accounts using that type. Deactivating a type keeps old accounts readable but removes it from new-account forms.
      </p>
    </form>
  );
}
