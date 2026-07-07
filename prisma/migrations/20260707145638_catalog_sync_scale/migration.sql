-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CatalogSyncType" ADD VALUE 'TOP_RATED';
ALTER TYPE "CatalogSyncType" ADD VALUE 'ON_THE_AIR';
ALTER TYPE "CatalogSyncType" ADD VALUE 'AIRING_TODAY';
ALTER TYPE "CatalogSyncType" ADD VALUE 'DISCOVER';
ALTER TYPE "CatalogSyncType" ADD VALUE 'TRENDING';
ALTER TYPE "CatalogSyncType" ADD VALUE 'CATALOG_FULL';

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "createdBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "homepage" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "networks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "numberOfEpisodes" INTEGER,
ADD COLUMN     "numberOfSeasons" INTEGER,
ADD COLUMN     "originCountry" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "productionCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "productionCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "spokenLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tagline" TEXT;
