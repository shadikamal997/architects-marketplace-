// Auth middleware for route protection
const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';

/**
 * Middleware: Require authentication
 * Verifies JWT token and attaches user to req.user
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return unauthorized(res, 'Invalid token');
  }
};

/**
 * Middleware: Require specific role
 * @param {string} role - Required role (BUYER, ARCHITECT, ADMIN)
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Not authenticated');
    }

    if (req.user.role !== role) {
      return forbidden(res, `Access denied. Requires ${role} role`);
    }

    next();
  };
};

/**
 * Middleware: Require one of multiple roles
 * @param {string[]} roles - Array of allowed roles
 */
const requireAnyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      return forbidden(res, `Access denied. Requires one of: ${roles.join(', ')}`);
    }

    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
  requireAnyRole
};
