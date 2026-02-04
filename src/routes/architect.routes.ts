import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuthMiddleware } from '../modules/auth/middleware/auth.middleware';
import { requireRole } from '../modules/auth/guards/permission.guard';
import { UserRole } from '../modules/auth/roles.enum';
import { ok, fail } from '../utils/response.js';
import { AuthenticatedRequest } from '../modules/auth/authenticated-request';

const router = Router();

// All architect routes require authentication and ARCHITECT role
router.use(requireAuthMiddleware);
router.use(requireRole(UserRole.ARCHITECT));

/**
 * GET /architect/debug
 * Debug endpoint to check auth state
 */
router.get('/debug', async (req, res) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    console.log('[DEBUG] Full req.user:', JSON.stringify(authReq.user, null, 2));
    
    // Try to find user and architect
    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.userId },
      include: { architect: true, buyer: true },
    });

    return ok(res, {
      reqUser: authReq.user,
      dbUser: user,
      hasArchitect: !!user?.architect,
      architectId: user?.architect?.id,
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return fail(res, String(error), 500);
  }
});

/**
 * GET /architect/dashboard
 * Get architect dashboard statistics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const architectId = req.user!.id;

    // Get counts of designs by status
    const [designs, earnings] = await Promise.all([
      prisma.design.findMany({
        where: { architectId },
        select: { status: true, price: true },
      }),
      prisma.design.aggregate({
        where: {
          architectId,
          status: 'PUBLISHED',
        },
        _sum: { price: true },
      }),
    ]);

    const totalDesigns = designs.length;
    const publishedDesigns = designs.filter(d => d.status === 'PUBLISHED').length;
    const draftDesigns = designs.filter(d => d.status === 'DRAFT').length;
    const submittedDesigns = designs.filter(d => d.status === 'SUBMITTED').length;

    return ok(res, {
      totalDesigns,
      publishedDesigns,
      draftDesigns,
      submittedDesigns,
      earnings: Number(earnings._sum.price || 0),
      pendingPayouts: 0, // Stub for now
    });
  } catch (error) {
    console.error('[Architect] Get dashboard error:', error);
    return fail(res, 'Failed to fetch dashboard', 500);
  }
});

/**
 * POST /architect/designs
 * Create new design (DRAFT state)
 */
router.post('/designs', async (req, res) => {
  try {
    const { title, description, category, priceUsdCents } = req.body;

    if (!title || !description || !category || priceUsdCents === undefined) {
      return fail(res, 'Missing required fields: title, description, category, priceUsdCents', 400);
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const design = await prisma.design.create({
      data: {
        title,
        slug,
        description,
        category,
        price: priceUsdCents / 100, // Convert cents to dollars for Decimal field
        status: 'DRAFT',
        architectId: req.user!.id,
      },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
        files: true,
      },
    });

    return ok(res, { design }, 201);
  } catch (error) {
    console.error('[Architect] Create design error:', error);
    return fail(res, 'Failed to create design', 500);
  }
});

/**
 * GET /architect/designs
 * List architect's own designs with stats
 */
router.get('/designs', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {
      architectId: req.user!.id,
    };

    if (state) {
      where.status = state;
    }

    const [designs, stats] = await Promise.all([
      prisma.design.findMany({
        where,
        include: {
          files: {
            select: {
              id: true,
              fileType: true,
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.design.groupBy({
        by: ['status'],
        where: { architectId: req.user!.id },
        _count: true,
      }),
    ]);

    const statsObj = stats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count;
      return acc;
    }, {} as any);

    const total = await prisma.design.count({ where });

    return ok(res, {
      designs,
      stats: {
        total: stats.reduce((sum, stat) => sum + stat._count, 0),
        draft: statsObj.draft || 0,
        submitted: statsObj.submitted || 0,
        approved: statsObj.approved || 0,
        published: statsObj.published || 0,
        rejected: statsObj.rejected || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[Architect] List designs error:', error);
    return fail(res, 'Failed to fetch designs', 500);
  }
});

/**
 * GET /architect/designs/:id
 * Get single design (must be owner)
 */
router.get('/designs/:id', async (req, res) => {
  try {
    const { id: designId } = req.params;

    const design = await prisma.design.findFirst({
      where: {
        id: designId,
        architectId: req.user!.id,
      },
      include: {
        files: true,
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    return ok(res, { design });
  } catch (error) {
    console.error('[Architect] Get design error:', error);
    return fail(res, 'Failed to fetch design', 500);
  }
});

/**
 * PUT /architect/designs/:id
 * Update design (DRAFT only)
 */
router.put('/designs/:id', async (req, res) => {
  try {
    const { id: designId } = req.params;
    const { title, description, category, price } = req.body;

    // Check if design exists and is owned by user and is DRAFT
    const existingDesign = await prisma.design.findFirst({
      where: {
        id: designId,
        architectId: req.user!.id,
      },
    });

    if (!existingDesign) {
      return fail(res, 'Design not found', 404);
    }

    if (existingDesign.status !== 'DRAFT') {
      return fail(res, 'Can only edit designs in DRAFT status', 400);
    }

    const updateData: any = {};
    if (title !== undefined) {
      updateData.title = title;
      updateData.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = price / 100; // Convert cents to dollars

    const design = await prisma.design.update({
      where: { id: designId },
      data: updateData,
      include: {
        files: true,
      },
    });

    return ok(res, { design });
  } catch (error) {
    console.error('[Architect] Update design error:', error);
    return fail(res, 'Failed to update design', 500);
  }
});

/**
 * DELETE /architect/designs/:id
 * Delete design (DRAFT only)
 */
router.delete('/designs/:id', async (req, res) => {
  try {
    const { id: designId } = req.params;

    // Check if design exists and is owned by user and is DRAFT
    const existingDesign = await prisma.design.findFirst({
      where: {
        id: designId,
        architectId: req.user!.id,
      },
    });

    if (!existingDesign) {
      return fail(res, 'Design not found', 404);
    }

    if (existingDesign.status !== 'DRAFT') {
      return fail(res, 'Can only delete designs in DRAFT status', 400);
    }

    await prisma.design.delete({
      where: { id: designId },
    });

    return ok(res, { message: 'Design deleted successfully', id: designId });
  } catch (error) {
    console.error('[Architect] Delete design error:', error);
    return fail(res, 'Failed to delete design', 500);
  }
});

/**
 * POST /architect/designs/:id/submit
 * Submit design for admin review (DRAFT → SUBMITTED)
 */
router.post('/designs/:id/submit', async (req, res) => {
  try {
    const { id: designId } = req.params;

    // Check if design exists and is owned by user and is DRAFT
    const existingDesign = await prisma.design.findFirst({
      where: {
        id: designId,
        architectId: req.user!.id,
      },
      include: {
        files: true,
      },
    });

    if (!existingDesign) {
      return fail(res, 'Design not found', 404);
    }

    if (existingDesign.status !== 'DRAFT') {
      return fail(res, 'Can only submit designs in DRAFT status', 400);
    }

    // Check if design has at least one file
    if (existingDesign.files.length === 0) {
      return fail(res, 'Design must have at least one file before submission', 400);
    }

    const design = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'SUBMITTED',
      },
    });

    return ok(res, { design });
  } catch (error) {
    console.error('[Architect] Submit design error:', error);
    return fail(res, 'Failed to submit design', 500);
  }
});

/**
 * GET /architect/earnings
 * Get architect's earnings summary
 */
router.get('/earnings', async (req, res) => {
  try {
    const earnings = await prisma.architectEarning.findMany({
      where: { architectId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const summary = earnings.reduce(
      (acc, earning) => {
        acc.totalEarnings += earning.amount;
        if (earning.status === 'PENDING') {
          acc.totalPending += earning.amount;
        } else if (earning.status === 'PAID') {
          acc.totalPaid += earning.amount;
        }
        return acc;
      },
      { totalEarnings: 0, totalPending: 0, totalPaid: 0 }
    );

    return ok(res, {
      earnings,
      summary,
    });
  } catch (error) {
    console.error('[Architect] Get earnings error:', error);
    return fail(res, 'Failed to fetch earnings', 500);
  }
});

/**
 * GET /architect/account
 * Get architect account data (stub endpoint)
 */
router.get('/account', async (req, res) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    console.log('[Architect Account] req.user:', authReq.user);
    console.log('[Architect Account] Looking for architectId:', authReq.user!.id);
    
    // req.user!.id is architectId (roleEntityId), need to find architect directly
    let architect = await prisma.architect.findUnique({
      where: { id: authReq.user!.id },
      include: {
        user: true,
        payoutBanks: true,
      },
    });

    // Fallback: If architect not found by architectId, try finding by userId
    if (!architect && authReq.user!.userId) {
      console.log('[Architect Account] Architect not found by architectId, trying userId:', authReq.user!.userId);
      const user = await prisma.user.findUnique({
        where: { id: authReq.user!.userId },
        include: {
          architect: {
            include: {
              user: true,
              payoutBanks: true,
            },
          },
        },
      });
      architect = user?.architect || null;
    }

    if (!architect) {
      console.error('[Architect Account] Architect not found with id:', req.user!.id);
      console.error('[Architect Account] Full req.user:', JSON.stringify(req.user, null, 2));
      return fail(res, 'Architect account not found. Please log out and log back in.', 404);
    }

    return ok(res, {
      architect: {
        id: architect.id,
        displayName: architect.displayName,
        company: architect.company,
        bio: architect.bio,
        payoutBanks: architect.payoutBanks || [],
        user: {
          id: architect.user.id,
          email: architect.user.email,
          name: architect.user.name,
          createdAt: architect.user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('[Architect] Get account error:', error);
    return fail(res, 'Failed to fetch account', 500);
  }
});

/**
 * PUT /architect/account
 * Update architect account settings
 */
router.put('/account', async (req, res) => {
  try {
    const architectId = req.user!.id;
    const updates = req.body;

    // Get architect to find userId
    const architect = await prisma.architect.findUnique({
      where: { id: architectId },
      select: { userId: true },
    });

    if (!architect) {
      return fail(res, 'Architect not found', 404);
    }

    // Update user data if provided
    if (updates.name || updates.email) {
      await prisma.user.update({
        where: { id: architect.userId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.email && { email: updates.email }),
        },
      });
    }

    // Update architect profile if provided
    if (updates.displayName || updates.company || updates.bio) {
      await prisma.architect.update({
        where: { id: architectId },
        data: {
          ...(updates.displayName && { displayName: updates.displayName }),
          ...(updates.company && { company: updates.company }),
          ...(updates.bio && { bio: updates.bio }),
        },
      });
    }

    return ok(res, {
      message: 'Account updated successfully',
    });
  } catch (error) {
    console.error('[Architect] Update account error:', error);
    return fail(res, 'Failed to update account', 500);
  }
});

/**
 * GET /architect/payouts
 * Get architect payouts (stub endpoint)
 */
router.get('/payouts', async (req, res) => {
  try {
    // Stub: return empty payouts array
    return ok(res, {
      payouts: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
      },
    });
  } catch (error) {
    console.error('[Architect] Get payouts error:', error);
    return fail(res, 'Failed to fetch payouts', 500);
  }
});

/**
 * GET /architect/performance
 * Get architect performance metrics (stub endpoint)
 */
router.get('/performance', async (req, res) => {
  try {
    // Stub: return zero metrics until analytics are implemented
    return ok(res, {
      performance: {
        views: 0,
        sales: 0,
        conversionRate: 0,
      },
    });
  } catch (error) {
    console.error('[Architect] Get performance error:', error);
    return fail(res, 'Failed to fetch performance metrics', 500);
  }
});

/**
 * GET /architect/messages
 * Get architect messages/conversations (stub endpoint)
 */
router.get('/messages', async (req, res) => {
  try {
    // Stub: return empty conversations array
    return ok(res, {
      conversations: [],
    });
  } catch (error) {
    console.error('[Architect] Get messages error:', error);
    return fail(res, 'Failed to fetch messages', 500);
  }
});

export = router;