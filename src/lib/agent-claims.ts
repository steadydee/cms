export type HubAgentPayload = {
  iss: "owhub";
  typ: "agent_access";
  aud: "partners";
  agentId: string;
  credentialId: string;
  actorLabel: string;
  permissions: string[];
  propertyIds: string[];
  allowedToolClassifications: string[];
  allowedTools: string[];
  activePropertyId: string;
  iat: number;
  exp: number;
  jti: string;
};

export function validateAgentClaims(value: unknown, now = Math.floor(Date.now() / 1000)): HubAgentPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const claim = value as Record<string, unknown>;
  if (claim.iss !== "owhub" || claim.typ !== "agent_access" || claim.aud !== "partners") return null;
  for (const key of ["agentId", "credentialId", "actorLabel", "activePropertyId", "jti"]) {
    if (typeof claim[key] !== "string" || !(claim[key] as string).trim()) return null;
  }
  for (const key of ["permissions", "propertyIds", "allowedToolClassifications", "allowedTools"]) {
    const list = claim[key];
    if (!Array.isArray(list) || !list.every((entry) => typeof entry === "string" && entry.trim())) return null;
  }
  if (!Number.isSafeInteger(claim.iat) || !Number.isSafeInteger(claim.exp)) return null;
  const payload = claim as HubAgentPayload;
  if (payload.exp <= now || payload.iat > now + 60 || payload.exp <= payload.iat || payload.exp - payload.iat > 900) return null;
  if (!payload.propertyIds.includes(payload.activePropertyId)) return null;
  return payload;
}
