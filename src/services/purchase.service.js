/**
 * Purchase Service
 * 
 * Handles design purchase logic, license enforcement, and secure downloads.
 * 
 * Core Rules:
 * 1. Only APPROVED or PUBLISHED designs can be purchased
 * 2. Buyer must be authenticated
 * 3. EXCLUSIVE licenses can only be sold once
 * 4. Purchase records are immutable (no updates)
 * 5. Downloads require purchase ownership verification
 * 
 * Security:
 * - Never expose ZIP file URLs directly
 * - Always verify buyer ownership before download
 * - Enforce license type constraints
 */

const { prisma } = require('../lib/prisma.ts');

class PurchaseService {
  /**
   * Create a new purchase
   * 
   * @param {string} buyerId - Buyer's user ID
   * @param {string} designId - Design UUID
   * @returns {Promise<Purchase>} Created purchase record
   * 
   * @throws {Error} If design not APPROVED or PUBLISHED
   * @throws {Error} If design already sold exclusively
   * @throws {Error} If buyer already purchased design
   */
  async createPurchase(buyerId, designId) {
    // 1. Fetch design with license info
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    // 2. Validate design exists and is APPROVED or PUBLISHED
    if (!design) {
      throw new Error('Design not found');
    }

    // Allow purchases for both APPROVED and PUBLISHED designs
    // (PUBLISHED is used when AUTO_PUBLISH=true)
    if (!['APPROVED', 'PUBLISHED'].includes(design.status)) {
      throw new Error('Design not available for purchase. Only approved/published designs can be purchased.');
    }

    // 3. EXCLUSIVE LICENSE ENFORCEMENT
    // If design is exclusive, check if already sold
    if (design.licenseType === 'EXCLUSIVE') {
      const existingPurchase = await prisma.purchase.findFirst({
        where: { designId },
      });

      if (existingPurchase) {
        throw new Error('Design already sold exclusively. Exclusive licenses can only be sold once.');
      }
    }

    // 4. Check if buyer already purchased this design
    const alreadyPurchased = await prisma.purchase.findFirst({
      where: {
        buyerId,
        designId,
      },
    });

    if (alreadyPurchased) {
      throw new Error('You have already purchased this design.');
    }

    // 5. Determine price based on license type
    const pricePaid = design.licenseType === 'EXCLUSIVE' && design.exclusivePrice
      ? design.exclusivePrice
      : design.standardPrice || 0;

    // 6. Create purchase record
    const purchase = await prisma.purchase.create({
      data: {
        buyerId,
        designId,
        price: pricePaid,
      },
      include: {
        design: {
          select: {
            id: true,
            slug: true,
            title: true,
            licenseType: true,
            standardPrice: true,
            exclusivePrice: true,
            architect: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    console.log(`[Purchase] Created purchase ${purchase.id} - Buyer ${buyerId} purchased design ${designId} for $${pricePaid}`);

    // 7. TODO: Create license record (Step 4.5)
    // 8. TODO: Create transaction record (Step 4.5)
    // 9. TODO: Create architect earning record (Step 5)
    // 10. TODO: Send confirmation email (Step 6)

    return purchase;
  }

  /**
   * Get buyer's purchase history
   * 
   * @param {string} buyerId - Buyer's user ID
   * @param {object} options - Query options
   * @returns {Promise<{purchases: Purchase[], total: number}>}
   */
  async getBuyerPurchases(buyerId, options = {}) {
    const { page = 1, limit = 20 } = options;

    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where: { buyerId },
        include: {
          design: {
            select: {
              id: true,
              slug: true,
              title: true,
              shortSummary: true,
              category: true,
              licenseType: true,
              files: {
                where: {
                  fileType: 'PREVIEW_IMAGE',
                },
                select: {
                  storageKey: true,
                  displayOrder: true,
                },
                orderBy: {
                  displayOrder: 'asc',
                },
                take: 1,
              },
              architect: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.purchase.count({
        where: { buyerId },
      }),
    ]);

    return {
      purchases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single purchase by ID
   * 
   * @param {string} purchaseId - Purchase UUID
   * @param {string} buyerId - Buyer's user ID (for ownership verification)
   * @returns {Promise<Purchase>}
   * 
   * @throws {Error} If purchase not found or buyer doesn't own it
   */
  async getPurchase(purchaseId, buyerId) {
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        buyerId,
      },
      include: {
        design: {
          select: {
            id: true,
            slug: true,
            title: true,
            shortSummary: true,
            description: true,
            category: true,
            style: true,
            licenseType: true,
            totalArea: true,
            areaUnit: true,
            floors: true,
            bedrooms: true,
            bathrooms: true,
            parkingSpaces: true,
            designStage: true,
            files: {
              select: {
                id: true,
                fileType: true,
                originalFileName: true,
                storageKey: true,
                fileSize: true,
                displayOrder: true,
              },
              orderBy: {
                displayOrder: 'asc',
              },
            },
            architect: {
              select: {
                id: true,
                displayName: true,
                company: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      throw new Error('Purchase not found or you do not have permission to access it');
    }

    return purchase;
  }

  /**
   * Get download URL for purchased design
   * 
   * SECURITY CRITICAL:
   * - Verifies buyer owns the purchase
   * - Only returns MAIN_PACKAGE file
   * - Never exposes direct file paths
   * 
   * @param {string} purchaseId - Purchase UUID
   * @param {string} buyerId - Buyer's user ID
   * @returns {Promise<{fileUrl: string, fileName: string, fileSize: number}>}
   * 
   * @throws {Error} If purchase not found or not owned by buyer
   * @throws {Error} If design file not found
   */
  async getDownloadUrl(purchaseId, buyerId) {
    // 1. Verify purchase ownership
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        buyerId,
      },
      include: {
        design: {
          select: {
            id: true,
            title: true,
            status: true,
            files: {
              where: {
                fileType: 'MAIN_PACKAGE',
              },
              select: {
                id: true,
                originalFileName: true,
                storageKey: true,
                fileSize: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });

    // 2. Verify purchase exists and buyer owns it
    if (!purchase) {
      throw new Error('Purchase not found or you do not have permission to download this design');
    }

    // 3. Find main package file (ZIP)
    const mainPackage = purchase.design.files.find(f => f.fileType === 'MAIN_PACKAGE');

    if (!mainPackage) {
      throw new Error('Design file not found. Please contact support.');
    }

    // 4. Return file information
    // NOTE: In production, replace storageKey with signed S3 URL (15-minute expiry)
    return {
      fileUrl: mainPackage.storageKey,
      fileName: mainPackage.originalFileName,
      fileSize: mainPackage.fileSize,
      mimeType: mainPackage.mimeType,
    };
  }

  /**
   * Check if buyer has already purchased a design
   * 
   * @param {string} buyerId - Buyer's user ID
   * @param {string} designId - Design UUID
   * @returns {Promise<boolean>}
   */
  async hasPurchased(buyerId, designId) {
    const purchase = await prisma.purchase.findFirst({
      where: {
        buyerId,
        designId,
      },
    });

    return !!purchase;
  }

  /**
   * Get purchase statistics for a buyer
   * 
   * @param {string} buyerId - Buyer's user ID
   * @returns {Promise<object>} Purchase statistics
   */
  async getBuyerStats(buyerId) {
    const [totalPurchases, totalSpent, recentPurchases] = await Promise.all([
      prisma.purchase.count({
        where: { buyerId },
      }),
      prisma.purchase.aggregate({
        where: { buyerId },
        _sum: {
          price: true,
        },
      }),
      prisma.purchase.findMany({
        where: { buyerId },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          design: {
            select: {
              title: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    return {
      totalPurchases,
      totalSpent: totalSpent._sum.price || 0,
      recentPurchases,
    };
  }

  /**
   * Verify if a design is available for purchase
   * 
   * @param {string} designId - Design UUID
   * @returns {Promise<{available: boolean, reason?: string}>}
   */
  async checkAvailability(designId) {
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: {
        status: true,
        licenseType: true,
      },
    });

    if (!design) {
      return { available: false, reason: 'Design not found' };
    }

    // Allow purchases for both APPROVED and PUBLISHED designs
    // (PUBLISHED is used when AUTO_PUBLISH=true)
    if (!['APPROVED', 'PUBLISHED'].includes(design.status)) {
      return { available: false, reason: 'Design not approved for sale' };
    }

    // Check if exclusive license already sold
    if (design.licenseType === 'EXCLUSIVE') {
      const existingPurchase = await prisma.purchase.findFirst({
        where: { designId },
      });

      if (existingPurchase) {
        return { available: false, reason: 'Design sold exclusively to another buyer' };
      }
    }

    return { available: true };
  }
}

module.exports = new PurchaseService();
