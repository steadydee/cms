import { getPartnersRequestContext } from "@/lib/auth";
import { listContactsIndex } from "@/lib/services/partners";
import { ContactList } from "@/components/contacts/contact-list";

type ContactsSearchParams = {
  query?: string;
  stage?: string;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<ContactsSearchParams>;
}) {
  const context = await getPartnersRequestContext();
  if (!context) return null;

  const resolvedSearchParams = await searchParams;
  const items = await listContactsIndex(context.propertyId, {
    query: resolvedSearchParams.query || "",
    stage: parseStage(resolvedSearchParams.stage),
  });

  return (
    <div className="w-full">
      <ContactList
        items={items}
        searchParams={{
          query: resolvedSearchParams.query || "",
          stage: resolvedSearchParams.stage || "all",
        }}
      />
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
