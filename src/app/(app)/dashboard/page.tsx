import Link from "next/link";
import type { ReactNode } from "react";
import { getPartnersRequestContext } from "@/lib/auth";
import { getDashboardPickupOverview } from "@/lib/services/partners";

type DashboardPickup = Awaited<ReturnType<typeof getDashboardPickupOverview>>;
type AwaitingReplyItem = DashboardPickup["followUps"]["awaitingReply"][number];
type CoolingOffItem = DashboardPickup["followUps"]["coolingOff"][number];
type ReadyItem = DashboardPickup["followUps"]["readyToContact"][number];
type LatestActionItem = DashboardPickup["latestActions"][number];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_MS));
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatActionTime(date: Date) {
  const days = daysSince(date);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return formatDate(date);
}

function formatLastSent(date: Date | null) {
  if (!date) return "nothing sent yet";

  const days = daysSince(date);
  if (days === 0) return "last sent today";
  if (days === 1) return "last sent 1 day ago";
  return `last sent ${days} days ago`;
}

function barWidth(count: number, total: number) {
  if (total <= 0 || count <= 0) return "0%";
  return `${(count / total) * 100}%`;
}

function awaitingReplyHint(daysQuiet: number) {
  if (daysQuiet <= 7) return "give it a few more days";
  if (daysQuiet <= 14) return "consider a nudge";
  return "probably gone cold";
}

function latestActionDotClassName(type: LatestActionItem["type"]) {
  if (type === "email" || type === "whatsapp") return "bg-[var(--warm)]";
  if (type === "stage" || type === "task_done") return "bg-[var(--accent)]";
  return "bg-[var(--ink-faint)]";
}

function readyContext(item: ReadyItem) {
  const person = item.primaryContact?.fullName?.trim() || "";
  if (person && item.locationText) return `${person} · ${item.locationText}`;
  if (person) return person;
  if (item.locationText) return item.locationText;
  return `added ${formatDate(item.createdAt)}`;
}

function Dot({ account }: { account: DashboardPickup["rolodex"][number] }) {
  const stateClassName =
    account.dotState === "active"
      ? "border-[var(--accent-deep)] bg-[var(--accent)]"
      : account.dotState === "motion"
        ? "border-[var(--warm)] bg-[var(--warm)]"
        : "border-[var(--line)] bg-transparent";

  return (
    <Link
      href={`/contacts/${account.id}`}
      aria-label={`${account.name} · ${account.statePhrase}`}
      className={`group relative aspect-square rounded-full border-[1.5px] transition hover:z-10 hover:scale-[1.6] ${stateClassName}`}
    >
      <span className="sr-only">{account.name} · {account.statePhrase}</span>
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[var(--ink)] px-2 py-1 text-[11px] font-medium text-[var(--accent-contrast)] shadow-[var(--shadow)] group-hover:block">
        {account.name} · {account.statePhrase}
      </span>
    </Link>
  );
}

function FollowUpGroup({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "urgent" | "warm";
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        <span className={`h-2 w-2 rounded-full ${tone === "urgent" ? "bg-[var(--warm)]" : "bg-[var(--accent)]"}`} />
        {label}
      </div>
      <div className="divide-y divide-[var(--line)]">{children}</div>
    </div>
  );
}

function FollowUpRow({
  href,
  name,
  context,
  rightHint,
}: {
  href: string;
  name: string;
  context: string;
  rightHint: string;
}) {
  return (
    <Link
      href={href}
      className="grid gap-2 py-3 transition hover:text-[var(--accent)] sm:grid-cols-[minmax(0,1fr)_max-content] sm:items-center sm:gap-4"
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-[var(--ink)]">{name}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-[var(--ink-soft)]">{context}</span>
      </span>
      {rightHint ? (
        <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[12px] text-[var(--ink-soft)] sm:text-right">
          {rightHint}
        </span>
      ) : null}
    </Link>
  );
}

function AwaitingReplyRow({ item }: { item: AwaitingReplyItem }) {
  return (
    <FollowUpRow
      href={`/contacts/${item.id}`}
      name={item.name}
      context={`Sent ${item.latestOutboundLabel} ${item.latestOutboundAt ? formatDate(item.latestOutboundAt) : ""} · ${item.daysQuiet} days quiet`}
      rightHint={awaitingReplyHint(item.daysQuiet)}
    />
  );
}

function CoolingOffRow({ item }: { item: CoolingOffItem }) {
  const sender = item.latestInbound?.fromName?.trim() || item.latestInbound?.fromEmail?.trim() || "partner";
  const context = item.latestInbound
    ? `Last reply from ${sender} · ${formatDate(item.latestInbound.sentAt)}`
    : `Last activity · ${formatDate(item.activityAt)}`;

  return (
    <FollowUpRow
      href={`/contacts/${item.id}`}
      name={item.name}
      context={context}
      rightHint={item.latestInbound ? `last reply ${item.daysSinceReply}d ago` : `last activity ${item.daysSinceActivity}d ago`}
    />
  );
}

function ReadyRow({ item }: { item: ReadyItem }) {
  return (
    <FollowUpRow
      href={`/contacts/${item.id}`}
      name={item.name}
      context={readyContext(item)}
      rightHint={item.hasResearchNotes ? "research done" : ""}
    />
  );
}

function LatestActionRow({ item }: { item: LatestActionItem }) {
  return (
    <Link
      href={`/contacts/${item.organization.id}`}
      className="grid gap-2 py-3 transition hover:text-[var(--accent)] sm:grid-cols-[10px_minmax(0,1fr)_max-content] sm:items-center sm:gap-4"
    >
      <span className={`mt-1 h-2.5 w-2.5 rounded-full sm:mt-0 ${latestActionDotClassName(item.type)}`} />
      <span className="min-w-0 truncate text-[14px] text-[var(--ink-soft)]">
        <span className="mr-2 inline-flex align-middle text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          {item.label}
        </span>
        <span className="font-semibold text-[var(--ink)]">{item.organization.name}</span>
        <span> · {item.text}</span>
      </span>
      <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[12px] text-[var(--ink-soft)] sm:text-right">
        {formatActionTime(item.happenedAt)}
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const dashboard = await getDashboardPickupOverview(context.propertyId);
  const readyInline = dashboard.followUps.readyToContact.slice(0, 5);
  const readyOverflow = Math.max(0, dashboard.followUps.readyToContact.length - readyInline.length);
  const hasFollowUps =
    dashboard.followUps.awaitingReply.length > 0
    || dashboard.followUps.coolingOff.length > 0
    || dashboard.followUps.readyToContact.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6">
      <header className="pt-1">
        <h1 className="font-serif text-[32px] font-semibold tracking-tight text-[var(--ink)]">Operators &amp; agencies</h1>
        <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
          Slow-burn outreach for the offseason · {formatLastSent(dashboard.lastOutboundEmailAt)}
        </p>
      </header>

      <section className="rounded-[22px] border border-[var(--line)] bg-card px-6 py-6 shadow-[var(--shadow)] sm:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[var(--ink)]">
            <span className="text-[var(--accent)]">{dashboard.progress.contacted}</span> reached, {dashboard.progress.remaining} to go
          </h2>
          <p className="text-[13px] text-[var(--ink-soft)]">{dashboard.progress.total} operators in the rolodex</p>
        </div>

        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="bg-[var(--accent)]"
            style={{ width: barWidth(dashboard.progress.activePartner, dashboard.progress.total) }}
          />
          <div
            className="bg-[var(--warm)]"
            style={{ width: barWidth(dashboard.progress.inMotion, dashboard.progress.total) }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[var(--ink-soft)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--accent)]" />
            Active partner ({dashboard.progress.activePartner})
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--warm)]" />
            In motion ({dashboard.progress.inMotion})
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--line)]" />
            Not yet ({dashboard.progress.notYet})
          </span>
        </div>
      </section>

      <section className="rounded-[22px] border border-[var(--line)] bg-card px-6 py-6 shadow-[var(--shadow)] sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          The rolodex · hover for name
        </p>
        <div className="mt-4 grid grid-cols-[repeat(10,minmax(0,1fr))] gap-[7px] sm:grid-cols-[repeat(15,minmax(0,1fr))] lg:grid-cols-[repeat(20,minmax(0,1fr))]">
          {dashboard.rolodex.map((account) => (
            <Dot key={account.id} account={account} />
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-[var(--line)] bg-card px-6 py-6 shadow-[var(--shadow)] sm:px-8">
        <h2 className="font-serif text-[23px] font-semibold tracking-tight text-[var(--ink)]">Where to pick up</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">In order of who&apos;s been waiting longest.</p>

        <div className="mt-5 space-y-6">
          {dashboard.followUps.awaitingReply.length > 0 ? (
            <FollowUpGroup label="Sent · awaiting reply" tone="urgent">
              {dashboard.followUps.awaitingReply.map((item) => (
                <AwaitingReplyRow key={item.id} item={item} />
              ))}
            </FollowUpGroup>
          ) : null}

          {dashboard.followUps.coolingOff.length > 0 ? (
            <FollowUpGroup label="In conversation · cooling off" tone="urgent">
              {dashboard.followUps.coolingOff.map((item) => (
                <CoolingOffRow key={item.id} item={item} />
              ))}
            </FollowUpGroup>
          ) : null}

          {readyInline.length > 0 ? (
            <FollowUpGroup label="Ready to contact" tone="warm">
              {readyInline.map((item) => (
                <ReadyRow key={item.id} item={item} />
              ))}
              {readyOverflow > 0 ? (
                <Link
                  href="/contacts?stage=ready_to_contact"
                  className="block py-3 text-center text-[13px] font-medium text-[var(--ink-soft)] transition hover:text-[var(--accent)]"
                >
                  + {readyOverflow} more in the rolodex · see all
                </Link>
              ) : null}
            </FollowUpGroup>
          ) : null}

          {!hasFollowUps ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-[13px] text-[var(--ink-faint)]">
              Nothing needs a pickup right now.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[22px] border border-[var(--line)] bg-card px-6 py-6 shadow-[var(--shadow)] sm:px-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-[23px] font-semibold tracking-tight text-[var(--ink)]">Latest actions</h2>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Recent outreach, status moves, and completed work.</p>
          </div>
          <p className="text-[12px] text-[var(--ink-faint)]">Newest first</p>
        </div>

        <div className="mt-4 divide-y divide-[var(--line)]">
          {dashboard.latestActions.length > 0 ? (
            dashboard.latestActions.map((item) => (
              <LatestActionRow key={item.id} item={item} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-[13px] text-[var(--ink-faint)]">
              No recent actions yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
