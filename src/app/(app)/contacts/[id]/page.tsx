import { notFound } from "next/navigation";
import { getPartnersRequestContext } from "@/lib/auth";
import { getContactDetailPage } from "@/lib/services/partners";
import { ContactDetail } from "@/components/contacts/contact-detail";

type ContactsSearchParams = {
  query?: string;
  stage?: string;
};

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ContactsSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const contact = await getContactDetailPage(id, context.propertyId);

  if (!contact) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <ContactDetail
        key={`${contact.id}:${contact.updatedAt.toISOString()}`}
        contact={contact}
        backHref={buildBackHref(resolvedSearchParams)}
      />
    </div>
  );
}

function buildBackHref(searchParams: ContactsSearchParams) {
  const params = new URLSearchParams();

  if (searchParams.query?.trim()) {
    params.set("query", searchParams.query.trim());
  }

  const stage = normalizeStageParam(searchParams.stage);
  if (stage) {
    params.set("stage", stage);
  }

  const query = params.toString();
  return query ? `/contacts?${query}` : "/contacts";
}

function normalizeStageParam(value: string | undefined) {
  if (value === "ready_to_contact") return "ready";
  return value === "researching"
    || value === "ready"
    || value === "outreach_sent"
    || value === "in_conversation"
    || value === "active_partner"
    || value === "dormant"
    ? value
    : null;
}
