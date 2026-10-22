import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateAgentClaims } from "../src/lib/agent-claims";
import { getAgentScopeDenial } from "../src/lib/tools/agent-scope";
import type { PartnersRequestContext } from "../src/lib/auth";
import { TOOL_DEFINITIONS } from "../src/lib/tools/definitions";

const claims = {
  iss: "owhub", typ: "agent_access", aud: "partners", agentId: "uat-agent", credentialId: "uat-key",
  actorLabel: "UAT Agent", permissions: ["partners.organizations.read"], propertyIds: ["uat"],
  activePropertyId: "uat", allowedToolClassifications: ["read"], allowedTools: ["find_partner_accounts"],
  iat: 100, exp: 1000, jti: "uat-request",
};
const context: PartnersRequestContext = {
  userId: "uat-agent", userName: "UAT Agent", role: "admin", propertyId: "uat", source: "agent",
  permissions: claims.permissions, allowedToolClassifications: ["read"], allowedTools: claims.allowedTools,
};
const readTool = TOOL_DEFINITIONS.find((tool) => tool.name === "find_partner_accounts")!;

test("signed agent claims require explicit valid identity, audience, scope and lifetime", () => {
  assert.deepEqual(validateAgentClaims(claims, 150), claims);
  for (const change of [
    { aud: "reservations" }, { iss: "other" }, { typ: "human" }, { exp: 150 }, { exp: 1001 },
    { iat: 211 }, { exp: undefined }, { exp: "1000" }, { agentId: "" }, { credentialId: null },
    { activePropertyId: "other" }, { propertyIds: [] }, { propertyIds: ["*"] }, { propertyIds: null },
    { permissions: "partners.admin" }, { allowedTools: undefined }, { allowedTools: [123] },
  ]) assert.equal(validateAgentClaims({ ...claims, ...change }, 150), null, JSON.stringify(change));
});

test("tool allowlist prevents lateral use of tools sharing the same permission", () => {
  assert.equal(getAgentScopeDenial(readTool, context), null);
  const other = TOOL_DEFINITIONS.find((tool) => tool.name === "get_dashboard_summary")!;
  assert.equal(getAgentScopeDenial(other, context)?.code, "TOOL_NOT_ALLOWED");
});

test("an empty classification grant denies access instead of granting all classes", () => {
  assert.equal(getAgentScopeDenial(readTool, { ...context, allowedToolClassifications: [] })?.code, "CLASSIFICATION_NOT_ALLOWED");
  assert.equal(getAgentScopeDenial(readTool, { ...context, allowedTools: undefined })?.code, "TOOL_NOT_ALLOWED");
});

test("empty tool names retain Hub permission-scoped semantics without bypassing classifications", () => {
  assert.equal(getAgentScopeDenial(readTool, { ...context, allowedTools: [] }), null);
  assert.equal(getAgentScopeDenial({ ...readTool, classification: "restricted" }, { ...context, allowedTools: [] })?.code, "CLASSIFICATION_NOT_ALLOWED");
});

test("human access remains separate and bearer authentication cannot fall back to a browser cookie", () => {
  assert.equal(getAgentScopeDenial(readTool, { ...context, source: "shell" }), null);
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  const authorize = auth.split("export async function authorizePartnersAccess")[1];
  assert.ok(authorize.indexOf('has("authorization")') < authorize.indexOf("getCookieContext()"));
  assert.match(authorize, /if \(!context\) return \{ ok: false, status: 401/);
  assert.match(auth, /allowedTools: payload\.allowedTools/);
  assert.match(authorize, /if \(!options\.allowAgent\)/);
  const runtime = readFileSync("src/lib/tools/runtime.ts", "utf8");
  assert.match(runtime, /authorizePartnersAccess\(mapPermissionLevel\(tool\), \{ allowAgent: true \}\)/);
  const attachment = readFileSync("src/app/api/email-drafts/[id]/attachment/route.ts", "utf8");
  assert.match(attachment, /findToolDefinition\("get_partner_email_draft"\)/);
  assert.match(attachment, /ensureToolAccess\(definition\)/);
});
