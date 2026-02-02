/**
 * Custom Error Classes
 * 
 * Domain-specific error types for business logic violations.
 * 
 * Categories:
 * - ValidationError: Input validation failures
 * - NotFoundError: Resource not found
 * - UnauthorizedError: Authentication/authorization failures
 * - BusinessLogicError: Frozen rule violations
 * - FinancialError: Commission, payout, or transaction errors
 * - ImmutabilityError: Attempts to modify immutable records
 */

/**
 * Unauthorized - Missing or invalid authentication credentials
 * HTTP: 401
 */
export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  readonly message = 'Unauthorized';

  constructor(details?: string) {
    super(details || 'Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Invalid identity or malformed credentials
 * HTTP: 401
 */
export class InvalidIdentityError extends Error {
  readonly statusCode = 401;
  readonly message = 'Invalid identity';

  constructor(details?: string) {
    super(details || 'Invalid identity');
    this.name = 'InvalidIdentityError';
  }
}

/**
 * Authentication failed (generic)
 * HTTP: 401
 */
export class AuthenticationFailedError extends Error {
  readonly statusCode = 401;
  readonly message = 'Authentication failed';

  constructor(details?: string) {
    super(details || 'Authentication failed');
    this.name = 'AuthenticationFailedError';
  }
}
