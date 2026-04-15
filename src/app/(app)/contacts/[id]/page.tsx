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

  if (
    searchParams.stage === "researching"
    || searchParams.stage === "ready"
    || searchParams.stage === "outreach_sent"
    || searchParams.stage === "in_conversation"
    || searchParams.stage === "active_partner"
    || searchParams.stage === "dormant"
  ) {
    params.set("stage", searchParams.stage);
  }

  const query = params.toString();
  return query ? `/contacts?${query}` : "/contacts";
}
