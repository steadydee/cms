"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizePartnersAccess } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";
import {
  addContact,
  archiveOrganization,
  bulkScheduleFollowUpTasks,
  bulkUpdateOrganizations,
  createOrganization,
  logOutreachTouch,
  logIntroEmailSent,
  scheduleFollowUpTask,
  sendIntroEmail,
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

function getReturnTo(formData: FormData, fallback: string) {
  const value = String(formData.get("returnTo") ?? "").trim();
  return value || fallback;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : "Something went wrong. Please try again.";
}

async function setSuccessAndRedirect(message: string, returnTo: string) {
  await setFlashMessage({ type: "success", text: message });
  redirect(returnTo);
}

async function setErrorAndRedirect(error: unknown, returnTo: string) {
  await setFlashMessage({ type: "error", text: getErrorMessage(error) });
  redirect(returnTo);
}

export async function createOrganizationAction(formData: FormData) {
  const fallbackReturnTo = getReturnTo(formData, "/organizations");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const organization = await createOrganization(access.context, {
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

    if (formData.get("redirectToCreated") === "on") {
      await setSuccessAndRedirect(`Created account ${organization.name}.`, `/organizations/${organization.id}`);
    }
  } catch (error) {
    await setErrorAndRedirect(error, fallbackReturnTo);
  }

  await setSuccessAndRedirect("Account created.", fallbackReturnTo);
}

export async function addContactAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}?tab=people`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

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
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Contact added.", returnTo);
}

export async function logOutreachTouchAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}?tab=timeline`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

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
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Outreach touch logged.", returnTo);
}

export async function logIntroEmailSentAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "") || undefined;
  const subject = String(formData.get("subject") ?? "").trim();
  const recipientLabel = String(formData.get("recipientLabel") ?? "").trim();
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    await logIntroEmailSent(access.context, {
      organizationId,
      contactId,
      subject,
      recipientLabel,
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    revalidatePath("/followups");
    revalidatePath("/tasks");
    revalidatePath(`/organizations/${organizationId}`);
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Intro email logged.", returnTo);
}

export async function sendIntroEmailAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "") || undefined;
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const recipientLabel = String(formData.get("recipientLabel") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    await sendIntroEmail(access.context, {
      organizationId,
      contactId,
      recipientEmail,
      recipientLabel,
      subject,
      body,
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    revalidatePath("/followups");
    revalidatePath("/tasks");
    revalidatePath(`/organizations/${organizationId}`);
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect(`Intro email sent to ${recipientEmail}.`, returnTo);
}

export async function createFollowUpTaskAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, organizationId ? `/organizations/${organizationId}?tab=tasks` : "/tasks");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

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
    revalidatePath("/tasks");
    if (organizationId) {
      revalidatePath(`/organizations/${organizationId}`);
    }
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Task created.", returnTo);
}

export async function updateOrganizationStatusAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}?tab=profile`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    await updateOrganizationStatus(access.context, {
      organizationId,
      status: parseRelationshipStatus(formData.get("status") as string | null),
      visitStatus: parseVisitStatus(formData.get("visitStatus") as string | null),
      visitNotes: String(formData.get("visitNotes") ?? ""),
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    revalidatePath(`/organizations/${organizationId}`);
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Relationship stage updated.", returnTo);
}

export async function updateOrganizationProfileAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const rawPriority = String(formData.get("priority") ?? "").trim();
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}?tab=profile`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    await updateOrganizationProfile(access.context, {
      organizationId,
      country: String(formData.get("country") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      website: String(formData.get("website") ?? ""),
      source: String(formData.get("source") ?? ""),
      marketNotes: String(formData.get("marketNotes") ?? ""),
      nextActionAt: String(formData.get("nextActionAt") ?? ""),
      ownerUserName: String(formData.get("ownerUserName") ?? ""),
      priority: rawPriority ? Number(rawPriority) : 0,
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    revalidatePath(`/organizations/${organizationId}`);
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Profile updated.", returnTo);
}

export async function archiveOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, "/organizations");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    await archiveOrganization(access.context, organizationId);

    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    revalidatePath("/followups");
    revalidatePath("/tasks");
    revalidatePath(`/organizations/${organizationId}`);
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Account archived.", returnTo);
}

export async function unarchiveOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, `/organizations/${organizationId}`);

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    await unarchiveOrganization(access.context, organizationId);

    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    revalidatePath("/followups");
    revalidatePath("/tasks");
    revalidatePath(`/organizations/${organizationId}`);
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Account restored.", returnTo);
}

export async function bulkOrganizationAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/organizations");

  try {
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
    revalidatePath("/tasks");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Bulk action completed.", returnTo);
}
