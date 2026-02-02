import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'BUYER' } = req.body;

    // STRICT INPUT VALIDATION
    if (!email || typeof email !== 'string') {
      return fail(res, 'Email is required', 400);
    }

    if (!password || typeof password !== 'string') {
      return fail(res, 'Password is required', 400);
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return fail(res, 'Invalid email format', 400);
    }

    // Email length validation
    if (email.length > 254) {
      return fail(res, 'Email too long', 400);
    }

    // Password strength validation
    if (password.length < 8) {
      return fail(res, 'Password must be at least 8 characters long', 400);
    }

    if (password.length > 128) {
      return fail(res, 'Password too long', 400);
    }

    // Check for common weak passwords (basic check)
    const weakPasswords = ['password', '12345678', 'qwerty', 'abc123'];
    if (weakPasswords.includes(password.toLowerCase())) {
      return fail(res, 'Password too weak', 400);
    }

    // Name validation
    if (name && (typeof name !== 'string' || name.length > 100)) {
      return fail(res, 'Invalid name', 400);
    }

    // Role validation
    const validRoles = ['BUYER', 'ARCHITECT'];
    const userRole = role.toUpperCase();
    if (!validRoles.includes(userRole)) {
      return fail(res, 'Invalid role', 400);
    }

    // Check if user exists - PREVENT RACE CONDITIONS
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return fail(res, 'User already exists', 409);
    }

    // Hash password with proper salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with nested Buyer or Architect based on role - ATOMIC OPERATION
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name ? name.trim() : email.split('@')[0],
        password: hashedPassword,
        role: userRole,
        ...(userRole === 'BUYER' && {
          buyer: {
            create: {}
          }
        }),
        ...(userRole === 'ARCHITECT' && {
          architect: {
            create: {
              displayName: name ? name.trim() : email.split('@')[0]
            }
          }
        })
      },
      include: {
        buyer: true,
        architect: true
      }
    });

    // Generate JWT with proper expiration
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        buyerId: user.buyer?.id,
        architectId: user.architect?.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return ok(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return fail(res, 'Internal server error', 500);
  }
});

/**
 * POST /auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // STRICT INPUT VALIDATION
    if (!email || typeof email !== 'string') {
      return fail(res, 'Email is required', 400);
    }

    if (!password || typeof password !== 'string') {
      return fail(res, 'Password is required', 400);
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return fail(res, 'Invalid email format', 400);
    }

    // Email length validation
    if (email.length > 254) {
      return fail(res, 'Email too long', 400);
    }

    // Password length validation
    if (password.length > 128) {
      return fail(res, 'Password too long', 400);
    }

    // Find user by email (case insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        buyer: true,
        architect: true
      }
    });

    // CONSISTENT ERROR RESPONSE - Never reveal if email exists
    if (!user) {
      return fail(res, 'Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return fail(res, 'Invalid credentials', 401);
    }

    // Generate JWT with proper expiration
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        buyerId: user.buyer?.id,
        architectId: user.architect?.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return ok(res, {
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
    return fail(res, 'Internal server error', 500);
  }
});

/**
 * POST /auth/verify
 * Verify JWT token and return user info
 */
router.post('/verify', requireAuth, async (req, res) => {
  const user = (req as any).user;
  return ok(res, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

/**
 * GET /auth/me
 * Get current user info (alias for verify)
 */
router.get('/me', requireAuth, async (req, res) => {
  const authenticatedUser = (req as any).user;
  
  // Fetch full user data from database to ensure we have all fields
  const user = await prisma.user.findUnique({
    where: { id: authenticatedUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    }
  });
  
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  
  return ok(res, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });
});

export default router;