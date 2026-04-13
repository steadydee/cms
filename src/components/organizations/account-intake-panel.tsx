"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createOrganizationAction } from "@/app/(app)/organizations/actions";

const inputClassName =
  "w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]";

export function AccountIntakePanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-white shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Add account
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#0f172a]/35 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 cursor-default"
            aria-label="Close add account panel"
          />

          <div className="h-full w-full max-w-[560px] overflow-y-auto border-l border-[#ddd6cc] bg-[#fcfbf8] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#ece7df] bg-[#fcfbf8]/95 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Quick intake</p>
                <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[#1e293b]">Add an account</h2>
                <p className="mt-2 text-[14px] text-[#64748b]">
                  Capture the basics quickly, then enrich the record from the account detail page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[#d7d2c9] p-2 text-[#475569] transition hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={createOrganizationAction} className="space-y-6 px-6 py-6">
              <input type="hidden" name="redirectToCreated" value="on" />
              <section className="grid gap-4 md:grid-cols-2">
                <input name="name" placeholder="Account name" required className={`${inputClassName} md:col-span-2`} />
                <select name="type" className={inputClassName} defaultValue="agency">
                  <option value="agency">Agency</option>
                  <option value="operator">Operator</option>
                  <option value="travel_advisor">Travel advisor</option>
                  <option value="media">Media</option>
                  <option value="other">Other</option>
                </select>
                <input name="source" placeholder="Campaign or source" className={inputClassName} />
                <input name="country" placeholder="Country" className={inputClassName} />
                <input name="city" placeholder="City" className={inputClassName} />
              </section>

              <section className="rounded-2xl border border-[#ece7df] bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Best contact channel</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input name="email" type="email" placeholder="General email" className={inputClassName} />
                  <input name="phone" placeholder="Phone" className={inputClassName} />
                  <input name="whatsapp" placeholder="WhatsApp" className={inputClassName} />
                  <input name="website" placeholder="Website" className={inputClassName} />
                </div>
              </section>

              <section className="rounded-2xl border border-[#ece7df] bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Keep it moving</p>
                <div className="mt-4 grid gap-4">
                  <input name="nextActionAt" type="datetime-local" className={inputClassName} />
                  <textarea
                    name="marketNotes"
                    placeholder="Quick notes about market, fit, or why this account matters"
                    className="min-h-28 rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#0f766e]"
                  />
                </div>
              </section>

              <div className="flex items-center justify-between gap-4 border-t border-[#ece7df] pt-4">
                <p className="text-[13px] text-[#64748b]">
                  New accounts start as <span className="font-medium text-[#1e293b]">not contacted</span> with you as owner.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl bg-[#1e293b] px-4 py-2.5 text-[14px] font-medium text-white">
                    Create account
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
