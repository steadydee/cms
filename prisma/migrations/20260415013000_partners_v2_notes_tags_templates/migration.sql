CREATE TABLE "Note" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "author" TEXT NOT NULL DEFAULT 'Dennis',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TagOnContact" (
  "organizationId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,

  CONSTRAINT "TagOnContact_pkey" PRIMARY KEY ("organizationId", "tagId")
);

CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Note_organizationId_createdAt_idx" ON "Note"("organizationId", "createdAt");
CREATE INDEX "TagOnContact_tagId_idx" ON "TagOnContact"("tagId");
CREATE INDEX "EmailTemplate_propertyId_sortOrder_idx" ON "EmailTemplate"("propertyId", "sortOrder");

ALTER TABLE "Note"
ADD CONSTRAINT "Note_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TagOnContact"
ADD CONSTRAINT "TagOnContact_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TagOnContact"
ADD CONSTRAINT "TagOnContact_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

WITH "property_ids" AS (
  SELECT DISTINCT "propertyId" FROM "PartnerOrganization"
  UNION
  SELECT 'owlswatch'
)
INSERT INTO "EmailTemplate" ("id", "propertyId", "name", "subject", "body", "sortOrder")
SELECT
  "propertyId" || '_intro_operator',
  "propertyId",
  'Intro — birding operator',
  'Introducing Owl''s Watch for your travelers',
  'Hello {company},\n\nI''m reaching out from Owl''s Watch Nature Retreat, located directly adjacent to the Río Blanco Reserve near Manizales, Colombia.\n\nWe offer birding-focused accommodation with direct trail access to one of Colombia''s richest birding sites — no morning drive required. I''d love to explore whether we could be a fit for your travelers.\n\nWould you be open to a quick call or visit?\n\nBest,\nDennis Bailey\nOwl''s Watch Nature Retreat',
  0
FROM "property_ids"
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "EmailTemplate"."propertyId" = "property_ids"."propertyId"
    AND "EmailTemplate"."name" = 'Intro — birding operator'
);

WITH "property_ids" AS (
  SELECT DISTINCT "propertyId" FROM "PartnerOrganization"
  UNION
  SELECT 'owlswatch'
)
INSERT INTO "EmailTemplate" ("id", "propertyId", "name", "subject", "body", "sortOrder")
SELECT
  "propertyId" || '_follow_up_no_reply',
  "propertyId",
  'Follow-up — no reply',
  'Following up — Owl''s Watch partnership',
  'Hello {company},\n\nJust following up on my earlier message about a potential partnership with Owl''s Watch. We''re adjacent to Río Blanco Reserve and offer direct trail access for birding groups.\n\nHappy to share our rate sheet or schedule a call whenever convenient.\n\nBest,\nDennis',
  1
FROM "property_ids"
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "EmailTemplate"."propertyId" = "property_ids"."propertyId"
    AND "EmailTemplate"."name" = 'Follow-up — no reply'
);

WITH "property_ids" AS (
  SELECT DISTINCT "propertyId" FROM "PartnerOrganization"
  UNION
  SELECT 'owlswatch'
)
INSERT INTO "EmailTemplate" ("id", "propertyId", "name", "subject", "body", "sortOrder")
SELECT
  "propertyId" || '_invite_visit',
  "propertyId",
  'Invite — property visit',
  'Invitation to visit Owl''s Watch',
  'Hello {name},\n\nI''d like to invite you for a complimentary visit to Owl''s Watch Nature Retreat. Seeing the property and trails firsthand is the best way to understand what we can offer your groups.\n\nWe''d provide accommodation and a guided birding session with Juan Carlos.\n\nWould any dates in the coming weeks work?\n\nBest,\nDennis',
  2
FROM "property_ids"
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "EmailTemplate"."propertyId" = "property_ids"."propertyId"
    AND "EmailTemplate"."name" = 'Invite — property visit'
);
