import { NextResponse } from "next/server";
import { connectPropertyMailbox } from "@/lib/services/partner-email";
import { verifyGmailOAuthState } from "@/lib/gmail";
import { setFlashMessage } from "@/lib/flash";

function getSafeReturnTo(value: string | null | undefined) {
  const trimmed = value?.trim() || "/contacts";
  if (!trimmed.startsWith("/")) return "/contacts";
  return trimmed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (error) {
    await setFlashMessage({
      type: "error",
      text: `Google did not complete the Gmail connection: ${error}.`,
    });
    return NextResponse.redirect(new URL("/contacts", request.url));
  }

  if (!code || !stateToken) {
    await setFlashMessage({
      type: "error",
      text: "Google callback was missing the authorization code.",
    });
    return NextResponse.redirect(new URL("/contacts", request.url));
  }

  const state = verifyGmailOAuthState(stateToken);
  const returnTo = getSafeReturnTo(state?.returnTo);

  if (!state) {
    await setFlashMessage({
      type: "error",
      text: "The Gmail connection state expired. Start the connection again.",
    });
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  try {
    const mailbox = await connectPropertyMailbox({
      propertyId: state.propertyId,
      origin: url.origin,
      code,
    });

    await setFlashMessage({
      type: "success",
      text: `Connected Gmail inbox ${mailbox.emailAddress}. Replies now sync automatically into Partners.`,
    });
  } catch (callbackError) {
    await setFlashMessage({
      type: "error",
      text: callbackError instanceof Error ? callbackError.message : "Gmail connection failed.",
    });
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
