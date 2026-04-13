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
    name: "get_partner_account",
    description: "Get one partner account and its contacts, touches, and tasks.",
    classification: "read",
    requiredPermissions: ["partners.organizations.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ organizationId: string }",
    outputSummary: "Partner organization detail object",
  },
  {
    name: "get_partner_organization",
    description: "Legacy alias for get_partner_account.",
    classification: "read",
    requiredPermissions: ["partners.organizations.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ organizationId: string }",
    outputSummary: "Partner organization detail object",
  },
  {
    name: "find_partner_accounts",
    description: "List partner accounts filtered by query and status.",
    classification: "read",
    requiredPermissions: ["partners.organizations.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ query?: string, status?: string, visitStatus?: string }",
    outputSummary: "Partner organization list",
  },
  {
    name: "find_partner_organizations",
    description: "Legacy alias for find_partner_accounts.",
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
    inputSummary: "{ bucket?: 'all' | 'overdue' | 'this_week' | 'mine', assignee?: string }",
    outputSummary: "Follow-up task list",
  },
  {
    name: "list_research_findings",
    description: "List raw partner research findings for review.",
    classification: "read",
    requiredPermissions: ["partners.research.read"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ status?: string, sourceType?: string, query?: string }",
    outputSummary: "Research finding list",
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
  {
    name: "create_research_finding",
    description: "Create a raw research finding without directly mutating partner accounts.",
    classification: "guarded_write",
    requiredPermissions: ["partners.research.write"],
    requiresPropertyContext: true,
    requiresApproval: false,
    inputSummary: "{ sourceType?: string, sourceUrl?: string, sourceHandle?: string, observedName?: string, observedText?: string, extractedDataJson?: object, confidence?: number, proposedOrganizationId?: string }",
    outputSummary: "Created research finding",
  },
];
