import { notFound } from "next/navigation";
import { getPartnersRequestContext } from "@/lib/auth";
import { getContactDetailPage, listContactsIndex } from "@/lib/services/partners";
import { ContactDetail } from "@/components/contacts/contact-detail";
import { ContactList } from "@/components/contacts/contact-list";

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

  const [contact, items] = await Promise.all([
    getContactDetailPage(id, context.propertyId),
    listContactsIndex(context.propertyId, {
      query: resolvedSearchParams.query || "",
      stage: parseStage(resolvedSearchParams.stage),
    }),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="min-h-0 xl:sticky xl:top-0 xl:h-[calc(100vh-150px)]">
        <ContactList
          items={items}
          selectedId={id}
          compact
          searchParams={{
            query: resolvedSearchParams.query || "",
            stage: resolvedSearchParams.stage || "all",
          }}
        />
      </div>
      <ContactDetail key={`${contact.id}:${contact.updatedAt.toISOString()}`} contact={contact} />
    </div>
  );
}

function parseStage(value: string | undefined) {
  return value === "researching"
    || value === "ready"
    || value === "outreach_sent"
    || value === "in_conversation"
    || value === "active_partner"
    || value === "dormant"
    ? value
    : "all";
}
