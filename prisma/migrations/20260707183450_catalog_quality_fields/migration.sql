-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "collectionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "qualityScore" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "watchProviders" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Series_qualityScore_idx" ON "Series"("qualityScore");
