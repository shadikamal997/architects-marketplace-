-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "modificationId" TEXT,
ALTER COLUMN "designId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Transaction_modificationId_idx" ON "Transaction"("modificationId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_modificationId_fkey" FOREIGN KEY ("modificationId") REFERENCES "ModificationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
