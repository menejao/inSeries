-- CreateEnum
CREATE TYPE "SupporterContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSupporter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSupporterBadge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supporterBannerStyle" TEXT,
ADD COLUMN     "supporterFrameStyle" TEXT,
ADD COLUMN     "supporterSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupporterContribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PIX',
    "status" "SupporterContributionStatus" NOT NULL DEFAULT 'PENDING',
    "pixTxId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "SupporterContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupporterPoll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupporterPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupporterPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupporterPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupporterContribution_pixTxId_key" ON "SupporterContribution"("pixTxId");

-- CreateIndex
CREATE INDEX "SupporterContribution_userId_status_idx" ON "SupporterContribution"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupporterPollVote_pollId_userId_key" ON "SupporterPollVote"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "SupporterContribution" ADD CONSTRAINT "SupporterContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupporterPollVote" ADD CONSTRAINT "SupporterPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "SupporterPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupporterPollVote" ADD CONSTRAINT "SupporterPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
