"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OutreachChannel, RelationshipStatus, TaskStatus, VisitStatus } from "@prisma/client";
import { authorizePartnersAccess, type PartnersRequestContext } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";
import { deleteEmailDraft, saveEmailDraft, sendAccountEmail, syncMailbox } from "@/lib/services/partner-email";
import {
  addContact,
  addNote,
  addTagToContact,
  archiveOrganization,
  createQuickContact,
  logIntroEmailSent,
  logOutreachTouch,
  removeTagFromContact,
  scheduleFollowUpTask,
  sendIntroEmail,
  setFollowUpTaskStatus,
  updateContactField,
  updateFollowUpTask,
  updateOrganizationStatus,
  updatePartnerContact,
} from "@/lib/services/partners";

type InlineActionResult = {
  ok: boolean;
  error?: string;
  draftId?: string;
};

function parseChannel(value: string | null): OutreachChannel {
  if (value === "whatsapp" || value === "phone" || value === "meeting" || value === "other") {
    return value;
  }

  return "email";
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

async function parseOptionalEmailAttachment(formData: FormData) {
  const value = formData.get("attachment");
  if (!value || typeof value === "string" || value.size === 0) {
    return undefined;
  }

  return {
    filename: value.name || "attachment",
    contentType: value.type || "application/octet-stream",
    content: Buffer.from(await value.arrayBuffer()),
    size: value.size,
  };
}

function parseTaskStatus(value: string | null): TaskStatus {
  if (value === "done" || value === "cancelled") return value;
  return "open";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : "Something went wrong. Please try again.";
}

function getReturnTo(formData: FormData, fallback: string) {
  const value = String(formData.get("returnTo") ?? "").trim();
  return value || fallback;
}

function revalidateContactsSurface(organizationId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  revalidatePath("/organizations");
  if (organizationId) {
    revalidatePath(`/contacts/${organizationId}`);
    revalidatePath(`/organizations/${organizationId}`);
  }
}

async function withInlineWriteAccess(
  fn: (context: PartnersRequestContext) => Promise<void>
): Promise<InlineActionResult> {
  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      return { ok: false, error: access.message };
    }

    await fn(access.context);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createQuickContactAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/contacts");
  let destination = returnTo;

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const organization = await createQuickContact(access.context, {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? ""),
      emailOrWhatsapp: String(formData.get("emailOrWhatsapp") ?? ""),
    });

    revalidateContactsSurface(organization.id);
    await setFlashMessage({ type: "success", text: `Created account ${organization.name}.` });
    destination = `/contacts/${organization.id}`;
  } catch (error) {
    await setFlashMessage({ type: "error", text: getErrorMessage(error) });
  }

  redirect(destination);
}

export async function archiveContactAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnTo = getReturnTo(formData, "/contacts");
  let destination = returnTo;

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    await archiveOrganization(access.context, organizationId);
    revalidateContactsSurface(organizationId);
    await setFlashMessage({ type: "success", text: "Account archived." });
    destination = "/contacts";
  } catch (error) {
    await setFlashMessage({ type: "error", text: getErrorMessage(error) });
  }

  redirect(destination);
}

export async function saveContactFieldAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await updateContactField(context, {
      organizationId,
      field: String(formData.get("field") ?? "") as Parameters<typeof updateContactField>[1]["field"],
      value: String(formData.get("value") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function saveContactStageAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    const status = parseRelationshipStatus(formData.get("status") as string | null);

    await updateOrganizationStatus(context, {
      organizationId,
      status,
      visitStatus: parseVisitStatus(formData.get("visitStatus") as string | null),
      visitNotes: String(formData.get("visitNotes") ?? ""),
    });

    await addNote(context, {
      organizationId,
      text: `Stage updated to ${status.replaceAll("_", " ")}.`,
    });

    revalidateContactsSurface(organizationId);
  });
}

export async function saveContactNoteAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await addNote(context, {
      organizationId,
      text: String(formData.get("text") ?? ""),
      author: String(formData.get("author") ?? "") || undefined,
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function saveContactPersonAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "").trim();

  return withInlineWriteAccess(async (context) => {
    if (contactId) {
      await updatePartnerContact(context, {
        contactId,
        fullName: String(formData.get("fullName") ?? ""),
        roleTitle: String(formData.get("roleTitle") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        whatsapp: String(formData.get("whatsapp") ?? ""),
        isPrimary: formData.get("isPrimary") === "on",
      });
    } else {
      await addContact(context, {
        organizationId,
        fullName: String(formData.get("fullName") ?? ""),
        roleTitle: String(formData.get("roleTitle") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        whatsapp: String(formData.get("whatsapp") ?? ""),
        isPrimary: formData.get("isPrimary") === "on",
      });
    }

    revalidateContactsSurface(organizationId);
  });
}

export async function saveContactTagAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await addTagToContact(context, {
      organizationId,
      tagName: String(formData.get("tagName") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function removeContactTagAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await removeTagFromContact(context, {
      organizationId,
      tagId: String(formData.get("tagId") ?? ""),
      tagName: String(formData.get("tagName") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function saveTaskAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const taskId = String(formData.get("taskId") ?? "").trim();

  return withInlineWriteAccess(async (context) => {
    if (taskId) {
      await updateFollowUpTask(context, {
        taskId,
        title: String(formData.get("title") ?? ""),
        dueAt: String(formData.get("dueAt") ?? ""),
      });
    } else {
      await scheduleFollowUpTask(context, {
        organizationId,
        contactId: String(formData.get("contactId") ?? "") || undefined,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        dueAt: String(formData.get("dueAt") ?? ""),
      });
    }

    revalidateContactsSurface(organizationId);
  });
}

export async function setTaskStatusAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await setFollowUpTaskStatus(context, {
      taskId: String(formData.get("taskId") ?? ""),
      status: parseTaskStatus(formData.get("status") as string | null),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function saveOutreachTouchAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await logOutreachTouch(context, {
      organizationId,
      contactId: String(formData.get("contactId") ?? "") || undefined,
      channel: parseChannel(formData.get("channel") as string | null),
      summary: String(formData.get("summary") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      outcome: String(formData.get("outcome") ?? ""),
      nextStep: String(formData.get("nextStep") ?? ""),
      happenedAt: String(formData.get("happenedAt") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function logTemplatedEmailAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await logIntroEmailSent(context, {
      organizationId,
      contactId: String(formData.get("contactId") ?? "") || undefined,
      subject: String(formData.get("subject") ?? ""),
      recipientLabel: String(formData.get("recipientLabel") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function sendTemplatedEmailAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await sendIntroEmail(context, {
      organizationId,
      contactId: String(formData.get("contactId") ?? "") || undefined,
      recipientEmail: String(formData.get("recipientEmail") ?? ""),
      recipientLabel: String(formData.get("recipientLabel") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}

export async function syncMailboxAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await syncMailbox(context);
    revalidateContactsSurface(organizationId);
  });
}

export async function sendAccountEmailAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const draftId = String(formData.get("draftId") ?? "").trim();

  return withInlineWriteAccess(async (context) => {
    await sendAccountEmail(context, {
      organizationId,
      contactId: String(formData.get("contactId") ?? "") || undefined,
      threadId: String(formData.get("threadId") ?? "") || undefined,
      fromEmail: String(formData.get("fromEmail") ?? "") || undefined,
      toEmail: String(formData.get("toEmail") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      attachment: await parseOptionalEmailAttachment(formData),
    });
    if (draftId) {
      try {
        await deleteEmailDraft(context, {
          organizationId,
          draftId,
        });
      } catch (error) {
        console.warn("Email sent, but failed to remove saved draft.", error);
      }
    }
    revalidateContactsSurface(organizationId);
  });
}

export async function saveEmailDraftAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      return { ok: false, error: access.message };
    }

    const draft = await saveEmailDraft(access.context, {
      draftId: String(formData.get("draftId") ?? ""),
      organizationId,
      contactId: String(formData.get("contactId") ?? "") || undefined,
      threadId: String(formData.get("threadId") ?? "") || undefined,
      fromEmail: String(formData.get("fromEmail") ?? "") || undefined,
      toEmail: String(formData.get("toEmail") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    revalidateContactsSurface(organizationId);
    return { ok: true, draftId: draft.id };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteEmailDraftAction(formData: FormData): Promise<InlineActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");

  return withInlineWriteAccess(async (context) => {
    await deleteEmailDraft(context, {
      organizationId,
      draftId: String(formData.get("draftId") ?? ""),
    });
    revalidateContactsSurface(organizationId);
  });
}
