CREATE TABLE IF NOT EXISTS "PropertyControlOption" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tableKey" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PropertyControlOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyControlOption_propertyId_tableKey_value_key"
  ON "PropertyControlOption"("propertyId", "tableKey", "value");

CREATE INDEX IF NOT EXISTS "PropertyControlOption_propertyId_tableKey_sortOrder_idx"
  ON "PropertyControlOption"("propertyId", "tableKey", "sortOrder");

ALTER TABLE "PartnerOrganization" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "PartnerOrganization" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "PartnerOrganization" ALTER COLUMN "type" SET DEFAULT 'agency';

CREATE INDEX IF NOT EXISTS "PartnerOrganization_propertyId_type_idx"
  ON "PartnerOrganization"("propertyId", "type");

DROP TYPE IF EXISTS "PartnerType";

WITH "property_ids" AS (
  SELECT DISTINCT "propertyId" FROM "PartnerOrganization"
  UNION
  SELECT DISTINCT "propertyId" FROM "EmailTemplate"
  UNION
  SELECT DISTINCT "propertyId" FROM "MailboxConnection"
  UNION
  SELECT 'owlswatch'
),
"defaults" AS (
  SELECT 'agency'::TEXT AS "value", 'Agency'::TEXT AS "label", 0 AS "sortOrder"
  UNION ALL SELECT 'operator', 'Birding operator', 1
  UNION ALL SELECT 'travel_advisor', 'Travel advisor', 2
  UNION ALL SELECT 'media', 'Media', 3
  UNION ALL SELECT 'other', 'Other', 4
)
INSERT INTO "PropertyControlOption" ("id", "propertyId", "tableKey", "value", "label", "sortOrder", "isActive")
SELECT
  "property_ids"."propertyId" || '_partner_type_' || "defaults"."value",
  "property_ids"."propertyId",
  'partner_type',
  "defaults"."value",
  "defaults"."label",
  "defaults"."sortOrder",
  true
FROM "property_ids"
CROSS JOIN "defaults"
WHERE NOT EXISTS (
  SELECT 1
  FROM "PropertyControlOption"
  WHERE "PropertyControlOption"."propertyId" = "property_ids"."propertyId"
    AND "PropertyControlOption"."tableKey" = 'partner_type'
    AND "PropertyControlOption"."value" = "defaults"."value"
);
