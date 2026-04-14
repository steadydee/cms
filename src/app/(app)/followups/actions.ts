"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizePartnersAccess } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";
import { completeFollowUpTask, reopenFollowUpTask, updateFollowUpAssignee } from "@/lib/services/partners";

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

export async function completeFollowUpTaskAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/tasks");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const taskId = String(formData.get("taskId") ?? "");
    await completeFollowUpTask(access.context, taskId);
    revalidatePath("/dashboard");
    revalidatePath("/followups");
    revalidatePath("/tasks");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Task marked done.", returnTo);
}

export async function reopenFollowUpTaskAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/tasks");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const taskId = String(formData.get("taskId") ?? "");
    await reopenFollowUpTask(access.context, taskId);
    revalidatePath("/dashboard");
    revalidatePath("/followups");
    revalidatePath("/tasks");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Task reopened.", returnTo);
}

export async function assignFollowUpToMeAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/tasks");

  try {
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
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Task assigned to you.", returnTo);
}
