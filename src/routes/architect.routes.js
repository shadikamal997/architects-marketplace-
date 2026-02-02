const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');

const router = express.Router();

// All architect routes require authentication and ARCHITECT role
router.use(requireAuth);
router.use(requireRole('ARCHITECT'));

/**
 * POST /architect/designs
 * Create new design (DRAFT state)
 */
router.post('/designs', async (req, res) => {
  try {
    const { title, description, category, priceUsdCents } = req.body;

    // STEP 3: Placeholder response - Replace with DB logic later
    return ok(res, {
      design: {
        id: `design-${Date.now()}`,
        title: title || 'Untitled Design',
        slug: (title || 'untitled-design').toLowerCase().replace(/\s+/g, '-'),
        description: description || '',
        category: category || 'Uncategorized',
        priceUsdCents: priceUsdCents || 5000,
        state: 'DRAFT',
        architectId: req.user.id,
        filesCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Architect] Create design error:', error);
    return serverError(res, 'Failed to create design');
  }
});

/**
 * GET /architect/designs
 * List architect's own designs with stats
 */
router.get('/designs', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;

    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      designs: [],
      stats: {
        total: 0,
        draft: 0,
        submitted: 0,
        approved: 0,
        published: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        totalPages: 0
      }
    });
  } catch (error) {
    console.error('[Architect] List designs error:', error);
    return serverError(res, 'Failed to fetch designs');
  }
});

/**
 * GET /architect/designs/:id
 * Get single design (must be owner)
 */
router.get('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with DB query + ownership check later
    return ok(res, {
      design: {
        id,
        title: 'Sample Design',
        slug: 'sample-design',
        description: 'This is a placeholder design',
        category: 'Residential',
        priceUsdCents: 5000,
        state: 'DRAFT',
        architectId: req.user.id,
        files: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: null,
        publishedAt: null
      }
    });
  } catch (error) {
    console.error('[Architect] Get design error:', error);
    return serverError(res, 'Failed to fetch design');
  }
});

/**
 * PUT /architect/designs/:id
 * Update design (DRAFT only)
 */
router.put('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, priceUsdCents } = req.body;

    // STEP 3: Placeholder response - Replace with DB update + state check later
    return ok(res, {
      design: {
        id,
        title: title || 'Updated Design',
        slug: (title || 'updated-design').toLowerCase().replace(/\s+/g, '-'),
        description: description || '',
        category: category || 'Uncategorized',
        priceUsdCents: priceUsdCents || 5000,
        state: 'DRAFT',
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Architect] Update design error:', error);
    return serverError(res, 'Failed to update design');
  }
});

/**
 * DELETE /architect/designs/:id
 * Delete design (DRAFT only)
 */
router.delete('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with DB delete + state check later
    return ok(res, {
      message: 'Design deleted successfully',
      id
    });
  } catch (error) {
    console.error('[Architect] Delete design error:', error);
    return serverError(res, 'Failed to delete design');
  }
});

/**
 * POST /architect/designs/:id/submit
 * Submit design for admin review (DRAFT → SUBMITTED)
 */
router.post('/designs/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with state transition + file check later
    return ok(res, {
      design: {
        id,
        state: 'SUBMITTED',
        submittedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Architect] Submit design error:', error);
    return serverError(res, 'Failed to submit design');
  }
});

/**
 * GET /architect/payouts
 * List architect's payouts (PENDING + RELEASED)
 */
router.get('/payouts', async (req, res) => {
  try {
    const { state, page = 1, limit = 20 } = req.query;

    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      payouts: [],
      summary: {
        totalPending: 0,
        totalReleased: 0,
        totalEarnings: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
  } catch (error) {
    console.error('[Architect] List payouts error:', error);
    return serverError(res, 'Failed to fetch payouts');
  }
});

/**
 * POST /architect/payouts/release
 * Release pending payouts to bank
 */
router.post('/payouts/release', async (req, res) => {
  try {
    const { payoutBankId } = req.body;

    // STEP 3: Placeholder response - Replace with payout logic + bank verification later
    return ok(res, {
      released: 0,
      totalAmount: 0,
      payoutBankId: payoutBankId || null
    });
  } catch (error) {
    console.error('[Architect] Release payouts error:', error);
    return serverError(res, 'Failed to release payouts');
  }
});

/**
 * PUT /architect/account
 * Update architect account settings
 */
router.put('/account', async (req, res) => {
  try {
    const updates = req.body;

    // STEP 3: Placeholder response - Replace with DB update later
    return ok(res, {
      architect: {
        id: req.user.id,
        displayName: updates.displayName || 'Architect Name',
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Architect] Update account error:', error);
    return serverError(res, 'Failed to update account');
  }
});

module.exports = router;
