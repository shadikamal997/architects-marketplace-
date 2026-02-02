/**
 * Permission Definitions
 * 
 * Access Control Rules (Frozen)
 * 
 * ARCHITECT (Design Seller):
 * - Create, read, update own designs
 * - Read own transactions (as seller)
 * - Read own payouts
 * - View own bank accounts
 * 
 * BUYER (Design Purchaser):
 * - Browse published designs
 * - Read own licenses
 * - Read own transactions (as buyer)
 * - Cannot modify licenses
 * - Cannot access other buyers' data
 * 
 * ADMIN (Platform Administrator):
 * - READ everything (designs, transactions, licenses, payouts, users)
 * - CANNOT modify transactions
 * - CANNOT modify licenses
 * - CANNOT modify payout amounts
 * - CAN approve/reject designs
 * - CAN revoke licenses (with reason)
 * - CAN log admin actions
 * 
 * CRITICAL: Authorization fails CLOSED
 * - Default: DENY
 * - Explicit allow only
 * - Admin is NOT a superuser
 */

import { UserRole } from './roles.enum';

/**
 * Permission definition
 */
export interface Permission {
  role: UserRole;
  resource: string;
  action: string;
  constraints?: {
    ownershipRequired?: boolean;  // Must own the resource
    readOnly?: boolean;            // Cannot modify
    hidden?: boolean;              // Cannot view at all
  };
}

/**
 * All Permissions (Frozen)
 * 
 * Format: {role}_{resource}_{action}
 * Example: ARCHITECT_DESIGN_CREATE
 */
export const PERMISSIONS: Record<string, Permission> = {
  // ========================================
  // ARCHITECT PERMISSIONS
  // ========================================

  ARCHITECT_DESIGN_CREATE: {
    role: UserRole.ARCHITECT,
    resource: 'design',
    action: 'create',
  },

  ARCHITECT_DESIGN_READ: {
    role: UserRole.ARCHITECT,
    resource: 'design',
    action: 'read',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_DESIGN_UPDATE: {
    role: UserRole.ARCHITECT,
    resource: 'design',
    action: 'update',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_DESIGN_SUBMIT: {
    role: UserRole.ARCHITECT,
    resource: 'design',
    action: 'submit',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_DESIGN_PUBLISH: {
    role: UserRole.ARCHITECT,
    resource: 'design',
    action: 'publish',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_DESIGN_ARCHIVE: {
    role: UserRole.ARCHITECT,
    resource: 'design',
    action: 'archive',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_TRANSACTION_READ: {
    role: UserRole.ARCHITECT,
    resource: 'transaction',
    action: 'read',
    constraints: { ownershipRequired: true, readOnly: true },
  },

  ARCHITECT_PAYOUT_READ: {
    role: UserRole.ARCHITECT,
    resource: 'payout',
    action: 'read',
    constraints: { ownershipRequired: true, readOnly: true },
  },

  ARCHITECT_PAYOUT_RELEASE: {
    role: UserRole.ARCHITECT,
    resource: 'payout',
    action: 'release',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_PAYOUT_BANK_CREATE: {
    role: UserRole.ARCHITECT,
    resource: 'payout_bank',
    action: 'create',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_PAYOUT_BANK_UPDATE: {
    role: UserRole.ARCHITECT,
    resource: 'payout_bank',
    action: 'update',
    constraints: { ownershipRequired: true },
  },

  ARCHITECT_PAYOUT_BANK_READ: {
    role: UserRole.ARCHITECT,
    resource: 'payout_bank',
    action: 'read',
    constraints: { ownershipRequired: true },
  },

  // ========================================
  // BUYER PERMISSIONS
  // ========================================

  BUYER_DESIGN_READ: {
    role: UserRole.BUYER,
    resource: 'design',
    action: 'read',
    constraints: { readOnly: true },
  },

  BUYER_DESIGN_BROWSE: {
    role: UserRole.BUYER,
    resource: 'design',
    action: 'browse',
    constraints: { readOnly: true },
  },

  BUYER_LICENSE_READ: {
    role: UserRole.BUYER,
    resource: 'license',
    action: 'read',
    constraints: { ownershipRequired: true, readOnly: true },
  },

  BUYER_LICENSE_DOWNLOAD: {
    role: UserRole.BUYER,
    resource: 'license',
    action: 'download',
    constraints: { ownershipRequired: true },
  },

  BUYER_TRANSACTION_CREATE: {
    role: UserRole.BUYER,
    resource: 'transaction',
    action: 'create',
  },

  BUYER_TRANSACTION_READ: {
    role: UserRole.BUYER,
    resource: 'transaction',
    action: 'read',
    constraints: { ownershipRequired: true, readOnly: true },
  },

  BUYER_TRANSACTION_REQUEST_REFUND: {
    role: UserRole.BUYER,
    resource: 'transaction',
    action: 'request_refund',
    constraints: { ownershipRequired: true },
  },

  // ========================================
  // ADMIN PERMISSIONS
  // ========================================

  ADMIN_DESIGN_READ: {
    role: UserRole.ADMIN,
    resource: 'design',
    action: 'read',
    constraints: { readOnly: true },
  },

  ADMIN_DESIGN_APPROVE: {
    role: UserRole.ADMIN,
    resource: 'design',
    action: 'approve',
  },

  ADMIN_DESIGN_REJECT: {
    role: UserRole.ADMIN,
    resource: 'design',
    action: 'reject',
  },

  ADMIN_DESIGN_ARCHIVE: {
    role: UserRole.ADMIN,
    resource: 'design',
    action: 'archive',
  },

  ADMIN_LICENSE_READ: {
    role: UserRole.ADMIN,
    resource: 'license',
    action: 'read',
    constraints: { readOnly: true },
  },

  ADMIN_LICENSE_REVOKE: {
    role: UserRole.ADMIN,
    resource: 'license',
    action: 'revoke',
  },

  ADMIN_TRANSACTION_READ: {
    role: UserRole.ADMIN,
    resource: 'transaction',
    action: 'read',
    constraints: { readOnly: true },
  },

  ADMIN_TRANSACTION_CANNOT_MODIFY: {
    role: UserRole.ADMIN,
    resource: 'transaction',
    action: 'modify',
    constraints: { hidden: true, readOnly: true },
  },

  ADMIN_PAYOUT_READ: {
    role: UserRole.ADMIN,
    resource: 'payout',
    action: 'read',
    constraints: { readOnly: true },
  },

  ADMIN_PAYOUT_CANNOT_MODIFY_AMOUNT: {
    role: UserRole.ADMIN,
    resource: 'payout',
    action: 'modify_amount',
    constraints: { hidden: true, readOnly: true },
  },

  ADMIN_ARCHITECT_READ: {
    role: UserRole.ADMIN,
    resource: 'architect',
    action: 'read',
    constraints: { readOnly: true },
  },

  ADMIN_ARCHITECT_SUSPEND: {
    role: UserRole.ADMIN,
    resource: 'architect',
    action: 'suspend',
  },

  ADMIN_ARCHITECT_REINSTATE: {
    role: UserRole.ADMIN,
    resource: 'architect',
    action: 'reinstate',
  },

  ADMIN_BUYER_READ: {
    role: UserRole.ADMIN,
    resource: 'buyer',
    action: 'read',
    constraints: { readOnly: true },
  },

  ADMIN_BUYER_SUSPEND: {
    role: UserRole.ADMIN,
    resource: 'buyer',
    action: 'suspend',
  },

  ADMIN_BUYER_REINSTATE: {
    role: UserRole.ADMIN,
    resource: 'buyer',
    action: 'reinstate',
  },

  ADMIN_ACTION_LOG: {
    role: UserRole.ADMIN,
    resource: 'admin_action',
    action: 'create',
  },
};

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return Object.values(PERMISSIONS).filter(p => p.role === role);
}

/**
 * Check if permission exists
 */
export function hasPermission(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const permission = Object.values(PERMISSIONS).find(
    p => p.role === role && p.resource === resource && p.action === action
  );
  return !!permission;
}

/**
 * Check if permission requires ownership
 */
export function requiresOwnership(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const permission = Object.values(PERMISSIONS).find(
    p => p.role === role && p.resource === resource && p.action === action
  );
  return permission?.constraints?.ownershipRequired ?? false;
}

/**
 * Check if permission is read-only
 */
export function isReadOnly(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const permission = Object.values(PERMISSIONS).find(
    p => p.role === role && p.resource === resource && p.action === action
  );
  return permission?.constraints?.readOnly ?? false;
}
