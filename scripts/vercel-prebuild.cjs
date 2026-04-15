/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");

const BASELINE_MIGRATION = "20260413235500_add_tool_action_audits";
const CURRENT_MIGRATION = "20260415013000_partners_v2_notes_tags_templates";
const CURRENT_MIGRATION_FILE = `prisma/migrations/${CURRENT_MIGRATION}/migration.sql`;

function hasUsableDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  return Boolean(value && (value.startsWith("postgres://") || value.startsWith("postgresql://")));
}

function run(args, options = {}) {
  const result = spawnSync("pnpm", args, {
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

if (!hasUsableDatabaseUrl()) {
  console.log("Skipping prisma migrate deploy: DATABASE_URL is not available in this environment.");
  process.exit(0);
}

console.log("Running prisma migrate deploy before build...");

const deployResult = run(["exec", "prisma", "migrate", "deploy"], {
  allowFailure: true,
  capture: true,
});

if (deployResult.status === 0) {
  process.stdout.write(deployResult.stdout || "");
  process.stderr.write(deployResult.stderr || "");
  process.exit(0);
}

const deployOutput = `${deployResult.stdout || ""}\n${deployResult.stderr || ""}`;

if (!deployOutput.includes("P3005")) {
  process.stdout.write(deployResult.stdout || "");
  process.stderr.write(deployResult.stderr || "");
  process.exit(deployResult.status ?? 1);
}

console.log("Prisma migrate deploy hit P3005. Baselining the existing database, applying the new migration SQL, and recording it.");

run(["exec", "prisma", "migrate", "resolve", "--applied", BASELINE_MIGRATION]);
run(["exec", "prisma", "db", "execute", "--schema", "prisma/schema.prisma", "--file", CURRENT_MIGRATION_FILE]);
run(["exec", "prisma", "migrate", "resolve", "--applied", CURRENT_MIGRATION]);
run(["exec", "prisma", "migrate", "deploy"]);
