import { getToolCatalog } from "@/lib/tools/runtime";

export async function GET() {
  return Response.json(await getToolCatalog());
}
