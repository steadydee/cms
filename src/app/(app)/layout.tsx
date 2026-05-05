import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartnersRequestContext } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { FlashBanner } from "@/components/layout/flash-banner";
import { EnvironmentBadge, getEnvironmentName } from "@/components/layout/environment-badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getFlashMessage } from "@/lib/flash";
import { getHubBaseUrl, getHubLaunchUrl } from "@/lib/hub-url";

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
    redirect(getHubLaunchUrl("partners"));
  }

  const hubHref = getHubBaseUrl();
  const environment = getEnvironmentName();

  return (
    <div className="flex h-full min-h-screen bg-background text-foreground">
      <Sidebar
        hubHref={hubHref}
        userName={context.userName}
        role={context.role}
        propertyId={context.propertyId}
        environment={environment}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-[var(--line)] bg-card px-6 py-4 md:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className="rounded-full bg-[var(--line-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)]">
                Dashboard
              </Link>
              <Link href="/contacts" className="rounded-full bg-[var(--line-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)]">
                Accounts
              </Link>
              <Link href="/tasks" className="rounded-full bg-[var(--line-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)]">
                Tasks
              </Link>
              <Link href="/setup" className="rounded-full bg-[var(--line-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)]">
                Setup
              </Link>
              <EnvironmentBadge environment={environment} />
              <ThemeToggle compact />
            </div>
            <Link
              href={hubHref}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] font-medium text-foreground"
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
