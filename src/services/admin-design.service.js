/**
 * Admin Design Service
 * Core logic for admin design review operations
 * 
 * STATE MACHINE (LOCKED):
 * DRAFT → SUBMITTED → APPROVED / REJECTED
 * REJECTED → DRAFT (on architect edit)
 */

const { prisma } = require('../lib/prisma.ts');

class AdminDesignService {
  /**
   * Get all submitted designs awaiting review
   * Only returns designs with status = SUBMITTED
   * 
   * @returns {Promise<Design[]>}
   */
  async getSubmittedDesigns() {
    return prisma.design.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        architect: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        files: {
          select: {
            id: true,
            fileType: true,
            fileName: true,
            fileSize: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
      orderBy: { submittedAt: 'asc' }, // Oldest first (FIFO queue)
    });
  }

  /**
   * Get single design for admin review
   * 
   * @param {string} designId 
   * @returns {Promise<Design>}
   */
  async getDesignForReview(designId) {
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        architect: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        files: {
          orderBy: [
            { fileType: 'asc' },
            { displayOrder: 'asc' },
          ],
        },
      },
    });

    if (!design) {
      throw new Error('Design not found');
    }

    return design;
  }

  /**
   * Approve design (SUBMITTED → APPROVED)
   * 
   * RULES:
   * - Design must be in SUBMITTED state
   * - Auto-generates unique slug for public URLs
   * - Sets publishedAt timestamp (makes it public-ready)
   * - Clears rejection reason and admin notes
   * 
   * @param {string} designId 
   * @param {string} adminId - ID of admin approving
   * @returns {Promise<Design>}
   */
  async approveDesign(designId, adminId) {
    // 1. Get design and verify state
    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      throw new Error('Design not found');
    }

    if (design.status !== 'SUBMITTED') {
      throw new Error(`Cannot approve design with status: ${design.status}. Only SUBMITTED designs can be approved.`);
    }

    // 2. Generate unique slug if not already set
    let slug = design.slug;
    if (!slug) {
      const baseSlug = this._generateSlug(design.title);
      slug = await this._ensureUniqueSlug(baseSlug, designId);
    }

    // 3. Update to APPROVED with public metadata
    const updated = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'APPROVED',
        slug,
        approvedAt: new Date(),
        publishedAt: new Date(), // Makes it public-visible immediately
        rejectionReason: null, // Clear previous rejection if any
        adminNotes: `Approved by admin ${adminId}`,
      },
    });

    console.log(`[AdminDesignService] Design ${designId} approved and published with slug: ${slug}`);

    // TODO: Send email notification to architect
    // await emailService.sendDesignApproved(design.architectId, designId);

    return updated;
  }

  /**
   * Generate URL-friendly slug from title
   * @private
   */
  _generateSlug(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .substring(0, 100); // Limit length
  }

  /**
   * Ensure slug is unique by appending number if needed
   * @private
   */
  async _ensureUniqueSlug(baseSlug, excludeDesignId = null) {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.design.findUnique({
        where: { slug },
        select: { id: true },
      });

      // Slug is available if no design exists or it's the current design
      if (!existing || existing.id === excludeDesignId) {
        return slug;
      }

      // Slug taken, try with counter
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Reject design with reason (SUBMITTED → REJECTED)
   * 
   * RULES:
   * - Design must be in SUBMITTED state
   * - Rejection reason required (min 10 chars)
   * - Architect can edit rejected designs
   * 
   * @param {string} designId 
   * @param {string} reason - Public rejection reason (architect sees this)
   * @param {string} adminId - ID of admin rejecting
   * @param {string} [adminNotes] - Private admin notes (architect doesn't see)
   * @returns {Promise<Design>}
   */
  async rejectDesign(designId, reason, adminId, adminNotes = null) {
    // 1. Validate rejection reason
    if (!reason || reason.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters');
    }

    // 2. Get design and verify state
    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      throw new Error('Design not found');
    }

    if (design.status !== 'SUBMITTED') {
      throw new Error(`Cannot reject design with status: ${design.status}. Only SUBMITTED designs can be rejected.`);
    }

    // 3. Update to REJECTED
    const updated = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        adminNotes: adminNotes ? `Rejected by admin ${adminId}: ${adminNotes}` : `Rejected by admin ${adminId}`,
      },
    });

    // TODO: Send email notification to architect with rejection reason
    // await emailService.sendDesignRejected(design.architectId, designId, reason);

    return updated;
  }

  /**
   * Get design statistics for admin dashboard
   * 
   * @returns {Promise<Object>}
   */
  async getDesignStats() {
    const [total, byStatus] = await Promise.all([
      prisma.design.count(),
      prisma.design.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const stats = {
      total,
      draft: 0,
      submitted: 0,
      approved: 0,
      published: 0,
      rejected: 0,
    };

    byStatus.forEach(stat => {
      const status = stat.status.toLowerCase();
      stats[status] = stat._count;
    });

    return stats;
  }

  /**
   * Get recently reviewed designs (approved or rejected)
   * 
   * @param {number} limit 
   * @returns {Promise<Design[]>}
   */
  async getRecentlyReviewed(limit = 20) {
    return prisma.design.findMany({
      where: {
        status: {
          in: ['APPROVED', 'REJECTED'],
        },
      },
      include: {
        architect: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Check if design can be edited by architect
   * 
   * RULES:
   * - DRAFT: Always editable
   * - REJECTED: Editable (will reset to DRAFT)
   * - SUBMITTED: Locked (awaiting review)
   * - APPROVED: Locked (approved by admin)
   * - PUBLISHED: Locked (live in marketplace)
   * 
   * @param {string} status 
   * @returns {boolean}
   */
  canArchitectEdit(status) {
    return ['DRAFT', 'REJECTED'].includes(status);
  }

  /**
   * Reset rejected design to DRAFT when architect starts editing
   * This ensures clean state for resubmission
   * 
   * @param {string} designId 
   * @returns {Promise<Design>}
   */
  async resetRejectedToDraft(designId) {
    const design = await prisma.design.findUnique({
      where: { id: designId },
    });

    if (!design) {
      throw new Error('Design not found');
    }

    if (design.status !== 'REJECTED') {
      // No need to reset if not rejected
      return design;
    }

    // Reset to DRAFT, keep rejection reason for architect reference
    return prisma.design.update({
      where: { id: designId },
      data: {
        status: 'DRAFT',
        // Keep rejectionReason so architect can see what to fix
        // Keep adminNotes for internal tracking
      },
    });
  }
}

module.exports = new AdminDesignService();
