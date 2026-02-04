/**
 * File validation utilities for design uploads
 */

/**
 * Validate uploaded files against requirements
 * @param {Object} files - Multer files object
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
const validateDesignFiles = (files) => {
  const errors = [];

  // 1. Main package is required
  if (!files.mainPackage || files.mainPackage.length === 0) {
    errors.push('Main design package (ZIP) is required');
  }

  // 2. Minimum 3 preview images required
  if (!files.images || files.images.length < 3) {
    errors.push('At least 3 preview images are required');
  }

  // 3. 3D assets are optional (no validation needed)

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Map uploaded files to DesignFile database records
 * @param {string} designId - Design UUID
 * @param {string} architectId - Architect UUID
 * @param {Object} files - Multer files object
 * @returns {Array} - Array of DesignFile records to create
 */
const mapFilesToRecords = (designId, architectId, files) => {
  const records = [];
  let imageOrder = 0;

  // Map main package
  if (files.mainPackage) {
    files.mainPackage.forEach((file) => {
      records.push({
        designId,
        uploadedByArchitectId: architectId,
        fileType: 'MAIN_PACKAGE',
        originalFileName: file.originalname,
        storageKey: file.path, // Local path (will be S3 key later)
        fileSize: file.size,
        mimeType: file.mimetype,
        isPublicPreview: false,
        displayOrder: null,
      });
    });
  }

  // Map preview images (with display order)
  if (files.images) {
    files.images.forEach((file) => {
      records.push({
        designId,
        uploadedByArchitectId: architectId,
        fileType: 'PREVIEW_IMAGE',
        originalFileName: file.originalname,
        storageKey: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        isPublicPreview: true, // Preview images are public
        displayOrder: imageOrder++,
      });
    });
  }

  // Map 3D assets
  if (files.assets3d) {
    files.assets3d.forEach((file) => {
      records.push({
        designId,
        uploadedByArchitectId: architectId,
        fileType: 'THREE_D_ASSET',
        originalFileName: file.originalname,
        storageKey: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        isPublicPreview: false,
        displayOrder: null,
      });
    });
  }

  return records;
};

/**
 * Format file info for API response
 * @param {Array} fileRecords - Array of DesignFile records from DB
 * @returns {Object} - Grouped file info
 */
const formatFileResponse = (fileRecords) => {
  return {
    mainPackage: fileRecords.find(f => f.fileType === 'MAIN_PACKAGE') || null,
    images: fileRecords
      .filter(f => f.fileType === 'PREVIEW_IMAGE')
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
    assets3d: fileRecords.filter(f => f.fileType === 'THREE_D_ASSET'),
    totalSize: fileRecords.reduce((sum, f) => sum + f.fileSize, 0),
    totalCount: fileRecords.length,
  };
};

/**
 * Get file type enum from field name
 */
const getFileTypeFromField = (fieldName) => {
  const map = {
    mainPackage: 'MAIN_PACKAGE',
    images: 'PREVIEW_IMAGE',
    assets3d: 'THREE_D_ASSET',
  };
  return map[fieldName] || null;
};

module.exports = {
  validateDesignFiles,
  mapFilesToRecords,
  formatFileResponse,
  getFileTypeFromField,
};
