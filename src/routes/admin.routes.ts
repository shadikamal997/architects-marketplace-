import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuthMiddleware } from '../modules/auth/middleware/auth.middleware';
import { requireRole } from '../modules/auth/guards/permission.guard';
import { UserRole } from '../modules/auth/roles.enum';
import { ok, fail } from '../utils/response.js';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(requireAuthMiddleware);
router.use(requireRole(UserRole.ADMIN));

/**
 * GET /admin/dashboard
 * Get admin dashboard statistics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [totalUsers, totalDesigns, pendingDesigns] = await Promise.all([
      prisma.user.count(),
      prisma.design.count(),
      prisma.design.count({ where: { status: 'SUBMITTED' } }),
    ]);

    return ok(res, {
      totalUsers,
      totalDesigns,
      pendingDesigns,
    });
  } catch (error) {
    console.error('[Admin] Get dashboard error:', error);
    return fail(res, 'Failed to fetch dashboard stats', 500);
  }
});

/**
 * GET /admin/designs
 * List all designs for moderation (filter by state)
 */
router.get('/designs', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {};
    if (state) {
      where.status = state;
    }

    const [designs, stats] = await Promise.all([
      prisma.design.findMany({
        where,
        include: {
          architect: {
            select: {
              id: true,
              displayName: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
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
        awaitingReview: statsObj.submitted || 0,
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
    console.error('[Admin] List designs error:', error);
    return fail(res, 'Failed to fetch designs', 500);
  }
});

/**
 * GET /admin/designs/:id
 * Get single design for moderation review
 */
router.get('/designs/:id', async (req, res) => {
  try {
    const { id: designId } = req.params;

    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        architect: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        files: true,
      },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    return ok(res, {
      design: {
        id: design.id,
        title: design.title,
        description: design.description,
        status: design.status,
        price: design.price,
        category: design.category,
        architect: {
          id: design.architect.id,
          displayName: design.architect.displayName,
          user: design.architect.user,
        },
        files: design.files,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Admin] Get design error:', error);
    return fail(res, 'Failed to fetch design', 500);
  }
});

/**
 * POST /admin/designs/:id/approve
 * Approve design (SUBMITTED → APPROVED)
 */
router.post('/designs/:id/approve', async (req, res) => {
  try {
    const { id: designId } = req.params;

    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    if (design.status !== 'SUBMITTED') {
      return fail(res, 'Design must be in SUBMITTED status to approve', 400);
    }

    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'APPROVED',
      },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    // Log audit action
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'DESIGN_APPROVED',
        entityType: 'DESIGN',
        entityId: designId,
        metadata: { designId, architectId: design.architectId },
      },
    });

    return ok(res, { design: updatedDesign });
  } catch (error) {
    console.error('[Admin] Approve design error:', error);
    return fail(res, 'Failed to approve design', 500);
  }
});

/**
 * POST /admin/designs/:id/reject
 * Reject design with reason (SUBMITTED → DRAFT)
 */
router.post('/designs/:id/reject', async (req, res) => {
  try {
    const { id: designId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return fail(res, 'Rejection reason is required', 400);
    }

    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    if (design.status !== 'SUBMITTED') {
      return fail(res, 'Design must be in SUBMITTED status to reject', 400);
    }

    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'DRAFT',
        rejectionReason: reason,
      },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    // Log audit action
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'DESIGN_REJECTED',
        entityType: 'DESIGN',
        entityId: designId,
        metadata: { designId, architectId: design.architectId, reason },
      },
    });

    return ok(res, { design: updatedDesign });
  } catch (error) {
    console.error('[Admin] Reject design error:', error);
    return fail(res, 'Failed to reject design', 500);
  }
});

/**
 * POST /admin/designs/:id/publish
 * Publish design to marketplace (APPROVED → PUBLISHED)
 */
router.post('/designs/:id/publish', async (req, res) => {
  try {
    const { id: designId } = req.params;

    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    if (design.status !== 'APPROVED') {
      return fail(res, 'Design must be in APPROVED status to publish', 400);
    }

    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'PUBLISHED',
      },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    // Log audit action
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'DESIGN_PUBLISHED',
        entityType: 'DESIGN',
        entityId: designId,
        metadata: { designId, architectId: design.architectId },
      },
    });

    return ok(res, { design: updatedDesign });
  } catch (error) {
    console.error('[Admin] Publish design error:', error);
    return fail(res, 'Failed to publish design', 500);
  }
});

/**
 * GET /admin/users
 * List all users (filter by role, search)
 */
router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, stats] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          buyer: {
            select: {
              id: true,
            },
          },
          architect: {
            select: {
              id: true,
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    const statsObj = stats.reduce((acc, stat) => {
      acc[`total${stat.role.charAt(0).toUpperCase() + stat.role.slice(1).toLowerCase()}s`] = stat._count;
      return acc;
    }, {} as any);

    const total = await prisma.user.count({ where });

    return ok(res, {
      users,
      stats: {
        totalBuyers: statsObj.totalBuyers || 0,
        totalArchitects: statsObj.totalArchitects || 0,
        totalAdmins: statsObj.totalAdmins || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[Admin] List users error:', error);
    return fail(res, 'Failed to fetch users', 500);
  }
});

/**
 * GET /admin/audit
 * Get audit log of admin actions
 */
router.get('/audit', async (req, res) => {
  try {
    const { action, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {};
    if (action) where.action = action;
    if (userId) where.actorId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok(res, {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[Admin] Get audit log error:', error);
    return fail(res, 'Failed to fetch audit logs', 500);
  }
});

export default router;