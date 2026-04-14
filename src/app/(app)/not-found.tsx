import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="rounded-[28px] border border-[#ddd6cc] bg-white p-8 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Not found</p>
      <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[#1e293b]">That page does not exist in Partners</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#64748b]">
        The route may be wrong, the record may have been archived, or the page may no longer exist. Use the app navigation below to recover without leaving the shell.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-xl bg-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-white"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/organizations"
          className="rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]"
        >
          Back to Accounts
        </Link>
      </div>
    </div>
  );
}
