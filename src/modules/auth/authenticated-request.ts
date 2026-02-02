/**
 * Authenticated Request Context
 *
 * Enriches every request with authenticated user information
 * FROZEN: Every request has EXACTLY ONE role
 */

import { UserRole } from './roles.enum';

/**
 * Authenticated user data
 *
 * CRITICAL: roleEntityId determines access scope
 * - ARCHITECT: architectId
 * - BUYER: buyerId
 * - ADMIN: userId (admin uses base user ID)
 */
export interface AuthenticatedUser {
  userId: string; // Base user ID
  role: UserRole; // EXACTLY ONE role
  roleEntityId: string; // Role-specific entity ID for ownership checks
  id: string; // Alias for roleEntityId (backwards compatibility with existing routes)
}

/**
 * Authenticated request
 *
 * Every authenticated request includes user context and ownership checking
 */
export interface AuthenticatedRequest {
  user: AuthenticatedUser;
  /**
   * Check if user owns a resource
   *
   * Compares roleEntityId against resource owner ID
   * - Architect can only own designs they created
   * - Buyer can only own licenses/transactions they own
   * - Admin uses userId for ownership checks
   */
  isOwner(resourceOwnerId: string): boolean;
}

/**
 * Extract role from identity
 *
 * CRITICAL: Must be exactly ONE role (not array, not multiple)
 */
export function extractRole(roleValue: any): UserRole {
  // Guard against arrays or multiple values
  if (Array.isArray(roleValue)) {
    throw new Error('Dual-role sessions not allowed');
  }

  // Validate role is valid
  if (roleValue !== 'ARCHITECT' && roleValue !== 'BUYER' && roleValue !== 'ADMIN') {
    throw new Error(`Invalid role: ${roleValue}`);
  }

  return roleValue;
}

/**
 * Extract role entity ID from identity
 *
 * Maps role to appropriate entity ID for ownership checks
 * - ARCHITECT: architectId
 * - BUYER: buyerId
 * - ADMIN: sub (base user ID)
 */
export function extractRoleEntityId(
  role: UserRole,
  identity: any
): string {
  switch (role) {
    case UserRole.ARCHITECT:
      if (!identity.architectId) {
        throw new Error('Architect role requires architectId');
      }
      return identity.architectId;

    case UserRole.BUYER:
      if (!identity.buyerId) {
        throw new Error('Buyer role requires buyerId');
      }
      return identity.buyerId;

    case UserRole.ADMIN:
      if (!identity.sub) {
        throw new Error('Admin role requires user ID (sub)');
      }
      return identity.sub;

    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

/**
 * Create authenticated request with ownership checking
 */
export function createAuthenticatedRequest(user: AuthenticatedUser): AuthenticatedRequest {
  return {
    user,
    isOwner(resourceOwnerId: string): boolean {
      return user.roleEntityId === resourceOwnerId;
    },
  };
}
