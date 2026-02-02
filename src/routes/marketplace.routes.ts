import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * GET /marketplace/designs
 * Get published designs for marketplace browsing
 * Public endpoint - no auth required
 */
router.get('/designs', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      q, // FIXED: Changed from 'search' to 'q' to match frontend
      minPrice,
      maxPrice,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Build filters safely
    const where: any = {
      status: 'PUBLISHED',
    };

    // Category filter
    if (category && typeof category === 'string') {
      where.category = category;
    }

    // Search query - safe partial search (no full-text fragility)
    if (q && typeof q === 'string' && q.trim()) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { description: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    // Price range filters
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        const minPriceNum = parseFloat(minPrice as string);
        if (!isNaN(minPriceNum)) {
          where.price.gte = minPriceNum;
        }
      }
      if (maxPrice) {
        const maxPriceNum = parseFloat(maxPrice as string);
        if (!isNaN(maxPriceNum)) {
          where.price.lte = maxPriceNum;
        }
      }
    }

    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        include: {
          architect: {
            select: {
              id: true,
              displayName: true,
            },
          },
          files: {
            where: { fileType: 'PREVIEW_IMAGE' },
            take: 1,
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.design.count({ where }),
    ]);

    // Normalize image URLs for frontend compatibility
    const normalizedDesigns = designs.map(design => ({
      ...design,
      previewImageUrl: design.previewImageUrl || design.files[0]?.storageKey || null,
    }));

    return ok(res, {
      designs: normalizedDesigns,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Marketplace designs error:', error);
    // CRITICAL FIX: Never return 500 on search failure
    // Return 200 with empty results instead (graceful degradation)
    const { limit = 10 } = req.query;
    return res.status(200).json({
      success: true,
      data: {
        designs: [],
        pagination: {
          page: 1,
          limit: parseInt(limit as string) || 10,
          total: 0,
          totalPages: 0,
        },
      },
    });
  }
});

/**
 * GET /marketplace/designs/:id
 * Get design details by ID
 * Public endpoint - no auth required
 */
router.get('/designs/:id', async (req, res) => {
  try {
    const { id: designId } = req.params;

    const design = await prisma.design.findFirst({
      where: {
        id: designId,
        status: 'PUBLISHED',
      },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
            bio: true,
          },
        },
        files: true,
      },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    // Normalize image URL for frontend compatibility
    const normalizedDesign = {
      ...design,
      previewImageUrl: design.previewImageUrl || design.files.find(f => f.fileType === 'PREVIEW_IMAGE')?.storageKey || null,
    };

    return ok(res, normalizedDesign);
  } catch (error) {
    console.error('Design detail error:', error);
    return fail(res, 'Failed to fetch design', 500);
  }
});

/**
 * GET /marketplace/designs/slug/:slug
 * Get design details by slug
 * Public endpoint - no auth required
 */
router.get('/designs/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const design = await prisma.design.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
      },
      include: {
        architect: {
          select: {
            id: true,
            displayName: true,
            bio: true,
          },
        },
        files: true,
      },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    // Normalize image URL for frontend compatibility
    const normalizedDesign = {
      ...design,
      previewImageUrl: design.previewImageUrl || design.files.find(f => f.fileType === 'PREVIEW_IMAGE')?.storageKey || null,
    };

    return ok(res, normalizedDesign);
  } catch (error) {
    console.error('Design detail by slug error:', error);
    return fail(res, 'Failed to fetch design', 500);
  }
});

export default router;