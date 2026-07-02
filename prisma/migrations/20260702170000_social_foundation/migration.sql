-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showWatchingSeries" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_seriesId_key" ON "Review"("userId", "seriesId");
