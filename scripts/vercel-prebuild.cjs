/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");

const BASELINE_MIGRATION = "20260413235500_add_tool_action_audits";
const CURRENT_MIGRATION = "20260422093000_gmail_conversations";
const CURRENT_MIGRATION_FILE = `prisma/migrations/${CURRENT_MIGRATION}/migration.sql`;
const MIGRATE_LOCK_RETRIES = 4;
const LOCK_RETRY_DELAY_MS = 5000;

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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function getCommandOutput(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function isAdvisoryLockTimeout(output) {
  return output.includes("P1002") && output.includes("pg_advisory_lock");
}

function runMigrateDeploy() {
  return run(["exec", "prisma", "migrate", "deploy"], {
    allowFailure: true,
    capture: true,
  });
}

function runMigrateDeployWithRetry() {
  for (let attempt = 1; attempt <= MIGRATE_LOCK_RETRIES; attempt += 1) {
    const result = runMigrateDeploy();
    const output = getCommandOutput(result);

    if (result.status === 0) {
      return result;
    }

    if (!isAdvisoryLockTimeout(output) || attempt === MIGRATE_LOCK_RETRIES) {
      return result;
    }

    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    console.log(
      `prisma migrate deploy hit an advisory lock timeout (attempt ${attempt}/${MIGRATE_LOCK_RETRIES}). Retrying in ${LOCK_RETRY_DELAY_MS / 1000}s...`
    );
    sleep(LOCK_RETRY_DELAY_MS);
  }
}

if (!hasUsableDatabaseUrl()) {
  console.log("Skipping prisma migrate deploy: DATABASE_URL is not available in this environment.");
  process.exit(0);
}

console.log("Running prisma migrate deploy before build...");

const deployResult = runMigrateDeployWithRetry();

if (deployResult.status === 0) {
  process.stdout.write(deployResult.stdout || "");
  process.stderr.write(deployResult.stderr || "");
  process.exit(0);
}

const deployOutput = getCommandOutput(deployResult);

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
