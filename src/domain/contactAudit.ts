import { prisma } from "../lib/prisma";
import { logMessagingEvent } from "../shared/services/audit.service";

export const logContactUnlock = async ({
  designId,
  buyerId,
  architectId
}: {
  designId: string;
  buyerId: string;
  architectId: string;
}) => {
  // Create the contact unlock event
  await prisma.contactUnlockEvent.create({
    data: {
      designId,
      buyerId,
      architectId,
      reason: "EXCLUSIVE_PURCHASE"
    }
  });

  // Log the audit event
  await logMessagingEvent(
    buyerId, // The buyer "unlocked" contact, even though it's triggered by purchase
    'CONTACT_UNLOCK',
    designId,
    {
      reason: 'EXCLUSIVE_PURCHASE',
      architectId,
      buyerId
    }
  );
};