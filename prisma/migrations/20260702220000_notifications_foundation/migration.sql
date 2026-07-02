-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_EPISODE_AVAILABLE', 'FOLLOWED_YOU', 'REVIEW_FROM_FOLLOWING', 'LIST_FROM_FOLLOWING', 'SERIES_COMPLETED', 'ADMIN_NOTICE');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "kind",
DROP COLUMN "payload",
DROP COLUMN "seenAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "episodeId" TEXT,
ADD COLUMN     "href" TEXT,
ADD COLUMN     "listId" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "reviewId" TEXT,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE SET NULL ON UPDATE CASCADE;

