-- CreateEnum
CREATE TYPE "ModificationStatus" AS ENUM ('REQUESTED', 'PRICED', 'ACCEPTED', 'PAID', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('STANDARD', 'EXCLUSIVE');

-- CreateTable
CREATE TABLE "ModificationRequest" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "description" TEXT NOT NULL,
    "scopeTags" TEXT[],
    "proposedPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deliveryTimeDays" INTEGER,
    "revisionsIncluded" INTEGER,
    "status" "ModificationStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModificationRequest_designId_idx" ON "ModificationRequest"("designId");

-- CreateIndex
CREATE INDEX "ModificationRequest_buyerId_idx" ON "ModificationRequest"("buyerId");

-- CreateIndex
CREATE INDEX "ModificationRequest_architectId_idx" ON "ModificationRequest"("architectId");

-- CreateIndex
CREATE INDEX "ModificationRequest_status_idx" ON "ModificationRequest"("status");

-- AddForeignKey
ALTER TABLE "ModificationRequest" ADD CONSTRAINT "ModificationRequest_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModificationRequest" ADD CONSTRAINT "ModificationRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModificationRequest" ADD CONSTRAINT "ModificationRequest_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
