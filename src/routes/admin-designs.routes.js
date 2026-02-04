/**
 * Admin Routes - Design Review & Moderation
 * 
 * All routes require:
 * - Authentication (JWT)
 * - ADMIN role
 * 
 * STATE TRANSITIONS (LOCKED):
 * SUBMITTED → APPROVED (admin approves)
 * SUBMITTED → REJECTED (admin rejects with reason)
 * REJECTED → DRAFT (architect edits)
 */

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');
const adminDesignService = require('../services/admin-design.service');

const router = express.Router();

// All admin routes require authentication and ADMIN role
router.use(requireAuth);
router.use(requireRole('ADMIN'));

/**
 * GET /admin/designs/submitted
 * Get all designs awaiting review (status = SUBMITTED)
 * 
 * Returns designs in FIFO order (oldest first)
 * Includes architect info and file counts
 */
router.get('/designs/submitted', async (req, res) => {
  try {
    const designs = await adminDesignService.getSubmittedDesigns();

    return ok(res, {
      designs: designs.map(d => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        shortSummary: d.shortSummary,
        category: d.category,
        status: d.status,
        submittedAt: d.submittedAt,
        architect: {
          id: d.architect.id,
          name: d.architect.displayName || d.architect.email.split('@')[0],
          email: d.architect.email,
        },
        filesCount: d._count.files,
        previewImagesCount: d.files.filter(f => f.fileType === 'PREVIEW_IMAGE').length,
        hasMainPackage: d.files.some(f => f.fileType === 'MAIN_PACKAGE'),
      })),
      total: designs.length,
    });
  } catch (error) {
    console.error('[Admin] Get submitted designs error:', error);
    return serverError(res, 'Failed to fetch submitted designs');
  }
});

/**
 * GET /admin/designs/:id
 * Get single design for review
 * 
 * Returns full design details including all files
 * Used by admin to review before approve/reject
 */
router.get('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const design = await adminDesignService.getDesignForReview(id);

    return ok(res, {
      design: {
        ...design,
        architect: {
          id: design.architect.id,
          name: design.architect.displayName || design.architect.email.split('@')[0],
          email: design.architect.email,
        },
      },
    });
  } catch (error) {
    console.error('[Admin] Get design error:', error);
    
    if (error.message === 'Design not found') {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found',
      });
    }

    return serverError(res, 'Failed to fetch design');
  }
});

/**
 * POST /admin/designs/:id/approve
 * Approve design (SUBMITTED → APPROVED)
 * 
 * RULES:
 * - Design must be in SUBMITTED state
 * - Only ADMIN role can approve
 * - Sets approvedAt timestamp
 * - Clears rejection reason/notes
 * 
 * After approval, design is ready for publishing (future step)
 */
router.post('/designs/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const design = await adminDesignService.approveDesign(id, adminId);

    return ok(res, {
      success: true,
      message: 'Design approved successfully',
      design: {
        id: design.id,
        title: design.title,
        status: design.status,
        approvedAt: design.approvedAt,
      },
    });
  } catch (error) {
    console.error('[Admin] Approve design error:', error);

    if (error.message.includes('Cannot approve')) {
      return res.status(400).json({
        error: 'Invalid state',
        message: error.message,
      });
    }

    if (error.message === 'Design not found') {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found',
      });
    }

    return serverError(res, 'Failed to approve design');
  }
});

/**
 * POST /admin/designs/:id/reject
 * Reject design with reason (SUBMITTED → REJECTED)
 * 
 * RULES:
 * - Design must be in SUBMITTED state
 * - Rejection reason required (min 10 chars)
 * - Admin notes optional (internal only)
 * - Architect can edit rejected designs
 * 
 * Body:
 * {
 *   "reason": "Public reason architect sees",
 *   "adminNotes": "Internal notes (optional)"
 * }
 */
router.post('/designs/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminNotes } = req.body;
    const adminId = req.user.id;

    // Validate input
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Rejection reason must be at least 10 characters',
      });
    }

    const design = await adminDesignService.rejectDesign(
      id,
      reason,
      adminId,
      adminNotes
    );

    return ok(res, {
      success: true,
      message: 'Design rejected successfully',
      design: {
        id: design.id,
        title: design.title,
        status: design.status,
        rejectionReason: design.rejectionReason,
      },
    });
  } catch (error) {
    console.error('[Admin] Reject design error:', error);

    if (error.message.includes('Cannot reject') || error.message.includes('Rejection reason')) {
      return res.status(400).json({
        error: 'Invalid request',
        message: error.message,
      });
    }

    if (error.message === 'Design not found') {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found',
      });
    }

    return serverError(res, 'Failed to reject design');
  }
});

/**
 * GET /admin/designs/stats
 * Get design statistics for admin dashboard
 * 
 * Returns counts by status:
 * - total, draft, submitted, approved, published, rejected
 */
router.get('/designs/stats', async (req, res) => {
  try {
    const stats = await adminDesignService.getDesignStats();

    return ok(res, { stats });
  } catch (error) {
    console.error('[Admin] Get design stats error:', error);
    return serverError(res, 'Failed to fetch design statistics');
  }
});

/**
 * GET /admin/designs/recent
 * Get recently reviewed designs (approved or rejected)
 * 
 * Query params:
 * - limit: Number of results (default 20)
 * 
 * Returns designs sorted by updatedAt desc
 */
router.get('/designs/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const designs = await adminDesignService.getRecentlyReviewed(parseInt(limit));

    return ok(res, {
      designs: designs.map(d => ({
        id: d.id,
        title: d.title,
        status: d.status,
        updatedAt: d.updatedAt,
        approvedAt: d.approvedAt,
        rejectionReason: d.rejectionReason,
        architect: {
          id: d.architect.id,
          name: d.architect.displayName || d.architect.email.split('@')[0],
        },
      })),
    });
  } catch (error) {
    console.error('[Admin] Get recent designs error:', error);
    return serverError(res, 'Failed to fetch recent designs');
  }
});

module.exports = router;
