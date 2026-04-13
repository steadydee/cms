import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartnersRequestContext } from "@/lib/auth";

export default async function HomePage() {
  const context = await getPartnersRequestContext();
  if (context) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl rounded-[28px] border border-[#ddd6cc] bg-white p-10 shadow-[0_20px_60px_rgba(30,41,59,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">
          Owl&apos;s Watch Partners
        </p>
        <h1 className="mt-3 text-[34px] font-semibold tracking-tight text-[#1e293b]">
          Launch this app from Hub
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#64748b]">
          Partners is the outreach CRM for operators and agencies. It expects an Owl&apos;s Watch Hub handoff in
          production and uses a local dev fallback outside production.
        </p>
        <div className="mt-8 flex gap-4 text-[14px]">
          <Link
            href={`${process.env.OW_PARTNERS_HUB_URL?.trim() || "http://localhost:3000"}`}
            className="rounded-lg bg-[#1e293b] px-4 py-2.5 font-medium text-white"
          >
            Back to Hub
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-[#cbd5e1] px-4 py-2.5 font-medium text-[#334155]">
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
