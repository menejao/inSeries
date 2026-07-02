-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "voteAverage" DOUBLE PRECISION,
ADD COLUMN     "voteCount" INTEGER;

-- CreateIndex
CREATE INDEX "Series_status_idx" ON "Series"("status");

-- CreateIndex
CREATE INDEX "Series_firstAirYear_idx" ON "Series"("firstAirYear");

-- CreateIndex
CREATE INDEX "Series_popularityScore_idx" ON "Series"("popularityScore");

-- CreateIndex
CREATE INDEX "Series_voteAverage_idx" ON "Series"("voteAverage");

-- CreateIndex
CREATE INDEX "Series_title_idx" ON "Series"("title");

