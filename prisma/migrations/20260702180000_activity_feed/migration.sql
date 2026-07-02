-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EPISODE_WATCHED', 'SERIES_STATUS_CHANGED', 'SERIES_COMPLETED', 'REVIEW_CREATED', 'LIST_CREATED', 'USER_FOLLOWED');

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "kind",
DROP COLUMN "payload",
ADD COLUMN     "episodeId" TEXT,
ADD COLUMN     "listId" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "reviewId" TEXT,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "targetUserId" TEXT,
ADD COLUMN     "type" "ActivityType" NOT NULL,
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_visibility_createdAt_idx" ON "Activity"("visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

