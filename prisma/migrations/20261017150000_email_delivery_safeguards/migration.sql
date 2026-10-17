ALTER TABLE "EmailDraft" ADD COLUMN "propertyId" TEXT;
UPDATE "EmailDraft" d SET "propertyId" = o."propertyId"
FROM "PartnerOrganization" o WHERE d."organizationId" = o.id;
ALTER TABLE "EmailDraft" ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "EmailDraft" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "EmailDraft"
  ADD COLUMN "reviewOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "firstOutreach" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attachmentName" TEXT,
  ADD COLUMN "attachmentType" TEXT,
  ADD COLUMN "attachmentSize" INTEGER,
  ADD COLUMN "attachmentSha256" TEXT,
  ADD COLUMN "attachmentContent" BYTEA;
CREATE INDEX "EmailDraft_propertyId_reviewOnly_updatedAt_idx" ON "EmailDraft"("propertyId", "reviewOnly", "updatedAt");

CREATE TABLE "EmailSendAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "organizationId" TEXT,
  "draftId" TEXT,
  "requestKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "firstOutreachKey" TEXT,
  "firstRecipientKey" TEXT,
  "reviewOnly" BOOLEAN NOT NULL DEFAULT false,
  "simulated" BOOLEAN NOT NULL DEFAULT false,
  "toEmail" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "attachmentName" TEXT,
  "attachmentSha256" TEXT,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "providerMessageId" TEXT,
  "providerThreadId" TEXT,
  "stored" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" TEXT,
  "actorId" TEXT NOT NULL,
  "actorLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "EmailSendAttempt_dedupeKey_key" ON "EmailSendAttempt"("dedupeKey");
CREATE UNIQUE INDEX "EmailSendAttempt_firstOutreachKey_key" ON "EmailSendAttempt"("firstOutreachKey");
CREATE UNIQUE INDEX "EmailSendAttempt_firstRecipientKey_key" ON "EmailSendAttempt"("firstRecipientKey");
CREATE UNIQUE INDEX "EmailSendAttempt_propertyId_requestKey_key" ON "EmailSendAttempt"("propertyId", "requestKey");
CREATE INDEX "EmailSendAttempt_propertyId_organizationId_createdAt_idx" ON "EmailSendAttempt"("propertyId", "organizationId", "createdAt");
CREATE INDEX "EmailSendAttempt_propertyId_toEmail_createdAt_idx" ON "EmailSendAttempt"("propertyId", "toEmail", "createdAt");
