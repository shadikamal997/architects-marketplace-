const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError, forbidden } = require('../utils/response');

const router = express.Router();

// All admin routes require authentication and ADMIN role
router.use(requireAuth);
router.use(requireRole('ADMIN'));

/**
 * GET /admin/designs
 * List all designs for moderation (filter by state)
 */
router.get('/designs', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;

    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      designs: [],
      stats: {
        awaitingReview: 0,
        approved: 0,
        published: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
  } catch (error) {
    console.error('[Admin] List designs error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /admin/designs/:id/approve
 * Approve design (SUBMITTED → APPROVED)
 */
router.post('/designs/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with state check + transition + notification later
    return ok(res, {
      design: {
        id,
        state: 'APPROVED',
        approvedAt: new Date().toISOString(),
        approvedBy: req.user.id
      }
    });
  } catch (error) {
    console.error('[Admin] Approve design error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /admin/designs/:id/reject
 * Reject design with reason (SUBMITTED → DRAFT)
 */
router.post('/designs/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // STEP 3: Placeholder response - Replace with state check + transition + notification later
    return ok(res, {
      design: {
        id,
        state: 'DRAFT',
        rejectionReason: reason || '',
        rejectedAt: new Date().toISOString(),
        rejectedBy: req.user.id
      }
    });
  } catch (error) {
    console.error('[Admin] Reject design error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /admin/designs/:id/publish
 * Publish design to marketplace (APPROVED → PUBLISHED)
 */
router.post('/designs/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with state check + transition + notification later
    return ok(res, {
      design: {
        id,
        state: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        publishedBy: req.user.id
      }
    });
  } catch (error) {
    console.error('[Admin] Publish design error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * GET /admin/users
 * List all users (filter by role, search)
 */
router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      users: [],
      stats: {
        totalBuyers: 0,
        totalArchitects: 0,
        totalAdmins: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
  } catch (error) {
    console.error('[Admin] List users error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * GET /admin/audit
 * Get audit log of admin actions
 */
router.get('/audit', async (req, res) => {
  try {
    const { action, userId, startDate, endDate, page = 1, limit = 20 } = req.query;

    // STEP 3: Placeholder response - Replace with audit log query later
    return ok(res, {
      logs: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
  } catch (error) {
    console.error('[Admin] Get audit log error:', error);
    return serverError(res, 'Operation failed');
  }
});

module.exports = router;
