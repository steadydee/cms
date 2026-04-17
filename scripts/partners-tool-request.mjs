#!/usr/bin/env node

const [, , toolName, rawInput = "{}", baseUrlArg] = process.argv;

if (!toolName) {
  console.error("Usage: node scripts/partners-tool-request.mjs <tool-name> '<json-input>' [base-url]");
  process.exit(1);
}

let input;
try {
  input = JSON.parse(rawInput);
} catch (error) {
  console.error(`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const baseUrl = (baseUrlArg || process.env.OW_PARTNERS_URL || "https://partners-six-gamma.vercel.app").replace(/\/$/, "");
const internalSecret = process.env.OW_INTERNAL_SHARED_SECRET?.trim();

if (!internalSecret) {
  console.error("OW_INTERNAL_SHARED_SECRET is required to call Partners through shell context.");
  process.exit(1);
}

const headers = {
  "content-type": "application/json",
  "x-ow-internal-secret": internalSecret,
  "x-ow-user-id": process.env.OW_PARTNERS_RUNTIME_USER_ID?.trim() || "codex",
  "x-ow-user-name": process.env.OW_PARTNERS_RUNTIME_USER_NAME?.trim() || "Codex",
  "x-ow-user-role": process.env.OW_PARTNERS_RUNTIME_USER_ROLE?.trim() || "admin",
  "x-ow-property-id": process.env.OW_PARTNERS_RUNTIME_PROPERTY_ID?.trim() || "owlswatch",
  "x-ow-request-source": "internal_agent",
  "x-ow-correlation-id": `codex-${Date.now()}`,
};

const response = await fetch(`${baseUrl}/api/tools/${toolName}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ input }),
});

const text = await response.text();
console.log(`${response.status} ${response.statusText}`);
console.log(text);
