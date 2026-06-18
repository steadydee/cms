CREATE TABLE IF NOT EXISTS "EmailDraft" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT,
  "emailThreadId" TEXT,
  "fromEmail" TEXT,
  "toEmail" TEXT,
  "subject" TEXT,
  "bodyText" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByUserName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailDraft_organizationId_updatedAt_idx" ON "EmailDraft"("organizationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "EmailDraft_contactId_updatedAt_idx" ON "EmailDraft"("contactId", "updatedAt");
CREATE INDEX IF NOT EXISTS "EmailDraft_emailThreadId_updatedAt_idx" ON "EmailDraft"("emailThreadId", "updatedAt");
CREATE INDEX IF NOT EXISTS "EmailDraft_createdByUserId_updatedAt_idx" ON "EmailDraft"("createdByUserId", "updatedAt");

ALTER TABLE "EmailDraft"
  ADD CONSTRAINT "EmailDraft_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDraft"
  ADD CONSTRAINT "EmailDraft_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "PartnerContact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailDraft"
  ADD CONSTRAINT "EmailDraft_emailThreadId_fkey"
  FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
