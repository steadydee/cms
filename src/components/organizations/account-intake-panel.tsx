"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createOrganizationAction } from "@/app/(app)/organizations/actions";

const inputClassName =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

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
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)] shadow-[var(--shadow)]"
      >
        <Plus className="h-4 w-4" />
        Add account
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--ink)]/35 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 cursor-default"
            aria-label="Close add account panel"
          />

          <div className="h-full w-full max-w-[560px] overflow-y-auto border-l border-[var(--line)] bg-[var(--line-soft)] shadow-[var(--shadow)]">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--line-soft)] bg-[var(--line-soft)]/95 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-faint)]">Quick intake</p>
                <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--ink)]">Add an account</h2>
                <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
                  Capture the basics quickly, then enrich the record from the account detail page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--line)] p-2 text-[var(--ink-soft)] transition hover:bg-[var(--card)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={createOrganizationAction} className="space-y-6 px-6 py-6">
              <input type="hidden" name="redirectToCreated" value="on" />
              <input type="hidden" name="returnTo" value="/organizations" />
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

              <section className="rounded-2xl border border-[var(--line-soft)] bg-[var(--card)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">Best contact channel</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input name="email" type="email" placeholder="General email" className={inputClassName} />
                  <input name="phone" placeholder="Phone" className={inputClassName} />
                  <input name="whatsapp" placeholder="WhatsApp" className={inputClassName} />
                  <input name="website" placeholder="Website" className={inputClassName} />
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--line-soft)] bg-[var(--card)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">Keep it moving</p>
                <div className="mt-4 grid gap-4">
                  <input name="nextActionAt" type="datetime-local" className={inputClassName} />
                  <textarea
                    name="marketNotes"
                    placeholder="Quick notes about market, fit, or why this account matters"
                    className="min-h-28 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                  />
                </div>
              </section>

              <div className="flex items-center justify-between gap-4 border-t border-[var(--line-soft)] pt-4">
                <p className="text-[13px] text-[var(--ink-soft)]">
                  New accounts start as <span className="font-medium text-[var(--ink)]">not contacted</span> with you as owner.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-[14px] font-medium text-[var(--ink-soft)]"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)]">
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
