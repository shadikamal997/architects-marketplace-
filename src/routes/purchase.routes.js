/**
 * Purchase Routes
 * 
 * Handles design purchase operations and secure file downloads.
 * 
 * Routes:
 * - POST   /purchases          - Create new purchase (checkout)
 * - GET    /purchases/my       - Get buyer's purchase history
 * - GET    /purchases/:id      - Get single purchase details
 * - GET    /purchases/:id/download - Download purchased design files
 * 
 * Security:
 * - All routes require authentication
 * - Buyer role enforced
 * - Purchase ownership verified for downloads
 */

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');
const purchaseService = require('../services/purchase.service');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// All purchase routes require authentication
router.use(requireAuth);
// Most routes require BUYER role (architects can't buy their own designs in v1)
router.use(requireRole('BUYER'));

/**
 * POST /purchases
 * Initiate purchase checkout flow
 * 
 * Body:
 * - designId: string (required)
 * - licenseType: 'STANDARD' | 'EXCLUSIVE' (optional, defaults to design's license type)
 * 
 * Returns:
 * - checkoutUrl: Stripe Checkout session URL to redirect buyer to
 * - sessionId: Stripe session ID for reference
 * 
 * Flow:
 * 1. Check design availability (APPROVED, EXCLUSIVE not sold)
 * 2. Create Stripe Checkout session via existing /api/payments/checkout endpoint
 * 3. Return checkout URL for client redirect
 * 4. After payment, webhook creates purchase record and license
 * 
 * Security:
 * - Only APPROVED designs can be purchased
 * - EXCLUSIVE licenses can only be sold once
 * - Buyer cannot purchase same design twice
 */
router.post('/', async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { designId, licenseType } = req.body;

    // 1. Validate input
    if (!designId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'designId is required',
      });
    }

    // 2. Check design availability before creating checkout session
    const availability = await purchaseService.checkAvailability(designId);
    if (!availability.available) {
      return res.status(400).json({
        error: 'Purchase not allowed',
        message: availability.reason,
      });
    }

    // 3. Check if buyer already purchased this design
    const alreadyPurchased = await purchaseService.hasPurchased(buyerId, designId);
    if (alreadyPurchased) {
      return res.status(400).json({
        error: 'Already purchased',
        message: 'You have already purchased this design',
      });
    }

    // 4. Forward to Stripe Checkout endpoint (existing integration)
    // This endpoint is in src/index.ts at /api/payments/checkout
    const axios = require('axios');
    const checkoutResponse = await axios.post(
      `${process.env.API_URL || 'http://localhost:3001'}/api/payments/checkout`,
      {
        type: 'DESIGN',
        resourceId: designId,
        licenseType: licenseType || undefined, // Let backend determine from design
      },
      {
        headers: {
          Authorization: req.headers.authorization,
          'Content-Type': 'application/json',
        },
      }
    );

    // 5. Return Stripe Checkout URL for client redirect
    return ok(res, {
      success: true,
      message: 'Checkout session created',
      checkoutUrl: checkoutResponse.data.checkoutUrl,
      sessionId: checkoutResponse.data.sessionId,
    }, 201);

  } catch (error) {
    console.error('[Purchase] Create purchase error:', error);

    // Handle known errors with specific messages
    if (error.message.includes('not available') || 
        error.message.includes('already sold') ||
        error.message.includes('already purchased')) {
      return res.status(400).json({
        error: 'Purchase failed',
        message: error.message,
      });
    }

    return serverError(res, 'Failed to create purchase');
  }
});

/**
 * GET /purchases/my
 * Get buyer's purchase history
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * 
 * Returns:
 * - purchases: Array of purchase objects with design info
 * - pagination: Pagination metadata
 */
router.get('/my', async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const result = await purchaseService.getBuyerPurchases(buyerId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    // Format response
    const formattedPurchases = result.purchases.map(p => ({
      id: p.id,
      pricePaid: Number(p.price),
      purchasedAt: p.createdAt,
      design: {
        id: p.design.id,
        slug: p.design.slug,
        title: p.design.title,
        shortSummary: p.design.shortSummary,
        category: p.design.category,
        licenseType: p.design.licenseType,
        previewImage: p.design.files[0]?.storageKey || null,
        architect: p.design.architect,
      },
    }));

    return ok(res, {
      purchases: formattedPurchases,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });

  } catch (error) {
    console.error('[Purchase] Get purchase history error:', error);
    return serverError(res, 'Failed to fetch purchase history');
  }
});

/**
 * GET /purchases/:id
 * Get single purchase details
 * 
 * Returns:
 * - purchase: Complete purchase info with design details
 * 
 * Security:
 * - Only purchase owner can access
 */
router.get('/:id', async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { id } = req.params;

    const purchase = await purchaseService.getPurchase(id, buyerId);

    // Format response
    return ok(res, {
      purchase: {
        id: purchase.id,
        pricePaid: Number(purchase.price),
        purchasedAt: purchase.createdAt,
        design: {
          id: purchase.design.id,
          slug: purchase.design.slug,
          title: purchase.design.title,
          shortSummary: purchase.design.shortSummary,
          description: purchase.design.description,
          category: purchase.design.category,
          style: purchase.design.style,
          licenseType: purchase.design.licenseType,
          specs: {
            totalArea: purchase.design.totalArea,
            areaUnit: purchase.design.areaUnit,
            floors: purchase.design.floors,
            bedrooms: purchase.design.bedrooms,
            bathrooms: purchase.design.bathrooms,
            parkingSpaces: purchase.design.parkingSpaces,
            designStage: purchase.design.designStage,
          },
          files: purchase.design.files.map(f => ({
            id: f.id,
            type: f.fileType,
            fileName: f.originalFileName,
            size: f.fileSize,
            url: f.fileType === 'PREVIEW_IMAGE' ? f.storageKey : null, // Only preview images exposed
          })),
          architect: purchase.design.architect,
        },
      },
    });

  } catch (error) {
    console.error('[Purchase] Get purchase error:', error);

    if (error.message.includes('not found') || error.message.includes('permission')) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Purchase not found or you do not have permission',
      });
    }

    return serverError(res, 'Failed to fetch purchase');
  }
});

/**
 * GET /purchases/:id/download
 * Download purchased design files
 * 
 * SECURITY CRITICAL:
 * - Verifies purchase ownership
 * - Only streams MAIN_PACKAGE file
 * - Logs download activity
 * 
 * Returns:
 * - File stream (application/zip)
 * 
 * Future enhancements:
 * - Replace with S3 signed URLs (15-min expiry)
 * - Add watermarking for preview PDFs
 * - Track download count per purchase
 */
router.get('/:id/download', async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { id } = req.params;

    // 1. Get download URL with ownership verification
    const fileInfo = await purchaseService.getDownloadUrl(id, buyerId);

    // 2. Verify file exists on disk
    if (!fs.existsSync(fileInfo.fileUrl)) {
      console.error(`[Purchase] File not found on disk: ${fileInfo.fileUrl}`);
      return res.status(500).json({
        error: 'File not found',
        message: 'Design file not available. Please contact support.',
      });
    }

    // 3. Log download activity
    console.log(`[Purchase] Download initiated - Purchase ${id}, Buyer ${buyerId}, File ${fileInfo.fileName}`);

    // 4. Stream file to buyer
    res.setHeader('Content-Type', fileInfo.mimeType || 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);
    res.setHeader('Content-Length', fileInfo.fileSize);

    const fileStream = fs.createReadStream(fileInfo.fileUrl);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('[Purchase] File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Download failed',
          message: 'Failed to download file',
        });
      }
    });

  } catch (error) {
    console.error('[Purchase] Download error:', error);

    if (error.message.includes('not found') || error.message.includes('permission')) {
      return res.status(403).json({
        error: 'Access denied',
        message: error.message,
      });
    }

    return serverError(res, 'Failed to download design');
  }
});

/**
 * GET /purchases/:id/availability
 * Check if a design is available for purchase
 * 
 * Used by frontend to show purchase button state.
 * 
 * Returns:
 * - available: boolean
 * - reason: string (if not available)
 */
router.get('/:designId/availability', async (req, res) => {
  try {
    const { designId } = req.params;

    const result = await purchaseService.checkAvailability(designId);

    return ok(res, result);

  } catch (error) {
    console.error('[Purchase] Check availability error:', error);
    return serverError(res, 'Failed to check availability');
  }
});

module.exports = router;
