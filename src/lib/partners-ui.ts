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
    className: "bg-[#f5f0e8] text-[#8b7355]",
    cardClassName: "border-[#e8e0d4] bg-white text-[#2c2416]",
  },
  ready: {
    label: "Ready to Contact",
    className: "bg-[#f3eef8] text-[#6b4c8a]",
    cardClassName: "border-[#eadff2] bg-white text-[#2c2416]",
  },
  outreach_sent: {
    label: "Outreach Sent",
    className: "bg-[#fff3eb] text-[#c4713b]",
    cardClassName: "border-[#f3dccb] bg-[#fffaf6] text-[#2c2416]",
  },
  in_conversation: {
    label: "In Conversation",
    className: "bg-[#ebf3fa] text-[#2d6fa0]",
    cardClassName: "border-[#dae6f2] bg-white text-[#2c2416]",
  },
  active_partner: {
    label: "Active Partner",
    className: "bg-[#ebf3ed] text-[#3d6b4f]",
    cardClassName: "border-[#d3e3d8] bg-white text-[#2c2416]",
  },
  dormant: {
    label: "Dormant",
    className: "bg-[#f3f1ed] text-[#817563]",
    cardClassName: "border-[#e6dfd4] bg-white text-[#2c2416]",
  },
};

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
