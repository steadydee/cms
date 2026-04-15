"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ResearchSourceType } from "@prisma/client";
import { authorizePartnersAccess } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";
import {
  createResearchFinding,
  promoteResearchFindingToOrganization,
  updateResearchFindingStatus,
} from "@/lib/services/partners";

function parseSourceType(value: string | null): ResearchSourceType {
  if (
    value === "instagram"
    || value === "website"
    || value === "directory"
    || value === "referral"
    || value === "other"
  ) {
    return value;
  }

  return "manual";
}

function parseExtractedDataJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Extracted data must be valid JSON");
  }
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

export async function createResearchFindingAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/dashboard");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const rawConfidence = String(formData.get("confidence") ?? "").trim();

    await createResearchFinding(access.context, {
      sourceType: parseSourceType(formData.get("sourceType") as string | null),
      sourceUrl: String(formData.get("sourceUrl") ?? ""),
      sourceHandle: String(formData.get("sourceHandle") ?? ""),
      observedName: String(formData.get("observedName") ?? ""),
      observedText: String(formData.get("observedText") ?? ""),
      extractedDataJson: parseExtractedDataJson(String(formData.get("extractedDataJson") ?? "")),
      confidence: rawConfidence ? Number(rawConfidence) : undefined,
    });

    revalidatePath("/dashboard");
    revalidatePath("/research");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Research finding saved.", returnTo);
}

export async function markResearchFindingReviewedAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/dashboard");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const findingId = String(formData.get("findingId") ?? "");
    await updateResearchFindingStatus(access.context, {
      findingId,
      status: "reviewed",
    });

    revalidatePath("/dashboard");
    revalidatePath("/research");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Research item marked reviewed.", returnTo);
}

export async function discardResearchFindingAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/dashboard");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const findingId = String(formData.get("findingId") ?? "");
    await updateResearchFindingStatus(access.context, {
      findingId,
      status: "discarded",
    });

    revalidatePath("/dashboard");
    revalidatePath("/research");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Research item discarded.", returnTo);
}

export async function promoteResearchFindingAction(formData: FormData) {
  const returnTo = getReturnTo(formData, "/dashboard");

  try {
    const access = await authorizePartnersAccess("write");
    if (!access.ok) {
      throw new Error(access.message);
    }

    const findingId = String(formData.get("findingId") ?? "");
    await promoteResearchFindingToOrganization(access.context, {
      findingId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/contacts");
    revalidatePath("/research");
    revalidatePath("/organizations");
  } catch (error) {
    await setErrorAndRedirect(error, returnTo);
  }

  await setSuccessAndRedirect("Research item promoted to contact.", returnTo);
}
