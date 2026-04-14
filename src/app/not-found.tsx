import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl rounded-[28px] border border-[#ddd6cc] bg-white p-8 text-center shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">Not found</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[#1e293b]">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">
          Return to Hub and launch Partners again, or go straight to the main app dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-xl bg-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-white">
            Go to Dashboard
          </Link>
          <Link href="/" className="rounded-xl border border-[#d7d2c9] px-4 py-2.5 text-[14px] font-medium text-[#475569]">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
