import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { AccessDenied } from "@/components/layout/access-denied";
import { FlashBanner } from "@/components/layout/flash-banner";
import { getFlashMessage } from "@/lib/flash";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [context, flashMessage] = await Promise.all([
    getPartnersRequestContext(),
    getFlashMessage(),
  ]);
  if (!context) {
    return <AccessDenied message="Launch Partners from Owl's Watch Hub to start an employee session." />;
  }

  return (
    <div className="flex h-full min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-[#e8e0d4] bg-card px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Partners CRM</p>
              <p className="mt-2 font-serif text-[24px] font-semibold tracking-tight text-foreground">Partner dashboard</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Contacts, notes, research, and follow-up in one place.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 md:hidden">
                <Link href="/dashboard" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                  Dashboard
                </Link>
                <Link href="/contacts" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                  Contacts
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="hidden rounded-lg border border-[#e8e0d4] bg-background px-3 py-2 text-[12px] text-muted-foreground md:block">
                <p className="font-medium text-foreground">{context.userName}</p>
                <p className="capitalize">{context.role} · {context.propertyId}</p>
              </div>
              <Link
                href={process.env.OW_PARTNERS_HUB_URL?.trim() || "http://localhost:3000"}
                className="rounded-lg border border-[#e8e0d4] px-3 py-2 text-[13px] font-medium text-foreground"
              >
                Back to Hub
              </Link>
            </div>
          </div>
        </header>
        {flashMessage ? <FlashBanner message={flashMessage} /> : null}
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
