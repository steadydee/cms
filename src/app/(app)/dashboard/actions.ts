"use server";

import { revalidatePath } from "next/cache";
import { authorizePartnersAccess } from "@/lib/auth";
import { updateEmailTemplate } from "@/lib/services/partners";

type InlineActionResult = {
  ok: boolean;
  error?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : "Something went wrong. Please try again.";
}

export async function saveEmailTemplateAction(formData: FormData): Promise<InlineActionResult> {
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

    revalidatePath("/dashboard");
    revalidatePath("/contacts");
    revalidatePath("/organizations");

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
