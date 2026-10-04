import { pathToFileURL } from "node:url";

export const TARGETS = {
  test: {
    hubBaseUrl: "https://hub-env-test-dennis-projects-b028c121.vercel.app",
    cmsBaseUrl: "https://partners-env-test-dennis-projects-b028c121.vercel.app",
  },
  production: {
    hubBaseUrl: "https://hub.owlswatch.com",
    cmsBaseUrl: "https://cms.owlswatch.com",
  },
};

// Read-only CMS calls only: never invoke a send or mutation tool in this check.
export async function checkAgentAccess({ environment = "test", agentKey, propertyId = "owlswatch", hubProtectionBypass, cmsProtectionBypass }, request = fetch) {
  if (!Object.hasOwn(TARGETS, environment)) throw new Error("Unknown verification environment.");
  if (!agentKey?.trim()) throw new Error("HUB_AGENT_KEY is required; use a read-only Hub agent credential.");
  const { hubBaseUrl, cmsBaseUrl } = TARGETS[environment];
  const checks = [];
  async function call(label, url, options, expectedStatus = 200) {
    let response;
    try {
      const bypass = new URL(url).origin === hubBaseUrl ? hubProtectionBypass : cmsProtectionBypass;
      response = await request(url, {
        ...options,
        headers: { ...options.headers, ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}) },
        redirect: "error",
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new Error(`${label}: request failed (credentials and response content omitted).`);
    }
    if (response.status !== expectedStatus) {
      throw new Error(`${label}: expected HTTP ${expectedStatus}, received ${response.status}.`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${label}: expected a JSON response.`);
    }
    checks.push(label);
    return body;
  }
  const exchangeOptions = {
    method: "POST",
    headers: { authorization: `Bearer ${agentKey.trim()}`, "content-type": "application/json" },
    body: JSON.stringify({ app: "partners", propertyId }),
  };
  const exchanged = await call("Hub token exchange", `${hubBaseUrl}/api/agent-auth/exchange`, exchangeOptions);
  if (!exchanged.success || exchanged.app !== "partners" || exchanged.activePropertyId !== propertyId || typeof exchanged.token !== "string" || !exchanged.token) {
    throw new Error("Hub token exchange: unexpected token response or property scope.");
  }
  const headers = { authorization: `Bearer ${exchanged.token}`, "content-type": "application/json" };
  const catalog = await call("CMS discovery", `${cmsBaseUrl}/.well-known/ow-tools`, { headers });
  if (catalog.app !== "partners") throw new Error("CMS discovery: unexpected app identity.");
  const readTool = async (name, input = {}) => {
    const result = await call(name, `${cmsBaseUrl}/api/tools/${name}`, { method: "POST", headers, body: JSON.stringify({ input }) });
    if (!result.success) throw new Error(`${name}: unsuccessful tool result.`);
    return result.data;
  };
  const dashboard = await readTool("get_dashboard_summary");
  if (!dashboard || typeof dashboard !== "object") throw new Error("Dashboard result is missing.");
  const accounts = await readTool("find_partner_accounts");
  if (!Array.isArray(accounts) || !accounts[0]?.id) {
    throw new Error("Account-detail verification requires an existing account; add a fake account in test, not production.");
  }
  const account = await readTool("get_partner_account", { organizationId: accounts[0].id });
  if (account?.id !== accounts[0].id || !Array.isArray(account.contacts) || !Array.isArray(account.touches)) {
    throw new Error("Account read did not return the expected account, contacts, and outreach history.");
  }
  await call("Anonymous discovery denied", `${cmsBaseUrl}/.well-known/ow-tools`, {}, 401);
  await call("Invalid token denied", `${cmsBaseUrl}/.well-known/ow-tools`, {
    headers: { authorization: `Bearer ${exchanged.token}invalid` },
  }, 401);
  await call("Read-only credential cannot access sending", `${cmsBaseUrl}/api/tools/send_intro_email`, { headers }, 403);
  await call("Out-of-scope property denied by Hub", `${hubBaseUrl}/api/agent-auth/exchange`, {
    ...exchangeOptions,
    body: JSON.stringify({ app: "partners", propertyId: "cms-auth-check-out-of-scope" }),
  }, 403);
  return { environment, hubBaseUrl, cmsBaseUrl, checks, accountCount: accounts.length, emailsSent: 0 };
}

async function main() {
  const production = process.argv.includes("--production-read-only");
  try {
    const report = await checkAgentAccess({
      environment: production ? "production" : "test",
      agentKey: process.env.HUB_AGENT_KEY,
      hubProtectionBypass: process.env.HUB_VERCEL_AUTOMATION_BYPASS_SECRET,
      cmsProtectionBypass: process.env.CMS_VERCEL_AUTOMATION_BYPASS_SECRET,
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
