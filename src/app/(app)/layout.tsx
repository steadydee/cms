import Link from "next/link";
import { getPartnersRequestContext } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { AccessDenied } from "@/components/layout/access-denied";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getPartnersRequestContext();
  if (!context) {
    return <AccessDenied message="Launch Partners from Owl's Watch Hub to start an employee session." />;
  }

  return (
    <div className="flex h-full min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b bg-card px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Partners CRM</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Outreach by email, WhatsApp, phone, and property visit workflow.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="hidden rounded-lg border bg-background px-3 py-2 text-[12px] text-muted-foreground md:block">
                <p className="font-medium text-foreground">{context.userName}</p>
                <p className="capitalize">{context.role} · {context.propertyId}</p>
              </div>
              <Link
                href={process.env.OW_PARTNERS_HUB_URL?.trim() || "http://localhost:3000"}
                className="rounded-lg border px-3 py-2 text-[13px] font-medium text-foreground"
              >
                Back to Hub
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
