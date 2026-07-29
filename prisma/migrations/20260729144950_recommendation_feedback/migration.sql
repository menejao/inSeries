-- CreateEnum
CREATE TYPE "RecommendationFeedbackAction" AS ENUM ('LIKE', 'NOT_INTERESTED', 'ALREADY_WATCHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "action" "RecommendationFeedbackAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_action_idx" ON "RecommendationFeedback"("userId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationFeedback_userId_seriesId_key" ON "RecommendationFeedback"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
