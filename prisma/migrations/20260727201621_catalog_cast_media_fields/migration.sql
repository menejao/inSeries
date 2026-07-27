-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "backdropUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cast" JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN     "posterUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videos" JSONB[] DEFAULT ARRAY[]::JSONB[];
