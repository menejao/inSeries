-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('PENDING_PAYMENT', 'AWAITING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserSupporterStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "SupporterContribution" DROP CONSTRAINT "SupporterContribution_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isSupporter",
DROP COLUMN "supporterSince";

-- DropTable
DROP TABLE "SupporterContribution";

-- DropEnum
DROP TYPE "SupporterContributionStatus";

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PIX',
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "pixTxId" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSupporter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "UserSupporterStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PIX',
    "supportRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSupporter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_pixTxId_key" ON "SupportRequest"("pixTxId");

-- CreateIndex
CREATE INDEX "SupportRequest_userId_status_idx" ON "SupportRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSupporter_userId_key" ON "UserSupporter"("userId");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSupporter" ADD CONSTRAINT "UserSupporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
