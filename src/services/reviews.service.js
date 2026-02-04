/**
 * Reviews Service - Business Logic & Authorization
 * 
 * All review operations MUST go through this service.
 * This ensures business rules are enforced at the API level.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ReviewsService {
  /**
   * Verify buyer can review this design
   * 
   * Rules enforced:
   * 1. Purchase must exist
   * 2. Purchase must belong to buyer
   * 3. Purchase must be for this specific design
   * 4. Transaction must be PAID (not pending/failed/refunded)
   * 
   * @throws {Error} If any rule is violated
   */
  async canReviewDesign(buyerId, designId, purchaseId) {
    // Find the purchase with transaction
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        buyerId: buyerId,
        designId: designId,
      },
      include: {
        buyer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new Error('PURCHASE_NOT_FOUND');
    }

    // CRITICAL: Verify purchase has a PAID transaction
    // Check if there's a completed payment for this purchase
    const paidTransaction = await prisma.transaction.findFirst({
      where: {
        buyerId: buyerId,
        designId: designId,
        status: 'PAID', // Only PAID status allowed
      },
    });

    if (!paidTransaction) {
      throw new Error('PURCHASE_NOT_COMPLETED');
    }
    
    return purchase;
  }

  /**
   * Ensure no duplicate review exists
   * 
   * Rule: One review per buyer per design (enforced by unique constraint)
   * 
   * @throws {Error} If review already exists
   */
  async ensureNoDuplicateReview(buyerId, designId) {
    const existing = await prisma.review.findUnique({
      where: {
        buyerId_designId: {
          buyerId: buyerId,
          designId: designId,
        },
      },
    });

    if (existing) {
      throw new Error('You have already reviewed this design');
    }
  }

  /**
   * Verify user owns this review
   * 
   * Rule: Can only update/delete own reviews
   * 
   * @throws {Error} If review doesn't exist or doesn't belong to user
   */
  async getOwnReview(reviewId, buyerId) {
    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        buyerId: buyerId,
      },
    });

    if (!review) {
      throw new Error('Review not found or access denied');
    }

    return review;
  }

  /**
   * Create a new review
   * 
   * Full authorization check before creation
   */
  async createReview({ buyerId, designId, purchaseId, rating, comment }) {
    // Validate inputs
    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    if (!comment || comment.trim().length < 10) {
      throw new Error('Comment must be at least 10 characters');
    }

    if (comment.trim().length > 1000) {
      throw new Error('Comment must not exceed 1000 characters');
    }

    // Authorization: Can buyer review this design?
    await this.canReviewDesign(buyerId, designId, purchaseId);

    // Authorization: No duplicate reviews
    await this.ensureNoDuplicateReview(buyerId, designId);

    // TRANSACTION SAFETY: Create review + update aggregation atomically
    const review = await prisma.$transaction(async (tx) => {
      // Create review
      const newReview = await tx.review.create({
        data: {
          buyerId: buyerId,
          designId: designId,
          purchaseId: purchaseId,
          rating: rating,
          comment: comment.trim(),
          status: 'PUBLISHED',
        },
        include: {
          buyer: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  // Privacy: Don't expose email in response
                },
              },
            },
          },
          design: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      });

      // Update design aggregation in same transaction
      const stats = await this.getDesignRatingStatsInTransaction(tx, designId);
      await tx.design.update({
        where: { id: designId },
        data: {
          averageRating: stats.averageRating,
          reviewCount: stats.totalReviews,
        },
      });

      return newReview;
    });

    return review;
  }

  /**
   * Update an existing review
   * 
   * Authorization: Must own the review
   */
  async updateReview(reviewId, buyerId, { rating, comment }) {
    // Validate inputs
    if (rating && (rating < 1 || rating > 5)) {
      throw new Error('INVALID_RATING');
    }

    if (comment !== undefined) {
      if (comment.trim().length < 10) {
        throw new Error('COMMENT_TOO_SHORT');
      }
      if (comment.trim().length > 1000) {
        throw new Error('COMMENT_TOO_LONG');
      }
    }

    // Authorization: Verify ownership
    const existingReview = await this.getOwnReview(reviewId, buyerId);

    // RATING DRIFT PROTECTION: Prevent useless updates
    const newRating = rating !== undefined ? rating : existingReview.rating;
    const newComment = comment !== undefined ? comment.trim() : existingReview.comment;
    
    if (newRating === existingReview.rating && newComment === existingReview.comment) {
      throw new Error('NO_CHANGES_DETECTED');
    }

    // Build update data
    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment.trim();

    // TRANSACTION SAFETY: Update review + aggregation atomically
    const updated = await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          buyer: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  // Privacy: Don't expose email
                },
              },
            },
          },
          design: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      });

      // Update design aggregation if rating changed
      if (rating !== undefined) {
        const stats = await this.getDesignRatingStatsInTransaction(tx, existingReview.designId);
        await tx.design.update({
          where: { id: existingReview.designId },
          data: {
            averageRating: stats.averageRating,
            reviewCount: stats.totalReviews,
          },
        });
      }

      return updatedReview;
    });

    return updated;
  }

  /**
   * Soft delete review (set status to DELETED)
   * 
   * Authorization: Must own the review
   */
  async deleteReview(reviewId, buyerId) {
    // Authorization: Verify ownership
    const existingReview = await this.getOwnReview(reviewId, buyerId);

    // TRANSACTION SAFETY: Soft delete + update aggregation atomically
    const deleted = await prisma.$transaction(async (tx) => {
      const deletedReview = await tx.review.update({
        where: { id: reviewId },
        data: { status: 'DELETED' },
      });

      // Update design aggregation (exclude deleted reviews)
      const stats = await this.getDesignRatingStatsInTransaction(tx, existingReview.designId);
      await tx.design.update({
        where: { id: existingReview.designId },
        data: {
          averageRating: stats.averageRating,
          reviewCount: stats.totalReviews,
        },
      });

      return deletedReview;
    });

    return deleted;
  }

  /**
   * Get all reviews for a design (public)
   * 
   * Only returns PUBLISHED reviews
   */
  async getDesignReviews(designId, { page = 1, limit = 10, sortBy = 'recent' } = {}) {
    const skip = (page - 1) * limit;

    // Determine sort order
    let orderBy = {};
    if (sortBy === 'recent') {
      orderBy = { createdAt: 'desc' };
    } else if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'highest') {
      orderBy = { rating: 'desc' };
    } else if (sortBy === 'lowest') {
      orderBy = { rating: 'asc' };
    }

    // Get reviews
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          designId: designId,
          status: 'PUBLISHED',
        },
        include: {
          buyer: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  // PRIVACY: Never expose email, full name, or user ID publicly
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.review.count({
        where: {
          designId: designId,
          status: 'PUBLISHED',
        },
      }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get rating statistics for a design
   */
  async getDesignRatingStats(designId) {
    const reviews = await prisma.review.findMany({
      where: {
        designId: designId,
        status: 'PUBLISHED',
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
      };
    }

    // Calculate average
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / reviews.length;

    // Calculate distribution
    const distribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    return {
      averageRating: Math.round(average * 10) / 10, // Round to 1 decimal
      totalReviews: reviews.length,
      distribution,
    };
  }

  /**
   * Update design rating aggregation
   * 
   * Recalculates averageRating and reviewCount for a design
   * Only counts PUBLISHED reviews
   */
  async updateDesignRating(designId) {
    const stats = await this.getDesignRatingStats(designId);

    await prisma.design.update({
      where: { id: designId },
      data: {
        averageRating: stats.averageRating,
        reviewCount: stats.totalReviews,
      },
    });
  }

  /**
   * Get rating stats within a transaction (for atomic operations)
   * Uses Prisma aggregate for better performance
   * @private
   */
  async getDesignRatingStatsInTransaction(tx, designId) {
    // Use Prisma's aggregate function for efficiency
    const [stats, distribution] = await Promise.all([
      tx.review.aggregate({
        where: {
          designId: designId,
          status: 'PUBLISHED',
        },
        _avg: {
          rating: true,
        },
        _count: true,
      }),
      // Get distribution separately
      tx.review.groupBy({
        by: ['rating'],
        where: {
          designId: designId,
          status: 'PUBLISHED',
        },
        _count: true,
      }),
    ]);

    // Build distribution map
    const distributionMap = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    distribution.forEach((item) => {
      distributionMap[item.rating] = item._count;
    });

    return {
      averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
      totalReviews: stats._count,
      distribution: distributionMap,
    };
  }

  /**
   * Get buyer's own reviews
   */
  async getBuyerReviews(buyerId) {
    const reviews = await prisma.review.findMany({
      where: {
        buyerId: buyerId,
        status: {
          not: 'DELETED', // Don't show deleted reviews
        },
      },
      include: {
        design: {
          select: {
            id: true,
            title: true,
            slug: true,
            previewImageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reviews;
  }

  /**
   * Check if buyer has purchased and can review this design
   * (Public check, doesn't throw errors)
   */
  async canBuyerReview(buyerId, designId) {
    // Check if purchase exists
    const purchase = await prisma.purchase.findFirst({
      where: {
        buyerId: buyerId,
        designId: designId,
      },
    });

    if (!purchase) {
      return { canReview: false, reason: 'NOT_PURCHASED' };
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: {
        buyerId_designId: {
          buyerId: buyerId,
          designId: designId,
        },
      },
    });

    if (existingReview && existingReview.status !== 'DELETED') {
      return { canReview: false, reason: 'ALREADY_REVIEWED', reviewId: existingReview.id };
    }

    return { canReview: true, purchaseId: purchase.id };
  }
}

module.exports = new ReviewsService();
