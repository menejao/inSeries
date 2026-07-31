-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoPauseInactiveDays" INTEGER DEFAULT 60,
ADD COLUMN     "autoPauseInactiveSeries" BOOLEAN NOT NULL DEFAULT true;
