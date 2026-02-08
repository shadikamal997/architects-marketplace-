/**
 * Design validation schemas and rules
 * Provides validation for create, update, and submit operations
 */

const VALID_ENUMS = {
  LICENSE_TYPES: ['STANDARD', 'EXCLUSIVE'],
  STRUCTURAL_SYSTEMS: ['CONCRETE', 'STEEL', 'TIMBER', 'MASONRY', 'MIXED'],
  CLIMATE_ZONES: ['TROPICAL', 'ARID', 'TEMPERATE', 'CONTINENTAL', 'POLAR'],
  DESIGN_STAGES: ['CONCEPT', 'SCHEMATIC', 'DETAILED', 'CONSTRUCTION_READY'],
  AREA_UNITS: ['sqm', 'sqft'],
};

/**
 * Validate create design data (permissive for drafts)
 * Required: title, shortSummary, category, licenseType, standardPrice
 */
const validateCreateDesign = (data) => {
  const errors = [];

  // Required fields - more lenient for draft creation
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 1) {
    errors.push('Title is required');
  }

  if (!data.shortSummary || typeof data.shortSummary !== 'string' || data.shortSummary.trim().length < 1) {
    errors.push('Short summary is required');
  }

  if (!data.category || typeof data.category !== 'string') {
    errors.push('Category is required');
  }

  // Licensing (required)
  if (!data.licenseType || !VALID_ENUMS.LICENSE_TYPES.includes(data.licenseType)) {
    errors.push(`License type must be one of: ${VALID_ENUMS.LICENSE_TYPES.join(', ')}`);
  }

  if (data.standardPrice === undefined || data.standardPrice === null) {
    errors.push('Standard price is required');
  } else if (typeof data.standardPrice !== 'number' || data.standardPrice < 0) {
    errors.push('Standard price must be a positive number');
  }

  // Conditional: exclusive price must be higher than standard
  if (data.exclusivePrice !== undefined && data.exclusivePrice !== null) {
    if (typeof data.exclusivePrice !== 'number' || data.exclusivePrice < 0) {
      errors.push('Exclusive price must be a positive number');
    } else if (data.standardPrice && data.exclusivePrice <= data.standardPrice) {
      errors.push('Exclusive price must be higher than standard price');
    }
  }

  // Optional enum validations
  if (data.structuralSystem && !VALID_ENUMS.STRUCTURAL_SYSTEMS.includes(data.structuralSystem)) {
    errors.push(`Structural system must be one of: ${VALID_ENUMS.STRUCTURAL_SYSTEMS.join(', ')}`);
  }

  if (data.climateZone && !VALID_ENUMS.CLIMATE_ZONES.includes(data.climateZone)) {
    errors.push(`Climate zone must be one of: ${VALID_ENUMS.CLIMATE_ZONES.join(', ')}`);
  }

  if (data.designStage && !VALID_ENUMS.DESIGN_STAGES.includes(data.designStage)) {
    errors.push(`Design stage must be one of: ${VALID_ENUMS.DESIGN_STAGES.join(', ')}`);
  }

  if (data.areaUnit && !VALID_ENUMS.AREA_UNITS.includes(data.areaUnit)) {
    errors.push(`Area unit must be one of: ${VALID_ENUMS.AREA_UNITS.join(', ')}`);
  }

  // Optional number validations
  if (data.totalArea !== undefined && (typeof data.totalArea !== 'number' || data.totalArea < 0)) {
    errors.push('Total area must be a positive number');
  }

  if (data.floors !== undefined && (!Number.isInteger(data.floors) || data.floors < 1)) {
    errors.push('Floors must be a positive integer');
  }

  if (data.bedrooms !== undefined && (!Number.isInteger(data.bedrooms) || data.bedrooms < 0)) {
    errors.push('Bedrooms must be a non-negative integer');
  }

  if (data.bathrooms !== undefined && (!Number.isInteger(data.bathrooms) || data.bathrooms < 0)) {
    errors.push('Bathrooms must be a non-negative integer');
  }

  if (data.parkingSpaces !== undefined && (!Number.isInteger(data.parkingSpaces) || data.parkingSpaces < 0)) {
    errors.push('Parking spaces must be a non-negative integer');
  }

  if (data.estimatedCost !== undefined && (typeof data.estimatedCost !== 'number' || data.estimatedCost < 0)) {
    errors.push('Estimated cost must be a positive number');
  }

  if (data.modificationPrice !== undefined && (typeof data.modificationPrice !== 'number' || data.modificationPrice < 0)) {
    errors.push('Modification price must be a positive number');
  }

  // Optional array validations
  if (data.features !== undefined && !Array.isArray(data.features)) {
    errors.push('Features must be an array');
  }

  if (data.sustainabilityTags !== undefined && !Array.isArray(data.sustainabilityTags)) {
    errors.push('Sustainability tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate update design data (permissive, partial updates)
 * Same rules as create but all fields optional
 */
const validateUpdateDesign = (data) => {
  // If nothing to update, that's valid
  if (Object.keys(data).length === 0) {
    return { valid: true, errors: [] };
  }

  // Use same validation logic but don't require fields
  const errors = [];

  // Validate provided fields
  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length < 3) {
      errors.push('Title must be at least 3 characters');
    }
  }

  if (data.shortSummary !== undefined) {
    if (typeof data.shortSummary !== 'string' || data.shortSummary.trim().length < 10) {
      errors.push('Short summary must be at least 10 characters');
    }
  }

  if (data.category !== undefined) {
    if (typeof data.category !== 'string' || data.category.trim().length === 0) {
      errors.push('Category cannot be empty');
    }
  }

  if (data.licenseType !== undefined && !VALID_ENUMS.LICENSE_TYPES.includes(data.licenseType)) {
    errors.push(`License type must be one of: ${VALID_ENUMS.LICENSE_TYPES.join(', ')}`);
  }

  if (data.standardPrice !== undefined) {
    if (typeof data.standardPrice !== 'number' || data.standardPrice < 0) {
      errors.push('Standard price must be a positive number');
    }
  }

  if (data.exclusivePrice !== undefined && data.exclusivePrice !== null) {
    if (typeof data.exclusivePrice !== 'number' || data.exclusivePrice < 0) {
      errors.push('Exclusive price must be a positive number');
    }
  }

  // Enum validations
  if (data.structuralSystem !== undefined && data.structuralSystem !== null) {
    if (!VALID_ENUMS.STRUCTURAL_SYSTEMS.includes(data.structuralSystem)) {
      errors.push(`Invalid structural system`);
    }
  }

  if (data.climateZone !== undefined && data.climateZone !== null) {
    if (!VALID_ENUMS.CLIMATE_ZONES.includes(data.climateZone)) {
      errors.push(`Invalid climate zone`);
    }
  }

  if (data.designStage !== undefined && data.designStage !== null) {
    if (!VALID_ENUMS.DESIGN_STAGES.includes(data.designStage)) {
      errors.push(`Invalid design stage`);
    }
  }

  if (data.areaUnit !== undefined && data.areaUnit !== null) {
    if (!VALID_ENUMS.AREA_UNITS.includes(data.areaUnit)) {
      errors.push(`Invalid area unit`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate design is ready for submission (strict)
 * Checks all requirements before allowing submit
 */
const validateSubmitDesign = async (design, files) => {
  const errors = [];

  // 1. Basic identity required
  if (!design.title || design.title.trim().length < 3) {
    errors.push('Title is required');
  }

  if (!design.shortSummary || design.shortSummary.trim().length < 10) {
    errors.push('Short summary is required');
  }

  if (!design.category) {
    errors.push('Category is required');
  }

  // 2. Pricing required
  if (!design.standardPrice || design.standardPrice <= 0) {
    errors.push('Standard price is required');
  }

  // 3. Design stage required
  if (!design.designStage) {
    errors.push('Design stage is required');
  }

  // 4. Legal disclaimer must be acknowledged
  if (!design.codeDisclaimer) {
    errors.push('Local code compliance disclaimer must be accepted');
  }

  // 5. Files required
  const mainPackages = files.filter(f => f.fileType === 'MAIN_PACKAGE');
  if (mainPackages.length === 0) {
    errors.push('Main design package (ZIP) is required');
  }

  const previewImages = files.filter(f => f.fileType === 'PREVIEW_IMAGE');
  if (previewImages.length < 3) {
    errors.push('At least 3 preview images are required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Generate URL-friendly slug from title
 */
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .substring(0, 100); // Limit length
};

/**
 * Sanitize design data for database
 * Removes undefined/null values and trims strings
 */
const sanitizeDesignData = (data) => {
  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip undefined/null
    if (value === undefined || value === null) {
      continue;
    }

    // Trim strings
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

module.exports = {
  validateCreateDesign,
  validateUpdateDesign,
  validateSubmitDesign,
  generateSlug,
  sanitizeDesignData,
  VALID_ENUMS,
};
