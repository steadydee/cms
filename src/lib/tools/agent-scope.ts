import type { PartnersRequestContext } from "../auth";
import type { ToolDefinition } from "./definitions";

export function hasAgentPermission(permissions: string[] = [], permission: string) {
  const values = new Set(permissions);
  if (values.has("partners.admin") || values.has(permission)) return true;
  // Hub's documented presets cover reads/writes, never sends or administration.
  if (!/^partners\.(organizations|contacts|outreach|tasks|research)\.(read|write)$/.test(permission)) return false;
  return permission.endsWith(".read")
    ? values.has("partners.read") || values.has("partners.write")
    : values.has("partners.write");
}

export function getAgentScopeDenial(tool: ToolDefinition, context: PartnersRequestContext) {
  if (context.source !== "agent") return null;
  if (!context.allowedToolClassifications?.includes(tool.classification)) {
    return { code: "CLASSIFICATION_NOT_ALLOWED", message: `${tool.classification} tools are not allowed for this agent` };
  }
  const tools = context.allowedTools;
  if (!Array.isArray(tools) || (tools.length > 0 && !tools.includes(tool.name))) {
    return { code: "TOOL_NOT_ALLOWED", message: "This tool is outside the agent's allowed tool scope" };
  }
  return null;
}
