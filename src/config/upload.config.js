const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * File upload configuration for design files
 * Supports: Main package (ZIP), Preview images, 3D assets
 */

// File type validation maps
const FILE_TYPES = {
  MAIN_PACKAGE: {
    mimes: ['application/zip', 'application/x-zip-compressed'],
    extensions: ['.zip'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  PREVIEW_IMAGE: {
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  THREE_D_ASSET: {
    mimes: [
      'application/octet-stream',
      'model/obj',
      'model/gltf-binary',
      'application/x-tgif'
    ],
    extensions: ['.skp', '.fbx', '.obj', '.glb', '.gltf'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
};

/**
 * Create upload directory if it doesn't exist
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Multer disk storage configuration
 * Strategy: Local storage now, easy to swap to S3 later
 */
const designStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const designId = req.params.id || 'temp';
    
    // Determine subfolder based on field name
    let folder = 'misc';
    if (file.fieldname === 'mainPackage') folder = 'main';
    if (file.fieldname === 'images') folder = 'images';
    if (file.fieldname === 'assets3d') folder = '3d';

    const uploadPath = path.join(
      process.cwd(),
      'uploads',
      'designs',
      designId,
      folder
    );

    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Sanitize
      .substring(0, 50); // Limit length
    
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter for validation
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Determine expected type based on field name
  let allowedConfig = null;
  if (file.fieldname === 'mainPackage') {
    allowedConfig = FILE_TYPES.MAIN_PACKAGE;
  } else if (file.fieldname === 'images') {
    allowedConfig = FILE_TYPES.PREVIEW_IMAGE;
  } else if (file.fieldname === 'assets3d') {
    allowedConfig = FILE_TYPES.THREE_D_ASSET;
  }

  if (!allowedConfig) {
    return cb(new Error(`Unknown file field: ${file.fieldname}`), false);
  }

  // Check extension
  if (!allowedConfig.extensions.includes(ext)) {
    return cb(
      new Error(
        `Invalid file type for ${file.fieldname}. Allowed: ${allowedConfig.extensions.join(', ')}`
      ),
      false
    );
  }

  // Check MIME type
  if (!allowedConfig.mimes.includes(file.mimetype)) {
    return cb(
      new Error(
        `Invalid MIME type for ${file.fieldname}: ${file.mimetype}`
      ),
      false
    );
  }

  cb(null, true);
};

/**
 * Multer upload configuration
 */
const uploadConfig = multer({
  storage: designStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (for main package)
    files: 21, // Max total files (1 main + 10 images + 10 3D)
  },
});

/**
 * Field configuration for multi-file upload
 */
const uploadFields = uploadConfig.fields([
  { name: 'mainPackage', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'assets3d', maxCount: 10 },
]);

/**
 * Validate file size after upload (multer limits don't work per-field)
 */
const validateFileSize = (file, fieldName) => {
  let maxSize;
  if (fieldName === 'mainPackage') {
    maxSize = FILE_TYPES.MAIN_PACKAGE.maxSize;
  } else if (fieldName === 'images') {
    maxSize = FILE_TYPES.PREVIEW_IMAGE.maxSize;
  } else if (fieldName === 'assets3d') {
    maxSize = FILE_TYPES.THREE_D_ASSET.maxSize;
  }

  if (file.size > maxSize) {
    // Delete uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw new Error(
      `File ${file.originalname} exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`
    );
  }
};

/**
 * Delete design files from disk
 */
const deleteDesignFiles = async (designId) => {
  const designPath = path.join(process.cwd(), 'uploads', 'designs', designId);
  
  if (fs.existsSync(designPath)) {
    fs.rmSync(designPath, { recursive: true, force: true });
  }
};

module.exports = {
  uploadFields,
  uploadConfig,
  validateFileSize,
  deleteDesignFiles,
  FILE_TYPES,
};
