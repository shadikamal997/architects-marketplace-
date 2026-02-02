const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');

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
 */
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // STEP 3: Placeholder response - Replace with license check + file stream later
    // For now, return mock response
    return ok(res, {
      message: 'File download not implemented yet',
      fileId: id,
      note: 'This will stream file binary data when implemented'
    });
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
