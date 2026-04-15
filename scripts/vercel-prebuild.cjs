/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");

function hasUsableDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  return Boolean(value && (value.startsWith("postgres://") || value.startsWith("postgresql://")));
}

if (!hasUsableDatabaseUrl()) {
  console.log("Skipping prisma migrate deploy: DATABASE_URL is not available in this environment.");
  process.exit(0);
}

console.log("Running prisma migrate deploy before build...");

const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
