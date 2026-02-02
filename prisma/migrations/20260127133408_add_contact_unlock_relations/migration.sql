-- AddForeignKey
ALTER TABLE "ContactUnlockEvent" ADD CONSTRAINT "ContactUnlockEvent_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactUnlockEvent" ADD CONSTRAINT "ContactUnlockEvent_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactUnlockEvent" ADD CONSTRAINT "ContactUnlockEvent_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
