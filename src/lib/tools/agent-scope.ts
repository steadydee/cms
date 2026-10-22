import type { PartnersRequestContext } from "../auth";
import type { ToolDefinition } from "./definitions";

export function getAgentScopeDenial(tool: ToolDefinition, context: PartnersRequestContext) {
  if (context.source !== "agent") return null;
  const classifications = new Set(context.allowedToolClassifications ?? []);
  if (!classifications.has(tool.classification)) {
    return { code: "CLASSIFICATION_NOT_ALLOWED", message: `${tool.classification} tools are not allowed for this agent` };
  }
  // Hub's empty name list means permission/classification-scoped access, not no permissions.
  const tools = context.allowedTools;
  if (!Array.isArray(tools) || (tools.length > 0 && !tools.includes(tool.name))) {
    return { code: "TOOL_NOT_ALLOWED", message: "This tool is outside the agent's allowed tool scope" };
  }
  return null;
}
