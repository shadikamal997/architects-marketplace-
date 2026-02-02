const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError, forbidden } = require('../utils/response');

const router = express.Router();

// All modification routes require authentication
router.use(requireAuth);

/**
 * POST /modifications/request
 * Request modification (BUYER with EXCLUSIVE license only)
 */
router.post('/request', requireRole('BUYER'), async (req, res) => {
  try {
    const { designId, description, urgency = 'MEDIUM' } = req.body;

    // STEP 3: Placeholder response - Replace with EXCLUSIVE license check + DB insert later
    // TODO: Add license type check (EXCLUSIVE only)
    return ok(res, {
      modification: {
        id: `mod-${Date.now()}`,
        designId: designId || null,
        buyerId: req.user.id,
        description: description || '',
        urgency,
        state: 'PENDING',
        createdAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Modifications] Request error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * GET /modifications
 * List modifications
 * ARCHITECT: See modifications for own designs
 * BUYER: See own modification requests
 */
router.get('/', async (req, res) => {
  try {
    const { state } = req.query;

    // STEP 3: Placeholder response - Replace with DB query filtered by role later
    return ok(res, {
      modifications: []
    });
  } catch (error) {
    console.error('[Modifications] List error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /modifications/:id/approve
 * Approve modification request (ARCHITECT only - own designs)
 */
router.post('/:id/approve', requireRole('ARCHITECT'), async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with ownership check + state transition later
    return ok(res, {
      modification: {
        id,
        state: 'APPROVED',
        respondedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Modifications] Approve error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /modifications/:id/reject
 * Reject modification request (ARCHITECT only - own designs)
 */
router.post('/:id/reject', requireRole('ARCHITECT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // STEP 3: Placeholder response - Replace with ownership check + state transition later
    return ok(res, {
      modification: {
        id,
        state: 'REJECTED',
        rejectionReason: reason || null,
        respondedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Modifications] Reject error:', error);
    return serverError(res, 'Operation failed');
  }
});

module.exports = router;
