const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError, forbidden } = require('../utils/response');

const router = express.Router();

/**
 * POST /transactions
 * Alias for POST /buyer/purchases
 * Create new transaction (requires BUYER role)
 */
router.post('/', requireAuth, requireRole('BUYER'), async (req, res) => {
  try {
    const { designId, licenseType = 'STANDARD' } = req.body;

    // STEP 3: Placeholder response - Replace with Stripe + DB logic later
    return ok(res, {
      transaction: {
        id: `txn-${Date.now()}`,
        designId: designId || null,
        buyerId: req.user.id,
        licenseType,
        designPriceUsdCents: 5000,
        totalAmountUsdCents: 5000,
        state: 'PENDING',
        paymentIntentId: null,
        createdAt: new Date().toISOString()
      },
      license: {
        id: `lic-${Date.now()}`,
        state: 'ACTIVE',
        downloadCount: 0,
        createdAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Transactions] Create transaction error:', error);
    return serverError(res, 'Operation failed');
  }
});

module.exports = router;
