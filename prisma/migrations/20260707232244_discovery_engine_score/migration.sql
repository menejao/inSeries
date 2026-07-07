-- AlterEnum
ALTER TYPE "CatalogSyncType" ADD VALUE 'DISCOVERY_ENGINE';

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "discoveryScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Series_discoveryScore_idx" ON "Series"("discoveryScore");
