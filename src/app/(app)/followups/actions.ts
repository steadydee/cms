"use server";

import { revalidatePath } from "next/cache";
import { authorizePartnersAccess } from "@/lib/auth";
import { completeFollowUpTask } from "@/lib/services/partners";

export async function completeFollowUpTaskAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const taskId = String(formData.get("taskId") ?? "");
  await completeFollowUpTask(access.context, taskId);
  revalidatePath("/dashboard");
  revalidatePath("/followups");
}
