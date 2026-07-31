-- CreateEnum
CREATE TYPE "SocialContentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('INSTAGRAM');

-- CreateEnum
CREATE TYPE "SocialPublicationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialAutomationAction" AS ENUM ('CONTENT_GENERATED', 'TEMPLATE_RENDERED', 'MEDIA_GENERATED', 'PUBLISH_ATTEMPTED', 'PUBLISH_SUCCEEDED', 'PUBLISH_FAILED', 'RETRY_SCHEDULED', 'CONTENT_SELECTION_STARTED', 'CONTENT_CANDIDATES_ANALYZED', 'CONTENT_TOPIC_SELECTED', 'CONTENT_FALLBACK_APPLIED', 'CONTENT_REJECTED_SAFETY', 'CONTENT_SUBMITTED_FOR_APPROVAL', 'CONTENT_APPROVED', 'CONTENT_REJECTED');

-- CreateTable
CREATE TABLE "SocialContent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SocialContentStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "format" TEXT,
    "sourceSeriesId" TEXT,
    "ctaId" TEXT,
    "hookId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPublication" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "caption" TEXT NOT NULL,
    "mediaRef" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "SocialPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAutomationHistory" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT,
    "contentId" TEXT,
    "action" "SocialAutomationAction" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAutomationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialContent_status_createdAt_idx" ON "SocialContent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SocialContent_templateId_idx" ON "SocialContent"("templateId");

-- CreateIndex
CREATE INDEX "SocialContent_format_idx" ON "SocialContent"("format");

-- CreateIndex
CREATE INDEX "SocialContent_sourceSeriesId_idx" ON "SocialContent"("sourceSeriesId");

-- CreateIndex
CREATE INDEX "SocialPublication_contentId_idx" ON "SocialPublication"("contentId");

-- CreateIndex
CREATE INDEX "SocialPublication_network_status_idx" ON "SocialPublication"("network", "status");

-- CreateIndex
CREATE INDEX "SocialPublication_status_scheduledFor_idx" ON "SocialPublication"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SocialTemplate_type_active_idx" ON "SocialTemplate"("type", "active");

-- CreateIndex
CREATE INDEX "SocialAutomationHistory_publicationId_createdAt_idx" ON "SocialAutomationHistory"("publicationId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialAutomationHistory_contentId_createdAt_idx" ON "SocialAutomationHistory"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialAutomationHistory_action_createdAt_idx" ON "SocialAutomationHistory"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SocialTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "SocialContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAutomationHistory" ADD CONSTRAINT "SocialAutomationHistory_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "SocialPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAutomationHistory" ADD CONSTRAINT "SocialAutomationHistory_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "SocialContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
