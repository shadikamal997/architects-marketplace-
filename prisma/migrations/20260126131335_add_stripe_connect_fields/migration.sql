-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PREVIEW_IMAGE', 'DESIGN_ARCHIVE', 'CAD_FILE', 'BIM_FILE', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ArchitectEarningStatus" AS ENUM ('PENDING', 'PAYABLE', 'PAID');

-- CreateEnum
CREATE TYPE "StripeAccountStatus" AS ENUM ('PENDING', 'VERIFIED', 'RESTRICTED');

-- AlterTable
ALTER TABLE "Architect" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeAccountStatus" "StripeAccountStatus";

-- CreateTable
CREATE TABLE "DesignFile" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "uploadedByArchitectId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isPublicPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "amountTotal" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "architectEarning" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchitectEarning" (
    "id" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ArchitectEarningStatus" NOT NULL DEFAULT 'PAYABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ArchitectEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignFile_storageKey_key" ON "DesignFile"("storageKey");

-- CreateIndex
CREATE INDEX "DesignFile_designId_idx" ON "DesignFile"("designId");

-- CreateIndex
CREATE INDEX "DesignFile_uploadedByArchitectId_idx" ON "DesignFile"("uploadedByArchitectId");

-- CreateIndex
CREATE INDEX "DesignFile_fileType_idx" ON "DesignFile"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripeSessionId_key" ON "Transaction"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Transaction_buyerId_idx" ON "Transaction"("buyerId");

-- CreateIndex
CREATE INDEX "Transaction_designId_idx" ON "Transaction"("designId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "License_transactionId_key" ON "License"("transactionId");

-- CreateIndex
CREATE INDEX "License_buyerId_idx" ON "License"("buyerId");

-- CreateIndex
CREATE INDEX "License_designId_idx" ON "License"("designId");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ArchitectEarning_transactionId_key" ON "ArchitectEarning"("transactionId");

-- CreateIndex
CREATE INDEX "ArchitectEarning_architectId_idx" ON "ArchitectEarning"("architectId");

-- CreateIndex
CREATE INDEX "ArchitectEarning_status_idx" ON "ArchitectEarning"("status");

-- AddForeignKey
ALTER TABLE "DesignFile" ADD CONSTRAINT "DesignFile_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignFile" ADD CONSTRAINT "DesignFile_uploadedByArchitectId_fkey" FOREIGN KEY ("uploadedByArchitectId") REFERENCES "Architect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchitectEarning" ADD CONSTRAINT "ArchitectEarning_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchitectEarning" ADD CONSTRAINT "ArchitectEarning_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
