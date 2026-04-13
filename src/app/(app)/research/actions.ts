"use server";

import { revalidatePath } from "next/cache";
import { ResearchSourceType } from "@prisma/client";
import { authorizePartnersAccess } from "@/lib/auth";
import { createResearchFinding } from "@/lib/services/partners";

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

export async function createResearchFindingAction(formData: FormData) {
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
}
