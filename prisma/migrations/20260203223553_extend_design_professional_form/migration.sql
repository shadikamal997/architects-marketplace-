/*
  Warnings:

  - Changed the type of `fileType` on the `DesignFile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "StructuralSystem" AS ENUM ('CONCRETE', 'STEEL', 'TIMBER', 'MASONRY', 'MIXED');

-- CreateEnum
CREATE TYPE "ClimateZone" AS ENUM ('TROPICAL', 'ARID', 'TEMPERATE', 'CONTINENTAL', 'POLAR');

-- CreateEnum
CREATE TYPE "DesignStage" AS ENUM ('CONCEPT', 'SCHEMATIC', 'DETAILED', 'CONSTRUCTION_READY');

-- CreateEnum
CREATE TYPE "DesignFileType" AS ENUM ('MAIN_PACKAGE', 'PREVIEW_IMAGE', 'THREE_D_ASSET');

-- AlterTable
ALTER TABLE "Design" ADD COLUMN     "additionalNotes" TEXT,
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "allowModifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "areaUnit" TEXT,
ADD COLUMN     "bathrooms" INTEGER,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "climateZone" "ClimateZone",
ADD COLUMN     "codeDisclaimer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "concept" TEXT,
ADD COLUMN     "designPhilosophy" TEXT,
ADD COLUMN     "designStage" "DesignStage",
ADD COLUMN     "energyNotes" TEXT,
ADD COLUMN     "estimatedCost" DOUBLE PRECISION,
ADD COLUMN     "exclusivePrice" DOUBLE PRECISION,
ADD COLUMN     "features" TEXT[],
ADD COLUMN     "floors" INTEGER,
ADD COLUMN     "idealBuyer" TEXT,
ADD COLUMN     "licenseType" "LicenseType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "limitations" TEXT,
ADD COLUMN     "modificationPrice" DOUBLE PRECISION,
ADD COLUMN     "modificationScope" TEXT,
ADD COLUMN     "modificationTime" TEXT,
ADD COLUMN     "parkingSpaces" INTEGER,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "shortSummary" TEXT,
ADD COLUMN     "standardPrice" DOUBLE PRECISION,
ADD COLUMN     "structuralSystem" "StructuralSystem",
ADD COLUMN     "style" TEXT,
ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "sustainabilityTags" TEXT[],
ADD COLUMN     "targetMarket" TEXT,
ADD COLUMN     "totalArea" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DesignFile" ADD COLUMN     "displayOrder" INTEGER,
ADD COLUMN     "legacyFileType" "FileType",
DROP COLUMN "fileType",
ADD COLUMN     "fileType" "DesignFileType" NOT NULL;

-- CreateIndex
CREATE INDEX "Design_designStage_idx" ON "Design"("designStage");

-- CreateIndex
CREATE INDEX "Design_licenseType_idx" ON "Design"("licenseType");

-- CreateIndex
CREATE INDEX "DesignFile_fileType_idx" ON "DesignFile"("fileType");

-- CreateIndex
CREATE INDEX "DesignFile_designId_fileType_idx" ON "DesignFile"("designId", "fileType");
