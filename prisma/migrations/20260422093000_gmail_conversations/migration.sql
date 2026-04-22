-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('gmail');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "EmailMatchSource" AS ENUM ('thread_id', 'participant_email', 'manual');

-- CreateTable
CREATE TABLE "MailboxConnection" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL DEFAULT 'gmail',
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "scope" TEXT,
    "historyId" TEXT,
    "labelId" TEXT,
    "labelName" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "mailboxConnectionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "providerThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "participantEmails" JSONB,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "mailboxConnectionId" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "direction" "EmailDirection" NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "toEmails" JSONB,
    "ccEmails" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchSource" "EmailMatchSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailboxConnection_propertyId_key" ON "MailboxConnection"("propertyId");

-- CreateIndex
CREATE INDEX "MailboxConnection_propertyId_provider_idx" ON "MailboxConnection"("propertyId", "provider");

-- CreateIndex
CREATE INDEX "EmailThread_organizationId_lastMessageAt_idx" ON "EmailThread"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "EmailThread_contactId_lastMessageAt_idx" ON "EmailThread"("contactId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_mailboxConnectionId_providerThreadId_key" ON "EmailThread"("mailboxConnectionId", "providerThreadId");

-- CreateIndex
CREATE INDEX "EmailMessage_organizationId_sentAt_idx" ON "EmailMessage"("organizationId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailMessage_contactId_sentAt_idx" ON "EmailMessage"("contactId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailMessage_emailThreadId_sentAt_idx" ON "EmailMessage"("emailThreadId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_mailboxConnectionId_providerMessageId_key" ON "EmailMessage"("mailboxConnectionId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_mailboxConnectionId_fkey" FOREIGN KEY ("mailboxConnectionId") REFERENCES "MailboxConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_mailboxConnectionId_fkey" FOREIGN KEY ("mailboxConnectionId") REFERENCES "MailboxConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

