ALTER TABLE "EmailSendAttempt" ADD COLUMN "dailyOutreachKey" TEXT,
  ADD COLUMN "outreachPolicyId" TEXT, ADD COLUMN "approvalMode" TEXT,
  ADD COLUMN "outreachEvidence" JSONB;
CREATE UNIQUE INDEX "EmailSendAttempt_dailyOutreachKey_key" ON "EmailSendAttempt"("dailyOutreachKey");
CREATE TABLE "DailyOutreachPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY, "propertyId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "agentId" TEXT NOT NULL, "credentialId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL, "templateSubject" TEXT NOT NULL, "templateBody" TEXT NOT NULL,
  "attachmentSha256" TEXT NOT NULL, "attachmentName" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL, "businessMailbox" TEXT NOT NULL, "personalMailbox" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedById" TEXT NOT NULL, "approvedByName" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "DailyOutreachPolicy_propertyId_key" ON "DailyOutreachPolicy"("propertyId");
