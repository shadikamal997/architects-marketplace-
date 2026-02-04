/**
 * Marketplace Routes - Public Design Browsing
 * 
 * SECURITY RULES:
 * - Only APPROVED designs are visible
 * - No ZIP files, 3D assets, or internal notes exposed
 * - Slug-based URLs for SEO
 * - Public-safe fields only
 * 
 * Provides public access to approved designs with:
 * - Sorting by rating, price, popularity
 * - Filtering by category, style, rating, price
 * - Search functionality
 * - Pagination
 */

const express = require('express');
const { ok, serverError } = require('../utils/response');
const publicDesignsService = require('../services/public-designs.service');

const router = express.Router();

/**
 * GET /marketplace/designs
 * Browse all APPROVED designs (public marketplace)
 * 
 * SECURITY: Only APPROVED designs visible, no private data exposed
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'recent' | 'highest-rated' | 'most-reviewed' | 'price-low' | 'price-high'
 * - minRating: number (filter by minimum average rating, e.g., 4)
 * - minPrice: number (minimum price filter)
 * - maxPrice: number (maximum price filter)
 * - category: string (category filter)
 * - style: string (style filter)
 * - search: string (search in title, summary, description)
 */
router.get('/designs', async (req, res) => {
  try {
    const { designs, total } = await publicDesignsService.getPublicDesigns(req.query);

    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = Math.min(parseInt(req.query.limit) || 20, 100);

    return ok(res, {
      designs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      filters: {
        sortBy: req.query.sortBy || 'recent',
        minRating: req.query.minRating ? parseFloat(req.query.minRating) : null,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
        category: req.query.category || null,
        style: req.query.style || null,
        search: req.query.search || null,
      },
    });
  } catch (error) {
    console.error('[Marketplace] Browse designs error:', error);
    return serverError(res, 'Failed to fetch designs');
  }
});

/**
 * GET /marketplace/designs/top-rated
 * Get top-rated designs (shortcut)
 * 
 * Returns designs with averageRating >= 4.0, sorted by rating
 */
router.get('/designs/top-rated', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const designs = await prisma.design.findMany({
      where: {
        status: 'PUBLISHED',
        averageRating: { gte: 4.0 },
        reviewCount: { gte: 3 }, // At least 3 reviews
      },
      orderBy: [
        { averageRating: 'desc' },
        { reviewCount: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        category: true,
        price: true,
        previewImageUrl: true,
        averageRating: true,
        reviewCount: true,
        architect: {
          select: {
            id: true,
            user: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    return ok(res, { designs });
  } catch (error) {
    console.error('[Marketplace] Top rated error:', error);
    return serverError(res, 'Failed to fetch top-rated designs');
  }
});

/**
 * GET /marketplace/designs/:slug
 * Get single APPROVED design by slug (public detail page)
 * 
 * SECURITY:
 * - Only APPROVED designs returned
 * - Returns 404 for DRAFT, SUBMITTED, REJECTED
 * - No ZIP files or 3D assets exposed
 * - Only preview images included
 * 
 * Uses slug for SEO-friendly URLs (e.g., /designs/modern-villa-tropical)
 */
router.get('/designs/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const design = await publicDesignsService.getPublicDesignBySlug(slug);

    if (!design) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Design not found or not available',
      });
    }

    return ok(res, { design });
  } catch (error) {
    console.error('[Marketplace] Get design error:', error);
    return serverError(res, 'Failed to fetch design');
  }
});

/**
 * GET /marketplace/categories
 * Get all unique categories with APPROVED design counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await publicDesignsService.getPublicCategories();
    return ok(res, { categories });
  } catch (error) {
    console.error('[Marketplace] Get categories error:', error);
    return serverError(res, 'Failed to fetch categories');
  }
});

/**
 * GET /marketplace/styles
 * Get all unique styles with APPROVED design counts
 */
router.get('/styles', async (req, res) => {
  try {
    const styles = await publicDesignsService.getPublicStyles();
    return ok(res, { styles });
  } catch (error) {
    console.error('[Marketplace] Get styles error:', error);
    return serverError(res, 'Failed to fetch styles');
  }
});

module.exports = router;