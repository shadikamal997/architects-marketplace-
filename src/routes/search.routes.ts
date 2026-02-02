import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * GET /search/designs
 * Search designs by title and description
 * Public endpoint - no auth required
 */
router.get('/designs', async (req, res) => {
  try {
    const { q: query, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return fail(res, 'Search query must be at least 2 characters', 400);
    }

    const where = {
      status: 'PUBLISHED' as const,
      OR: [
        { title: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ],
    };

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

    return ok(res, {
      designs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Search designs error:', error);
    return fail(res, 'Search failed', 500);
  }
});

/**
 * GET /search/suggestions
 * Get search suggestions (autocomplete)
 * Public endpoint - no auth required
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 1) {
      return ok(res, { suggestions: [] });
    }

    // Get title suggestions
    const titleSuggestions = await prisma.design.findMany({
      where: {
        status: 'PUBLISHED',
        title: { contains: query, mode: 'insensitive' },
      },
      select: {
        title: true,
      },
      take: 5,
      orderBy: { title: 'asc' },
    });

    // Get category suggestions
    const categorySuggestions = await prisma.design.findMany({
      where: {
        status: 'PUBLISHED',
        category: { contains: query, mode: 'insensitive' },
      },
      select: {
        category: true,
      },
      distinct: ['category'],
      take: 3,
    });

    const suggestions = [
      ...titleSuggestions.map(s => s.title),
      ...categorySuggestions.map(s => s.category),
    ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

    return ok(res, { suggestions });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return fail(res, 'Failed to get suggestions', 500);
  }
});

export default router;