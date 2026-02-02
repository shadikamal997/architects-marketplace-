import './env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { storageService } from './shared/services/storage.service';
import { paymentService } from './shared/services/payment.service';
import { watermarkingService } from './shared/services/watermarking.service';
import modificationRoutes from './routes/modifications';
import marketplaceRoutes from './routes/marketplace.routes';
import architectRoutes from './routes/architect.routes';
import adminRoutes from './routes/admin.routes';
import buyerRoutes from './routes/buyer.routes';
import searchRoutes from './routes/search.routes';
import filesRoutes from './routes/files.routes';
import authRoutes from './routes/auth.routes';
import { validateEnvironment, EnvironmentValidator } from './shared/utils/env-validation';
import { logger } from './shared/utils/logger';
import { logContactUnlock } from './domain/contactAudit';
import { prisma } from './lib/prisma';
import { logAuditAction } from './shared/utils/index';
import { logMessagingEvent, logLicenseEvent } from './shared/services/audit.service';
import { initializeSentry, sentryPerformanceMiddleware, monitoring, sentryErrorHandler } from './shared/utils/sentry';

// Data integrity fix function
async function fixDataIntegrity() {
  try {
    // Find designs with null status or price using raw SQL since Prisma doesn't support null filters directly
    const designsWithNullStatus = await prisma.$queryRaw`
      SELECT id, title, status, price FROM "Design" WHERE status IS NULL
    ` as any[];

    const designsWithNullPrice = await prisma.$queryRaw`
      SELECT id, title, status, price FROM "Design" WHERE price IS NULL
    ` as any[];

    console.log(`Found ${designsWithNullStatus.length} designs with null status`);
    console.log(`Found ${designsWithNullPrice.length} designs with null price`);

    // Fix designs with null status - set to DRAFT
    if (designsWithNullStatus.length > 0) {
      await prisma.$executeRaw`
        UPDATE "Design" SET status = 'DRAFT' WHERE status IS NULL
      `;
      console.log(`✅ Fixed ${designsWithNullStatus.length} designs with null status → DRAFT`);
    }

    // For designs with null price, set to 0.00 (they won't be publishable until price is set)
    if (designsWithNullPrice.length > 0) {
      await prisma.$executeRaw`
        UPDATE "Design" SET price = 0.00 WHERE price IS NULL
      `;
      console.log(`✅ Fixed ${designsWithNullPrice.length} designs with null price → 0.00`);
      console.log(`⚠️  These designs cannot be published until price is set properly`);
    }

  } catch (error) {
    console.error('❌ Error during data integrity fix:', error);
  }
}

// Validate environment configuration
validateEnvironment();

// Initialize Sentry for error monitoring and performance tracking
initializeSentry();

const envInfo = EnvironmentValidator.getEnvironmentInfo();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 10 // Max 10 files per upload
  }
});

// Performance constants
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_FILES_PER_DESIGN = 20;
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// File validation constants
const MAX_INDIVIDUAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.zip', '.rar', '.7z', '.jpg', '.jpeg', '.png', '.gif',
  '.dwg', '.dxf', '.ifc', '.skp', '.rvt', '.obj', '.fbx', '.stl'
];

// Function to determine FileType from mime type
function getFileType(mimeType: string): any {
  const mimeToType: { [key: string]: any } = {
    'application/pdf': 'DOCUMENT',
    'application/zip': 'DESIGN_ARCHIVE',
    'image/jpeg': 'PREVIEW_IMAGE',
    'image/png': 'PREVIEW_IMAGE',
    'application/acad': 'CAD_FILE', // DWG
    'application/x-autocad': 'CAD_FILE',
    'model/vnd.ifc': 'BIM_FILE', // IFC
    'application/ifc': 'BIM_FILE',
    'application/x-sketchup': 'BIM_FILE', // SKP
    'application/octet-stream': 'OTHER' // Fallback for RVT etc.
  };
  return mimeToType[mimeType] || 'OTHER';
}

// CORS configuration - environment specific
const corsOptions = envInfo.isProduction
  ? {
      origin: process.env.FRONTEND_URL || false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400 // 24 hours
    }
  : {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    };

app.use(cors(corsOptions));

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
  hsts: envInfo.isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: true, // X-XSS-Protection
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Sentry performance monitoring middleware
app.use(sentryPerformanceMiddleware);

// Additional security headers
app.use((req, res, next) => {
  // X-Frame-Options: DENY (prevent clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff (already set by helmet)
  // Referrer-Policy: strict-origin-when-cross-origin (already set by helmet)

  next();
});

// Rate limiting (disabled for development/localhost)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
  }
});

// Stricter rate limiting for auth endpoints (disabled for localhost)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 auth attempts per windowMs (increased for development)
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, not just failed ones
  skipFailedRequests: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
  }
});

// Stricter rate limiting for payment endpoints (disabled for localhost)
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 payment attempts per hour
  message: {
    error: 'Too many payment attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
  }
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/stripe', paymentLimiter);
app.use('/api/webhooks', paymentLimiter); // Webhooks should be rate limited too
app.use(limiter); // General rate limiting for all other routes

// Request ID and logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = logger.generateRequestId();
  (req as any).requestId = requestId;
  (req as any).startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log incoming request
  logger.info(`Incoming request: ${req.method} ${req.url}`, {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req as any).startTime;
    logger.httpRequest(req.method, req.url, res.statusCode, duration, {
      requestId,
      statusCode: res.statusCode,
      duration,
      ip: req.ip
    });
  });

  next();
});

// HTTPS enforcement in production
if (envInfo.isProduction) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      logger.warn('HTTP request in production environment', {
        requestId: (req as any).requestId,
        ip: req.ip,
        url: req.url
      });
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  }, REQUEST_TIMEOUT_MS);

  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
});

// Pagination enforcement middleware for list endpoints
const enforcePagination = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Only enforce pagination for GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const listEndpoints = ['/designs', '/marketplace/designs', '/architect/designs', '/api/architects/earnings'];

  // Check if this is a list endpoint (not a specific item endpoint)
  const isListEndpoint = listEndpoints.some(endpoint => {
    // For /designs, only enforce if it's exactly /designs or /designs with query params
    if (endpoint === '/designs') {
      return req.path === '/designs' || (req.path.startsWith('/designs') && req.path.split('/').length === 2);
    }
    return req.path.startsWith(endpoint);
  });

  if (isListEndpoint) {
    const { page, limit } = req.query;

    // If no pagination parameters provided, reject the request
    if (!page && !limit) {
      return res.status(400).json({
        error: 'Pagination required for list endpoints. Please provide page and/or limit parameters.',
        pagination: {
          defaultLimit: DEFAULT_PAGE_SIZE,
          maxLimit: MAX_PAGE_SIZE
        }
      });
    }
  }

  next();
};

// app.use(enforcePagination);

// Stripe webhook raw body parsing (must be before express.json())
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }));

// JSON body parsing with size limits to prevent DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check Stripe connectivity (in non-production, this might fail gracefully)
    let stripeStatus = 'unknown';
    try {
      if (paymentService) {
        const testResult = await paymentService.testConnection();
        stripeStatus = testResult ? 'healthy' : 'unhealthy';
      }
    } catch (error) {
      stripeStatus = 'error';
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: envInfo.environment,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: 'healthy',
        stripe: stripeStatus
      },
      responseTime: Date.now() - startTime
    };

    logger.info('Health check passed', {
      requestId: (req as any).requestId,
      responseTime: health.responseTime
    });

    res.json(health);
  } catch (error) {
    logger.error('Health check failed', error as Error, {
      requestId: (req as any).requestId
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: envInfo.environment,
      error: 'Service unavailable',
      responseTime: Date.now() - startTime
    });
  }
});

// Register routes
app.use('/auth', authRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/architect', architectRoutes);
app.use('/admin', adminRoutes);
app.use('/buyer', buyerRoutes);
app.use('/search', searchRoutes);
app.use('/designs', filesRoutes);
app.use("/api/modifications", modificationRoutes);

// JWT Secret from environment variable - STRICT VALIDATION
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ CRITICAL: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

// Auth middleware - USE HARDENED MODULAR VERSION
const { requireAuthMiddleware, optionalAuthMiddleware } = require('./modules/auth/middleware/auth.middleware');

// Auth routes
// Auth routes moved to auth.routes.ts

// Design endpoints
app.get('/designs/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await prisma.design.count({
      where: { status: 'PUBLISHED' }
    });

    // Get designs with architect info
    const designs = await prisma.design.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        },
        files: {
          where: { 
            fileType: 'PREVIEW_IMAGE',
            isPublicPreview: true 
          },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      designs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching designs:', error);
    res.status(500).json({ error: 'Failed to fetch designs' });
  }
});

app.get('/designs/:id', async (req, res) => {
  try {
    const design = await prisma.design.findUnique({
      where: { id: req.params.id as string },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    // Check if user can access direct contact
    let canAccessContact = false;
    const user = (req as any).user;
    
    if (user?.buyer) {
      // For now, all licenses are STANDARD, so contact access is always false
      // TODO: Implement EXCLUSIVE license type checking when that feature is added
      canAccessContact = false;
    }

    // Build response with conditional contact info
    const response: any = {
      ...design,
      architect: {
        ...design.architect,
        user: {
          name: design.architect.user.name
        }
      }
    };

    // Only include email if user has contact access
    if (canAccessContact) {
      // Get architect with email
      const architectWithEmail = await prisma.architect.findUnique({
        where: { id: design.architect.id },
        include: {
          user: {
            select: { email: true }
          }
        }
      });
      
      if (architectWithEmail) {
        response.architect.user.email = architectWithEmail.user.email;
      }
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/designs', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const { title, description, price, category } = req.body;

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    if (price === null || price === undefined || isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    const design = await prisma.design.create({
      data: {
        title,
        description,
        price: parseFloat(price), // Ensure price is a number
        category: category || 'residential',
        architectId: user.architect.id,
        status: 'DRAFT'  // Create as DRAFT for architect workflow
      },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Transform response to match frontend expectations
    const transformedDesign = {
      ...design,
      priceUsdCents: Math.round(Number(design.price) * 100),
      state: design.status,
      architectName: design.architect.user.name
    };

    res.status(201).json(transformedDesign);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/designs/:id', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const designId = req.params.id as string;
    const { title, description, price, category } = req.body;

    // Check if design exists and belongs to the architect and is DRAFT
    const existingDesign = await prisma.design.findUnique({
      where: { id: designId }
    });

    if (!existingDesign) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (existingDesign.architectId !== user.architect.id) {
      return res.status(403).json({ error: 'Not authorized to update this design' });
    }

    if (existingDesign.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT designs can be updated' });
    }

    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: {
        title,
        description,
        price,
        category
      },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json(updatedDesign);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload files to design
app.post('/api/designs/:designId/files', requireAuthMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const designId = req.params.designId as string;

    // Check if design exists and belongs to the architect
    const design = await prisma.design.findUnique({
      where: { id: designId }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.architectId !== user.architect.id) {
      return res.status(403).json({ error: 'Not authorized to upload files to this design' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Check current file count for this design
    const currentFileCount = await prisma.designFile.count({
      where: { designId }
    });

    if (currentFileCount + files.length > MAX_FILES_PER_DESIGN) {
      return res.status(400).json({
        error: `Design already has ${currentFileCount} files. Maximum ${MAX_FILES_PER_DESIGN} files allowed per design.`
      });
    }

    const uploadedFiles = [];
    const failedFiles = [];

    for (const file of files) {
      try {
        // Validate individual file size
        if (file.size > MAX_INDIVIDUAL_FILE_SIZE) {
          failedFiles.push({
            filename: file.originalname,
            error: `File too large. Maximum size is ${MAX_INDIVIDUAL_FILE_SIZE / (1024 * 1024)}MB`
          });
          continue;
        }

        // Validate filename length
        if (file.originalname.length > MAX_FILENAME_LENGTH) {
          failedFiles.push({
            filename: file.originalname,
            error: `Filename too long. Maximum length is ${MAX_FILENAME_LENGTH} characters`
          });
          continue;
        }

        // Validate filename for special characters (basic check)
        const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (invalidChars.test(file.originalname)) {
          failedFiles.push({
            filename: file.originalname,
            error: 'Filename contains invalid characters'
          });
          continue;
        }

        // Validate file extension
        const fileExt = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        if (!ALLOWED_FILE_EXTENSIONS.includes(fileExt)) {
          failedFiles.push({
            filename: file.originalname,
            error: `Invalid file extension. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
          });
          continue;
        }

        // Validate file type (more comprehensive check)
        const allowedMimes = [
          'application/pdf',
          'application/zip',
          'application/x-zip-compressed',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/acad',
          'application/x-autocad',
          'image/vnd.dwg',
          'image/vnd.dxf',
          'model/vnd.ifc',
          'application/ifc',
          'application/x-sketchup',
          'application/octet-stream'
        ];

        if (!allowedMimes.includes(file.mimetype)) {
          failedFiles.push({
            filename: file.originalname,
            error: `Invalid file type: ${file.mimetype}`
          });
          continue;
        }

        // Generate unique storage key with secure filename sanitization
        const uuid = uuidv4();
        // SECURE: Prevent path traversal by removing all path separators and control characters
        const sanitizedFilename = file.originalname
          .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
          .replace(/[\/\\:*?"<>|]/g, '_') // Replace path separators and invalid chars
          .replace(/\.\./g, '_') // Prevent directory traversal
          .substring(0, MAX_FILENAME_LENGTH); // Enforce length limit

        const storageKey = `designs/${designId}/${uuid}-${sanitizedFilename}`;

        let uploadedFile = null;
        let designFile = null;

        try {
          // Upload to storage first
          uploadedFile = await storageService.uploadFile(file.buffer, storageKey, file.mimetype, { public: false });

          // Determine file type
          const fileType = getFileType(file.mimetype);

          // Create DesignFile record
          designFile = await prisma.designFile.create({
            data: {
              designId,
              uploadedByArchitectId: user.architect.id,
              fileType,
              originalFileName: file.originalname,
              storageKey,
              fileSize: file.size,
              mimeType: file.mimetype,
              isPublicPreview: fileType === 'PREVIEW_IMAGE'
            }
          });

          uploadedFiles.push({
            id: designFile.id,
            fileType: designFile.fileType,
            originalFileName: designFile.originalFileName,
            fileSize: designFile.fileSize,
            mimeType: designFile.mimeType,
            isPublicPreview: designFile.isPublicPreview,
            createdAt: designFile.createdAt
          });

        } catch (uploadError) {
          // Cleanup: delete uploaded file if database creation failed
          if (uploadedFile) {
            try {
              await storageService.deleteFile(storageKey);
            } catch (cleanupError) {
              console.error('Failed to cleanup uploaded file:', cleanupError);
            }
          }
          throw uploadError;
        }

      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        failedFiles.push({
          filename: file.originalname,
          error: 'Upload failed due to server error'
        });
      }
    }

    // Return results
    if (uploadedFiles.length === 0 && failedFiles.length > 0) {
      return res.status(400).json({
        error: 'All files failed to upload',
        failedFiles
      });
    }

    res.status(201).json({
      files: uploadedFiles,
      ...(failedFiles.length > 0 && { failedFiles })
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get files for a design (with access control)
app.get('/api/designs/:designId/files', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const designId = req.params.designId as string;

    // Check if design exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        files: true
      }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    let accessibleFiles = [];

    if (user.architect && design.architectId === user.architect.id) {
      // Architect owns the design - can see all files
      accessibleFiles = design.files.map(file => ({
        id: file.id,
        fileType: file.fileType,
        originalFileName: file.originalFileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        isPublicPreview: file.isPublicPreview,
        createdAt: file.createdAt
      }));
    } else if (user.buyer) {
      // Buyer - check license and show appropriate files
      const license = await prisma.license.findFirst({
        where: {
          buyerId: user.buyer.id,
          designId: designId,
          status: 'ACTIVE'
        }
      });

      if (!license) {
        return res.status(403).json({ error: 'No active license found for this design' });
      }

      // Show preview files always
      const previewFiles = design.files
        .filter(file => file.isPublicPreview)
        .map(file => ({
          id: file.id,
          fileType: file.fileType,
          originalFileName: file.originalFileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          isPublicPreview: file.isPublicPreview,
          createdAt: file.createdAt,
          canDownload: true // Preview files are always downloadable
        }));

      // Show full files only if licensed
      const fullFiles = design.files
        .filter(file => !file.isPublicPreview)
        .map(file => ({
          id: file.id,
          fileType: file.fileType,
          originalFileName: file.originalFileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          isPublicPreview: file.isPublicPreview,
          createdAt: file.createdAt,
          canDownload: true // Licensed buyers can download full files
        }));

      accessibleFiles = [...previewFiles, ...fullFiles];
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      designId,
      files: accessibleFiles
    });
  } catch (error) {
    console.error('Error fetching design files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download file for licensed buyers (redirects to watermarking endpoint)
app.get('/api/designs/:designId/files/:fileId/download', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const designId = req.params.designId as string;
    const fileId = req.params.fileId as string;

    // Check if design exists and is published
    const design = await prisma.design.findUnique({
      where: { id: designId }
    });

    if (!design || design.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Design not found' });
    }

    // Check if buyer has a valid license for this design
    const license = await prisma.license.findFirst({
      where: {
        buyerId: user.buyer.id,
        designId: designId,
        status: 'ACTIVE'
      }
    });

    if (!license) {
      return res.status(403).json({ error: 'No valid license found for this design' });
    }

    // Check if the file exists and belongs to the design
    const designFile = await prisma.designFile.findFirst({
      where: {
        id: fileId,
        designId: designId
      }
    });

    if (!designFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate signed URL for secure download (expires in 1 hour)
    const signedUrl = await storageService.generateSignedUrl(designFile.storageKey, 3600);

    // Log audit action (async, never blocks)
    logAuditAction(user.id, 'DOWNLOAD_FILE', 'DESIGN_FILE', designFile.id, {
      designId,
      licenseId: license.id,
      licenseType: license.licenseType,
      fileName: designFile.originalFileName,
      fileSize: designFile.fileSize
    });

    // Return signed URL instead of serving file directly
    res.json({
      downloadUrl: signedUrl,
      fileName: designFile.originalFileName,
      fileSize: designFile.fileSize,
      mimeType: designFile.mimeType,
      expiresIn: 3600 // seconds
    });

  } catch (error) {
    console.error('Error processing download request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to process download request' });
    }
  }
});

// Get preview images for a design (public endpoint)
app.get('/api/designs/:designId/preview', async (req, res) => {
  try {
    const designId = req.params.designId as string;

    // Check if design exists and is published
    const design = await prisma.design.findUnique({
      where: { id: designId }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Design not found' });
    }

    // Get only preview images that are marked as public
    const previewFiles = await prisma.designFile.findMany({
      where: {
        designId: designId,
        isPublicPreview: true,
        fileType: 'PREVIEW_IMAGE'
      },
      select: {
        id: true,
        originalFileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (previewFiles.length === 0) {
      return res.json({ previews: [] });
    }

    // Generate signed URLs for each preview image
    const previews = await Promise.all(
      previewFiles.map(async (file) => {
        const designFile = await prisma.designFile.findUnique({
          where: { id: file.id }
        });

        if (!designFile) return null;

        const signedUrl = await storageService.generateSignedUrl(designFile.storageKey, 3600); // 1 hour expiration

        return {
          id: file.id,
          fileName: file.originalFileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          url: signedUrl,
          createdAt: file.createdAt
        };
      })
    );

    // Filter out any null results
    const validPreviews = previews.filter(preview => preview !== null);

    res.json({ previews: validPreviews });
  } catch (error) {
    console.error('Error fetching preview images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe Checkout session for design purchase or modification payment
app.post('/api/payments/checkout', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const { type, resourceId } = req.body;
    if (!type || !resourceId) {
      return res.status(400).json({ error: 'Type and resourceId are required' });
    }

    if (!['DESIGN', 'MODIFICATION'].includes(type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    let priceInCents: number;
    let itemName: string;
    let itemDescription: string;
    let licenseType: string = 'STANDARD'; // Default to STANDARD

    // Check if EXCLUSIVE license is requested
    if (req.body.licenseType === 'EXCLUSIVE') {
      licenseType = 'EXCLUSIVE';
    }

    let metadata: any = {
      paymentType: type,
      resourceId: resourceId,
      buyerId: user.id,
      licenseType: licenseType,
      amount: '0' // Will be set below
    };

    if (type === 'DESIGN') {
      // Validate design exists and is published
      const design = await prisma.design.findUnique({
        where: { id: resourceId },
        include: {
          architect: {
            include: {
              user: true
            }
          }
        }
      });

      if (!design) {
        return res.status(404).json({ error: 'Design not found' });
      }

      if (design.status !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Design is not available for purchase' });
      }

      // Check if buyer already has a license for this design
      const existingLicense = await prisma.license.findFirst({
        where: {
          buyerId: user.buyer.id,
          designId: resourceId,
          status: 'ACTIVE'
        }
      });

      if (existingLicense) {
        return res.status(400).json({ error: 'You have already purchased this design' });
      }

      // Check if buyer is trying to buy their own design (if they're also an architect)
      if (user.architect && design.architectId === user.architect.id) {
        return res.status(400).json({ error: 'You cannot purchase your own design' });
      }

      // Convert price to cents (design.price is Decimal, need to convert)
      priceInCents = Math.round(parseFloat(design.price.toString()) * 100);
      itemName = design.title;
      itemDescription = `Architectural design by ${design.architect.user.name}`;
      metadata.amount = priceInCents.toString();
      metadata.designId = resourceId;

    } else if (type === 'MODIFICATION') {
      // Validate modification request exists and is ACCEPTED
      const modification = await prisma.modificationRequest.findUnique({
        where: { id: resourceId },
        include: {
          design: {
            include: {
              architect: true
            }
          }
        }
      });

      if (!modification) {
        return res.status(404).json({ error: 'Modification request not found' });
      }

      if (modification.buyerId !== user.id) {
        return res.status(403).json({ error: 'You can only pay for your own modification requests' });
      }

      if (modification.status !== 'ACCEPTED') {
        return res.status(400).json({ error: 'Modification request is not ready for payment' });
      }

      if (!modification.proposedPrice) {
        return res.status(400).json({ error: 'Modification request does not have a price set' });
      }

      priceInCents = Math.round(modification.proposedPrice * 100); // Convert to cents
      itemName = `Modification: ${modification.design.title}`;
      itemDescription = `Custom modifications for architectural design`;
      metadata.modificationId = resourceId;
      metadata.amount = priceInCents.toString();
    } else {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    const platformFee = Math.round(priceInCents * 0.10); // 10%
    const architectEarning = priceInCents - platformFee; // 90%

    // Create checkout session
    const checkoutSession = await paymentService.createCheckoutSession({
      designId: type === 'DESIGN' ? resourceId : 'modification',
      designTitle: itemName,
      price: priceInCents,
      buyerEmail: user.email,
      successUrl: process.env.FRONTEND_SUCCESS_URL || 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: process.env.FRONTEND_CANCEL_URL || 'http://localhost:3000/payment/cancel',
      metadata: metadata
    });

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        buyerId: user.buyer.id,
        designId: type === 'DESIGN' ? resourceId : null,
        modificationId: type === 'MODIFICATION' ? resourceId : null,
        stripeSessionId: checkoutSession.id,
        amountTotal: priceInCents,
        platformFee: platformFee,
        architectEarning: architectEarning,
        currency: 'USD',
        status: 'PENDING'
      }
    });

    console.log(`Created ${type} payment session: ${checkoutSession.id} for user ${user.id}`);

    res.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

// Stripe webhook for payment completion
app.post('/api/webhooks/stripe', async (req, res) => {
  const startTime = Date.now();
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // Verify Stripe signature
    event = paymentService.constructWebhookEvent(req.body, sig);
  } catch (error) {
    // Track webhook signature verification failure
    monitoring.trackSecurityEvent('webhook_signature_invalid', 'high', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasSignature: !!sig
    });

    console.error('Webhook signature verification failed:', error);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  console.log(`Received verified webhook event: ${event.type}, ID: ${event.id}`);

  // Track successful webhook reception
  monitoring.trackUserAction('webhook_received', undefined, {
    eventType: event.type,
    eventId: event.id
  });

  // Only handle checkout.session.completed
  if (event.type !== 'checkout.session.completed') {
    console.log(`Ignoring event type: ${event.type}`);
    return res.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const stripeSessionId = session.id;
  const eventId = event.id; // Use for idempotency

  try {
    // Check for duplicate processing using event ID
    const existingProcessing = await prisma.transaction.findFirst({
      where: {
        stripeSessionId,
        status: 'PAID'
      }
    });

    if (existingProcessing) {
      console.log(`Transaction for session ${stripeSessionId} already processed`);
      return res.json({ received: true });
    }

    // Find the transaction by stripeSessionId
    const transaction = await prisma.transaction.findUnique({
      where: { stripeSessionId },
      include: {
        design: {
          include: {
            architect: {
              include: {
                user: true
              }
            }
          }
        },
        modification: {
          include: {
            design: {
              include: {
                architect: true
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      console.error(`Transaction not found for session: ${stripeSessionId}`);
      return res.status(200).json({ received: true }); // Return 200 to avoid Stripe retries
    }

    if (transaction.status !== 'PENDING') {
      console.log(`Transaction ${transaction.id} already processed (status: ${transaction.status})`);
      return res.json({ received: true });
    }

    // Validate required metadata
    const paymentType = session.metadata?.paymentType;
    const resourceId = session.metadata?.resourceId;
    const buyerId = session.metadata?.buyerId;
    const licenseType = session.metadata?.licenseType;
    const expectedAmount = session.metadata?.amount;

    if (!paymentType || !resourceId || !buyerId) {
      console.error(`Missing required metadata for session ${stripeSessionId}`);
      return res.status(200).json({ received: true });
    }

    // Validate buyer ID matches transaction
    if (buyerId !== transaction.buyerId) {
      console.error(`Buyer ID mismatch for session ${stripeSessionId}`);
      return res.status(200).json({ received: true });
    }

    // Validate payment amount
    if (expectedAmount && parseInt(expectedAmount) !== transaction.amountTotal) {
      console.error(`Amount mismatch for session ${stripeSessionId}: expected ${expectedAmount}, got ${transaction.amountTotal}`);
      return res.status(200).json({ received: true });
    }

    // Use database transaction for atomic operations
    await prisma.$transaction(async (tx) => {
      // Update transaction to PAID
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PAID',
          stripePaymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id
        }
      });

      if (paymentType === 'DESIGN') {
        console.log(`Processing DESIGN payment for design ${resourceId}`);

        // Validate design still exists and is PUBLISHED
        const design = await tx.design.findUnique({
          where: { id: resourceId },
          include: { architect: true }
        });

        if (!design || design.status !== 'PUBLISHED') {
          console.error(`Design ${resourceId} not found or not PUBLISHED`);
          throw new Error('Design validation failed');
        }

        // Validate license type
        const validLicenseTypes = ['STANDARD', 'EXCLUSIVE'];
        const finalLicenseType = licenseType && validLicenseTypes.includes(licenseType) ? licenseType as any : 'STANDARD';

        // Create license
        const license = await tx.license.create({
          data: {
            buyerId: transaction.buyerId,
            designId: transaction.designId!,
            transactionId: transaction.id,
            licenseType: finalLicenseType,
            status: 'ACTIVE'
          }
        });

        // Log license creation
        await logLicenseEvent(
          transaction.buyerId,
          'CREATE_LICENSE',
          license.id,
          {
            designId: transaction.designId,
            licenseType: finalLicenseType,
            transactionId: transaction.id,
            amount: transaction.amountTotal
          }
        );

        // Handle EXCLUSIVE license contact unlock
        if (finalLicenseType === 'EXCLUSIVE') {
          const exists = await tx.contactUnlockEvent.findFirst({
            where: { designId: transaction.designId!, buyerId: transaction.buyerId }
          });

          if (!exists) {
            await logContactUnlock({
              designId: transaction.designId!,
              buyerId: transaction.buyerId,
              architectId: design.architectId
            });
            console.log(`Contact unlocked for EXCLUSIVE purchase: design ${transaction.designId}, buyer ${transaction.buyerId}`);
          }
        }

      } else if (paymentType === 'MODIFICATION') {
        console.log(`Processing MODIFICATION payment for request ${resourceId}`);

        // Update modification request status to PAID
        await tx.modificationRequest.update({
          where: { id: transaction.modificationId! },
          data: { status: 'PAID' }
        });

        console.log(`Modification request ${transaction.modificationId} marked as PAID`);
      }

      // Create architect earning record
      const architectId = transaction.design?.architectId || transaction.modification?.design.architectId;
      if (!architectId) {
        throw new Error('No architect found for transaction');
      }

      await tx.architectEarning.create({
        data: {
          architectId: architectId,
          transactionId: transaction.id,
          amount: transaction.architectEarning,
          currency: transaction.currency,
          status: 'PENDING'  // Will change to PAYABLE after Stripe Connect setup
        }
      });

      console.log(`Payment processed successfully: ${paymentType} ${resourceId}, transaction ${transaction.id}`);
    });

    const duration = Date.now() - startTime;

    // Track successful payment processing
    monitoring.trackBusinessMetric('payment_processed', 1, {
      paymentType,
      amount: transaction.amountTotal,
      currency: transaction.currency,
      duration
    });

    // Return 200 only after successful processing
    res.json({ received: true });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Track webhook processing error
    monitoring.trackSecurityEvent('webhook_processing_error', 'medium', {
      eventType: event?.type,
      eventId: event?.id,
      error: (error as Error).message,
      duration
    });

    console.error('Error processing webhook:', error);
    // Return 200 to prevent Stripe from retrying - we've logged the error
    res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
  }
});

// Create Stripe Connect account for architect
app.post('/api/architects/stripe/connect', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const architect = user.architect;

    // Check if architect already has a Stripe account
    if (architect.stripeAccountId) {
      return res.status(400).json({ error: 'Stripe account already connected' });
    }

    const stripe = paymentService.getStripeClient();

    // Create Stripe Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Default to US, could be made configurable
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual', // Could be 'company' for business accounts
    });

    // Update architect with Stripe account ID
    await prisma.architect.update({
      where: { id: architect.id },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: 'PENDING'
      }
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/architect/stripe/connect?error=refresh`,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/architect/stripe/connect?success=true`,
      type: 'account_onboarding',
    });

    res.json({
      accountId: account.id,
      onboardingUrl: accountLink.url
    });
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    res.status(500).json({ error: 'Failed to create Stripe account' });
  }
});

// Get Stripe Connect account status
app.get('/api/architects/stripe/status', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const architect = await prisma.architect.findUnique({
      where: { id: user.architect.id },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true
      }
    });

    if (!architect?.stripeAccountId) {
      return res.json({ connected: false });
    }

    // Optionally check current status from Stripe API
    // For now, return stored status
    res.json({
      connected: true,
      accountId: architect.stripeAccountId,
      status: architect.stripeAccountStatus
    });
  } catch (error) {
    console.error('Error getting Stripe account status:', error);
    res.status(500).json({ error: 'Failed to get account status' });
  }
});

// Get architect earnings dashboard
app.get('/api/architects/earnings', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const {
      page = '1',
      limit = DEFAULT_PAGE_SIZE.toString()
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt(limit as string) || DEFAULT_PAGE_SIZE));

    const architectId = user.architect.id;

    // Get earnings count for pagination
    const totalEarnings = await prisma.architectEarning.count({
      where: { architectId }
    });

    // Get paginated earnings with optimized query
    const earnings = await prisma.architectEarning.findMany({
      where: { architectId },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        paidAt: true,
        transaction: {
          select: {
            id: true,
            design: {
              select: {
                id: true,
                title: true
              }
            },
            buyer: {
              select: {
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate totals (only for current page to avoid loading all data)
    const pageTotalEarned = earnings.reduce((sum, earning) => sum + earning.amount, 0);
    const pagePayableBalance = earnings
      .filter(earning => earning.status === 'PAYABLE')
      .reduce((sum, earning) => sum + earning.amount, 0);
    const pagePaidOut = earnings
      .filter(earning => earning.status === 'PAID')
      .reduce((sum, earning) => sum + earning.amount, 0);

    // For accurate totals, we need to query all earnings (but this is cached in practice)
    const allEarningsSummary = await prisma.architectEarning.groupBy({
      by: ['status'],
      where: { architectId },
      _sum: {
        amount: true
      }
    });

    const totalEarned = allEarningsSummary.reduce((sum, group) => sum + (group._sum.amount || 0), 0);
    const payableBalance = allEarningsSummary
      .filter(group => group.status === 'PAYABLE')
      .reduce((sum, group) => sum + (group._sum.amount || 0), 0);
    const paidOut = allEarningsSummary
      .filter(group => group.status === 'PAID')
      .reduce((sum, group) => sum + (group._sum.amount || 0), 0);

    const totalPages = Math.ceil(totalEarnings / pageSize);

    res.json({
      summary: {
        totalEarned,
        payableBalance,
        paidOut,
        currency: 'USD'
      },
      earnings: {
        payable: earnings.filter(e => e.status === 'PAYABLE'),
        paid: earnings.filter(e => e.status === 'PAID'),
        pending: earnings.filter(e => e.status === 'PENDING')
      },
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalEarnings,
        totalPages
      },
      recentTransactions: earnings.slice(0, 10).map(earning => ({
        id: earning.id,
        amount: earning.amount,
        status: earning.status,
        createdAt: earning.createdAt,
        paidAt: earning.paidAt,
        design: earning.transaction.design,
        buyer: earning.transaction.buyer.user
      }))
    });
  } catch (error) {
    console.error('Error getting architect earnings:', error);
    res.status(500).json({ error: 'Failed to get earnings data' });
  }
});

// Execute payout for architect (Admin only)
app.post('/api/admin/payouts/execute', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // TEMPORARY: Disable payouts until Stripe Connect is implemented
    // TODO: Re-enable after architect Stripe Connect onboarding is complete
    return res.status(503).json({
      error: 'Payouts temporarily disabled',
      message: 'Architect payouts are pending Stripe Connect implementation. All earnings are recorded as PENDING status.',
      temporary: true
    });

    const { architectId } = req.body;
    if (!architectId) {
      return res.status(400).json({ error: 'architectId is required' });
    }

    // Get architect with Stripe account info
    const architect = await prisma.architect.findUnique({
      where: { id: architectId },
      include: {
        user: true
      }
    });

    if (!architect) {
      return res.status(404).json({ error: 'Architect not found' });
    }

    // Validate Stripe account exists and payouts are enabled
    if (!architect!.stripeAccountId) {
      return res.status(400).json({ error: 'Architect has no connected Stripe account' });
    }

    if (!architect!.payoutsEnabled) {
      return res.status(400).json({ error: 'Architect payouts are not enabled' });
    }

    // Get all PAYABLE earnings for this architect
    const payableEarnings = await prisma.architectEarning.findMany({
      where: {
        architectId: architectId,
        status: 'PAYABLE'
      },
      include: {
        transaction: true
      }
    });

    if (payableEarnings.length === 0) {
      return res.status(400).json({ error: 'No payable earnings found for this architect' });
    }

    // Calculate total payout amount
    const totalAmount = payableEarnings.reduce((sum, earning) => sum + earning.amount, 0);

    // Validate all earnings have the same currency
    const currencies = [...new Set(payableEarnings.map(e => e.currency))];
    if (currencies.length !== 1) {
      return res.status(400).json({ error: 'All earnings must have the same currency' });
    }

    const currency = currencies[0];

    console.log(`Processing payout for architect ${architectId}: ${payableEarnings.length} earnings, total ${totalAmount} ${currency}`);

    // Create Stripe transfer using payment service
    let payoutResult;
    try {
      payoutResult = await paymentService.createPayoutTransfer({
        architectId: architect!.stripeAccountId!,
        amount: totalAmount,
        currency: currency,
        description: `Architect payout - ${payableEarnings.length} transactions`,
        metadata: {
          architectId: architectId,
          earningIds: payableEarnings.map(e => e.id).join(','),
          transactionCount: payableEarnings.length.toString()
        }
      });
    } catch (payoutError: any) {
      console.error('Payout transfer failed:', payoutError);
      return res.status(500).json({
        error: 'Payout transfer failed',
        details: payoutError.message
      });
    }

    // Update all earnings to PAID status with paidAt timestamp
    const now = new Date();
    await prisma.architectEarning.updateMany({
      where: {
        id: { in: payableEarnings.map(e => e.id) }
      },
      data: {
        status: 'PAID',
        paidAt: now
      }
    });

    console.log(`Payout completed for architect ${architectId}: Transfer ${payoutResult.transferId}, amount ${totalAmount} ${currency}`);

    res.json({
      success: true,
      architectId: architectId,
      transferId: payoutResult.transferId,
      amount: totalAmount,
      currency: currency,
      earningCount: payableEarnings.length,
      paidAt: now
    });

  } catch (error) {
    console.error('Error executing payout:', error);
    res.status(500).json({ error: 'Payout execution failed' });
  }
});

// Get contact unlock events (Admin only - read-only)
app.get('/api/admin/contact-unlock-events', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const events = await prisma.contactUnlockEvent.findMany({
      include: {
        design: {
          select: { title: true }
        },
        buyer: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        architect: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        }
      },
      orderBy: {
        unlockedAt: 'desc'
      }
    });

    res.json({ events });
  } catch (error) {
    console.error('Error getting contact unlock events:', error);
    res.status(500).json({ error: 'Failed to get contact unlock events' });
  }
});

// Marketplace designs endpoint with filters
app.get('/marketplace/designs', async (req, res) => {
  try {
    const {
      page = '1',
      limit = DEFAULT_PAGE_SIZE.toString(),
      category,
      priceMin,
      priceMax,
      sort = 'newest'
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt(limit as string) || DEFAULT_PAGE_SIZE));

    // Build where clause for filters
    const where: any = {
      status: 'PUBLISHED'
    };

    if (category && category !== '') {
      where.category = category as string;
    }

    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = parseFloat(priceMin as string);
      if (priceMax) where.price.lte = parseFloat(priceMax as string);
    }

    // Build orderBy clause
    let orderBy: any = {};
    const sortBy = sort as string || 'newest';
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    // Get total count
    const total = await prisma.design.count({ where });

    // Get paginated designs
    const designs = await prisma.design.findMany({
      where,
      orderBy,
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const totalPages = Math.ceil(total / pageSize);

    // Transform and validate designs - only return designs with valid data
    const validDesigns = designs
      .filter(d => d.status !== null && d.price !== null) // Filter out invalid designs
      .map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        category: d.category,
        priceUsdCents: Math.round(Number(d.price) * 100), // Convert to cents for frontend
        state: d.status, // Map status to state for frontend
        architectId: d.architectId,
        architectName: d.architect.user.name || d.architect.displayName,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        architect: d.architect
      }));

    res.json({
      designs: validDesigns,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: validDesigns.length, // Update total to reflect filtered results
        totalPages: Math.ceil(validDesigns.length / pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Individual marketplace design view
app.get('/marketplace/designs/:id', async (req, res) => {
  try {
    const design = await prisma.design.findUnique({
      where: { id: req.params.id as string },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    // Validate design has required data
    if (design.status === null || design.price === null) {
      return res.status(404).json({ error: 'Design not found' });
    }

    // Only return published designs in marketplace
    if (design.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Design not found' });
    }

    // Check if user can access direct contact
    let canAccessContact = false;
    const user = (req as any).user;
    
    if (user?.buyer) {
      // For now, all licenses are STANDARD, so contact access is always false
      // TODO: Implement EXCLUSIVE license type checking when that feature is added
      canAccessContact = false;
    }

    // Build response with transformed data
    const response: any = {
      id: design.id,
      title: design.title,
      description: design.description,
      category: design.category,
      priceUsdCents: Math.round(Number(design.price) * 100), // Convert to cents
      state: design.status, // Map status to state
      architectId: design.architectId,
      createdAt: design.createdAt.toISOString(),
      updatedAt: design.updatedAt.toISOString(),
      architect: {
        ...design.architect,
        user: {
          name: design.architect.user.name
        }
      }
    };

    // Only include email if user has contact access
    if (canAccessContact) {
      // Get architect with email
      const architectWithEmail = await prisma.architect.findUnique({
        where: { id: design.architect.id },
        include: {
          user: {
            select: { email: true }
          }
        }
      });
      
      if (architectWithEmail) {
        response.architect.user.email = architectWithEmail.user.email;
      }
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search endpoints
app.get('/search/suggestions', async (req, res) => {
  const startTime = Date.now();

  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = q.trim();

    // SECURE: Use parameterized query to prevent SQL injection
    const suggestions = await prisma.$queryRaw`
      SELECT id, title, category
      FROM "Design"
      WHERE status = 'PUBLISHED'
      AND to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', ${searchTerm.replace(/'/g, "''")})
      ORDER BY ts_rank(to_tsvector('english', title || ' ' || description), plainto_tsquery('english', ${searchTerm.replace(/'/g, "''")})) DESC
      LIMIT 5
    `;

    const duration = Date.now() - startTime;

    // Track search performance
    monitoring.trackPerformance('search_suggestions', duration, {
      searchTerm: searchTerm.substring(0, 50), // Truncate for privacy
      resultCount: Array.isArray(suggestions) ? suggestions.length : 0
    });

    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;

    // Track failed search
    monitoring.trackPerformance('search_suggestions_error', duration, {
      error: (error as Error).message
    });

    console.error('Search suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/search/designs', async (req, res) => {
  try {
    const {
      q,
      page = '1',
      limit = DEFAULT_PAGE_SIZE.toString(),
      category,
      priceMin,
      priceMax,
      sort = 'relevance'
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt(limit as string) || DEFAULT_PAGE_SIZE));

    // Validate and sanitize search query
    let searchQuery = '';
    if (q && typeof q === 'string') {
      searchQuery = q.trim();
      // Enforce max length to prevent abuse
      if (searchQuery.length > 100) {
        searchQuery = searchQuery.substring(0, 100);
      }
    }

    // If no search query, use marketplace logic
    if (searchQuery.length < 2) {
      const marketplaceWhere: any = {
        status: 'PUBLISHED'
      };

      if (category && category !== '') {
        marketplaceWhere.category = category as string;
      }

      if (priceMin || priceMax) {
        marketplaceWhere.price = {};
        if (priceMin) {
          const minPrice = parseFloat(priceMin as string);
          if (!isNaN(minPrice)) marketplaceWhere.price.gte = minPrice;
        }
        if (priceMax) {
          const maxPrice = parseFloat(priceMax as string);
          if (!isNaN(maxPrice)) marketplaceWhere.price.lte = maxPrice;
        }
      }

      let marketplaceOrderBy: any = { createdAt: 'desc' };
      const sortBy = sort as string || 'newest';
      switch (sortBy) {
        case 'newest':
          marketplaceOrderBy = { createdAt: 'desc' };
          break;
        case 'price-asc':
          marketplaceOrderBy = { price: 'asc' };
          break;
        case 'price-desc':
          marketplaceOrderBy = { price: 'desc' };
          break;
        default:
          marketplaceOrderBy = { createdAt: 'desc' };
      }

      const total = await prisma.design.count({ where: marketplaceWhere });
      const designs = await prisma.design.findMany({
        where: marketplaceWhere,
        orderBy: marketplaceOrderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: {
          architect: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      const totalPages = Math.ceil(total / pageSize);

      return res.json({
        data: designs.map(d => ({
          id: d.id,
          title: d.title,
          description: d.description,
          category: d.category,
          priceUsdCents: Math.round(Number(d.price) * 100),
          state: d.status,
          architectName: d.architect.user.name || d.architect.displayName,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString()
        })),
        meta: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages
        }
      });
    }

    // For search queries, use Prisma with proper filtering
    const searchWhere: any = {
      status: 'PUBLISHED',
      OR: [
        {
          title: {
            contains: searchQuery,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: searchQuery,
            mode: 'insensitive'
          }
        }
      ]
    };

    // Apply category filter
    if (category && category !== '') {
      searchWhere.category = category as string;
    }

    // Apply price filters
    if (priceMin || priceMax) {
      searchWhere.price = {};
      if (priceMin) {
        const minPrice = parseFloat(priceMin as string);
        if (!isNaN(minPrice) && minPrice >= 0) {
          searchWhere.price.gte = minPrice;
        }
      }
      if (priceMax) {
        const maxPrice = parseFloat(priceMax as string);
        if (!isNaN(maxPrice) && maxPrice >= 0) {
          searchWhere.price.lte = maxPrice;
        }
      }
    }

    // Sort configuration
    let orderBy: any = { createdAt: 'desc' };
    const sortBy = sort as string || 'relevance';
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      default: // relevance - for now, sort by newest
        orderBy = { createdAt: 'desc' };
    }

    // Get total count
    const total = await prisma.design.count({ where: searchWhere });

    // Get paginated results
    const designs = await prisma.design.findMany({
      where: searchWhere,
      orderBy,
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const totalPages = Math.ceil(total / pageSize);

    return res.json({
      data: designs.map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        category: d.category,
        priceUsdCents: Math.round(Number(d.price) * 100),
        state: d.status,
        architectName: d.architect.user?.name || d.architect.displayName,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      })),
      meta: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Search designs error:', error);
    // Return empty results instead of 500 error
    res.json({
      data: [],
      meta: {
        page: 1,
        limit: DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0
      }
    });
  }
});

// Buyer endpoints
app.get('/buyer/library', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    // Get all active licenses for the buyer with published designs only
    const licenses = await prisma.license.findMany({
      where: {
        buyerId: user.buyer.id,
        status: 'ACTIVE',
        design: {
          status: 'PUBLISHED'
        }
      },
      include: {
        design: {
          include: {
            architect: {
              include: {
                user: {
                  select: { name: true }
                }
              }
            },
            _count: {
              select: { files: true }
            }
          }
        },
        transaction: {
          select: {
            amountTotal: true,
            createdAt: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to match frontend expectations and include file availability
    const transformedLicenses = licenses.map(license => ({
      id: license.id,
      state: license.status, // Map status to state for frontend compatibility
      downloadCount: 0, // TODO: Implement download tracking if needed
      createdAt: license.createdAt,
      design: {
        id: license.design.id,
        title: license.design.title,
        description: license.design.description,
        previewUrl: null, // Will be populated by separate preview endpoint
        architect: {
          company: license.design.architect.company,
          user: { name: license.design.architect.user.name }
        }
      },
      transaction: license.transaction,
      hasFiles: license.design._count.files > 0,
      fileCount: license.design._count.files
    }));

    res.json({ licenses: transformedLicenses });
  } catch (error) {
    console.error('Error fetching buyer library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if buyer has active license for a design
app.get('/buyer/license/check/:designId', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const designId = req.params.designId as string;

    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    if (!designId) {
      return res.status(400).json({ error: 'Design ID required' });
    }

    // Check if buyer has active license for this design
    const license = await prisma.license.findFirst({
      where: {
        buyerId: user.buyer.id,
        designId: designId,
        status: 'ACTIVE'
      }
    });

    res.json({
      hasLicense: !!license,
      licenseType: license?.licenseType || null,
      allowDirectContact: license?.licenseType === 'EXCLUSIVE'
    });
  } catch (error) {
    console.error('Check license error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get buyer's purchase and transaction history
app.get('/buyer/purchases', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    // Get all transactions for the buyer
    const transactions = await prisma.transaction.findMany({
      where: { buyerId: user.buyer.id },
      include: {
        design: {
          select: {
            id: true,
            title: true,
            price: true
          }
        },
        license: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to include purchase details
    const purchases = transactions.map(transaction => ({
      id: transaction.id,
      designId: transaction.designId,
      designTitle: transaction.design?.title || 'Unknown Design',
      price: transaction.amountTotal,
      platformFee: transaction.platformFee,
      architectEarning: transaction.architectEarning,
      currency: transaction.currency,
      status: transaction.status,
      purchaseDate: transaction.createdAt,
      licenseId: transaction.license?.id,
      licenseStatus: transaction.license?.status
    }));

    res.json({ purchases });
  } catch (error) {
    console.error('Error fetching buyer purchases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get buyer's licenses with detailed rights information
app.get('/buyer/licenses', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    // Get all licenses for the buyer
    const licenses = await prisma.license.findMany({
      where: { buyerId: user.buyer.id },
      include: {
        design: {
          select: {
            id: true,
            title: true,
            price: true
          }
        },
        transaction: {
          select: {
            amountTotal: true,
            createdAt: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform licenses with rights information
    // Note: Current schema doesn't distinguish STANDARD vs EXCLUSIVE licenses
    // All licenses are treated as STANDARD for now
    const transformedLicenses = licenses.map(license => ({
      id: license.id,
      designId: license.design.id,
      designTitle: license.design.title,
      status: license.status,
      purchaseDate: license.transaction.createdAt,
      expiryDate: null, // No expiry in current schema
      licenseType: 'STANDARD', // All current licenses are STANDARD
      usageRights: [
        'Personal use',
        'Commercial use',
        'Modify for personal projects',
        'Share with team members'
      ],
      downloadCount: 0, // TODO: Implement download tracking
      maxDownloads: license.status === 'ACTIVE' ? 999 : 0, // Unlimited for active licenses
      price: license.transaction.amountTotal,
      currency: 'USD'
    }));

    // Calculate summary statistics
    const summary = {
      totalActive: licenses.filter(l => l.status === 'ACTIVE').length,
      totalRevoked: licenses.filter(l => l.status === 'REVOKED').length,
      totalExpired: 0, // No EXPIRED status in current schema
      totalLicenses: licenses.length
    };

    res.json({
      licenses: transformedLicenses,
      summary
    });
  } catch (error) {
    console.error('Error fetching buyer licenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/buyer/purchase', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const { designId, licenseType = 'STANDARD' } = req.body;

    // Validate license type
    if (!['STANDARD', 'EXCLUSIVE'].includes(licenseType)) {
      return res.status(400).json({ error: 'Invalid license type' });
    }

    // Redirect to the proper checkout endpoint
    // This endpoint should not create purchases directly - only webhooks should
    return res.status(400).json({
      error: 'Use /api/checkout/create to initiate purchase',
      redirectTo: '/api/checkout/create'
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/buyer/account', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const buyer = await prisma.buyer.findUnique({
      where: { id: user.buyer.id },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    res.json({ account: buyer });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Buyer favorites endpoints
app.post('/buyer/favorites/:designId', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const designId = req.params.designId as string;

    // Check if design exists and is published
    const design = await prisma.design.findUnique({
      where: { id: designId }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Design is not available' });
    }

    // Check if already favorited
    const existingFavorite = await prisma.buyer.findUnique({
      where: { id: user.buyer.id },
      include: {
        favorites: {
          where: { id: designId }
        }
      }
    }) as any;

    if (existingFavorite?.favorites.length > 0) {
      return res.status(400).json({ error: 'Design already in favorites' });
    }

    // Add to favorites
    await prisma.buyer.update({
      where: { id: user.buyer.id },
      data: {
        favorites: {
          connect: { id: designId }
        }
      }
    });

    res.json({ success: true, message: 'Design added to favorites' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/buyer/favorites/:designId', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const designId = req.params.designId as string;

    // Check if currently favorited
    const buyer = await prisma.buyer.findUnique({
      where: { id: user.buyer.id },
      include: {
        favorites: {
          where: { id: designId }
        }
      }
    }) as any;

    if (!buyer?.favorites.length) {
      return res.status(400).json({ error: 'Design not in favorites' });
    }

    // Remove from favorites
    await prisma.buyer.update({
      where: { id: user.buyer.id },
      data: {
        favorites: {
          disconnect: { id: designId }
        }
      }
    });

    res.json({ success: true, message: 'Design removed from favorites' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/buyer/favorites', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'User is not a buyer' });
    }

    const buyer = await prisma.buyer.findUnique({
      where: { id: user.buyer.id },
      include: {
        favorites: {
          where: { status: 'PUBLISHED' },
          include: {
            architect: {
              include: {
                user: {
                  select: { name: true }
                }
              }
            },
            files: {
              where: { fileType: 'PREVIEW_IMAGE' },
              take: 1
            }
          }
        }
      }
    });

    // Transform to match frontend expectations
    const favorites = buyer?.favorites.map(design => ({
      id: design.id,
      title: design.title,
      description: design.description,
      category: design.category,
      price: design.price,
      architect: {
        company: design.architect.displayName,
        user: { name: design.architect.user.name }
      },
      previewUrl: design.files[0]?.storageKey || null,
      createdAt: design.createdAt
    })) || [];

    res.json({ favorites });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Messaging endpoints

// Helper function to validate if messaging is allowed between buyer and architect
async function validateMessagingPermission(buyerId: string, designId: string): Promise<{ allowed: boolean, reason?: string, relatedId?: string, allowDirectContact?: boolean }> {
  if (!buyerId || !designId) {
    return { allowed: false };
  }

  try {
    // Check if buyer has any active license for this specific design
    const activeLicense = await prisma.license.findFirst({
      where: {
        buyerId,
        designId,
        status: 'ACTIVE'
      }
    });

    if (activeLicense) {
      return {
        allowed: true,
        reason: 'EXCLUSIVE_LICENSE',
        relatedId: activeLicense.id,
        allowDirectContact: activeLicense.licenseType === 'EXCLUSIVE'
      };
    }

    // Check if there's a paid modification between buyer and architect of this design
    const paidModification = await prisma.modificationRequest.findFirst({
      where: {
        buyerId,
        design: { id: designId },
        status: 'COMPLETED' // Only completed paid modifications allow messaging
      }
    });

    if (paidModification) {
      return {
        allowed: true,
        reason: 'PAID_MODIFICATION',
        relatedId: paidModification.id,
        allowDirectContact: true // Paid modifications allow direct contact
      };
    }

    return { allowed: false };
  } catch (error) {
    console.error('Error validating messaging permission:', error);
    return { allowed: false };
  }
}

// Helper function to filter contact information from message content
function filterMessageContent(content: string, allowDirectContact: boolean = false): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let filtered = content.trim();

  // If direct contact is not allowed, filter out contact information
  if (!allowDirectContact) {
    // Remove emails (more comprehensive pattern)
    filtered = filtered.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REMOVED]');

    // Remove phone numbers (multiple patterns)
    filtered = filtered.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REMOVED]');
    filtered = filtered.replace(/\b\d{1,3}[-.]?\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REMOVED]');
    filtered = filtered.replace(/\b\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4}\b/g, '[PHONE REMOVED]');

    // Remove URLs (more comprehensive)
    filtered = filtered.replace(/\bhttps?:\/\/[^\s]+/gi, '[URL REMOVED]');
    filtered = filtered.replace(/\bwww\.[^\s]+/gi, '[URL REMOVED]');

    // Remove social media handles
    filtered = filtered.replace(/@\w+/g, '[HANDLE REMOVED]');
  }

  return filtered;
}

app.post('/messages', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { designId, initialMessage } = req.body;

    // Validate inputs
    if (!designId) {
      return res.status(400).json({ error: 'Design ID required' });
    }

    if (!initialMessage || typeof initialMessage !== 'string' || initialMessage.trim().length === 0) {
      return res.status(400).json({ error: 'Initial message required' });
    }

    if (initialMessage.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    // Validate user is buyer
    if (!user.buyer) {
      return res.status(403).json({ error: 'Only buyers can initiate conversations' });
    }

    // Check if design exists and is published
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: { architect: true }
    });

    if (!design || design.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Design not found or not available' });
    }

    // Validate messaging permission
    const permission = await validateMessagingPermission(user.buyer.id, designId);
    if (!permission.allowed) {
      return res.status(403).json({ error: 'Messaging not allowed. Requires exclusive license or completed paid modification.' });
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        buyerId: user.buyer.id,
        architectId: design.architectId,
        reason: permission.reason as any,
        relatedId: permission.relatedId
      }
    });

    if (existingConversation) {
      return res.status(400).json({ error: 'Conversation already exists', conversationId: existingConversation.id });
    }

    // Filter message content based on permission
    const filteredMessage = filterMessageContent(initialMessage.trim(), permission.allowDirectContact);

    if (filteredMessage.length === 0) {
      return res.status(400).json({ error: 'Message content is not valid after filtering' });
    }

    // Create conversation and first message in transaction
    const result = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          buyerId: user.buyer.id,
          architectId: design.architectId,
          reason: permission.reason as any,
          relatedId: permission.relatedId
        }
      });

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: filteredMessage
        }
      });

      return { conversation, message };
    });

    // Log conversation creation
    await logMessagingEvent(
      user.id,
      'START_CONVERSATION',
      result.conversation.id,
      {
        designId,
        architectId: design.architectId,
        reason: permission.reason,
        relatedId: permission.relatedId,
        allowDirectContact: permission.allowDirectContact
      }
    );

    res.json({
      conversation: {
        id: result.conversation.id,
        buyerId: result.conversation.buyerId,
        architectId: result.conversation.architectId,
        reason: result.conversation.reason,
        createdAt: result.conversation.createdAt
      },
      message: {
        id: result.message.id,
        content: result.message.content,
        senderId: result.message.senderId,
        createdAt: result.message.createdAt
      }
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/messages', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    let conversations;

    if (user.role === 'ADMIN') {
      // Admin can see all conversations
      conversations = await prisma.conversation.findMany({
        include: {
          buyer: {
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          architect: {
            include: {
              user: {
                select: { name: true }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get latest message
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Regular users see their conversations
      const buyerConversations = user.buyer ? await prisma.conversation.findMany({
        where: { buyerId: user.buyer.id },
        include: {
          architect: {
            include: {
              user: {
                select: { name: true }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' }
      }) : [];

      const architectConversations = user.architect ? await prisma.conversation.findMany({
        where: { architectId: user.architect.id },
        include: {
          buyer: {
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' }
      }) : [];

      conversations = [...buyerConversations, ...architectConversations];
    }

    // Transform for frontend with safe property access
    const transformedConversations = conversations.map((conv: any) => ({
      id: conv.id,
      buyer: conv.buyer ? {
        id: conv.buyer.id,
        name: conv.buyer.user?.name || 'Unknown',
        email: conv.buyer.user?.email || ''
      } : null,
      architect: {
        id: conv.architect.id,
        name: conv.architect.user?.name || 'Unknown',
        displayName: conv.architect.displayName || 'Unknown Architect'
      },
      reason: conv.reason,
      lastMessage: conv.messages && conv.messages[0] ? {
        content: conv.messages[0].content || '',
        createdAt: conv.messages[0].createdAt
      } : null,
      createdAt: conv.createdAt
    }));

    res.json({ conversations: transformedConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/messages/:conversationId', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const conversationId = req.params.conversationId as string;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID required' });
    }

    // Get conversation with all necessary includes
    const conversationData = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        buyer: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        architect: {
          include: {
            user: {
              select: { name: true }
            }
          }
        },
        messages: {
          include: {
            sender: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversationData) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Validate user is participant or admin
    const isBuyer = user.buyer && conversationData.buyerId === user.buyer.id;
    const isArchitect = user.architect && conversationData.architectId === user.architect.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isBuyer && !isArchitect && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Safely transform data
    const buyer = conversationData.buyer ? {
      id: conversationData.buyer.id,
      name: conversationData.buyer.user?.name || 'Unknown',
      email: conversationData.buyer.user?.email || ''
    } : null;

    const architect = {
      id: conversationData.architect.id,
      name: conversationData.architect.user?.name || 'Unknown',
      displayName: conversationData.architect.displayName || 'Unknown Architect'
    };

    const messages = conversationData.messages.map((msg: any) => ({
      id: msg.id,
      content: msg.content || '',
      sender: {
        id: msg.senderId,
        name: msg.sender?.name || 'Unknown'
      },
      createdAt: msg.createdAt
    }));

    res.json({
      conversation: {
        id: conversationData.id,
        buyer,
        architect,
        reason: conversationData.reason,
        createdAt: conversationData.createdAt
      },
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/messages/:conversationId', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const conversationId = req.params.conversationId as string;
    const { content } = req.body;

    // Validate inputs
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID required' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    // Get conversation with license info
    const conversationData = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        buyer: true,
        architect: true
      }
    });

    if (!conversationData) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Validate user is participant
    const isBuyer = user.buyer && conversationData.buyerId === user.buyer.id;
    const isArchitect = user.architect && conversationData.architectId === user.architect.id;

    if (!isBuyer && !isArchitect) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Determine if direct contact is allowed for this conversation
    let allowDirectContact = false;
    if (conversationData.reason === 'EXCLUSIVE_LICENSE' && conversationData.relatedId) {
      const license = await prisma.license.findUnique({
        where: { id: conversationData.relatedId }
      });
      allowDirectContact = license?.licenseType === 'EXCLUSIVE';
    } else if (conversationData.reason === 'PAID_MODIFICATION') {
      allowDirectContact = true; // Paid modifications allow direct contact
    }

    // Filter message content based on permission
    const filteredContent = filterMessageContent(content.trim(), allowDirectContact);

    if (filteredContent.length === 0) {
      return res.status(400).json({ error: 'Message content is not valid after filtering' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: filteredContent
      },
      include: {
        sender: {
          select: { name: true }
        }
      }
    });

    // Log message sending
    await logMessagingEvent(
      user.id,
      'SEND_MESSAGE',
      message.id,
      {
        conversationId,
        contentLength: filteredContent.length,
        wasFiltered: filteredContent !== content.trim(),
        allowDirectContact
      }
    );

    res.json({
      message: {
        id: message.id,
        content: message.content,
        sender: {
          id: message.senderId,
          name: message.sender?.name || 'Unknown'
        },
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Architect endpoints
app.get('/architect/designs', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const {
      page = '1',
      limit = DEFAULT_PAGE_SIZE.toString()
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt(limit as string) || DEFAULT_PAGE_SIZE));

    const architectId = user.architect.id;

    // Get total count for this architect
    const total = await prisma.design.count({
      where: { architectId }
    });

    // Get paginated designs with optimized query
    const designs = await prisma.design.findMany({
      where: { architectId },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        category: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      designs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get architect account settings
app.get('/architect/account', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const architect = await prisma.architect.findUnique({
      where: { id: user.architect.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            timezone: true,
            preferredLanguage: true,
            profilePhotoUrl: true,
            country: true,
            city: true,
            createdAt: true
          }
        }
      }
    });

    if (!architect) {
      return res.status(404).json({ error: 'Architect not found' });
    }

    // Get payout banks for the architect
    const payoutBanks = await prisma.payoutBank.findMany({
      where: { architectId: user.architect.id },
      select: {
        id: true,
        accountHolder: true,
        iban: true,
        routingNumber: true,
        accountNumber: true,
        country: true,
        currency: true,
        verified: true,
        createdAt: true
      }
    });

    // Calculate platform commission (10%)
    const platformCommission = 10;

    res.json({
      architect: {
        // Profile
        id: architect.id,
        displayName: architect.displayName,
        professionalTitle: architect.professionalTitle,
        company: architect.company,
        bio: architect.bio,

        // Business & Legal
        accountType: architect.accountType,
        legalName: architect.legalName,
        businessRegistrationNumber: architect.businessRegistrationNumber,
        taxCountry: architect.taxCountry,
        vatTaxId: architect.vatTaxId,
        currencyPreference: architect.currencyPreference,

        // Payments & Payouts
        stripeAccountId: architect.stripeAccountId,
        stripeAccountStatus: architect.stripeAccountStatus,
        payoutsEnabled: architect.payoutsEnabled,
        payoutCurrency: architect.payoutCurrency,
        payoutSchedule: architect.payoutSchedule,
        platformCommission,

        // Licensing & Rights
        defaultLicenseType: architect.defaultLicenseType,
        allowPaidModifications: architect.allowPaidModifications,
        modificationPricingStrategy: architect.modificationPricingStrategy,
        copyrightDisplayName: architect.copyrightDisplayName,

        // Security
        twoFactorEnabled: architect.twoFactorEnabled,

        // Privacy
        publicProfileVisibility: architect.publicProfileVisibility,
        companyVisibility: architect.companyVisibility,
        searchEngineIndexing: architect.searchEngineIndexing,
        dataExportRequested: architect.dataExportRequested,
        accountDeletionRequested: architect.accountDeletionRequested,

        // Notification Preferences
        emailNotifications: architect.emailNotifications,

        // Payout banks
        payoutBanks,

        // User info
        user: architect.user,

        createdAt: architect.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting architect account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update architect account settings
app.put('/architect/account', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const updateData = req.body;

    // Update user fields
    if (updateData.user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: updateData.user.name,
          phone: updateData.user.phone,
          timezone: updateData.user.timezone,
          preferredLanguage: updateData.user.preferredLanguage,
          profilePhotoUrl: updateData.user.profilePhotoUrl,
          country: updateData.user.country,
          city: updateData.user.city
        }
      });
    }

    // Update architect fields
    const architectUpdateData: any = {};

    // Profile
    if (updateData.displayName !== undefined) architectUpdateData.displayName = updateData.displayName;
    if (updateData.professionalTitle !== undefined) architectUpdateData.professionalTitle = updateData.professionalTitle;
    if (updateData.company !== undefined) architectUpdateData.company = updateData.company;
    if (updateData.bio !== undefined) architectUpdateData.bio = updateData.bio;

    // Business & Legal
    if (updateData.accountType !== undefined) architectUpdateData.accountType = updateData.accountType;
    if (updateData.legalName !== undefined) architectUpdateData.legalName = updateData.legalName;
    if (updateData.businessRegistrationNumber !== undefined) architectUpdateData.businessRegistrationNumber = updateData.businessRegistrationNumber;
    if (updateData.taxCountry !== undefined) architectUpdateData.taxCountry = updateData.taxCountry;
    if (updateData.vatTaxId !== undefined) architectUpdateData.vatTaxId = updateData.vatTaxId;
    if (updateData.currencyPreference !== undefined) architectUpdateData.currencyPreference = updateData.currencyPreference;

    // Payments & Payouts
    if (updateData.payoutCurrency !== undefined) architectUpdateData.payoutCurrency = updateData.payoutCurrency;
    if (updateData.payoutSchedule !== undefined) architectUpdateData.payoutSchedule = updateData.payoutSchedule;

    // Licensing & Rights
    if (updateData.defaultLicenseType !== undefined) architectUpdateData.defaultLicenseType = updateData.defaultLicenseType;
    if (updateData.allowPaidModifications !== undefined) architectUpdateData.allowPaidModifications = updateData.allowPaidModifications;
    if (updateData.modificationPricingStrategy !== undefined) architectUpdateData.modificationPricingStrategy = updateData.modificationPricingStrategy;
    if (updateData.copyrightDisplayName !== undefined) architectUpdateData.copyrightDisplayName = updateData.copyrightDisplayName;

    // Security
    if (updateData.twoFactorEnabled !== undefined) architectUpdateData.twoFactorEnabled = updateData.twoFactorEnabled;

    // Privacy
    if (updateData.publicProfileVisibility !== undefined) architectUpdateData.publicProfileVisibility = updateData.publicProfileVisibility;
    if (updateData.companyVisibility !== undefined) architectUpdateData.companyVisibility = updateData.companyVisibility;
    if (updateData.searchEngineIndexing !== undefined) architectUpdateData.searchEngineIndexing = updateData.searchEngineIndexing;
    if (updateData.dataExportRequested !== undefined) architectUpdateData.dataExportRequested = updateData.dataExportRequested;
    if (updateData.accountDeletionRequested !== undefined) architectUpdateData.accountDeletionRequested = updateData.accountDeletionRequested;

    // Notification Preferences
    if (updateData.emailNotifications !== undefined) architectUpdateData.emailNotifications = updateData.emailNotifications;

    if (Object.keys(architectUpdateData).length > 0) {
      await prisma.architect.update({
        where: { id: user.architect.id },
        data: architectUpdateData
      });
    }

    // Return updated account data
    const updatedArchitect = await prisma.architect.findUnique({
      where: { id: user.architect.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            timezone: true,
            preferredLanguage: true,
            profilePhotoUrl: true,
            country: true,
            city: true,
            createdAt: true
          }
        }
      }
    });

    res.json({
      architect: {
        // Profile
        id: updatedArchitect!.id,
        displayName: updatedArchitect!.displayName,
        professionalTitle: updatedArchitect!.professionalTitle,
        company: updatedArchitect!.company,
        bio: updatedArchitect!.bio,

        // Business & Legal
        accountType: updatedArchitect!.accountType,
        legalName: updatedArchitect!.legalName,
        businessRegistrationNumber: updatedArchitect!.businessRegistrationNumber,
        taxCountry: updatedArchitect!.taxCountry,
        vatTaxId: updatedArchitect!.vatTaxId,
        currencyPreference: updatedArchitect!.currencyPreference,

        // Payments & Payouts
        stripeAccountId: updatedArchitect!.stripeAccountId,
        stripeAccountStatus: updatedArchitect!.stripeAccountStatus,
        payoutsEnabled: updatedArchitect!.payoutsEnabled,
        payoutCurrency: updatedArchitect!.payoutCurrency,
        payoutSchedule: updatedArchitect!.payoutSchedule,
        platformCommission: 10,

        // Licensing & Rights
        defaultLicenseType: updatedArchitect!.defaultLicenseType,
        allowPaidModifications: updatedArchitect!.allowPaidModifications,
        modificationPricingStrategy: updatedArchitect!.modificationPricingStrategy,
        copyrightDisplayName: updatedArchitect!.copyrightDisplayName,

        // Security
        twoFactorEnabled: updatedArchitect!.twoFactorEnabled,

        // Privacy
        publicProfileVisibility: updatedArchitect!.publicProfileVisibility,
        companyVisibility: updatedArchitect!.companyVisibility,
        searchEngineIndexing: updatedArchitect!.searchEngineIndexing,
        dataExportRequested: updatedArchitect!.dataExportRequested,
        accountDeletionRequested: updatedArchitect!.accountDeletionRequested,

        // Notification Preferences
        emailNotifications: updatedArchitect!.emailNotifications,

        // User info
        user: updatedArchitect!.user,

        createdAt: updatedArchitect!.createdAt
      }
    });
  } catch (error) {
    console.error('Error updating architect account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download design file with watermarking (specific file)
app.get('/api/files/:designId/download/:fileId', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'Only buyers can download design files' });
    }

    const designId = req.params.designId as string;
    const fileId = req.params.fileId as string;

    // Check if user has an active license for this design
    const license = await prisma.license.findFirst({
      where: {
        buyerId: user.buyer.id,
        designId: designId,
        status: 'ACTIVE'
      },
      include: {
        design: {
          include: {
            files: true
          }
        }
      }
    });

    if (!license) {
      return res.status(403).json({ error: 'You do not have an active license for this design' });
    }

    // Find the specific file
    const designFile = license.design.files.find(f => f.id === fileId);
    if (!designFile) {
      return res.status(404).json({ error: 'File not found or not accessible with your license' });
    }

    // Download the file from storage
    const fileBuffer = await storageService.downloadFile(designFile.storageKey);

    // Apply watermarking based on license type
    let processedBuffer = fileBuffer;
    let fileName = designFile.originalFileName;

    if (license.licenseType === 'STANDARD') {
      // Apply watermarking for standard licenses
      processedBuffer = await watermarkingService.processFileWithWatermark(
        fileBuffer,
        designFile.mimeType,
        'STANDARD'
      );
      fileName = `watermarked-${designFile.originalFileName}`;
    } else if (license.licenseType === 'EXCLUSIVE') {
      // No watermarking for exclusive licenses - clean download
      fileName = designFile.originalFileName;
    } else {
      return res.status(500).json({ error: 'Invalid license type' });
    }

    // Log audit action (async, never blocks)
    logAuditAction(user.id, 'DOWNLOAD_FILE', 'DESIGN_FILE', designFile.id, {
      designId,
      licenseId: license.id,
      licenseType: license.licenseType,
      fileName: designFile.originalFileName,
      fileSize: designFile.fileSize
    });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', designFile.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', processedBuffer.length);

    // Send the processed file
    res.send(processedBuffer);

  } catch (error) {
    console.error('Error downloading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});

// Download design file with watermarking (first file)
app.get('/api/files/:designId/download', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.buyer) {
      return res.status(403).json({ error: 'Only buyers can download design files' });
    }

    const designId = req.params.designId as string;

    // Check if user has an active license for this design
    const license = await prisma.license.findFirst({
      where: {
        buyerId: user.buyer.id,
        designId: designId,
        status: 'ACTIVE'
      },
      include: {
        design: {
          include: {
            files: true
          }
        }
      }
    });

    if (!license) {
      return res.status(403).json({ error: 'You do not have an active license for this design' });
    }

    // Get the first file
    const designFile = license.design.files[0];
    if (!designFile) {
      return res.status(404).json({ error: 'No files available for this design' });
    }

    // Download the file from storage
    const fileBuffer = await storageService.downloadFile(designFile.storageKey);

    // Apply watermarking based on license type
    let processedBuffer = fileBuffer;
    let fileName = designFile.originalFileName;

    if (license.licenseType === 'STANDARD') {
      // Apply watermarking for standard licenses
      processedBuffer = await watermarkingService.processFileWithWatermark(
        fileBuffer,
        designFile.mimeType,
        'STANDARD'
      );
      fileName = `watermarked-${designFile.originalFileName}`;
    } else if (license.licenseType === 'EXCLUSIVE') {
      // No watermarking for exclusive licenses - clean download
      fileName = designFile.originalFileName;
    } else {
      return res.status(500).json({ error: 'Invalid license type' });
    }

    // Log audit action (async, never blocks)
    logAuditAction(user.id, 'DOWNLOAD_FILE', 'DESIGN_FILE', designFile.id, {
      designId,
      licenseId: license.id,
      licenseType: license.licenseType,
      fileName: designFile.originalFileName,
      fileSize: designFile.fileSize
    });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', designFile.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', processedBuffer.length);

    // Send the processed file
    res.send(processedBuffer);

  } catch (error) {
    console.error('Error downloading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});

// Stripe Connect onboarding for architects
app.post('/api/stripe/connect/onboard', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'Only architects can onboard with Stripe Connect' });
    }

    // Check if architect already has a Stripe account
    if (user.architect.stripeAccountId) {
      return res.status(400).json({ error: 'Architect already has a Stripe Connect account' });
    }

    // Create Stripe Connect Express account
    const connectAccount = await paymentService.createStripeConnectAccount(
      user.email,
      user.architect.displayName || user.name
    );

    // Update architect record with Stripe account ID
    await prisma.architect.update({
      where: { id: user.architect.id },
      data: {
        stripeAccountId: connectAccount.id,
        stripeAccountStatus: 'PENDING'
      }
    });

    res.json({
      accountId: connectAccount.id,
      onboardingUrl: connectAccount.onboardingUrl
    });

  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    res.status(500).json({ error: 'Failed to create Stripe Connect account' });
  }
});

// Check Stripe Connect onboarding status
app.post('/api/stripe/connect/status', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'Only architects can check onboarding status' });
    }

    if (!user.architect.stripeAccountId) {
      return res.status(400).json({ error: 'No Stripe Connect account found' });
    }

    // Check account status with Stripe
    const accountStatus = await paymentService.checkAccountStatus(user.architect.stripeAccountId);

    // Update architect record
    await prisma.architect.update({
      where: { id: user.architect.id },
      data: {
        stripeAccountStatus: accountStatus.status,
        payoutsEnabled: accountStatus.payoutsEnabled
      }
    });

    res.json({
      accountId: user.architect.stripeAccountId,
      status: accountStatus.status,
      payoutsEnabled: accountStatus.payoutsEnabled
    });

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    res.status(500).json({ error: 'Failed to check onboarding status' });
  }
});

// Stripe webhook endpoint
app.post('/api/webhooks/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const event = paymentService.constructWebhookEvent(req.body, sig);

    console.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        // Handled by the main webhook handler above
        console.log('checkout.session.completed handled by main webhook handler');
        break;

      case 'account.updated':
        // Handle account status updates (optional)
        const account = event.data.object as Stripe.Account;
        console.log(`Account ${account.id} updated: ${account.details_submitted ? 'complete' : 'incomplete'}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// Payout endpoint
app.get('/payouts/my-payouts', async (req, res) => {
  try {
    // TODO: Implement payout tracking
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Design Approval Workflow Endpoints

// 1. Architect submits design for review
app.post('/api/designs/:id/submit', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.architect) {
      return res.status(403).json({ error: 'User is not an architect' });
    }

    const designId = req.params.id as string;

    // Check if design exists and belongs to the architect
    const design = await prisma.design.findUnique({
      where: { id: designId }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.architectId !== user.architect.id) {
      return res.status(403).json({ error: 'Not authorized to submit this design' });
    }

    if (design.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT designs can be submitted for review' });
    }

    // Update status to SUBMITTED
    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: { status: 'SUBMITTED' },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json({
      design: updatedDesign,
      message: 'Design submitted for review successfully'
    });
  } catch (error) {
    console.error('Error submitting design for review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Admin approves design
app.post('/api/admin/designs/:id/approve', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const designId = req.params.id as string;

    // Check if design exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only SUBMITTED designs can be approved' });
    }

    // Update status to APPROVED
    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: { status: 'APPROVED' }
    });

    // Log audit action (async, never blocks)
    logAuditAction(user.id, 'APPROVE_DESIGN', 'DESIGN', designId, {
      previousStatus: design.status,
      newStatus: 'APPROVED',
      architectId: design.architectId,
      designTitle: design.title
    });

    res.json({
      design: { ...updatedDesign, architect: design.architect },
      message: 'Design approved successfully'
    });
  } catch (error) {
    console.error('Error approving design:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Admin rejects design
app.post('/api/admin/designs/:id/reject', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const designId = req.params.id as string;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check if design exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only SUBMITTED designs can be rejected' });
    }

    // Update status to REJECTED and store rejection reason
    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim()
      }
    });

    // Log audit action (async, never blocks)
    logAuditAction(user.id, 'REJECT_DESIGN', 'DESIGN', designId, {
      previousStatus: design.status,
      newStatus: 'REJECTED',
      rejectionReason: reason.trim(),
      architectId: design.architectId,
      designTitle: design.title
    });

    res.json({
      design: { ...updatedDesign, architect: design.architect },
      message: 'Design rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting design:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Admin publishes design
app.post('/api/admin/designs/:id/publish', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const designId = req.params.id as string;

    // Check if design exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    if (design.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Only APPROVED designs can be published' });
    }

    // Validate design has required data before publishing
    if (design.price === null || Number(design.price) <= 0) {
      return res.status(400).json({ error: 'Design must have a valid price before publishing' });
    }

    // Update status to PUBLISHED
    const updatedDesign = await prisma.design.update({
      where: { id: designId },
      data: { status: 'PUBLISHED' }
    });

    // Log audit action (async, never blocks)
    logAuditAction(user.id, 'PUBLISH_DESIGN', 'DESIGN', designId, {
      previousStatus: design.status,
      newStatus: 'PUBLISHED',
      architectId: design.architectId,
      designTitle: design.title
    });

    res.json({
      design: { ...updatedDesign, architect: design.architect },
      message: 'Design published successfully'
    });
  } catch (error) {
    console.error('Error publishing design:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoint to get designs for moderation
app.get('/api/admin/designs', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      page = '1',
      limit = DEFAULT_PAGE_SIZE.toString(),
      status
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt(limit as string) || DEFAULT_PAGE_SIZE));

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status as string;
    } else {
      // Default to SUBMITTED and APPROVED designs for moderation
      where.status = { in: ['SUBMITTED', 'APPROVED'] };
    }

    // Get total count
    const total = await prisma.design.count({ where });

    // Get paginated designs
    const designs = await prisma.design.findMany({
      where,
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        architect: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      designs: designs.map(d => ({
        ...d,
        architectName: d.architect.user.name || d.architect.displayName
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting admin designs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin audit log endpoint
app.get('/api/admin/audit', requireAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      page = '1',
      limit = DEFAULT_PAGE_SIZE.toString(),
      action,
      entityType,
      actorId,
      entityId,
      dateFrom,
      dateTo
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt(limit as string) || DEFAULT_PAGE_SIZE));

    // Build where clause for filtering
    const where: any = {};

    if (action) {
      where.action = action as string;
    }

    if (entityType) {
      where.entityType = entityType as string;
    }

    if (actorId) {
      where.actorId = actorId as string;
    }

    if (entityId) {
      where.entityId = entityId as string;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    // Get total count with filters
    const total = await prisma.auditLog.count({ where });

    // Get paginated audit logs with filters
    const auditLogs = await prisma.auditLog.findMany({
      where,
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      auditLogs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    logger.info('Starting Architects Marketplace server', {
      environment: envInfo.environment,
      port: envInfo.port,
      isProduction: envInfo.isProduction
    });

    console.log('🔄 Testing database connection...');
    await prisma.$connect();
    console.log(`✓ Database connected`);

    // Fix data integrity issues on startup
    console.log('🔧 Checking data integrity...');
    await fixDataIntegrity();
    console.log('✓ Data integrity check completed');

    console.log(`🚀 Starting server on port ${envInfo.port}...`);
    
    // Add Sentry error handler as the last middleware
    app.use(sentryErrorHandler());
    
    const server = app.listen(envInfo.port, '127.0.0.1', () => {
      console.log(`✓ Server running on http://localhost:${envInfo.port}`);
      console.log(`✓ Environment: ${envInfo.environment}`);
      console.log(`✓ Ready to accept requests`);
      const addr = server.address();
      console.log(`🔍 Server address:`, typeof addr === 'object' ? JSON.stringify(addr) : addr);

      logger.info('Server started successfully', {
        port: envInfo.port,
        environment: envInfo.environment,
        address: typeof addr === 'object' ? JSON.stringify(addr) : addr
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      logger.error('Server failed to start', error as Error);
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        console.log('Server closed');
        try {
          await prisma.$disconnect();
          console.log('Database connection closed');
          logger.info('Graceful shutdown completed');
        } catch (error) {
          logger.error('Error during graceful shutdown', error as Error);
        }
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    logger.error('Database connection failed', error as Error);
    console.log('⚠️  Starting server without database connection');

    console.log(`🚀 Starting server on port ${envInfo.port} (without database)...`);
    const server = app.listen(envInfo.port, '127.0.0.1', () => {
      console.log(`✓ Server running on http://localhost:${envInfo.port} (without database)`);
      console.log(`✓ Ready to accept requests`);
      const addr = server.address();
      console.log(`🔍 Server address:`, typeof addr === 'object' ? JSON.stringify(addr) : addr);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      logger.error('Server failed to start', error as Error);
    });
  }
}

startServer();
