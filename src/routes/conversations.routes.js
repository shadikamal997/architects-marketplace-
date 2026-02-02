const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { ok, serverError, forbidden } = require('../utils/response');

const router = express.Router();

// All conversation routes require authentication
router.use(requireAuth);

/**
 * GET /conversations/:conversationId
 * Get conversation details and messages (alias for /messages/:conversationId)
 */
router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    // STEP 3: Placeholder response - Replace with DB query + participant check later
    return ok(res, {
      conversation: {
        id: conversationId,
        buyer: {
          id: 'buyer-1',
          name: 'Buyer Name'
        },
        architect: {
          id: 'architect-1',
          displayName: 'Architect Name'
        },
        design: null,
        reason: 'GENERAL'
      },
      messages: []
    });
  } catch (error) {
    console.error('[Conversations] Get conversation error:', error);
    return serverError(res, 'Operation failed');
  }
});

module.exports = router;
