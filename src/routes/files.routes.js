const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');
const { prisma } = require('../lib/prisma.ts');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * POST /files/upload
 * Upload file to design (requires ARCHITECT role)
 */
router.post('/upload', requireAuth, requireRole('ARCHITECT'), async (req, res) => {
  try {
    const { designId, type } = req.body;

    // STEP 3: Placeholder response - Replace with file upload logic later
    return ok(res, {
      file: {
        id: `file-${Date.now()}`,
        name: 'placeholder-file.jpg',
        type: type || 'IMAGE',
        sizeBytes: 0,
        url: '/placeholder-url',
        designId: designId || null,
        uploadedAt: new Date().toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('[Files] Upload error:', error);
    return serverError(res, 'Failed to upload file');
  }
});

/**
 * GET /files/:id
 * Get file metadata
 * Authorization: Public for published designs (images), authenticated for others
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with DB query + auth check later
    return ok(res, {
      file: {
        id,
        name: 'sample-file.jpg',
        type: 'IMAGE',
        sizeBytes: 1024000,
        url: '/placeholder-url',
        designId: 'design-1',
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Files] Get file error:', error);
    return serverError(res, 'Failed to fetch file');
  }
});

/**
 * GET /files/:id/download
 * Download file (requires active license for buyers, or ownership for architects)
 * 
 * Security:
 * - Verifies buyer has purchased the design (ownership check)
 * - Architects can download their own design files
 * - Returns actual file stream (not mock)
 */
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`[Files] Download request - FileID: ${id}, User: ${userId}, Role: ${userRole}`);

    // 1. Fetch file record from database
    const file = await prisma.designFile.findUnique({
      where: { id },
      include: {
        design: {
          select: {
            id: true,
            architectId: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!file) {
      console.error(`[Files] File not found: ${id}`);
      return res.status(404).json({
        error: 'Not found',
        message: 'File not found',
      });
    }

    // 2. Authorization check based on user role
    let authorized = false;

    if (userRole === 'ARCHITECT') {
      // Architects can download their own design files
      if (file.design.architectId === userId) {
        authorized = true;
        console.log('[Files] Authorized: Architect owns design');
      }
    } else if (userRole === 'BUYER') {
      // Buyers must have purchased the design
      const purchase = await prisma.purchase.findFirst({
        where: {
          buyerId: userId,
          designId: file.designId,
        },
      });

      if (purchase) {
        authorized = true;
        console.log(`[Files] Authorized: Buyer has purchase record ${purchase.id}`);
      } else {
        console.warn(`[Files] Unauthorized: Buyer ${userId} has not purchased design ${file.designId}`);
      }
    } else if (userRole === 'ADMIN') {
      // Admins can download any file
      authorized = true;
      console.log('[Files] Authorized: Admin access');
    }

    if (!authorized) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to download this file',
      });
    }

    // 3. Resolve absolute file path
    const absolutePath = path.resolve(process.cwd(), file.storageKey);

    // 4. Verify file exists on disk
    if (!fs.existsSync(absolutePath)) {
      console.error(`[Files] File not found on disk: ${absolutePath}`);
      return res.status(500).json({
        error: 'File not available',
        message: 'File not found on server. Please contact support.',
      });
    }

    // 5. Log download activity
    console.log(`[Files] Download started - User: ${userId}, File: ${file.originalFileName}, Size: ${file.fileSize} bytes`);

    // 6. Set response headers
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalFileName}"`);
    res.setHeader('Content-Length', file.fileSize);

    // 7. Stream file to client
    const fileStream = fs.createReadStream(absolutePath);

    fileStream.on('error', (err) => {
      console.error('[Files] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Download failed',
          message: 'Failed to stream file',
        });
      }
    });

    fileStream.on('end', () => {
      console.log(`[Files] Download completed - File: ${file.originalFileName}`);
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('[Files] Download error:', error);
    return serverError(res, 'Failed to download file');
  }
});

/**
 * DELETE /files/:id
 * Delete file (requires ARCHITECT role and DRAFT design)
 */
router.delete('/:id', requireAuth, requireRole('ARCHITECT'), async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with ownership + state check + delete later
    return ok(res, {
      message: 'File deleted successfully',
      id
    });
  } catch (error) {
    console.error('[Files] Delete error:', error);
    return serverError(res, 'Failed to delete file');
  }
});

module.exports = router;
