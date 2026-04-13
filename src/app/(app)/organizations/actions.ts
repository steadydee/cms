"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizePartnersAccess } from "@/lib/auth";
import { sendEmailWithResend } from "@/lib/email";
import {
  addContact,
  archiveOrganization,
  assignOrganizationOwnerToSelf,
  bulkScheduleFollowUpTasks,
  bulkUpdateOrganizations,
  createOrganization,
  logOutreachTouch,
  scheduleFollowUpTask,
  unarchiveOrganization,
  updateOrganizationProfile,
  updateOrganizationStatus,
} from "@/lib/services/partners";
import { OutreachChannel, RelationshipStatus, VisitStatus, type PartnerType } from "@prisma/client";

function parsePartnerType(value: string | null): PartnerType {
  return value === "operator" || value === "travel_advisor" || value === "media" || value === "other"
    ? value
    : "agency";
}

function parseChannel(value: string | null): OutreachChannel {
  return value === "whatsapp" || value === "phone" || value === "meeting" || value === "other"
    ? value
    : "email";
}

function parseRelationshipStatus(value: string | null): RelationshipStatus {
  if (
    value === "contacted"
    || value === "awaiting_reply"
    || value === "engaged"
    || value === "visit_scheduled"
    || value === "visited"
    || value === "proposal_sent"
    || value === "active_partner"
    || value === "inactive"
    || value === "not_interested"
  ) {
    return value;
  }
  return "not_contacted";
}

function parseVisitStatus(value: string | null): VisitStatus {
  if (value === "invited" || value === "scheduled" || value === "visited") {
    return value;
  }
  return "never_invited";
}

export async function createOrganizationAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  await createOrganization(access.context, {
    name: String(formData.get("name") ?? ""),
    type: parsePartnerType(formData.get("type") as string | null),
    country: String(formData.get("country") ?? ""),
    city: String(formData.get("city") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    website: String(formData.get("website") ?? ""),
    source: String(formData.get("source") ?? ""),
    marketNotes: String(formData.get("marketNotes") ?? ""),
    nextActionAt: String(formData.get("nextActionAt") ?? ""),
  });

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
}

export async function addContactAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await addContact(access.context, {
    organizationId,
    fullName: String(formData.get("fullName") ?? ""),
    roleTitle: String(formData.get("roleTitle") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    preferredChannel: parseChannel(formData.get("preferredChannel") as string | null),
    notes: String(formData.get("notes") ?? ""),
    isPrimary: formData.get("isPrimary") === "on",
  });

  revalidatePath(`/organizations/${organizationId}`);
}

export async function logOutreachTouchAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await logOutreachTouch(access.context, {
    organizationId,
    contactId: String(formData.get("contactId") ?? "") || undefined,
    channel: parseChannel(formData.get("channel") as string | null),
    happenedAt: String(formData.get("happenedAt") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    outcome: String(formData.get("outcome") ?? ""),
    nextStep: String(formData.get("nextStep") ?? ""),
  });

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function logIntroEmailSentAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "") || undefined;
  const subject = String(formData.get("subject") ?? "").trim();
  const recipientLabel = String(formData.get("recipientLabel") ?? "").trim();

  await logOutreachTouch(access.context, {
    organizationId,
    contactId,
    channel: "email",
    subject,
    summary: recipientLabel
      ? `Sent intro email template to ${recipientLabel}.`
      : "Sent intro email template.",
    outcome: "Awaiting reply",
    nextStep: "Follow up if no reply.",
    status: "awaiting_reply",
  });

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath("/followups");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function sendIntroEmailAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "") || undefined;
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const recipientLabel = String(formData.get("recipientLabel") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");

  if (!recipientEmail) {
    throw new Error("Recipient email is required");
  }

  await sendEmailWithResend({
    to: recipientEmail,
    subject,
    text: body,
  });

  await logOutreachTouch(access.context, {
    organizationId,
    contactId,
    channel: "email",
    subject,
    summary: recipientLabel
      ? `Sent intro email template to ${recipientLabel} via Resend.`
      : "Sent intro email template via Resend.",
    outcome: "Awaiting reply",
    nextStep: "Follow up if no reply.",
    status: "awaiting_reply",
  });

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath("/followups");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function createFollowUpTaskAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await scheduleFollowUpTask(access.context, {
    organizationId,
    contactId: String(formData.get("contactId") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    assignedToUserName: String(formData.get("assignedToUserName") ?? ""),
  });

  revalidatePath("/dashboard");
  revalidatePath("/followups");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function updateOrganizationStatusAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await updateOrganizationStatus(access.context, {
    organizationId,
    status: parseRelationshipStatus(formData.get("status") as string | null),
    visitStatus: parseVisitStatus(formData.get("visitStatus") as string | null),
    visitNotes: String(formData.get("visitNotes") ?? ""),
  });

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function updateOrganizationProfileAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const rawPriority = String(formData.get("priority") ?? "").trim();

  await updateOrganizationProfile(access.context, {
    organizationId,
    source: String(formData.get("source") ?? ""),
    marketNotes: String(formData.get("marketNotes") ?? ""),
    nextActionAt: String(formData.get("nextActionAt") ?? ""),
    ownerUserId: String(formData.get("ownerUserId") ?? ""),
    ownerUserName: String(formData.get("ownerUserName") ?? ""),
    priority: rawPriority ? Number(rawPriority) : 0,
  });

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function assignOrganizationOwnerToMeAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await assignOrganizationOwnerToSelf(access.context, organizationId);

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function archiveOrganizationAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await archiveOrganization(access.context, organizationId);

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath("/followups");
  revalidatePath(`/organizations/${organizationId}`);
  redirect("/organizations");
}

export async function unarchiveOrganizationAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  await unarchiveOrganization(access.context, organizationId);

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath("/followups");
  revalidatePath(`/organizations/${organizationId}`);
  redirect(`/organizations/${organizationId}`);
}

export async function bulkOrganizationAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const organizationIds = formData
    .getAll("organizationId")
    .map((value) => String(value))
    .filter(Boolean);

  const action = String(formData.get("bulkAction") ?? "");

  if (action === "schedule_followup") {
    await bulkScheduleFollowUpTasks(access.context, {
      organizationIds,
      title: String(formData.get("followUpTitle") ?? ""),
      description: String(formData.get("followUpDescription") ?? ""),
      dueAt: String(formData.get("followUpDueAt") ?? ""),
    });
  } else if (
    action === "mark_contacted"
    || action === "mark_awaiting_reply"
    || action === "assign_to_me"
  ) {
    await bulkUpdateOrganizations(access.context, {
      organizationIds,
      action,
    });
  } else {
    throw new Error("Select a valid bulk action");
  }

  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath("/followups");
}
