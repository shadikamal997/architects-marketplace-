import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail } from '../utils/response.js';
import { getGoogleAuthService } from '../services/google-auth.service.js';
import { getAppleAuthService } from '../services/apple-auth.service.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';

/**
 * POST /auth/debug-token
 * Debug endpoint to decode token without validation
 */
router.post('/debug-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return fail(res, 'Token is required', 400);
    }

    // Decode without verifying (just to see what's in it)
    const decoded = jwt.decode(token) as any;
    
    // Try to find user
    let user = null;
    if (decoded?.userId) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { architect: true, buyer: true },
      });
    }

    return ok(res, {
      decoded,
      userExists: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        hasArchitect: !!user.architect,
        hasBuyer: !!user.buyer,
        architectId: user.architect?.id,
        buyerId: user.buyer?.id,
      } : null,
    });
  } catch (error: any) {
    return fail(res, error.message, 500);
  }
});

/**
 * POST /auth/fix-account
 * Fix account by creating missing architect/buyer records
 */
router.post('/fix-account', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return fail(res, 'Token is required', 400);
    }

    // Verify and decode token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return fail(res, 'Invalid or expired token', 401);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { architect: true, buyer: true },
    });

    if (!user) {
      return fail(res, 'User not found in database. Please sign up again.', 404);
    }

    let needsNewToken = false;

    // Fix ARCHITECT without architect record
    if (user.role === 'ARCHITECT' && !user.architect) {
      console.log('[FIX] Creating missing architect record for user:', user.id);
      await prisma.architect.create({
        data: {
          userId: user.id,
          displayName: user.name || user.email.split('@')[0],
        },
      });
      needsNewToken = true;
    }

    // Fix BUYER without buyer record
    if (user.role === 'BUYER' && !user.buyer) {
      console.log('[FIX] Creating missing buyer record for user:', user.id);
      await prisma.buyer.create({
        data: {
          userId: user.id,
        },
      });
      needsNewToken = true;
    }

    // Fetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { architect: true, buyer: true },
    });

    // Generate new token with correct IDs
    const newToken = jwt.sign(
      {
        userId: updatedUser!.id,
        email: updatedUser!.email,
        role: updatedUser!.role,
        buyerId: updatedUser!.buyer?.id,
        architectId: updatedUser!.architect?.id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return ok(res, {
      message: needsNewToken ? 'Account fixed! Use the new token.' : 'Account is already valid.',
      token: newToken,
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        name: updatedUser!.name,
        role: updatedUser!.role,
      },
      fixed: needsNewToken,
    });
  } catch (error: any) {
    console.error('[FIX] Error:', error);
    return fail(res, error.message, 500);
  }
});

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

/**
 * POST /auth/google
 * Authenticate with Google ID token
 * 
 * Flow:
 * 1. Verify token with Google
 * 2. Check if provider already linked → return existing user
 * 3. Check if email exists → link provider to existing user
 * 4. Create new user + link provider
 * 5. Issue JWT token
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken, role = 'BUYER' } = req.body;

    // Validate input
    if (!idToken || typeof idToken !== 'string') {
      return fail(res, 'Google ID token is required', 400);
    }

    // Role validation for new users
    const validRoles = ['BUYER', 'ARCHITECT'];
    const userRole = role.toUpperCase();
    if (!validRoles.includes(userRole)) {
      return fail(res, 'Invalid role', 400);
    }

    // Verify token with Google
    const googleAuthService = getGoogleAuthService();
    let googleUser;
    
    try {
      googleUser = await googleAuthService.verifyIdToken(idToken);
    } catch (error: any) {
      console.error('Google verification error:', error.message);
      return fail(res, 'Invalid Google token', 401);
    }

    // 1️⃣ Check if this Google account is already linked
    const existingProvider = await prisma.authProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'GOOGLE',
          providerUserId: googleUser.providerUserId,
        },
      },
      include: {
        user: {
          include: {
            buyer: true,
            architect: true,
          },
        },
      },
    });

    if (existingProvider) {
      // User already exists with this Google account
      const user = existingProvider.user;

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          buyerId: user.buyer?.id,
          architectId: user.architect?.id,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ok(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        isNewUser: false,
      });
    }

    // 2️⃣ Check if a user with this email already exists
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email.toLowerCase().trim() },
      include: {
        buyer: true,
        architect: true,
      },
    });

    if (user) {
      // Existing user - link Google provider
      await prisma.authProvider.create({
        data: {
          provider: 'GOOGLE',
          providerUserId: googleUser.providerUserId,
          userId: user.id,
        },
      });

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          buyerId: user.buyer?.id,
          architectId: user.architect?.id,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ok(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        isNewUser: false,
        linkedProvider: true, // Indicates we linked Google to existing account
      });
    }

    // 3️⃣ Create new user with Google account
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create user with Buyer or Architect profile
      const newUser = await tx.user.create({
        data: {
          email: googleUser.email.toLowerCase().trim(),
          name: googleUser.name,
          password: '', // No password for Google users (will be empty string for now)
          role: userRole,
          profilePhotoUrl: googleUser.picture,
          ...(userRole === 'BUYER' && {
            buyer: {
              create: {},
            },
          }),
          ...(userRole === 'ARCHITECT' && {
            architect: {
              create: {
                displayName: googleUser.name,
              },
            },
          }),
        },
        include: {
          buyer: true,
          architect: true,
        },
      });

      // Link Google provider
      await tx.authProvider.create({
        data: {
          provider: 'GOOGLE',
          providerUserId: googleUser.providerUserId,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: result.id,
        email: result.email,
        role: result.role,
        buyerId: result.buyer?.id,
        architectId: result.architect?.id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return ok(res, {
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      },
      token,
      isNewUser: true,
    });
  } catch (error) {
    console.error('Google login error:', error);
    return fail(res, 'Internal server error', 500);
  }
});

/**
 * POST /auth/apple
 * Authenticate with Apple ID token
 * 
 * CRITICAL Apple Behavior:
 * - Email + name sent ONLY on first login
 * - After that: only 'sub' (Apple user ID)
 * - Email may be private relay or missing
 * - 'sub' is the ONLY stable identifier
 * 
 * Flow:
 * 1. Verify token with Apple (using Apple's public keys)
 * 2. Check if provider already linked by 'sub' → return existing user
 * 3. If email exists, check if user exists → link provider
 * 4. Create new user (email may be null) + link provider
 * 5. Issue JWT token
 */
router.post('/apple', async (req, res) => {
  try {
    const { idToken, role = 'BUYER', name } = req.body;

    // Validate input
    if (!idToken || typeof idToken !== 'string') {
      return fail(res, 'Apple ID token is required', 400);
    }

    // Role validation for new users
    const validRoles = ['BUYER', 'ARCHITECT'];
    const userRole = role.toUpperCase();
    if (!validRoles.includes(userRole)) {
      return fail(res, 'Invalid role', 400);
    }

    // Verify token with Apple
    const appleAuthService = getAppleAuthService();
    let appleUser;
    
    try {
      appleUser = await appleAuthService.verifyIdToken(idToken);
    } catch (error: any) {
      console.error('Apple verification error:', error.message);
      return fail(res, 'Invalid Apple token', 401);
    }

    // 1️⃣ Check if this Apple account is already linked (by sub)
    const existingProvider = await prisma.authProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'APPLE',
          providerUserId: appleUser.providerUserId,
        },
      },
      include: {
        user: {
          include: {
            buyer: true,
            architect: true,
          },
        },
      },
    });

    if (existingProvider) {
      // Returning Apple user - issue JWT
      const user = existingProvider.user;

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          buyerId: user.buyer?.id,
          architectId: user.architect?.id,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ok(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        isNewUser: false,
      });
    }

    // 2️⃣ Check if a user with this email already exists (only if email provided)
    let user = null;
    
    if (appleUser.email) {
      user = await prisma.user.findUnique({
        where: { email: appleUser.email.toLowerCase().trim() },
        include: {
          buyer: true,
          architect: true,
        },
      });

      if (user) {
        // Existing user - link Apple provider
        await prisma.authProvider.create({
          data: {
            provider: 'APPLE',
            providerUserId: appleUser.providerUserId,
            userId: user.id,
          },
        });

        const token = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            buyerId: user.buyer?.id,
            architectId: user.architect?.id,
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        return ok(res, {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          token,
          isNewUser: false,
          linkedProvider: true,
        });
      }
    }

    // 3️⃣ Create new user with Apple account
    // Apple may not provide email, so we handle that case
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Determine name: prioritize frontend name, then Apple email, then fallback
      const userName = name || 
                       (appleUser.email ? appleUser.email.split('@')[0] : 'Apple User');

      // Create user
      const newUser = await tx.user.create({
        data: {
          email: appleUser.email ? appleUser.email.toLowerCase().trim() : `apple_${appleUser.providerUserId}@placeholder.local`,
          name: userName,
          password: '', // No password for Apple users
          role: userRole,
          ...(userRole === 'BUYER' && {
            buyer: {
              create: {},
            },
          }),
          ...(userRole === 'ARCHITECT' && {
            architect: {
              create: {
                displayName: userName,
              },
            },
          }),
        },
        include: {
          buyer: true,
          architect: true,
        },
      });

      // Link Apple provider
      await tx.authProvider.create({
        data: {
          provider: 'APPLE',
          providerUserId: appleUser.providerUserId,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: result.id,
        email: result.email,
        role: result.role,
        buyerId: result.buyer?.id,
        architectId: result.architect?.id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return ok(res, {
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      },
      token,
      isNewUser: true,
      isPrivateEmail: appleUser.isPrivateEmail,
    });
  } catch (error) {
    console.error('Apple login error:', error);
    return fail(res, 'Internal server error', 500);
  }
});

export default router;