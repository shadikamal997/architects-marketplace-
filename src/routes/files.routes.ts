import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuthMiddleware } from '../modules/auth/middleware/auth.middleware';
import { requireRole } from '../modules/auth/guards/permission.guard';
import { UserRole } from '../modules/auth/roles.enum';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * POST /files/upload
 * Upload file to design (requires ARCHITECT role)
 */
router.post('/upload', requireAuthMiddleware, requireRole(UserRole.ARCHITECT), async (req, res) => {
  try {
    const { designId, type } = req.body;

    if (!designId || !type) {
      return fail(res, 'designId and type are required', 400);
    }

    // Check if design exists and belongs to architect
    const design = await prisma.design.findFirst({
      where: {
        id: designId,
        architectId: req.user!.id,
      },
    });

    if (!design) {
      return fail(res, 'Design not found or access denied', 404);
    }

    if (design.status !== 'DRAFT') {
      return fail(res, 'Can only upload files to designs in DRAFT status', 400);
    }

    // Create file record (mock for now)
    const file = await prisma.designFile.create({
      data: {
        designId,
        fileType: type as any,
        originalFileName: `placeholder-file-${Date.now()}.jpg`,
        storageKey: `placeholder-key-${Date.now()}`,
        fileSize: 0,
        mimeType: 'image/jpeg',
        uploadedByArchitectId: req.user!.id,
      },
    });

    return ok(res, {
      file: {
        id: file.id,
        name: file.originalFileName,
        type: file.fileType,
        sizeBytes: file.fileSize,
        url: `/api/files/${file.id}`, // Placeholder URL
        designId,
        uploadedAt: file.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('[Files] Upload error:', error);
    return fail(res, 'Failed to upload file', 500);
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
    const fileId = Array.isArray(id) ? id[0] : id;

    const file = await prisma.designFile.findUnique({
      where: { id: fileId },
      include: {
        design: {
          select: {
            id: true,
            status: true,
            architectId: true,
          },
        },
      },
    });

    if (!file) {
      return fail(res, 'File not found', 404);
    }

    // Check permissions
    const isPublicImage = file.fileType === 'PREVIEW_IMAGE' && file.design.status === 'PUBLISHED';
    const isOwner = req.user && req.user!.id === file.design.architectId;
    const hasLicense = req.user && await prisma.license.findFirst({
      where: {
        buyerId: req.user!.id,
        designId: file.design.id,
        status: 'ACTIVE',
      },
    });

    if (!isPublicImage && !isOwner && !hasLicense) {
      return fail(res, 'Access denied', 403);
    }

    return ok(res, {
      file: {
        id: file.id,
        name: file.originalFileName,
        type: file.fileType,
        sizeBytes: file.fileSize,
        url: `/api/files/${file.id}`, // Placeholder URL
        designId: file.designId,
        uploadedAt: file.createdAt,
      },
    });
  } catch (error) {
    console.error('[Files] Get file error:', error);
    return fail(res, 'Failed to fetch file', 500);
  }
});

/**
 * GET /files/:id/download
 * Download file (requires active license for buyers, or ownership for architects)
 */
router.get('/:id/download', requireAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const fileId = Array.isArray(id) ? id[0] : id;

    const file = await prisma.designFile.findUnique({
      where: { id: fileId },
      include: {
        design: {
          select: {
            id: true,
            architectId: true,
          },
        },
      },
    });

    if (!file) {
      return fail(res, 'File not found', 404);
    }

    // Check permissions
    const isOwner = req.user!.id === file.design!.architectId;
    const hasLicense = await prisma.license.findFirst({
      where: {
        buyerId: req.user!.id,
        designId: file.design!.id,
        status: 'ACTIVE',
      },
    });

    if (!isOwner && !hasLicense) {
      return fail(res, 'Access denied - no active license', 403);
    }

    // For now, return placeholder response
    return ok(res, {
      message: 'File download not implemented yet',
      fileId: id,
      note: 'This will stream file binary data when implemented',
    });
  } catch (error) {
    console.error('[Files] Download error:', error);
    return fail(res, 'Failed to download file', 500);
  }
});

/**
 * DELETE /files/:id
 * Delete file (requires ARCHITECT role and DRAFT design)
 */
router.delete('/:id', requireAuthMiddleware, requireRole(UserRole.ARCHITECT), async (req, res) => {
  try {
    const { id } = req.params;
    const fileId = Array.isArray(id) ? id[0] : id;

    const file = await prisma.designFile.findUnique({
      where: { id: fileId },
      include: {
        design: {
          select: {
            id: true,
            status: true,
            architectId: true,
          },
        },
      },
    });

    if (!file) {
      return fail(res, 'File not found', 404);
    }

    if (file.design!.architectId !== req.user!.id) {
      return fail(res, 'Access denied', 403);
    }

    if (file.design!.status !== 'DRAFT') {
      return fail(res, 'Can only delete files from designs in DRAFT status', 400);
    }

    await prisma.designFile.delete({
      where: { id: fileId },
    });

    return ok(res, {
      message: 'File deleted successfully',
      id: fileId,
    });
  } catch (error) {
    console.error('[Files] Delete error:', error);
    return fail(res, 'Failed to delete file', 500);
  }
});

/**
 * GET /designs/:id/files
 * List all files for a design
 * Authorization: Owner (architect) or licensed buyer
 */
router.get('/designs/:id/files', requireAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const designId = Array.isArray(id) ? id[0] : id;

    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: {
        id: true,
        architectId: true,
        status: true,
      },
    });

    if (!design) {
      return fail(res, 'Design not found', 404);
    }

    // Check permissions
    const isOwner = req.user!.id === design.architectId;
    const hasLicense = await prisma.license.findFirst({
      where: {
        buyerId: req.user!.id,
        designId: designId,
        status: 'ACTIVE',
      },
    });

    if (!isOwner && !hasLicense) {
      return fail(res, 'Access denied', 403);
    }

    const files = await prisma.designFile.findMany({
      where: { designId: designId },
      orderBy: { createdAt: 'asc' },
    });

    return ok(res, { files });
  } catch (error) {
    console.error('[Files] List design files error:', error);
    return fail(res, 'Failed to fetch files', 500);
  }
});

export default router;