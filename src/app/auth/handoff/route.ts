import { NextResponse } from "next/server";
import { createPartnersSessionFromHandoff } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("owhubToken");

  if (!token) {
    return NextResponse.redirect(new URL("/", url));
  }

  try {
    await createPartnersSessionFromHandoff(token);
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch {
    return NextResponse.redirect(new URL("/?error=handoff", url));
  }
}
