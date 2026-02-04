const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import route modules
const architectRoutes = require('./src/routes/architect.routes');
const buyerRoutes = require('./src/routes/buyer.routes');
const filesRoutes = require('./src/routes/files.routes');
const messagesRoutes = require('./src/routes/messages.routes');
const conversationsRoutes = require('./src/routes/conversations.routes');
const modificationsRoutes = require('./src/routes/modifications.routes');
const adminRoutes = require('./src/routes/admin.routes');
const transactionsRoutes = require('./src/routes/transactions.routes');
const licensesRoutes = require('./src/routes/licenses.routes');
const reviewsRoutes = require('./src/routes/reviews.routes');
const marketplaceRoutes = require('./src/routes/marketplace.routes');
const purchaseRoutes = require('./src/routes/purchase.routes');
const authRoutes = require('./src/routes/auth.routes.js');

const app = express();

// 🚨 HARD PORT LOCK - Backend cannot run on port 3000
const PORT = Number(process.env.PORT);
if (!PORT || PORT === 3000) {
  throw new Error("Backend cannot run on port 3000. Use 3001 or higher. Set PORT=3001 in .env");
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000', // Frontend URL
  credentials: true
}));
app.use(express.json());

// Mock user database (in memory for testing)
const users = [];

// Mock designs database (in memory for testing)
const designs = [
  {
    id: 1,
    title: "Modern Villa Design",
    slug: "modern-villa-design",
    description: "A contemporary villa with open floor plan and minimalist design",
    category: "Residential",
    priceUsdCents: 50000, // $500.00
    architectId: 1,
    architect: {
      id: 1,
      displayName: "John Architect",
      professionalTitle: "Senior Architect"
    },
    state: "PUBLISHED",
    area: 450,
    floors: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    title: "Urban Apartment Complex",
    slug: "urban-apartment-complex",
    description: "High-rise apartment building with sustainable features",
    category: "Residential",
    priceUsdCents: 75000, // $750.00
    architectId: 1,
    architect: {
      id: 1,
      displayName: "John Architect",
      professionalTitle: "Senior Architect"
    },
    state: "PUBLISHED",
    area: 1200,
    floors: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 3,
    title: "Corporate Office Building",
    slug: "corporate-office-building",
    description: "Modern office space with collaborative areas",
    category: "Commercial",
    priceUsdCents: 100000, // $1000.00
    architectId: 1,
    architect: {
      id: 1,
      displayName: "John Architect",
      professionalTitle: "Senior Architect"
    },
    state: "PUBLISHED",
    area: 2000,
    floors: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 4,
    title: "Draft Residential Project",
    slug: "draft-residential-project",
    description: "Work in progress residential design",
    category: "Residential",
    priceUsdCents: 60000,
    architectId: 1,
    architect: {
      id: 1,
      displayName: "John Architect",
      professionalTitle: "Senior Architect"
    },
    state: "DRAFT",
    area: 350,
    floors: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// JWT Secret - use environment variable for security
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';

// ============================================================================
// OLD MOCK AUTH ROUTES REMOVED - Using real auth routes now
// See: src/routes/auth.routes.ts (compiled to dist/routes/auth.routes.js)
// Available endpoints: /auth/register, /auth/login, /auth/google, /auth/apple
// ============================================================================

// Marketplace routes (public)
app.get('/marketplace/designs', (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Filter only published designs
    const publishedDesigns = designs.filter(d => d.state === 'PUBLISHED');
    
    // Simple pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedDesigns = publishedDesigns.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        designs: paginatedDesigns,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: publishedDesigns.length,
          totalPages: Math.ceil(publishedDesigns.length / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Marketplace designs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      status: 500
    });
  }
});

app.get('/marketplace/designs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const designId = parseInt(id);
    
    const design = designs.find(d => d.id === designId && d.state === 'PUBLISHED');
    
    if (!design) {
      return res.status(404).json({
        success: false,
        error: 'Design not found',
        code: 'DESIGN_NOT_FOUND',
        status: 404
      });
    }
    
    res.json({
      success: true,
      data: design
    });
  } catch (error) {
    console.error('Design detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      status: 500
    });
  }
});

app.get('/marketplace/designs/slug/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    
    const design = designs.find(d => d.slug === slug && d.state === 'PUBLISHED');
    
    if (!design) {
      return res.status(404).json({
        success: false,
        error: 'Design not found',
        code: 'DESIGN_NOT_FOUND',
        status: 404
      });
    }
    
    res.json({
      success: true,
      data: design
    });
  } catch (error) {
    console.error('Design detail by slug error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      status: 500
    });
  }
});

// ============================================================================
// REGISTER ALL ROUTE MODULES (STEP 3)
// ============================================================================

// Domain-specific routes
app.use('/auth', authRoutes); // Authentication (email/password, Google, Apple)
app.use('/architect', architectRoutes);
app.use('/buyer', buyerRoutes);
app.use('/files', filesRoutes);
app.use('/messages', messagesRoutes);
app.use('/conversations', conversationsRoutes);
app.use('/modifications', modificationsRoutes);
app.use('/admin', adminRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/licenses', licensesRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/purchases', purchaseRoutes); // Purchase & download management
app.use('/marketplace', marketplaceRoutes); // Public marketplace browsing

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 🚨 BACKEND SAFETY CHECK - Mandatory logging
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('ARCHITECTS MARKETPLACE - BACKEND SERVER');
  console.log('='.repeat(60));
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Process PID: ${process.pid}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('Backend server started successfully!');
  console.log('This server CANNOT run on port 3000');
  console.log('='.repeat(60));
});
