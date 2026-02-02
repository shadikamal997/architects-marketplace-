import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuthMiddleware } from '../modules/auth/middleware/auth.middleware';
import { requireRole } from '../modules/auth/guards/permission.guard';
import { UserRole } from '../modules/auth/roles.enum';
import { ok, fail } from '../utils/response.js';

const router = Router();

// All buyer routes require authentication and BUYER role
router.use(requireAuthMiddleware);
router.use(requireRole(UserRole.BUYER));

/**
 * GET /buyer/dashboard
 * Get buyer dashboard stats and recent activity
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get basic stats - simplified to avoid potential schema mismatches
    const purchases = await prisma.purchase.findMany({
      where: { buyerId: userId },
      include: { 
        design: {
          include: {
            architect: {
              include: { user: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, p) => sum + Number(p.price || 0), 0);

    // Get recent purchases (last 5)
    const recentPurchases = purchases.slice(0, 5).map(p => ({
      id: p.id,
      designId: p.design.id,
      designTitle: p.design.title,
      price: Number(p.price),
      purchasedAt: p.createdAt,
      architect: {
        name: p.design.architect?.user.name || 'Unknown',
        company: p.design.architect?.company
      }
    }));

    return ok(res, {
      stats: {
        totalPurchases,
        activeLicenses: 0, // Stub for now
        totalSpent
      },
      recentPurchases
    });
  } catch (error) {
    console.error('[Buyer] Get dashboard error:', error);
    return fail(res, 'Failed to fetch dashboard', 500);
  }
});

/**
 * GET /buyer/dashboard/stats
 * Alias for /dashboard - some frontend pages call this variant
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const userId = req.user!.id;

    const purchases = await prisma.purchase.findMany({
      where: { buyerId: userId },
    });

    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, p) => sum + Number(p.price || 0), 0);

    return ok(res, {
      totalPurchases,
      activeLicenses: 0,
      totalSpent
    });
  } catch (error) {
    console.error('[Buyer] Get dashboard stats error:', error);
    return fail(res, 'Failed to fetch stats', 500);
  }
});

/**
 * POST /buyer/purchases
 * Create new purchase (initiate transaction)
 */
router.post('/purchases', async (req, res) => {
  try {
    const { designId, licenseType = 'STANDARD' } = req.body;

    if (!designId) {
      return fail(res, 'designId is required', 400);
    }

    // Check if design exists and is published
    const design = await prisma.design.findFirst({
      where: {
        id: designId,
        status: 'PUBLISHED',
      },
    });

    if (!design) {
      return fail(res, 'Design not found or not available for purchase', 404);
    }

    // Check if buyer already purchased this design
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        buyerId: req.user!.id,
        designId,
      },
    });

    if (existingPurchase) {
      return fail(res, 'You have already purchased this design', 409);
    }

    // Create transaction (mock for now)
    const transaction = await prisma.transaction.create({
      data: {
        buyerId: req.user!.id,
        designId,
        stripeSessionId: `mock_session_${Date.now()}`, // Mock session ID
        amountTotal: Number(design.price) * 100, // Convert dollars to cents
        platformFee: Math.round(Number(design.price) * 100 * 0.1), // 10% platform fee
        architectEarning: Math.round(Number(design.price) * 100 * 0.9), // 90% to architect
        currency: 'USD',
        status: 'PENDING',
      },
    });

    // Create license
    const license = await prisma.license.create({
      data: {
        buyerId: req.user!.id,
        designId,
        transactionId: transaction.id,
        licenseType: licenseType as any,
        status: 'ACTIVE',
      },
    });

    return ok(res, {
      transaction: {
        id: transaction.id,
        designId,
        buyerId: req.user!.id,
        licenseType,
        designPriceUsdCents: Math.round(design.price.toNumber() * 100),
        totalAmountUsdCents: Math.round(design.price.toNumber() * 100),
        state: transaction.status,
        paymentIntentId: null,
        createdAt: transaction.createdAt,
      },
      license: {
        id: license.id,
        state: license.status,
        createdAt: license.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('[Buyer] Create purchase error:', error);
    return fail(res, 'Failed to create purchase', 500);
  }
});

/**
 * GET /buyer/purchases
 * List buyer's purchase history
 */
router.get('/purchases', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {
      buyerId: req.user!.id,
    };

    if (state) {
      where.status = state;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          design: {
            select: {
              id: true,
              title: true,
              slug: true,
              architect: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return ok(res, {
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[Buyer] List purchases error:', error);
    return fail(res, 'Failed to fetch purchases', 500);
  }
});

/**
 * GET /buyer/library
 * List buyer's licensed designs
 */
router.get('/library', async (req, res) => {
  try {
    const licenses = await prisma.license.findMany({
      where: {
        buyerId: req.user!.id,
        status: 'ACTIVE',
      },
      include: {
        design: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            category: true,
            architect: {
              select: {
                displayName: true,
              },
            },
            files: {
              where: { fileType: 'PREVIEW_IMAGE' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, { licenses });
  } catch (error) {
    console.error('[Buyer] Get library error:', error);
    return fail(res, 'Failed to fetch library', 500);
  }
});

/**
 * POST /buyer/favorites/:designId
 * Add design to favorites
 */
router.post('/favorites/:designId', async (req, res) => {
  try {
    const { designId } = req.params;

    // Check if design exists and is published
    const design = await prisma.design.findFirst({
      where: {
        id: designId,
        status: 'PUBLISHED',
      },
    });

    if (!design) {
      return fail(res, 'Design not found or not available', 404);
    }

    // Check if already favorited
    const existingFavorite = await prisma.buyer.findFirst({
      where: {
        id: req.user!.id,
        favorites: {
          some: { id: designId },
        },
      },
    });

    if (existingFavorite) {
      return fail(res, 'Design already in favorites', 409);
    }

    // Add to favorites (update buyer record)
    await prisma.buyer.update({
      where: { id: req.user!.id },
      data: {
        favorites: {
          connect: { id: designId },
        },
      },
    });

    return ok(res, {
      favorite: {
        id: `fav-${Date.now()}`,
        designId,
        buyerId: req.user!.id,
        createdAt: new Date(),
      },
    }, 201);
  } catch (error) {
    console.error('[Buyer] Add favorite error:', error);
    return fail(res, 'Failed to add favorite', 500);
  }
});

/**
 * DELETE /buyer/favorites/:designId
 * Remove design from favorites
 */
router.delete('/favorites/:designId', async (req, res) => {
  try {
    const { designId } = req.params;

    // Check if design exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    // Remove from favorites
    await prisma.buyer.update({
      where: { id: req.user!.id },
      data: {
        favorites: {
          disconnect: { id: designId },
        },
      },
    });

    return ok(res, {
      message: 'Favorite removed successfully',
      designId,
    });
  } catch (error) {
    console.error('[Buyer] Remove favorite error:', error);
    return fail(res, 'Failed to remove favorite', 500);
  }
});

/**
 * GET /buyer/favorites
 * List buyer's favorite designs
 */
router.get('/favorites', async (req, res) => {
  try {
    const buyer = await prisma.buyer.findUnique({
      where: { id: req.user!.id },
      include: {
        favorites: {
          where: { status: 'PUBLISHED' },
          include: {
            architect: {
              select: {
                displayName: true,
              },
            },
            files: {
              where: { fileType: 'PREVIEW_IMAGE' },
              take: 1,
            },
          },
        },
      },
    });

    if (!buyer) {
      // Return empty favorites if buyer profile doesn't exist yet
      return ok(res, {
        favorites: [],
      });
    }

    return ok(res, {
      favorites: (buyer as any).favorites,
    });
  } catch (error) {
    console.error('[Buyer] List favorites error:', error);
    return fail(res, 'Failed to fetch favorites', 500);
  }
});

/**
 * GET /buyer/account
 * Get buyer account information
 */
router.get('/account', async (req, res) => {
  try {
    const buyer = await prisma.buyer.findUnique({
      where: { id: req.user!.id },
      include: { user: true },
    });

    if (!buyer) {
      return fail(res, 'Buyer not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: buyer.userId },
      include: {
        buyer: true,
      },
    });

    if (!user) {
      return fail(res, 'User account not found', 404);
    }

    return ok(res, {
      buyer: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          kycStatus: 'VERIFIED', // Mock for now
        },
        buyer: user.buyer || null,
      },
    });
  } catch (error) {
    console.error('[Buyer] Get account error:', error);
    return fail(res, 'Failed to fetch account', 500);
  }
});

/**
 * GET /buyer/transactions
 * Alias for /purchases - frontend sometimes calls this endpoint
 */
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const transactions = await prisma.transaction.findMany({
      where: { buyerId: req.user!.id },
      take: limitNum,
      skip: (pageNum - 1) * limitNum,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.transaction.count({
      where: { buyerId: req.user!.id },
    });

    return ok(res, {
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[Buyer] Get transactions error:', error);
    return fail(res, 'Failed to fetch transactions', 500);
  }
});

/**
 * GET /buyer/licenses
 * Get buyer licenses
 * TEMP: Returns empty licenses until Stripe + license logic is finalized
 */
router.get('/licenses', async (req, res) => {
  try {
    // TEMP: return empty licenses until Stripe + license logic is finalized
    return res.status(200).json({
      success: true,
      licenses: [],
    });
  } catch (error) {
    console.error('Error fetching buyer licenses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load licenses',
    });
  }
});

/**
 * GET /buyer/messages
 * Get buyer messages/conversations (stub endpoint)
 */
router.get('/messages', async (req, res) => {
  try {
    // Stub: return empty conversations array
    return ok(res, {
      conversations: [],
    });
  } catch (error) {
    console.error('[Buyer] Get messages error:', error);
    return fail(res, 'Failed to fetch messages', 500);
  }
});

export default router;