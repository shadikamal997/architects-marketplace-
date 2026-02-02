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

const app = express();

// 🚨 HARD PORT LOCK - Backend cannot run on port 3000
const PORT = Number(process.env.PORT);
if (!PORT || PORT === 3000) {
  throw new Error("❌ Backend cannot run on port 3000. Use 3001 or higher. Set PORT=3001 in .env");
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

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'BUYER' } = req.body;

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: users.length + 1,
      email,
      name: name || email.split('@')[0], // Use name or fallback to email prefix
      password: hashedPassword,
      role: role.toUpperCase(),
      createdAt: new Date()
    };

    users.push(user);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint (alias for /auth/me)
app.get('/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // TEMP FIX: Return decoded JWT data directly (works with in-memory storage)
    // Once database is connected, uncomment user lookup below
    res.json({
      user: {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role
      }
    });

    /* DATABASE VERSION (use after Prisma is connected):
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
    */
  } catch (error) {
    console.error('Verify error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // TEMP FIX: Return decoded JWT data directly (works with in-memory storage)
    // Once database is connected, uncomment user lookup below
    res.json({
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0],
      role: decoded.role
    });

    /* DATABASE VERSION (use after Prisma is connected):
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      role: user.role
    });
    */
  } catch (error) {
    console.error('Me error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

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

// Get architect account details
app.get('/architect/account', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided',
      code: 'NO_TOKEN',
      status: 401
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        status: 404
      });
    }

    if (user.role !== 'ARCHITECT') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED',
        status: 403
      });
    }

    // Return mock architect account data
    res.json({
      success: true,
      data: {
        architect: {
          id: user.id,
          displayName: user.name,
          professionalTitle: 'Senior Architect',
          company: '',
          bio: '',
          accountType: 'INDIVIDUAL',
          currencyPreference: 'USD',
          stripeAccountStatus: 'pending',
          payoutsEnabled: false,
          payoutCurrency: 'USD',
          payoutSchedule: 'WEEKLY',
          platformCommission: 15,
          defaultLicenseType: 'STANDARD',
          allowPaidModifications: true,
          twoFactorEnabled: false,
          publicProfileVisibility: true,
          companyVisibility: true,
          searchEngineIndexing: true,
          dataExportRequested: false,
          accountDeletionRequested: false,
          emailNotifications: {},
          payoutBanks: [],
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            timezone: 'UTC',
            preferredLanguage: 'en',
            createdAt: user.createdAt
          },
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get architect account error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      status: 401
    });
  }
});

// ============================================================================
// REGISTER ALL ROUTE MODULES (STEP 3)
// ============================================================================

// Domain-specific routes
app.use('/architect', architectRoutes);
app.use('/buyer', buyerRoutes);
app.use('/files', filesRoutes);
app.use('/messages', messagesRoutes);
app.use('/conversations', conversationsRoutes);
app.use('/modifications', modificationsRoutes);
app.use('/admin', adminRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/licenses', licensesRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 🚨 BACKEND SAFETY CHECK - Mandatory logging
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🏗️  ARCHITECTS MARKETPLACE - BACKEND SERVER');
  console.log('='.repeat(60));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`🆔 Process PID: ${process.pid}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('✅ Backend server started successfully!');
  console.log('🚫 This server CANNOT run on port 3000');
  console.log('='.repeat(60));
});
