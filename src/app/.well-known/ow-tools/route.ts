import { NextResponse } from "next/server";
import { authorizePartnersAccess } from "@/lib/auth";
import { getToolCatalog } from "@/lib/tools/runtime";

export async function GET() {
  const access = await authorizePartnersAccess("read");
  if (!access.ok) {
    return NextResponse.json(
      { success: false, errorCode: "UNAUTHORIZED", message: access.message },
      { status: access.status }
    );
  }

  return NextResponse.json(getToolCatalog());
}
