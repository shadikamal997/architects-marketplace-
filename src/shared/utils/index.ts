/**
 * Shared Utility Functions
 *
 * Helper functions used across modules.
 *
 * Categories:
 * - Validation utilities (email, URL, file type, etc.)
 * - Formatting utilities (currency, dates, IDs)
 * - Calculation utilities (commission, tax, payout)
 * - Array/object manipulation
 * - String utilities
 * - Audit logging utilities
 *
 * (To be populated with utility function implementations)
 */

import { logAuditEvent } from '../services/audit.service';

/**
 * Audit logging utility - logs admin actions asynchronously
 * Never blocks the main operation, logs failures silently
 * @deprecated Use logAuditEvent from audit.service.ts instead
 */
export async function logAuditAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: any
): Promise<void> {
  await logAuditEvent({
    actorId,
    action,
    entityType,
    entityId,
    metadata
  });
}
