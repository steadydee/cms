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

  const hubHref = process.env.OW_PARTNERS_HUB_URL?.trim() || "http://localhost:3000";

  return (
    <div className="flex h-full min-h-screen bg-background text-foreground">
      <Sidebar
        hubHref={hubHref}
        userName={context.userName}
        role={context.role}
        propertyId={context.propertyId}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-[#e8e0d4] bg-card px-6 py-4 md:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                Dashboard
              </Link>
              <Link href="/contacts" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                Accounts
              </Link>
              <Link href="/research" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                Research
              </Link>
              <Link href="/tasks" className="rounded-full bg-[#f3ede4] px-3 py-1.5 text-[12px] font-medium text-[#6b5d4a]">
                Tasks
              </Link>
            </div>
            <Link
              href={hubHref}
              className="rounded-lg border border-[#e8e0d4] px-3 py-2 text-[13px] font-medium text-foreground"
            >
              Hub
            </Link>
          </div>
        </header>
        {flashMessage ? <FlashBanner message={flashMessage} /> : null}
        <main className="flex-1 overflow-y-auto px-6 py-6 md:py-5">{children}</main>
      </div>
    </div>
  );
}
