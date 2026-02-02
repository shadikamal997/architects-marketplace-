const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError, forbidden } = require('../utils/response');

const router = express.Router();

/**
 * GET /licenses/:designId/check
 * Check if buyer has license for design
 * Requires BUYER role
 */
router.get('/:designId/check', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const { designId } = req.params;

    // STEP 3: Placeholder response - Replace with DB query later
    return ok(res, {
      hasLicense: false,
      license: null
    });
  } catch (error) {
    console.error('[Licenses] Check license error:', error);
    return serverError(res, 'Operation failed');
  }
});

module.exports = router;
