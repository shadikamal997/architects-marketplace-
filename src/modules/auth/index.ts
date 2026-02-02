/**
 * Auth Module Barrel Export
 *
 * Main entry point for importing auth components
 *
 * Usage:
 * ```typescript
 * import {
 *   UserRole,
 *   hasPermission,
 *   authorize,
 *   requireAuthMiddleware,
 * } from './modules/auth';
 * ```
 */

// Roles
export { UserRole, VALID_ROLES, isValidRole } from './roles.enum';

// Permissions
export {
  hasPermission,
  requiresOwnership,
  isReadOnly,
  getPermissionsForRole,
  PERMISSIONS,
} from './permissions';

// Authenticated Request
export {
  AuthenticatedUser,
  AuthenticatedRequest,
  extractRole,
  extractRoleEntityId,
  createAuthenticatedRequest,
} from './authenticated-request';

// Identity Provider
export {
  IIdentityProvider,
  ProviderIdentity,
  StubIdentityProvider,
  getIdentityProvider,
} from './providers/identity-provider';

// Errors
export { UnauthorizedError, InvalidIdentityError } from '../../shared/errors';

// Guards
export { authenticateRequest, isAuthenticated } from './guards/auth.guard';
export { authorize, checkPermission, checkOwnership, getDeniedAccessResponse } from './guards/permission.guard';

// Middleware
export {
  RequiredAuthRequest,
  OptionalAuthRequest,
  requireAuthMiddleware,
  optionalAuthMiddleware,
} from './middleware/auth.middleware';
