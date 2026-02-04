/**
 * Review Routes - API Endpoints for Review System
 * 
 * Authorization:
 * - POST/PUT/DELETE: Requires BUYER role
 * - GET (public): No auth required
 */

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, fail, unauthorized, forbidden, serverError } = require('../utils/response');
const reviewsService = require('../services/reviews.service');

const router = express.Router();

/**
 * POST /reviews
 * Create a new review
 * 
 * Authorization: BUYER only, must have purchased the design
 * 
 * Body:
 * - designId: string (required)
 * - purchaseId: string (required)
 * - rating: number 1-5 (required)
 * - comment: string 10-1000 chars (required)
 */
router.post('/', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const { designId, purchaseId, rating, comment } = req.body;
    const buyerId = req.user.id;

    // Validate required fields
    if (!designId || !purchaseId) {
      return fail(res, 'designId and purchaseId are required', 400);
    }

    if (!rating) {
      return fail(res, 'rating is required', 400);
    }

    if (!comment) {
      return fail(res, 'comment is required', 400);
    }

    // Create review (service handles all authorization)
    const review = await reviewsService.createReview({
      buyerId,
      designId,
      purchaseId,
      rating: parseInt(rating),
      comment,
    });

    return ok(res, review, 201);
  } catch (error) {
    console.error('[Reviews] Create error:', error);

    // Map error codes to user-friendly messages
    const errorMap = {
      'PURCHASE_NOT_FOUND': 'You can only review designs you have purchased',
      'PURCHASE_NOT_COMPLETED': 'Purchase must be completed before reviewing',
      'ALREADY_REVIEWED': 'You have already reviewed this design',
      'INVALID_RATING': 'Rating must be between 1 and 5',
      'COMMENT_TOO_SHORT': 'Comment must be at least 10 characters',
      'COMMENT_TOO_LONG': 'Comment must not exceed 1000 characters',
    };

    // Handle known error codes
    if (error.message === 'PURCHASE_NOT_FOUND' || error.message === 'PURCHASE_NOT_COMPLETED') {
      return forbidden(res, errorMap[error.message]);
    }
    if (error.message === 'ALREADY_REVIEWED') {
      return fail(res, errorMap[error.message], 409); // Conflict
    }
    if (errorMap[error.message]) {
      return fail(res, errorMap[error.message], 400);
    }

    // Handle Prisma unique constraint violation
    if (error.code === 'P2002') {
      return fail(res, 'You have already reviewed this design', 409);
    }

    return serverError(res, 'Failed to create review');
  }
});

/**
 * GET /reviews/design/:designId
 * Get all reviews for a design (public)
 * 
 * Authorization: None (public endpoint)
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 50)
 * - sortBy: 'recent' | 'oldest' | 'highest' | 'lowest' (default: 'recent')
 */
router.get('/design/:designId', async (req, res) => {
  try {
    const { designId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50
    const sortBy = req.query.sortBy || 'recent';

    const result = await reviewsService.getDesignReviews(designId, {
      page,
      limit,
      sortBy,
    });

    return ok(res, result);
  } catch (error) {
    console.error('[Reviews] Get design reviews error:', error);
    return serverError(res, 'Failed to fetch reviews');
  }
});

/**
 * GET /reviews/design/:designId/stats
 * Get rating statistics for a design (public)
 * 
 * Authorization: None (public endpoint)
 * 
 * Returns:
 * - averageRating: number
 * - totalReviews: number
 * - distribution: { 5: count, 4: count, ... }
 */
router.get('/design/:designId/stats', async (req, res) => {
  try {
    const { designId } = req.params;

    const stats = await reviewsService.getDesignRatingStats(designId);

    return ok(res, stats);
  } catch (error) {
    console.error('[Reviews] Get stats error:', error);
    return serverError(res, 'Failed to fetch rating statistics');
  }
});

/**
 * GET /reviews/my-reviews
 * Get current buyer's reviews
 * 
 * Authorization: BUYER only
 */
router.get('/my-reviews', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const buyerId = req.user.id;

    const reviews = await reviewsService.getBuyerReviews(buyerId);

    return ok(res, reviews);
  } catch (error) {
    console.error('[Reviews] Get buyer reviews error:', error);
    return serverError(res, 'Failed to fetch your reviews');
  }
});

/**
 * GET /reviews/can-review/:designId
 * Check if current buyer can review a design
 * 
 * Authorization: BUYER only
 * 
 * Returns:
 * - canReview: boolean
 * - reason: string (if false)
 * - purchaseId: string (if true)
 */
router.get('/can-review/:designId', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const { designId } = req.params;
    const buyerId = req.user.id;

    const result = await reviewsService.canBuyerReview(buyerId, designId);

    return ok(res, result);
  } catch (error) {
    console.error('[Reviews] Can review check error:', error);
    return serverError(res, 'Failed to check review eligibility');
  }
});

/**
 * PUT /reviews/:reviewId
 * Update own review
 * 
 * Authorization: BUYER only, must own the review
 * 
 * Body:
 * - rating: number 1-5 (optional)
 * - comment: string 10-1000 chars (optional)
 */
router.put('/:reviewId', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const buyerId = req.user.id;
    const { rating, comment } = req.body;

    // At least one field must be provided
    if (rating === undefined && comment === undefined) {
      return fail(res, 'At least one of rating or comment must be provided', 400);
    }

    // Update review (service handles authorization)
    const updated = await reviewsService.updateReview(reviewId, buyerId, {
      rating: rating ? parseInt(rating) : undefined,
      comment,
    });

    return ok(res, updated);
  } catch (error) {
    console.error('[Reviews] Update error:', error);

    // Map error codes to user-friendly messages
    const errorMap = {
      'NO_CHANGES_DETECTED': 'No changes detected in your review',
      'INVALID_RATING': 'Rating must be between 1 and 5',
      'COMMENT_TOO_SHORT': 'Comment must be at least 10 characters',
      'COMMENT_TOO_LONG': 'Comment must not exceed 1000 characters',
    };

    if (error.message === 'NO_CHANGES_DETECTED') {
      return fail(res, errorMap[error.message], 400);
    }
    if (errorMap[error.message]) {
      return fail(res, errorMap[error.message], 400);
    }
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return forbidden(res, 'Review not found or you do not have permission to update it');
    }

    return serverError(res, 'Failed to update review');
  }
});

/**
 * DELETE /reviews/:reviewId
 * Soft delete own review
 * 
 * Authorization: BUYER only, must own the review
 * 
 * Note: This is a soft delete (sets status to DELETED)
 * Review remains in database but is hidden from public
 */
router.delete('/:reviewId', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const buyerId = req.user.id;

    // Delete review (service handles authorization)
    await reviewsService.deleteReview(reviewId, buyerId);

    return ok(res, { message: 'Review deleted successfully' });
  } catch (error) {
    console.error('[Reviews] Delete error:', error);

    // Handle authorization errors
    if (error.message.includes('not found or access denied')) {
      return forbidden(res, error.message);
    }

    return serverError(res, 'Failed to delete review');
  }
});

module.exports = router;
