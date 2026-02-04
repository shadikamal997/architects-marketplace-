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
 * Create new purchase (initiate transaction)
 * Alias: POST /transactions
 */
router.post('/purchases', async (req, res) => {
  try {
    const { designId, licenseType = 'STANDARD' } = req.body;

    // STEP 3: Placeholder response - Replace with Stripe + DB logic later
    return ok(res, {
      transaction: {
        id: `txn-${Date.now()}`,
        designId: designId || null,
        buyerId: req.user.id,
        licenseType,
        designPriceUsdCents: 5000,
        totalAmountUsdCents: 5000,
        state: 'PENDING',
        paymentIntentId: null,
        createdAt: new Date().toISOString()
      },
      license: {
        id: `lic-${Date.now()}`,
        state: 'ACTIVE',
        downloadCount: 0,
        createdAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Buyer] Create purchase error:', error);
    return serverError(res, 'Failed to create purchase');
  }
});

/**
 * GET /buyer/purchases
 * List buyer's purchase history
 * Alias: GET /buyer/transactions
 */
router.get('/purchases', async (req, res) => {
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
