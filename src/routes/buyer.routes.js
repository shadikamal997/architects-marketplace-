const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');
const { prisma } = require('../lib/prisma.ts');

const router = express.Router();

// All buyer routes require authentication and BUYER role
router.use(requireAuth);
router.use(requireRole('BUYER'));

/**
 * GET /buyer/overview
 * Get buyer dashboard overview (STEP 1)
 * 
 * Read-only data from existing purchases:
 * - totalPurchases: Count of all purchases
 * - totalSpend: Sum of all purchase amounts
 * - recentPurchases: Last 5 purchases with design info
 * 
 * Safe, no money movement, no schema changes
 */
router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch buyer record
    const buyer = await prisma.buyer.findUnique({
      where: { userId: userId },
    });

    if (!buyer) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Buyer profile not found',
      });
    }

    // Fetch purchases with design info
    const purchases = await prisma.purchase.findMany({
      where: { buyerId: buyer.id },
      select: {
        id: true,
        price: true,
        createdAt: true,
        design: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Calculate totals
    const totalPurchases = purchases.length;
    const totalSpend = purchases.reduce(
      (sum, p) => sum + Number(p.price),
      0
    );

    // Format recent purchases for response
    const recentPurchases = purchases.map(p => ({
      id: p.id,
      designId: p.design.id,
      title: p.design.title,
      slug: p.design.slug,
      pricePaid: Number(p.price),
      createdAt: p.createdAt,
    }));

    return ok(res, {
      totalPurchases,
      totalSpend,
      recentPurchases,
    });

  } catch (error) {
    console.error('[Buyer] Get overview error:', error);
    return serverError(res, 'Failed to fetch buyer overview');
  }
});

/**
 * POST /buyer/purchases
 * Create new purchase (STEP 2)
 * 
 * Creates real purchase record for buyer to own design.
 * 
 * Security:
 * - Buyer must be authenticated (requireAuth)
 * - Design must be APPROVED (PUBLISHED)
 * - No duplicate purchases allowed (STANDARD license)
 * 
 * Flow:
 * 1. Validate design exists and is purchasable
 * 2. Check for duplicate purchase
 * 3. Create Purchase record
 * 4. Architect earnings auto-update (via relation)
 * 
 * Note: Payment processing assumed complete (Stripe/mock)
 */
router.post('/purchases', async (req, res) => {
  try {
    const { designId } = req.body;
    const userId = req.user.id;

    // 1. Validate required fields
    if (!designId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'designId is required',
      });
    }

    // 2. Fetch buyer record
    const buyer = await prisma.buyer.findUnique({
      where: { userId: userId },
    });

    if (!buyer) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Buyer profile not found',
      });
    }

    // 3. Verify design exists and is purchasable
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        licenseType: true,
        standardPrice: true,
        exclusivePrice: true,
        architectId: true,
      },
    });

    if (!design) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found',
      });
    }

    // 4. Verify design is APPROVED (published/available)
    if (design.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Not available',
        message: 'Design is not available for purchase',
        currentStatus: design.status,
      });
    }

    // 5. Check for duplicate purchase (STANDARD license)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        buyerId: buyer.id,
        designId: designId,
      },
    });

    if (existingPurchase) {
      return res.status(400).json({
        error: 'Already purchased',
        message: 'You have already purchased this design',
        purchaseId: existingPurchase.id,
      });
    }

    // 6. Determine price (standard license for now)
    const pricePaid = Number(design.standardPrice);

    if (pricePaid <= 0) {
      return res.status(400).json({
        error: 'Invalid price',
        message: 'Design price is not set correctly',
      });
    }

    // 7. Create purchase record
    const purchase = await prisma.purchase.create({
      data: {
        buyerId: buyer.id,
        designId: design.id,
        price: pricePaid,
        licenseType: 'STANDARD', // Future: support EXCLUSIVE
        status: 'COMPLETED', // Payment assumed complete
      },
      include: {
        design: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // 8. Return success
    return ok(res, {
      success: true,
      message: 'Purchase completed successfully',
      purchase: {
        id: purchase.id,
        designId: purchase.design.id,
        designTitle: purchase.design.title,
        designSlug: purchase.design.slug,
        pricePaid: Number(purchase.price),
        licenseType: purchase.licenseType,
        status: purchase.status,
        createdAt: purchase.createdAt,
      },
    }, 201);

  } catch (error) {
    console.error('[Buyer] Create purchase error:', error);
    return serverError(res, 'Failed to create purchase');
  }
});

/**
 * GET /buyer/purchases
 * List buyer's purchase history (STEP 2)
 * 
 * Returns real purchase records with design info.
 * Used by buyer dashboard and purchase history page.
 */
router.get('/purchases', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    // Fetch buyer record
    const buyer = await prisma.buyer.findUnique({
      where: { userId: userId },
    });

    if (!buyer) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Buyer profile not found',
      });
    }

    // Fetch purchases with design and architect info
    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where: { buyerId: buyer.id },
        include: {
          design: {
            select: {
              id: true,
              title: true,
              slug: true,
              architect: {
                select: {
                  displayName: true,
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.purchase.count({
        where: { buyerId: buyer.id },
      }),
    ]);

    // Format response
    const formattedPurchases = purchases.map(p => ({
      id: p.id,
      designId: p.design.id,
      designTitle: p.design.title,
      designSlug: p.design.slug,
      architectName: p.design.architect.displayName || p.design.architect.user.email.split('@')[0],
      pricePaid: Number(p.price),
      licenseType: p.licenseType,
      status: p.status,
      createdAt: p.createdAt,
    }));

    return ok(res, {
      purchases: formattedPurchases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('[Buyer] List purchases error:', error);
    return serverError(res, 'Failed to fetch purchases');
  }
});

/**
 * GET /buyer/transactions
 * Alias for /buyer/purchases
 */
router.get('/transactions', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;

    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      transactions: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
  } catch (error) {
    console.error('[Buyer] List transactions error:', error);
    return serverError(res, 'Failed to fetch transactions');
  }
});

/**
 * GET /buyer/library
 * List buyer's licensed designs
 * Alias: GET /buyer/licenses
 */
router.get('/library', async (req, res) => {
  try {
    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      licenses: []
    });
  } catch (error) {
    console.error('[Buyer] Get library error:', error);
    return serverError(res, 'Failed to fetch library');
  }
});

/**
 * GET /buyer/licenses
 * Alias for /buyer/library
 */
router.get('/licenses', async (req, res) => {
  try {
    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      licenses: []
    });
  } catch (error) {
    console.error('[Buyer] Get licenses error:', error);
    return serverError(res, 'Failed to fetch licenses');
  }
});

/**
 * POST /buyer/favorites/:designId
 * Add design to favorites
 */
router.post('/favorites/:designId', async (req, res) => {
  try {
    const { designId } = req.params;

    // STEP 3: Placeholder response - Replace with DB insert later
    return ok(res, {
      favorite: {
        id: `fav-${Date.now()}`,
        designId,
        buyerId: req.user.id,
        createdAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Buyer] Add favorite error:', error);
    return serverError(res, 'Failed to add favorite');
  }
});

/**
 * DELETE /buyer/favorites/:designId
 * Remove design from favorites
 */
router.delete('/favorites/:designId', async (req, res) => {
  try {
    const { designId } = req.params;

    // STEP 3: Placeholder response - Replace with DB delete later
    return ok(res, {
      message: 'Favorite removed successfully',
      designId
    });
  } catch (error) {
    console.error('[Buyer] Remove favorite error:', error);
    return serverError(res, 'Failed to remove favorite');
  }
});

/**
 * GET /buyer/favorites
 * List buyer's favorite designs
 */
router.get('/favorites', async (req, res) => {
  try {
    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      favorites: []
    });
  } catch (error) {
    console.error('[Buyer] List favorites error:', error);
    return serverError(res, 'Failed to fetch favorites');
  }
});

module.exports = router;
