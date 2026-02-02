-- CreateTable
CREATE TABLE "PayoutBank" (
    "id" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "iban" TEXT,
    "routingNumber" TEXT,
    "accountNumber" TEXT,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutBank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutBank_architectId_idx" ON "PayoutBank"("architectId");

-- CreateIndex
CREATE INDEX "PayoutBank_verified_idx" ON "PayoutBank"("verified");

-- AddForeignKey
ALTER TABLE "PayoutBank" ADD CONSTRAINT "PayoutBank_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
