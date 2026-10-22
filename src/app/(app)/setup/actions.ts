"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizePartnersAccess } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";
import { saveDailyOutreachPolicy, pauseDailyOutreachPolicy } from "@/lib/services/daily-outreach";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  savePartnerTypeOptions,
  updateEmailTemplate,
} from "@/lib/services/partners";

type PartnerTypeRowInput = {
  id?: string;
  originalValue?: string;
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : "Something went wrong. Please try again.";
}

type InlineActionResult = {
  ok: boolean;
  error?: string;
};

export async function saveDailyOutreachSetupAction(form: FormData): Promise<InlineActionResult> {
  try {
    const access = await authorizePartnersAccess("admin");
    if (!access.ok) return { ok: false, error: access.message };
    if (form.get("action") === "pause") await pauseDailyOutreachPolicy(access.context);
    else await saveDailyOutreachPolicy(access.context, {
      enabled: form.get("enabled") === "on", agentId: String(form.get("agentId")), credentialId: String(form.get("credentialId")),
      templateId: String(form.get("templateId")), attachmentName: String(form.get("attachmentName")),
      attachmentSha256: String(form.get("attachmentSha256")), businessMailbox: String(form.get("businessMailbox")),
      personalMailbox: String(form.get("personalMailbox")), startsAt: `${form.get("startsAt")}T00:00:00-05:00`,
      expiresAt: `${form.get("expiresAt")}T00:00:00-05:00`,
    });
    revalidatePath("/setup");
    return { ok: true };
  } catch (error) { return { ok: false, error: getErrorMessage(error) }; }
}

function revalidateSetupSurfaces() {
  revalidatePath("/setup");
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/organizations");
}

export async function createEmailTemplateSetupAction(formData: FormData): Promise<InlineActionResult> {
  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      return { ok: false, error: access.message };
    }

    await createEmailTemplate(access.context, {
      name: String(formData.get("name") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });

    revalidateSetupSurfaces();

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function saveEmailTemplateSetupAction(formData: FormData): Promise<InlineActionResult> {
  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      return { ok: false, error: access.message };
    }

    await updateEmailTemplate(access.context, {
      templateId: String(formData.get("templateId") ?? ""),
      name: String(formData.get("name") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });

    revalidateSetupSurfaces();

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteEmailTemplateSetupAction(formData: FormData): Promise<InlineActionResult> {
  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      return { ok: false, error: access.message };
    }

    await deleteEmailTemplate(access.context, String(formData.get("templateId") ?? ""));

    revalidateSetupSurfaces();

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function savePartnerTypeSetupAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/setup").trim() || "/setup";

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const rowsJson = String(formData.get("rowsJson") ?? "[]");
    const rows = JSON.parse(rowsJson) as PartnerTypeRowInput[];

    await savePartnerTypeOptions(access.context, { rows });

    revalidateSetupSurfaces();
    await setFlashMessage({ type: "success", text: "Account types updated." });
  } catch (error) {
    await setFlashMessage({ type: "error", text: getErrorMessage(error) });
  }

  redirect(returnTo);
}
