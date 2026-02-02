/**
 * Identity Provider Interface & Stub Implementation
 *
 * Responsible for extracting and validating identity from requests
 *
 * STUB: This is a placeholder implementation
 * In production, replace with Auth0, Cognito, or custom JWT validator
 */

import { UserRole } from '../roles.enum';
import { UnauthorizedError, InvalidIdentityError } from '../../../shared/errors';
import jwt from 'jsonwebtoken';

/**
 * Identity extracted from request
 */
export interface ProviderIdentity {
  sub: string; // User ID
  email: string;
  role: UserRole;
  // Role-specific claims
  architectId?: string;
  buyerId?: string;
}

/**
 * Identity Provider interface
 */
export interface IIdentityProvider {
  /**
   * Extract identity from request headers
   *
   * @throws UnauthorizedError if token missing/invalid
   */
  extractIdentity(headers: Record<string, string>): ProviderIdentity;

  /**
   * Validate identity role is correct and singular
   *
   * @throws InvalidIdentityError if role invalid/malformed
   */
  validateRole(identity: ProviderIdentity): UserRole;
}

/**
 * Stub Identity Provider
 *
 * SECURE IMPLEMENTATION:
 * - Extracts from Authorization: Bearer <token>
 * - Properly verifies JWT signature with JWT_SECRET
 * - Validates claims and expiration
 * - Enforces exactly ONE role
 *
 * JWT Payload Format:
 * {
 *   "userId": "user123",
 *   "email": "user@example.com",
 *   "role": "ARCHITECT",
 *   "iat": 1234567890,
 *   "exp": 1234567890
 * }
 */
export class StubIdentityProvider implements IIdentityProvider {
  extractIdentity(headers: Record<string, string>): ProviderIdentity {
    const authHeader = headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    const token = parts[1];

    // SECURE: Properly verify JWT signature
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      // Check expiration explicitly
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedError('Token expired');
      }

      const identity: ProviderIdentity = {
        sub: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        architectId: decoded.architectId,
        buyerId: decoded.buyerId,
      };

      return identity;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  }

  validateRole(identity: ProviderIdentity): UserRole {
    // FROZEN: Exactly ONE role per user
    const validRoles = ['ARCHITECT', 'BUYER', 'ADMIN'];

    // Guard against arrays (dual-role)
    if (Array.isArray(identity.role)) {
      throw new InvalidIdentityError('Dual-role sessions not allowed');
    }

    // Guard against invalid role value
    if (!validRoles.includes(identity.role)) {
      throw new InvalidIdentityError(`Invalid role: ${identity.role}`);
    }

    // Validate role-specific requirements
    switch (identity.role) {
      case UserRole.ARCHITECT:
        if (!identity.architectId) {
          throw new InvalidIdentityError('Architect role requires architectId');
        }
        break;

      case UserRole.BUYER:
        if (!identity.buyerId) {
          throw new InvalidIdentityError('Buyer role requires buyerId');
        }
        break;

      case UserRole.ADMIN:
        if (!identity.sub) {
          throw new InvalidIdentityError('Admin role requires user ID');
        }
        break;
    }

    return identity.role;
  }
}

/**
 * Get singleton identity provider instance
 */
let providerInstance: IIdentityProvider | null = null;

export function getIdentityProvider(): IIdentityProvider {
  if (!providerInstance) {
    providerInstance = new StubIdentityProvider();
  }
  return providerInstance;
}
