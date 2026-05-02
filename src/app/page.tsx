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
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-10 shadow-[var(--shadow)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-faint)]">
          Owl&apos;s Watch Partners
        </p>
        <h1 className="mt-3 text-[34px] font-semibold tracking-tight text-[var(--ink)]">
          Launch this app from Hub
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
          Partners is the outreach CRM for operators and agencies. It expects an Owl&apos;s Watch Hub handoff in
          production and uses a local dev fallback outside production.
        </p>
        <div className="mt-8 flex gap-4 text-[14px]">
          <Link
            href={`${process.env.OW_PARTNERS_HUB_URL?.trim() || "http://localhost:3000"}`}
            className="rounded-lg bg-[var(--ink)] px-4 py-2.5 font-medium text-[var(--accent-contrast)]"
          >
            Back to Hub
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-[var(--line)] px-4 py-2.5 font-medium text-[var(--ink-soft)]">
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
