const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');
const { prisma } = require('../lib/prisma.ts');
const { uploadFields, validateFileSize, handleMulterError } = require('../config/upload.config');
const {
  validateDesignFiles,
  mapFilesToRecords,
  formatFileResponse,
} = require('../utils/file-validation');
const {
  validateCreateDesign,
  validateUpdateDesign,
  validateSubmitDesign,
  generateSlug,
  sanitizeDesignData,
} = require('../utils/design-validation');

const router = express.Router();

// All architect routes require authentication and ARCHITECT role
router.use(requireAuth);
router.use(requireRole('ARCHITECT'));

/**
 * POST /architect/designs
 * Create new design (DRAFT state)
 * 
 * Required fields:
 * - title (min 3 chars)
 * - shortSummary (min 10 chars)
 * - category
 * - licenseType (STANDARD | EXCLUSIVE)
 * - standardPrice (positive number)
 * 
 * All other fields optional for draft creation
 */
router.post('/designs', async (req, res) => {
  try {
    const architectId = req.user.id;
    const data = req.body;

    // 1. Validate input data
    const validation = validateCreateDesign(data);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid design data',
        details: validation.errors,
      });
    }

    // 2. Sanitize and prepare data
    const sanitized = sanitizeDesignData(data);
    
    // 3. Generate unique slug
    const baseSlug = generateSlug(sanitized.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Check for slug uniqueness
    while (await prisma.design.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 4. Create design in database
    const design = await prisma.design.create({
      data: {
        ...sanitized,
        slug,
        architectId,
        status: 'DRAFT',
        // Convert to Decimal for price field (backward compatibility)
        price: sanitized.standardPrice || 0,
      },
    });

    return ok(res, {
      design: {
        id: design.id,
        title: design.title,
        slug: design.slug,
        shortSummary: design.shortSummary,
        category: design.category,
        status: design.status,
        licenseType: design.licenseType,
        standardPrice: design.standardPrice,
        exclusivePrice: design.exclusivePrice,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
      },
    }, 201);

  } catch (error) {
    console.error('[Architect] Create design error:', error);
    return serverError(res, 'Failed to create design');
  }
});

/**
 * GET /architect/designs
 * List architect's own designs with stats
 * 
 * Query params:
 * - status: Filter by status (DRAFT, SUBMITTED, APPROVED, PUBLISHED)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 */
router.get('/designs', async (req, res) => {
  try {
    const architectId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = { architectId };
    if (status && ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REJECTED'].includes(status)) {
      where.status = status;
    }

    // Fetch designs with file counts
    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        include: {
          files: {
            select: {
              id: true,
              fileType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.design.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.design.groupBy({
      by: ['status'],
      where: { architectId },
      _count: true,
    });

    const statsMap = {
      total: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      published: 0,
      rejected: 0,
    };

    stats.forEach(stat => {
      statsMap.total += stat._count;
      statsMap[stat.status.toLowerCase()] = stat._count;
    });

    // Format response
    const formattedDesigns = designs.map(d => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      shortSummary: d.shortSummary,
      category: d.category,
      status: d.status,
      standardPrice: d.standardPrice,
      licenseType: d.licenseType,
      filesCount: d.files.length,
      previewImagesCount: d.files.filter(f => f.fileType === 'PREVIEW_IMAGE').length,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      submittedAt: d.submittedAt,
      approvedAt: d.approvedAt,
      publishedAt: d.publishedAt,
    }));

    return ok(res, {
      designs: formattedDesigns,
      stats: statsMap,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('[Architect] List designs error:', error);
    return serverError(res, 'Failed to fetch designs');
  }
});

/**
 * GET /architect/designs/:id
 * Get single design (must be owner)
 * Includes all fields and file information
 */
router.get('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const architectId = req.user.id;

    // Fetch design with files
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
      include: {
        files: {
          orderBy: [
            { fileType: 'asc' },
            { displayOrder: 'asc' },
          ],
        },
      },
    });

    if (!design) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found or you do not have permission',
      });
    }

    // Format files
    const formattedFiles = formatFileResponse(design.files);

    return ok(res, {
      design: {
        ...design,
        files: formattedFiles,
      },
    });

  } catch (error) {
    console.error('[Architect] Get design error:', error);
    return serverError(res, 'Failed to fetch design');
  }
});

/**
 * PUT /architect/designs/:id
 * Update design (DRAFT only)
 * 
 * Security: Only architect owner can update
 * State enforcement: Only DRAFT designs can be updated
 * Validation: Partial updates, validates provided fields
 */
router.put('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const architectId = req.user.id;
    const data = req.body;

    // 1. Verify design exists and architect is owner
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
    });

    if (!design) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found or you do not have permission',
      });
    }

    // 2. State enforcement: Only DRAFT and REJECTED can be updated
    if (!['DRAFT', 'REJECTED'].includes(design.status)) {
      return res.status(400).json({
        error: 'Design locked',
        message: 'Can only update designs in DRAFT or REJECTED status',
        currentStatus: design.status,
      });
    }

    // 3. Validate update data
    const validation = validateUpdateDesign(data);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid update data',
        details: validation.errors,
      });
    }

    // 4. Sanitize data
    const sanitized = sanitizeDesignData(data);

    // 5. If design is REJECTED, reset to DRAFT for clean resubmission
    if (design.status === 'REJECTED') {
      sanitized.status = 'DRAFT';
      // Keep rejectionReason so architect can see what to fix
      console.log(`[Architect] Resetting rejected design ${id} to DRAFT for editing`);
    }

    // 6. Update slug if title changed
    if (sanitized.title && sanitized.title !== design.title) {
      const baseSlug = generateSlug(sanitized.title);
      let slug = baseSlug;
      let counter = 1;
      
      while (await prisma.design.findFirst({ 
        where: { 
          slug,
          id: { not: id } // Exclude current design
        } 
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      sanitized.slug = slug;
    }

    // 7. Update backward-compatible price field if standardPrice changed
    if (sanitized.standardPrice !== undefined) {
      sanitized.price = sanitized.standardPrice;
    }

    // 8. Perform update
    const updated = await prisma.design.update({
      where: { id },
      data: sanitized,
    });

    return ok(res, {
      design: updated,
      message: 'Design updated successfully',
    });

  } catch (error) {
    console.error('[Architect] Update design error:', error);
    return serverError(res, 'Failed to update design');
  }
});

/**
 * DELETE /architect/designs/:id
 * Delete design (DRAFT only)
 * 
 * Security: Only architect owner can delete
 * State enforcement: Only DRAFT designs can be deleted
 * Cleanup: Deletes all associated files from disk and database
 */
router.delete('/designs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const architectId = req.user.id;

    // 1. Verify design exists and architect is owner
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
      include: {
        files: true,
      },
    });

    if (!design) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found or you do not have permission',
      });
    }

    // 2. State enforcement: Only DRAFT and REJECTED can be deleted
    if (!['DRAFT', 'REJECTED'].includes(design.status)) {
      return res.status(400).json({
        error: 'Design locked',
        message: 'Can only delete designs in DRAFT or REJECTED status',
        currentStatus: design.status,
      });
    }

    // 3. Delete physical files from disk
    const fs = require('fs');
    const path = require('path');
    
    design.files.forEach(file => {
      if (fs.existsSync(file.storageKey)) {
        try {
          fs.unlinkSync(file.storageKey);
        } catch (err) {
          console.error(`Failed to delete file ${file.storageKey}:`, err);
        }
      }
    });

    // 4. Delete design folder
    const designFolder = path.join(process.cwd(), 'uploads', 'designs', id);
    if (fs.existsSync(designFolder)) {
      try {
        fs.rmSync(designFolder, { recursive: true, force: true });
      } catch (err) {
        console.error(`Failed to delete design folder:`, err);
      }
    }

    // 5. Delete from database (CASCADE deletes files)
    await prisma.design.delete({
      where: { id },
    });

    return ok(res, {
      success: true,
      message: 'Design deleted successfully',
      id,
    });

  } catch (error) {
    console.error('[Architect] Delete design error:', error);
    return serverError(res, 'Failed to delete design');
  }
});

/**
 * POST /architect/designs/:id/submit
 * Submit design for admin review (DRAFT → SUBMITTED)
 * 
 * STRICT VALIDATION:
 * - Design must be in DRAFT status
 * - Must have title, shortSummary, category
 * - Must have valid pricing
 * - Must have design stage
 * - Must have code disclaimer accepted
 * - Must have main package file
 * - Must have at least 3 preview images
 * 
 * After submission, design becomes locked (no edits until admin action)
 */
router.post('/designs/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const architectId = req.user.id;
    const { codeDisclaimerAccepted } = req.body;

    // 1. Verify design exists and architect is owner
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
      include: {
        files: true,
      },
    });

    if (!design) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Design not found or you do not have permission',
      });
    }

    // 2. State enforcement: Only DRAFT can be submitted
    if (design.status !== 'DRAFT') {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Design has already been submitted',
        currentStatus: design.status,
      });
    }

    // 3. Validate code disclaimer acceptance
    if (!codeDisclaimerAccepted) {
      return res.status(400).json({
        error: 'Disclaimer required',
        message: 'You must accept the local code compliance disclaimer',
      });
    }

    // 4. STRICT VALIDATION: Check all requirements
    const validation = await validateSubmitDesign(design, design.files);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Submission requirements not met',
        message: 'Design is not ready for submission',
        details: validation.errors,
      });
    }

    // 5. Update design status to SUBMITTED
    const updated = await prisma.design.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        codeDisclaimer: true,
      },
    });

    // 6. TODO: Send notification to admins (future)
    // await notifyAdmins('NEW_SUBMISSION', { designId: id, architectId });

    return ok(res, {
      success: true,
      message: 'Design submitted successfully for admin review',
      design: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        submittedAt: updated.submittedAt,
      },
    });

  } catch (error) {
    console.error('[Architect] Submit design error:', error);
    return serverError(res, 'Failed to submit design');
  }
});

/**
 * POST /architect/designs/:id/files
 * Upload design files (main package, preview images, 3D assets)
 * 
 * Security:
 * - Only architect owner can upload
 * - Only when design status = DRAFT
 * 
 * File Requirements:
 * - mainPackage: Required, ZIP file, max 500MB
 * - images: Required, min 3, max 10, JPG/PNG/WEBP, max 10MB each
 * - assets3d: Optional, max 10, SKP/FBX/OBJ/GLB, max 100MB each
 */
router.post('/designs/:id/files', uploadFields, handleMulterError, async (req, res) => {
  console.log('[UPLOAD] START', {
    designId: req.params.id,
    userId: req.user?.id,
    filesReceived: req.files ? Object.keys(req.files) : [],
  });
  console.log('[UPLOAD] fields received:', Object.keys(req.files || {}));

  try {
    const { id } = req.params;
    const architectId = req.user.id;
    const files = req.files || {};

    console.log('[UPLOAD] Files breakdown', {
      mainPackage: files.mainPackage?.length || 0,
      images: files.images?.length || 0,
      assets3d: files.assets3d?.length || 0,
    });

    // 1. Verify design exists and architect is owner
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
    });

    if (!design) {
      console.error('[UPLOAD ERROR] Design not found', { id, architectId });
      return res.status(403).json({
        error: 'Access denied',
        message: 'Design not found or you do not have permission to upload files',
      });
    }

    // 2. Verify design is in DRAFT status
    if (design.status !== 'DRAFT') {
      return res.status(400).json({
        error: 'Design locked',
        message: 'Can only upload files when design status is DRAFT',
        currentStatus: design.status,
      });
    }

    // 3. Validate file sizes (per-field limits)
    try {
      if (files.mainPackage) {
        files.mainPackage.forEach(f => validateFileSize(f, 'mainPackage'));
      }
      if (files.images) {
        files.images.forEach(f => validateFileSize(f, 'images'));
      }
      if (files.assets3d) {
        files.assets3d.forEach(f => validateFileSize(f, 'assets3d'));
      }
    } catch (sizeError) {
      return res.status(400).json({
        error: 'File size limit exceeded',
        message: sizeError.message,
      });
    }

    // 4. Validate file requirements (main package + min 3 images)
    const validation = validateDesignFiles(files);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'File requirements not met',
        details: validation.errors,
      });
    }

    // 5. Map files to DesignFile records
    const fileRecords = mapFilesToRecords(id, architectId, files);

    // 6. DB-SIDE SAFETY GUARDS
    
    // 6a. Guard against empty record sets (prevents obscure Prisma errors)
    if (!fileRecords || fileRecords.length === 0) {
      return res.status(400).json({
        error: 'No valid files',
        message: 'No valid files to save',
      });
    }

    // 6b. Final ownership verification (prevents cross-user contamination)
    if (design.architectId !== architectId) {
      return res.status(403).json({
        error: 'Ownership violation',
        message: 'Invalid design ownership',
      });
    }

    // 6c. Save to database with transaction safety
    await prisma.$transaction(async (tx) => {
      await tx.designFile.createMany({
        data: fileRecords,
      });
    });

    // 7. Fetch created records for response
    const savedFiles = await prisma.designFile.findMany({
      where: { designId: id },
      orderBy: { createdAt: 'desc' },
    });

    // 8. Format response
    const formattedFiles = formatFileResponse(savedFiles);

    return ok(res, {
      success: true,
      message: 'Files uploaded successfully',
      files: formattedFiles,
      uploadedCount: fileRecords.length,
    });

  } catch (error) {
    console.error('[UPLOAD ERROR] Full error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return serverError(res, 'Failed to upload files');
  }
});

/**
 * GET /architect/designs/:id/files
 * Get all files for a design
 */
router.get('/designs/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const architectId = req.user.id;

    // Verify ownership
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
    });

    if (!design) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Design not found or you do not have permission',
      });
    }

    // Fetch files
    const files = await prisma.designFile.findMany({
      where: { designId: id },
      orderBy: [
        { fileType: 'asc' },
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const formattedFiles = formatFileResponse(files);

    return ok(res, {
      designId: id,
      files: formattedFiles,
    });

  } catch (error) {
    console.error('[Architect] Get files error:', error);
    return serverError(res, 'Failed to fetch files');
  }
});

/**
 * DELETE /architect/designs/:id/files/:fileId
 * Delete a specific file
 */
router.delete('/designs/:id/files/:fileId', async (req, res) => {
  try {
    const { id, fileId } = req.params;
    const architectId = req.user.id;

    // Verify ownership
    const design = await prisma.design.findFirst({
      where: {
        id,
        architectId,
      },
    });

    if (!design) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    // Verify design is DRAFT
    if (design.status !== 'DRAFT') {
      return res.status(400).json({
        error: 'Cannot delete files',
        message: 'Design must be in DRAFT status to delete files',
      });
    }

    // Delete file record and physical file
    const file = await prisma.designFile.findUnique({
      where: { id: fileId },
    });

    if (!file || file.designId !== id) {
      return res.status(404).json({
        error: 'File not found',
      });
    }

    // Delete from filesystem
    const fs = require('fs');
    if (fs.existsSync(file.storageKey)) {
      fs.unlinkSync(file.storageKey);
    }

    // Delete from database
    await prisma.designFile.delete({
      where: { id: fileId },
    });

    return ok(res, {
      success: true,
      message: 'File deleted successfully',
      fileId,
    });

  } catch (error) {
    console.error('[Architect] Delete file error:', error);
    return serverError(res, 'Failed to delete file');
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

/**
 * GET /architect/reviews
 * Get all reviews for architect's own designs
 * Returns reviews with buyer info and design title
 */
router.get('/reviews', async (req, res) => {
  try {
    const architectId = req.user.id;

    // Get all reviews for designs owned by this architect
    const reviews = await prisma.review.findMany({
      where: {
        design: {
          architectId: architectId
        },
        status: 'PUBLISHED'
      },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            displayName: true
          }
        },
        design: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Group by design for easy overview
    const reviewsByDesign = {};
    let totalReviews = 0;
    let totalRating = 0;

    reviews.forEach(review => {
      const designId = review.design.id;
      
      if (!reviewsByDesign[designId]) {
        reviewsByDesign[designId] = {
          designId: review.design.id,
          designTitle: review.design.title,
          designSlug: review.design.slug,
          reviews: [],
          averageRating: 0,
          reviewCount: 0
        };
      }

      reviewsByDesign[designId].reviews.push({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        buyer: {
          id: review.buyer.id,
          name: review.buyer.displayName || review.buyer.email.split('@')[0]
        },
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      });

      reviewsByDesign[designId].reviewCount++;
      reviewsByDesign[designId].averageRating += review.rating;
      
      totalReviews++;
      totalRating += review.rating;
    });

    // Calculate averages
    Object.values(reviewsByDesign).forEach(design => {
      design.averageRating = design.reviewCount > 0 
        ? Number((design.averageRating / design.reviewCount).toFixed(2))
        : 0;
    });

    const overallAverage = totalReviews > 0 
      ? Number((totalRating / totalReviews).toFixed(2))
      : 0;

    return ok(res, {
      summary: {
        totalReviews,
        overallAverageRating: overallAverage,
        designsWithReviews: Object.keys(reviewsByDesign).length
      },
      byDesign: Object.values(reviewsByDesign)
    });

  } catch (error) {
    console.error('[Architect] Get reviews error:', error);
    return serverError(res, 'Failed to fetch reviews');
  }
});

module.exports = router;
