import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-faint)]">Not found</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[var(--ink)]">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Return to Hub and launch Partners again, or go straight to the main app dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)]">
            Go to Dashboard
          </Link>
          <Link href="/" className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-[14px] font-medium text-[var(--ink-soft)]">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
