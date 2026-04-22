"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizePartnersAccess } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";
import { savePartnerTypeOptions, updateEmailTemplate } from "@/lib/services/partners";

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

export async function saveEmailTemplateSetupAction(formData: FormData): Promise<InlineActionResult> {
  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      return { ok: false, error: access.message };
    }

    await updateEmailTemplate(access.context, {
      templateId: String(formData.get("templateId") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });

    revalidatePath("/setup");
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    revalidatePath("/organizations");

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function savePartnerTypeSetupAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/setup").trim() || "/setup";
  let destination = returnTo;

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const rowsJson = String(formData.get("rowsJson") ?? "[]");
    const rows = JSON.parse(rowsJson) as PartnerTypeRowInput[];

    await savePartnerTypeOptions(access.context, { rows });

    revalidatePath("/setup");
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    revalidatePath("/organizations");
    await setFlashMessage({ type: "success", text: "Account types updated." });
  } catch (error) {
    await setFlashMessage({ type: "error", text: getErrorMessage(error) });
  }

  redirect(destination);
}
