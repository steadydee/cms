import { NextResponse } from "next/server";
import { authorizePartnersAccess } from "@/lib/auth";
import { buildGmailConnectUrl, createGmailOAuthState, isGmailConfigured } from "@/lib/gmail";
import { setFlashMessage } from "@/lib/flash";

function getSafeReturnTo(value: string | null) {
  const trimmed = value?.trim() || "/contacts";
  if (!trimmed.startsWith("/")) return "/contacts";
  return trimmed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = getSafeReturnTo(url.searchParams.get("returnTo"));
  const access = await authorizePartnersAccess("write");

  if (!access.ok) {
    await setFlashMessage({ type: "error", text: access.message });
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  if (!isGmailConfigured()) {
    await setFlashMessage({
      type: "error",
      text: "Gmail is not configured yet. Add Google OAuth credentials before connecting.",
    });
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  const state = createGmailOAuthState({
    propertyId: access.context.propertyId,
    userId: access.context.userId,
    returnTo,
  });

  return NextResponse.redirect(
    buildGmailConnectUrl({
      origin: url.origin,
      state,
    })
  );
}
