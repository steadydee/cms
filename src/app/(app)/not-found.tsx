import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-8 shadow-[var(--shadow)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-faint)]">Not found</p>
      <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[var(--ink)]">That page does not exist in Partners</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--ink-soft)]">
        The route may be wrong, the record may have been archived, or the page may no longer exist. Use the app navigation below to recover without leaving the shell.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)]"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/organizations"
          className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-[14px] font-medium text-[var(--ink-soft)]"
        >
          Back to Accounts
        </Link>
      </div>
    </div>
  );
}
