/**
 * Permission Guard
 * 
 * Validates user has permission for specific resource + action
 * 
 * FROZEN RULES:
 * - Authorization fails CLOSED (deny by default)
 * - No permission = access denied
 * - Ownership required = checked separately
 * - Admin is NOT a superuser (can't modify transactions/licenses)
 */

import { UserRole } from '../roles.enum';
import {
  hasPermission,
  requiresOwnership,
  isReadOnly,
} from '../permissions';
import { AuthenticatedRequest } from '../authenticated-request';

/**
 * Permission Denied Error (Generic)
 * 
 * CRITICAL: Generic message regardless of reason:
 * - No permission for action
 * - Wrong role
 * - No ownership
 * - Insufficient privileges
 * - All return same message
 * 
 * This prevents attackers from discovering permission structure
 */
export class PermissionDeniedError extends Error {
  constructor() {
    super('Access denied');
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Check if user has permission for action
 * 
 * THROWS: PermissionDeniedError if:
 * - User's role doesn't have permission
 * - Permission doesn't exist for role
 * - Resource is read-only for modifications
 * 
 * RETURNS: true if permission granted
 */
export function checkPermission(
  user: AuthenticatedRequest,
  resource: string,
  action: string
): boolean {
  // Step 1: Check if permission exists for role
  if (!hasPermission(user.user.role, resource, action)) {
    throw new PermissionDeniedError();
  }

  // Step 2: Check if action is valid
  // (permission exists but might be read-only for modifications)
  if (isReadOnly(user.user.role, resource, action) && isModificationAction(action)) {
    throw new PermissionDeniedError();
  }

  return true;
}

/**
 * Check if user owns resource (for ownership-required permissions)
 * 
 * THROWS: PermissionDeniedError if:
 * - Permission requires ownership but user doesn't own resource
 * - Permission doesn't require ownership (caller error)
 */
export function checkOwnership(
  user: AuthenticatedRequest,
  resource: string,
  action: string,
  resourceOwnerId: string
): boolean {
  // Step 1: Verify permission requires ownership
  if (!requiresOwnership(user.user.role, resource, action)) {
    // Ownership not required for this action
    // Caller should not invoke this check
    throw new Error('Permission does not require ownership check');
  }

  // Step 2: Verify user owns resource
  if (!user.isOwner(resourceOwnerId)) {
    throw new PermissionDeniedError();
  }

  return true;
}

/**
 * Full authorization check
 * 
 * Checks both:
 * 1. Permission exists
 * 2. Ownership (if required)
 * 
 * THROWS: PermissionDeniedError on failure
 */
export function authorize(
  user: AuthenticatedRequest,
  resource: string,
  action: string,
  resourceOwnerId?: string
): boolean {
  // Step 1: Check permission
  checkPermission(user, resource, action);

  // Step 2: Check ownership (if required)
  if (requiresOwnership(user.user.role, resource, action)) {
    if (!resourceOwnerId) {
      throw new Error('Ownership check required but resourceOwnerId missing');
    }
    checkOwnership(user, resource, action, resourceOwnerId);
  }

  return true;
}

/**
 * Check if action is a modification (vs. read)
 */
function isModificationAction(action: string): boolean {
  const readActions = ['read', 'browse', 'download', 'view'];
  return !readActions.includes(action.toLowerCase());
}

/**
 * Get denied access response (generic, non-revealing)
 */
export function getDeniedAccessResponse(): {
  status: number;
  message: string;
} {
  return {
    status: 403,
    message: 'Access denied',
  };
}

/**
 * Express middleware to require specific role
 * 
 * Use this after requireAuthMiddleware to enforce role-based access
 */
export function requireRole(role: UserRole) {
  return (req: any, res: any, next: any): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  };
}
