/**
 * Authentication Middleware
 *
 * Express/Node middleware for applying authentication to routes
 */

import { authenticateRequest, isAuthenticated } from '../guards/auth.guard';
import { AuthenticatedRequest } from '../authenticated-request';
import { AuthenticationFailedError } from '../../../shared/errors';

/**
 * Require authentication
 *
 * Throws 401 if not authenticated
 *
 * Usage:
 * ```typescript
 * const handler = (req: RequiredAuthRequest) => {
 *   // req.user is guaranteed to exist
 *   const { user } = req;
 * };
 * ```
 */
export interface RequiredAuthRequest {
  user: AuthenticatedRequest['user'];
}

/**
 * Optional authentication
 *
 * Continues even if not authenticated
 *
 * Usage:
 * ```typescript
 * const handler = (req: OptionalAuthRequest) => {
 *   // req.user may be undefined
 *   const { user } = req;
 * };
 * ```
 */
export interface OptionalAuthRequest {
  user?: AuthenticatedRequest['user'];
}

/**
 * Express middleware for required authentication
 *
 * Attaches authenticated user to request
 * Returns 401 if authentication fails
 */
export function requireAuthMiddleware(
  req: any,
  res: any,
  next: any
): void {
  try {
    const authenticatedRequest = authenticateRequest(req.headers);
    req.user = authenticatedRequest.user;
    next();
  } catch (error) {
    if (error instanceof AuthenticationFailedError) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Express middleware for optional authentication
 *
 * Attaches authenticated user to request if available
 * Continues regardless of authentication status
 */
export function optionalAuthMiddleware(
  req: any,
  res: any,
  next: any
): void {
  try {
    if (isAuthenticated(req.headers)) {
      const authenticatedRequest = authenticateRequest(req.headers);
      req.user = authenticatedRequest.user;
    }
    next();
  } catch (error) {
    // For optional auth, we ignore auth errors and continue
    next();
  }
}
