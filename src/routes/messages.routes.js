const express = require('express');
const { requireAuth, requireAnyRole } = require('../middleware/auth');
const { ok, serverError, forbidden } = require('../utils/response');

const router = express.Router();

// All message routes require authentication
router.use(requireAuth);

/**
 * GET /messages
 * List conversations for current user
 * ARCHITECT: See conversations for own designs
 * BUYER: See own conversations
 */
router.get('/', async (req, res) => {
  try {
    // STEP 3: Placeholder response - Replace with DB query filtered by role later
    return ok(res, {
      conversations: []
    });
  } catch (error) {
    console.error('[Messages] List conversations error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /messages
 * Create new conversation (BUYER only)
 * STANDARD license: 403 Forbidden (anti-bypass protection)
 * EXCLUSIVE license: Allowed
 */
router.post('/', async (req, res) => {
  try {
    const { architectId, designId, reason, initialMessage } = req.body;

    // STEP 3: Placeholder response - Replace with license check + DB insert later
    // For now, check if user is buyer
    if (req.user.role !== 'BUYER') {
      return forbidden(res, 'Access denied');
    }

    return ok(res, {
      conversation: {
        id: `conv-${Date.now()}`,
        buyerId: req.user.id,
        architectId: architectId || null,
        designId: designId || null,
        reason: reason || 'GENERAL',
        createdAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Messages] Create conversation error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * GET /messages/:conversationId
 * Get conversation details and messages
 * Alias: GET /conversations/:conversationId
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
    console.error('[Messages] Get conversation error:', error);
    return serverError(res, 'Operation failed');
  }
});

/**
 * POST /messages/:conversationId
 * Send message in conversation (participant only)
 */
router.post('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    // STEP 3: Placeholder response - Replace with participant check + DB insert later
    return ok(res, {
      message: {
        id: `msg-${Date.now()}`,
        content: content || '',
        senderId: req.user.id,
        conversationId,
        createdAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Messages] Send message error:', error);
    return serverError(res, 'Operation failed');
  }
});

module.exports = router;
