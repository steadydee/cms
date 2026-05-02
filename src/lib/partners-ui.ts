import type { RelationshipStatus } from "@prisma/client";

export type ContactStage =
  | "researching"
  | "ready"
  | "outreach_sent"
  | "in_conversation"
  | "active_partner"
  | "dormant";

export const CONTACT_STAGE_META: Record<
  ContactStage,
  { label: string; className: string; cardClassName: string }
> = {
  researching: {
    label: "Researching",
    className: "bg-[var(--line-soft)] text-[var(--ink-soft)]",
    cardClassName: "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]",
  },
  ready: {
    label: "Ready to Contact",
    className: "bg-[var(--accent-soft)] text-[var(--accent)]",
    cardClassName: "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]",
  },
  outreach_sent: {
    label: "Outreach Sent",
    className: "bg-[var(--warm-soft)] text-[var(--warm)]",
    cardClassName: "border-[var(--warm-soft)] bg-[var(--card)] text-[var(--ink)]",
  },
  in_conversation: {
    label: "In Conversation",
    className: "bg-[var(--accent-soft)] text-[var(--accent)]",
    cardClassName: "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]",
  },
  active_partner: {
    label: "Active Partner",
    className: "bg-[var(--accent-soft)] text-[var(--accent)]",
    cardClassName: "border-[var(--accent-soft)] bg-[var(--card)] text-[var(--ink)]",
  },
  dormant: {
    label: "Dormant",
    className: "bg-[var(--line-soft)] text-[var(--ink-soft)]",
    cardClassName: "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]",
  },
};

const CONTACTED_STAGES: readonly ContactStage[] = [
  "outreach_sent",
  "in_conversation",
  "active_partner",
  "dormant",
];

export function isContactedStage(stage: ContactStage) {
  return CONTACTED_STAGES.includes(stage);
}

type OrganizationSignals = {
  status: RelationshipStatus;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  contacts?: Array<{
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  }>;
};

function hasDirectContactChannel(organization: OrganizationSignals) {
  if (organization.email?.trim() || organization.phone?.trim() || organization.whatsapp?.trim()) {
    return true;
  }

  return Boolean(
    organization.contacts?.some((contact) => contact.email?.trim() || contact.phone?.trim() || contact.whatsapp?.trim())
  );
}

export function getContactStage(organization: OrganizationSignals): ContactStage {
  switch (organization.status) {
    case "not_contacted":
      return hasDirectContactChannel(organization) ? "ready" : "researching";
    case "contacted":
    case "awaiting_reply":
      return "outreach_sent";
    case "engaged":
    case "visit_scheduled":
    case "visited":
    case "proposal_sent":
      return "in_conversation";
    case "active_partner":
      return "active_partner";
    case "inactive":
    case "not_interested":
      return "dormant";
    default:
      return "researching";
  }
}

export function getContactStageLabel(stage: ContactStage) {
  return CONTACT_STAGE_META[stage].label;
}

export function getStatusDisplayLabel(status: RelationshipStatus) {
  switch (status) {
    case "not_contacted":
      return "Researching";
    case "contacted":
      return "Outreach Sent";
    case "awaiting_reply":
      return "Awaiting Reply";
    case "engaged":
      return "In Conversation";
    case "visit_scheduled":
      return "Visit Scheduled";
    case "visited":
      return "Visited";
    case "proposal_sent":
      return "Proposal Sent";
    case "active_partner":
      return "Active Partner";
    case "inactive":
      return "Dormant";
    case "not_interested":
      return "Not Interested";
    default:
      return "Researching";
  }
}
