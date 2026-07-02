-- CreateEnum
CREATE TYPE "CatalogSyncType" AS ENUM ('POPULAR_SERIES', 'SERIES_DETAILS', 'SERIES_SEASONS', 'SERIES_EPISODES', 'FULL_REFRESH');

-- CreateEnum
CREATE TYPE "CatalogSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "CatalogSyncRun" (
    "id" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL DEFAULT 'TMDB',
    "type" "CatalogSyncType" NOT NULL,
    "status" "CatalogSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "importedSeriesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedSeriesCount" INTEGER NOT NULL DEFAULT 0,
    "importedSeasonCount" INTEGER NOT NULL DEFAULT 0,
    "updatedSeasonCount" INTEGER NOT NULL DEFAULT 0,
    "importedEpisodeCount" INTEGER NOT NULL DEFAULT 0,
    "updatedEpisodeCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogSyncRun_type_startedAt_idx" ON "CatalogSyncRun"("type", "startedAt");

-- CreateIndex
CREATE INDEX "CatalogSyncRun_status_idx" ON "CatalogSyncRun"("status");

