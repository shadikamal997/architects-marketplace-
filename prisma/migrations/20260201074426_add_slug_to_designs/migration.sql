/*
  Warnings:

  - The values [REVIEW] on the enum `DesignStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Design` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Design` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConversationReason" AS ENUM ('EXCLUSIVE_LICENSE', 'PAID_MODIFICATION', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "DesignStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
ALTER TABLE "Design" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Design" ALTER COLUMN "status" TYPE "DesignStatus_new" USING ("status"::text::"DesignStatus_new");
ALTER TYPE "DesignStatus" RENAME TO "DesignStatus_old";
ALTER TYPE "DesignStatus_new" RENAME TO "DesignStatus";
DROP TYPE "DesignStatus_old";
ALTER TABLE "Design" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "Design" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "licenseType" "LicenseType" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "reason" "ConversationReason" NOT NULL,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BuyerFavorites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Conversation_buyerId_idx" ON "Conversation"("buyerId");

-- CreateIndex
CREATE INDEX "Conversation_architectId_idx" ON "Conversation"("architectId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_buyerId_architectId_reason_relatedId_key" ON "Conversation"("buyerId", "architectId", "reason", "relatedId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_BuyerFavorites_AB_unique" ON "_BuyerFavorites"("A", "B");

-- CreateIndex
CREATE INDEX "_BuyerFavorites_B_index" ON "_BuyerFavorites"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Design_slug_key" ON "Design"("slug");

-- CreateIndex
CREATE INDEX "Design_category_idx" ON "Design"("category");

-- CreateIndex
CREATE INDEX "Design_price_idx" ON "Design"("price");

-- CreateIndex
CREATE INDEX "Design_createdAt_idx" ON "Design"("createdAt");

-- CreateIndex
CREATE INDEX "Design_title_idx" ON "Design"("title");

-- CreateIndex
CREATE INDEX "Design_description_idx" ON "Design"("description");

-- CreateIndex
CREATE INDEX "Design_slug_idx" ON "Design"("slug");

-- CreateIndex
CREATE INDEX "Design_title_description_idx" ON "Design"("title", "description");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuyerFavorites" ADD CONSTRAINT "_BuyerFavorites_A_fkey" FOREIGN KEY ("A") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuyerFavorites" ADD CONSTRAINT "_BuyerFavorites_B_fkey" FOREIGN KEY ("B") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
