/**
 * Public Designs Service
 * 
 * Safe data access for public marketplace.
 * Only exposes APPROVED designs with public-safe fields.
 * Never exposes: ZIP files, 3D assets, internal notes, rejection reasons.
 */

const { prisma } = require('../lib/prisma.ts');

class PublicDesignsService {
  /**
   * Get all approved designs for public marketplace
   * 
   * @param {Object} filters - Query filters
   * @param {number} filters.page - Page number (default 1)
   * @param {number} filters.limit - Items per page (default 20, max 100)
   * @param {string} filters.sortBy - Sort order: 'recent' | 'highest-rated' | 'price-low' | 'price-high'
   * @param {string} filters.category - Category filter
   * @param {string} filters.style - Style filter
   * @param {number} filters.minRating - Minimum average rating filter
   * @param {number} filters.minPrice - Minimum price filter
   * @param {number} filters.maxPrice - Maximum price filter
   * @param {string} filters.search - Search query (title, description)
   * @returns {Promise<{designs: Design[], total: number}>}
   */
  async getPublicDesigns(filters = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'recent',
      category,
      style,
      minRating,
      minPrice,
      maxPrice,
      search,
    } = filters;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause - ONLY APPROVED designs
    const where = {
      status: 'APPROVED',
    };

    // Category filter
    if (category) {
      where.category = category;
    }

    // Style filter
    if (style) {
      where.style = style;
    }

    // Rating filter
    if (minRating) {
      where.averageRating = { gte: parseFloat(minRating) };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.standardPrice = {};
      if (minPrice) where.standardPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.standardPrice.lte = parseFloat(maxPrice);
    }

    // Search filter
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { shortSummary: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Determine sort order
    let orderBy = [];
    switch (sortBy) {
      case 'highest-rated':
        orderBy = [{ averageRating: 'desc' }, { reviewCount: 'desc' }];
        break;
      case 'most-reviewed':
        orderBy = [{ reviewCount: 'desc' }];
        break;
      case 'price-low':
        orderBy = [{ standardPrice: 'asc' }];
        break;
      case 'price-high':
        orderBy = [{ standardPrice: 'desc' }];
        break;
      case 'recent':
      default:
        orderBy = [{ publishedAt: 'desc' }];
        break;
    }

    // Fetch designs with PUBLIC-SAFE fields only
    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          // Design identity (public)
          id: true,
          slug: true,
          title: true,
          shortSummary: true,
          description: true,
          category: true,
          subCategory: true,
          style: true,
          targetMarket: true,

          // Technical specs (public)
          totalArea: true,
          areaUnit: true,
          floors: true,
          bedrooms: true,
          bathrooms: true,
          parkingSpaces: true,
          structuralSystem: true,
          designStage: true,
          features: true,
          sustainabilityTags: true,
          climateZone: true,

          // Licensing & pricing (public)
          licenseType: true,
          standardPrice: true,
          exclusivePrice: true,
          allowModifications: true,

          // Review aggregates (public)
          averageRating: true,
          reviewCount: true,

          // Timestamps (public)
          publishedAt: true,
          createdAt: true,

          // Architect info (public-safe only)
          architect: {
            select: {
              id: true,
              displayName: true,
              professionalTitle: true,
              company: true,
              bio: true,
              userId: true,
            },
          },

          // Files: ONLY preview images (NO ZIP, NO 3D ASSETS)
          files: {
            where: {
              fileType: 'PREVIEW_IMAGE',
            },
            select: {
              id: true,
              fileType: true,
              fileName: true,
              fileSize: true,
              storageKey: true,
              displayOrder: true,
            },
            orderBy: { displayOrder: 'asc' },
          },

          // NO: rejectionReason, adminNotes, submittedAt, approvedAt
          // NO: MAIN_PACKAGE, THREE_D_ASSET files
        },
      }),
      prisma.design.count({ where }),
    ]);

    return { designs, total };
  }

  /**
   * Get single approved design by slug (public detail page)
   * 
   * @param {string} slug - Design slug
   * @returns {Promise<Design|null>}
   */
  async getPublicDesignBySlug(slug) {
    const design = await prisma.design.findFirst({
      where: {
        slug,
        status: 'APPROVED', // CRITICAL: Only approved designs
      },
      select: {
        // Full public design details
        id: true,
        slug: true,
        title: true,
        shortSummary: true,
        description: true,
        concept: true,
        designPhilosophy: true,
        idealBuyer: true,
        category: true,
        subCategory: true,
        style: true,
        targetMarket: true,

        // Technical specifications
        totalArea: true,
        areaUnit: true,
        floors: true,
        bedrooms: true,
        bathrooms: true,
        parkingSpaces: true,
        structuralSystem: true,
        estimatedCost: true,
        designStage: true,

        // Features & sustainability
        features: true,
        sustainabilityTags: true,
        energyNotes: true,
        climateZone: true,

        // Licensing & pricing
        licenseType: true,
        standardPrice: true,
        exclusivePrice: true,
        allowModifications: true,
        modificationPrice: true,
        modificationTime: true,
        modificationScope: true,

        // Additional notes (public)
        additionalNotes: true,
        limitations: true,

        // Review aggregates
        averageRating: true,
        reviewCount: true,

        // Timestamps
        publishedAt: true,
        createdAt: true,
        updatedAt: true,

        // Architect info (public profile)
        architect: {
          select: {
            id: true,
            displayName: true,
            professionalTitle: true,
            company: true,
            bio: true,
            userId: true,
          },
        },

        // Preview images ONLY (no ZIP, no 3D assets)
        files: {
          where: {
            fileType: 'PREVIEW_IMAGE',
          },
          select: {
            id: true,
            fileType: true,
            fileName: true,
            fileSize: true,
            storageKey: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },

        // Reviews (published only)
        reviews: {
          where: {
            status: 'PUBLISHED',
          },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            buyer: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Limit reviews shown
        },
      },
    });

    return design;
  }

  /**
   * Get categories with design counts (approved only)
   * 
   * @returns {Promise<Array<{name: string, count: number}>>}
   */
  async getPublicCategories() {
    const categories = await prisma.design.groupBy({
      by: ['category'],
      where: {
        status: 'APPROVED',
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    return categories.map((c) => ({
      name: c.category,
      count: c._count.id,
    }));
  }

  /**
   * Get styles with design counts (approved only)
   * 
   * @returns {Promise<Array<{name: string, count: number}>>}
   */
  async getPublicStyles() {
    const styles = await prisma.design.groupBy({
      by: ['style'],
      where: {
        status: 'APPROVED',
        style: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    return styles.map((s) => ({
      name: s.style,
      count: s._count.id,
    }));
  }

  /**
   * Get top-rated designs (approved only, min 3 reviews)
   * 
   * @param {number} limit - Max designs to return (default 10, max 50)
   * @returns {Promise<Design[]>}
   */
  async getTopRatedDesigns(limit = 10) {
    const limitNum = Math.min(parseInt(limit), 50);

    return prisma.design.findMany({
      where: {
        status: 'APPROVED',
        averageRating: { gte: 4.0 },
        reviewCount: { gte: 3 },
      },
      orderBy: [{ averageRating: 'desc' }, { reviewCount: 'desc' }],
      take: limitNum,
      select: {
        id: true,
        slug: true,
        title: true,
        shortSummary: true,
        category: true,
        standardPrice: true,
        licenseType: true,
        averageRating: true,
        reviewCount: true,
        publishedAt: true,
        architect: {
          select: {
            id: true,
            displayName: true,
          },
        },
        files: {
          where: { fileType: 'PREVIEW_IMAGE' },
          select: {
            storageKey: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
          take: 1,
        },
      },
    });
  }
}

module.exports = new PublicDesignsService();
