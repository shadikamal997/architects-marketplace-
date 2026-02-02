/**
 * User Roles
 * 
 * FROZEN RULES:
 * - Every request resolves to EXACTLY ONE role
 * - No dual-role sessions
 * - Architect and Buyer are mutually exclusive
 * - Admin is a separate account type
 */

export enum UserRole {
  ARCHITECT = 'ARCHITECT',  // Design seller
  BUYER = 'BUYER',           // Design purchaser
  ADMIN = 'ADMIN',           // Platform administrator
}

/**
 * Role validation
 */
export const VALID_ROLES = Object.values(UserRole);

/**
 * Check if value is a valid role
 */
export function isValidRole(value: string): value is UserRole {
  return VALID_ROLES.includes(value as UserRole);
}
