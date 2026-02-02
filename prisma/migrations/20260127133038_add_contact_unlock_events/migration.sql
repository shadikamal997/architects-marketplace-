-- CreateTable
CREATE TABLE "ContactUnlockEvent" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactUnlockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactUnlockEvent_designId_idx" ON "ContactUnlockEvent"("designId");

-- CreateIndex
CREATE INDEX "ContactUnlockEvent_buyerId_idx" ON "ContactUnlockEvent"("buyerId");

-- CreateIndex
CREATE INDEX "ContactUnlockEvent_architectId_idx" ON "ContactUnlockEvent"("architectId");
