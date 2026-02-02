/**
 * Authentication Guard
 *
 * Validates user identity and creates authenticated request context
 *
 * FROZEN: Authorization fails CLOSED
 * FROZEN: Generic error responses (no information leakage)
 */

import { AuthenticatedRequest, AuthenticatedUser, extractRole, extractRoleEntityId, createAuthenticatedRequest } from '../authenticated-request';
import { getIdentityProvider } from '../providers/identity-provider';
import { AuthenticationFailedError, InvalidIdentityError, UnauthorizedError } from '../../../shared/errors';

/**
 * Authenticate request and create authenticated context
 *
 * 5-step process:
 * 1. Extract identity from headers
 * 2. Validate role is singular and valid
 * 3. Validate role-specific requirements
 * 4. Extract roleEntityId (architectId, buyerId, userId)
 * 5. Create authenticated request
 *
 * @throws AuthenticationFailedError with generic message (no details!)
 */
export function authenticateRequest(headers: Record<string, string>): AuthenticatedRequest {
  try {
    const provider = getIdentityProvider();

    // Step 1: Extract identity from headers
    const identity = provider.extractIdentity(headers);

    // Step 2: Validate role is singular and valid
    const role = extractRole(identity.role);

    // Step 3: Validate identity via provider
    provider.validateRole(identity);

    // Step 4: Extract roleEntityId
    const roleEntityId = extractRoleEntityId(role, identity);

    // Step 5: Create authenticated request
    const authenticatedUser: AuthenticatedUser = {
      userId: identity.sub,
      role,
      roleEntityId,
      id: roleEntityId, // Alias for backwards compatibility with existing routes
    };

    return createAuthenticatedRequest(authenticatedUser);
  } catch (error) {
    // FROZEN: Generic error response (no information leakage)
    // Don't reveal why authentication failed:
    // - Missing token vs invalid token?
    // - Expired token vs wrong signature?
    // - Wrong role vs missing role requirement?
    console.error('[AUTH] Authentication failed:', (error as Error).message);
    throw new AuthenticationFailedError('Authentication failed');
  }
}

/**
 * Check if request is authenticated (optional auth routes)
 *
 * Returns boolean instead of throwing
 */
export function isAuthenticated(headers: Record<string, string>): boolean {
  try {
    authenticateRequest(headers);
    return true;
  } catch {
    return false;
  }
}
