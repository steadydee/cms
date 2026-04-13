"use server";

import { revalidatePath } from "next/cache";
import { authorizePartnersAccess } from "@/lib/auth";
import { completeFollowUpTask, reopenFollowUpTask, updateFollowUpAssignee } from "@/lib/services/partners";

export async function completeFollowUpTaskAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const taskId = String(formData.get("taskId") ?? "");
  await completeFollowUpTask(access.context, taskId);
  revalidatePath("/dashboard");
  revalidatePath("/followups");
  revalidatePath("/tasks");
}

export async function reopenFollowUpTaskAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const taskId = String(formData.get("taskId") ?? "");
  await reopenFollowUpTask(access.context, taskId);
  revalidatePath("/dashboard");
  revalidatePath("/followups");
  revalidatePath("/tasks");
}

export async function assignFollowUpToMeAction(formData: FormData) {
  const access = await authorizePartnersAccess("write");
  if (!access.ok) {
    throw new Error(access.message);
  }

  const taskId = String(formData.get("taskId") ?? "");
  await updateFollowUpAssignee(access.context, {
    taskId,
    assignedToUserId: access.context.userId,
    assignedToUserName: access.context.userName,
  });

  revalidatePath("/dashboard");
  revalidatePath("/followups");
  revalidatePath("/tasks");
}
