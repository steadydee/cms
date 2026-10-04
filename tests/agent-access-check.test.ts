import assert from "node:assert/strict";
import test from "node:test";
import { checkAgentAccess } from "../scripts/check-agent-access.mjs";

function fakeRequest(failDiscovery = false) {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  return {
    calls,
    request: async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      const path = new URL(url).pathname;
      const headers = options.headers as Record<string, string> | undefined;
      const body = options.body ? JSON.parse(String(options.body)) : {};
      let result: unknown = {};
      let status = 200;
      if (path === "/api/agent-auth/exchange") {
        if (body.propertyId === "cms-auth-check-out-of-scope") status = 403;
        else result = { success: true, app: "partners", activePropertyId: "owlswatch", token: "test-token" };
      } else if (path === "/.well-known/ow-tools") {
        if (failDiscovery || headers?.authorization !== "Bearer test-token") status = 401;
        else result = { app: "partners", tools: [] };
      } else if (path.endsWith("/send_intro_email")) {
        assert.equal(options.method ?? "GET", "GET", "must never invoke sending");
        status = 403;
      } else if (path.endsWith("/get_dashboard_summary")) result = { success: true, data: { total: 1 } };
      else if (path.endsWith("/find_partner_accounts")) result = { success: true, data: [{ id: "fake-account" }] };
      else if (path.endsWith("/get_partner_account")) result = { success: true, data: { id: "fake-account", contacts: [], touches: [] } };
      else assert.fail(`Unexpected endpoint: ${path}`);
      return new Response(JSON.stringify(result), { status });
    },
  };
}

test("verifies Hub exchange and CMS reads without exposing secrets or invoking writes", async () => {
  const fake = fakeRequest();
  const report = await checkAgentAccess({ agentKey: "test-agent-key" }, fake.request);
  assert.equal(report.checks.length, 9);
  assert.equal(report.accountCount, 1);
  assert.equal(report.emailsSent, 0);
  assert.equal(report.environment, "test");
  assert.equal(JSON.stringify(report).includes("test-agent-key"), false);
  assert.equal(JSON.stringify(report).includes("test-token"), false);
  for (const { url, options } of fake.calls) {
    assert.equal(options.redirect, "error");
    assert.ok(new URL(url).hostname.includes("env-test"));
    if (options.method === "POST") {
      assert.ok(["/api/agent-auth/exchange", "/api/tools/get_dashboard_summary", "/api/tools/find_partner_accounts", "/api/tools/get_partner_account"].includes(new URL(url).pathname));
    }
  }
});

test("detects signing-secret mismatch before any account or send operation", async () => {
  const fake = fakeRequest(true);
  await assert.rejects(checkAgentAccess({ agentKey: "test-agent-key" }, fake.request), /CMS discovery: expected HTTP 200, received 401/);
  assert.equal(fake.calls.length, 2);
});

test("requires a credential and rejects unknown targets before network access", async () => {
  const fake = fakeRequest();
  await assert.rejects(checkAgentAccess({}, fake.request), /HUB_AGENT_KEY is required/);
  await assert.rejects(checkAgentAccess({ environment: "other", agentKey: "test" }, fake.request), /Unknown verification environment/);
  assert.equal(fake.calls.length, 0);
});

test("production verification uses the same read-only checks with explicit environment selection", async () => {
  const fake = fakeRequest();
  const result = await checkAgentAccess({ environment: "production", agentKey: "test-agent-key" }, fake.request);
  assert.equal(result.environment, "production");
  assert.ok(fake.calls.every(({ url }) => new URL(url).hostname.endsWith(".owlswatch.com")));
});
