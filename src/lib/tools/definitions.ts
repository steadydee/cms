export type ToolClassification = "read" | "draft" | "guarded_write" | "restricted";

export type ToolDefinition = {
  name: string;
  description: string;
  classification: ToolClassification;
  requiredPermissions: string[];
  requiresPropertyContext: boolean;
  requiresApproval: boolean;
  inputSummary: string;
  outputSummary: string;
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_partner_organization",
    description: "Get one partner organization and its contacts, touches, and tasks.",
    classification: "read",
    requiredPermissions: ["partners.organizations.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ organizationId: string }",
    outputSummary: "Partner organization detail object",
  },
  {
    name: "find_partner_organizations",
    description: "List partner organizations filtered by query and status.",
    classification: "read",
    requiredPermissions: ["partners.organizations.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ query?: string, status?: string, visitStatus?: string }",
    outputSummary: "Partner organization list",
  },
  {
    name: "list_not_contacted_partners",
    description: "List partner organizations that have not been contacted yet.",
    classification: "read",
    requiredPermissions: ["partners.organizations.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{}",
    outputSummary: "Partner organization list",
  },
  {
    name: "list_followups_due",
    description: "List follow-up tasks due for the active property.",
    classification: "read",
    requiredPermissions: ["partners.tasks.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{}",
    outputSummary: "Follow-up task list",
  },
  {
    name: "draft_intro_email",
    description: "Draft an introductory outreach email for a partner organization.",
    classification: "draft",
    requiredPermissions: ["partners.outreach.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ organizationId: string }",
    outputSummary: "{ subject: string, body: string }",
  },
];
