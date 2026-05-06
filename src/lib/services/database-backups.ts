import { PrismaClient } from "@prisma/client";
import { gzipSync } from "node:zlib";

type TableBackup = {
  schema: string;
  table: string;
  rowCount: number;
  primaryKey: string[];
  rows: unknown[];
};

type BackupDocument = {
  app: "partners";
  schema: string;
  createdAt: string;
  environment: string | null;
  deploymentUrl: string | null;
  gitCommitSha: string | null;
  tables: TableBackup[];
};

const APP_NAME = "partners";

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function getBackupSchema() {
  const explicitSchema = process.env.BACKUP_DATABASE_SCHEMA?.trim();
  if (explicitSchema) return explicitSchema;

  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      const schema = new URL(connectionString).searchParams.get("schema")?.trim();
      if (schema) return schema;
    } catch {
      // Fall through to the default schema.
    }
  }

  return "public";
}

async function listTables(db: PrismaClient, schema: string) {
  const result = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `,
    schema
  );

  return result.map((row) => row.table_name);
}

async function getPrimaryKeyColumns(db: PrismaClient, schema: string, tableName: string) {
  const result = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position
    `,
    schema,
    tableName
  );

  return result.map((row) => row.column_name);
}

async function backupTable(db: PrismaClient, schema: string, tableName: string): Promise<TableBackup> {
  const primaryKey = await getPrimaryKeyColumns(db, schema, tableName);
  const relationName = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
  const orderBy = primaryKey.length > 0
    ? ` ORDER BY ${primaryKey.map((column) => quoteIdentifier(column)).join(", ")}`
    : "";

  const result = await db.$queryRawUnsafe<Array<{ row_count: string; rows: unknown[] }>>(
    `
      SELECT
        COUNT(*)::text AS row_count,
        COALESCE(jsonb_agg(to_jsonb(source_rows)), '[]'::jsonb) AS rows
      FROM (
        SELECT *
        FROM ${relationName}
        ${orderBy}
      ) AS source_rows
    `
  );

  const row = result[0];
  return {
    schema,
    table: tableName,
    rowCount: Number(row?.row_count ?? 0),
    primaryKey,
    rows: row?.rows ?? [],
  };
}

function backupPathname(createdAt: Date) {
  const year = String(createdAt.getUTCFullYear());
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getUTCDate()).padStart(2, "0");
  const timestamp = createdAt.toISOString().replaceAll(":", "-").replace(".", "-");
  return `backups/${APP_NAME}/${year}/${month}/${day}/${APP_NAME}-${timestamp}.json.gz`;
}

async function uploadPrivateBackup(pathname: string, body: Buffer) {
  const token = process.env.BACKUP_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("BACKUP_READ_WRITE_TOKEN is required to write Partners backups");
  }

  const params = new URLSearchParams({ pathname });
  const uploadBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  const response = await fetch(`https://vercel.com/api/blob/?${params.toString()}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": "12",
      "x-vercel-blob-access": "private",
      "x-content-type": "application/gzip",
      "x-allow-overwrite": "0",
    },
    body: uploadBody,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data?.error?.message ?? data?.message ?? "Vercel Blob upload failed";
    throw new Error(message);
  }

  return data as { url?: string; pathname?: string };
}

export async function createPartnersDatabaseBackup() {
  const schema = getBackupSchema();
  const db = new PrismaClient();
  const createdAt = new Date();

  try {
    const tableNames = await listTables(db, schema);
    const tables: TableBackup[] = [];
    for (const tableName of tableNames) {
      tables.push(await backupTable(db, schema, tableName));
    }

    const backup: BackupDocument = {
      app: APP_NAME,
      schema,
      createdAt: createdAt.toISOString(),
      environment: process.env.VERCEL_ENV ?? null,
      deploymentUrl: process.env.VERCEL_URL ?? null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      tables,
    };

    const backupJson = JSON.stringify(backup);
    const compressed = gzipSync(Buffer.from(backupJson, "utf8"));
    const pathname = backupPathname(createdAt);
    const blob = await uploadPrivateBackup(pathname, compressed);

    return {
      pathname: blob.pathname ?? pathname,
      url: blob.url ?? null,
      createdAt: backup.createdAt,
      schema,
      tableCount: tables.length,
      rowCount: tables.reduce((total, table) => total + table.rowCount, 0),
      uncompressedBytes: Buffer.byteLength(backupJson, "utf8"),
      compressedBytes: compressed.byteLength,
    };
  } finally {
    await db.$disconnect();
  }
}
