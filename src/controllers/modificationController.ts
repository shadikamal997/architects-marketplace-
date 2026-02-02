import { Request, Response } from 'express';
import { prisma } from "../lib/prisma";
import { assertModificationAllowed } from "../domain/modificationAssertions";
import { canTransition } from "../domain/modificationRules";
import { canActorChangeStatus } from "../domain/modificationPermissions";
import { containsContactInfo } from "../domain/messageFilter";
import { canAccessDirectContact } from "../domain/contactAccess";
import { LicenseType } from "@prisma/client";
import { paymentService } from "../shared/services/payment.service";

export const createModificationRequest = async (req: Request, res: Response) => {
  const { designId, description, scopeTags } = req.body;
  const user = (req as any).user; // injected by auth middleware

  // 1. Verify buyer owns a license and get design info
  const license = await prisma.license.findFirst({
    where: { designId, buyerId: user.id },
    include: { design: { include: { architect: true } } }
  });

  if (!license) {
    return res.status(403).json({ error: "You do not own this design" });
  }

  // 2. Assert rules (default to STANDARD license type)
  assertModificationAllowed(LicenseType.STANDARD, "BUYER", "REQUEST");

  // 3. Check for contact info in description (only if user doesn't have direct contact access)
  const hasDirectContactAccess = canAccessDirectContact({
    licenseType: LicenseType.STANDARD, // For now, all are STANDARD
    exclusivePaid: false // No EXCLUSIVE licenses implemented yet
  });

  if (!hasDirectContactAccess && containsContactInfo(description)) {
    return res.status(400).json({
      error: "Sharing contact details is not allowed for this license type"
    });
  }

  // 4. Create request
  const request = await prisma.modificationRequest.create({
    data: {
      designId,
      buyerId: user.id,
      architectId: license.design.architect.id,
      licenseType: LicenseType.STANDARD,
      description,
      scopeTags
    }
  });

  res.json(request);
};

export const priceModification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { proposedPrice, deliveryTimeDays, revisionsIncluded } = req.body;
  const user = (req as any).user;

  const request = await prisma.modificationRequest.findUnique({ where: { id: id as string } });

  if (!request || request.architectId !== user.id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (
    !canActorChangeStatus("ARCHITECT", "PRICED") ||
    !canTransition(request.status, "PRICED")
  ) {
    return res.status(400).json({ error: "Invalid state transition" });
  }

  const updated = await prisma.modificationRequest.update({
    where: { id: id as string },
    data: {
      proposedPrice,
      deliveryTimeDays,
      revisionsIncluded,
      status: "PRICED"
    }
  });

  res.json(updated);
};

export const acceptModification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const request = await prisma.modificationRequest.findUnique({ where: { id: id as string } });

  if (!request || request.buyerId !== user.id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (
    !canActorChangeStatus("BUYER", "ACCEPTED") ||
    !canTransition(request.status, "ACCEPTED")
  ) {
    return res.status(400).json({ error: "Invalid state transition" });
  }

  const updated = await prisma.modificationRequest.update({
    where: { id: id as string },
    data: { status: "ACCEPTED" }
  });

  res.json(updated);
};

export const completeModification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const request = await prisma.modificationRequest.findUnique({
    where: { id: id as string },
    include: {
      design: {
        include: {
          architect: true
        }
      }
    }
  });

  if (!request || request.architectId !== user.id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (
    !canActorChangeStatus("ARCHITECT", "COMPLETED") ||
    !canTransition(request.status, "COMPLETED")
  ) {
    return res.status(400).json({ error: "Invalid state transition" });
  }

  // Update modification status
  const updated = await prisma.modificationRequest.update({
    where: { id: id as string },
    data: { status: "COMPLETED" }
  });

  // TEMPORARY: Disable automatic payouts until Stripe Connect is implemented
  // TODO: Re-enable modification payouts after architect onboarding is complete
  try {
    // Find the earning record for this modification
    const earning = await prisma.architectEarning.findFirst({
      where: {
        architectId: request.architectId,
        transaction: {
          modificationId: request.id
        },
        status: 'PENDING'
      },
      include: {
        transaction: true
      }
    });

    if (earning) {
      // TEMPORARY: Keep earnings as PENDING until Stripe Connect is set up
      console.log(`Modification completed - earnings recorded as PENDING for architect ${request.architectId} (Stripe Connect not yet implemented)`);

      // Note: In the future, this will check if architect has payouts enabled and execute payout
      // if (!request.design.architect.payoutsEnabled || !request.design.architect.stripeAccountId) {
      //   console.log(`Architect ${request.architectId} not ready for payouts - holding modification earnings`);
      // } else {
      //   // Execute payout...
      // }
    }
  } catch (payoutError) {
    console.error('Modification payout processing error:', payoutError);
    // Don't fail the completion, just log the error
  }

  res.json(updated);
};