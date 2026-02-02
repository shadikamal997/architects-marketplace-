/**
 * Audit Service
 *
 * Immutable audit logging system for sensitive marketplace actions.
 * All logs are append-only and server-side only.
 */

import { prisma } from '../../lib/prisma';

export interface AuditEvent {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event asynchronously
 * Never throws - failures are logged silently
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    // Ensure metadata is JSON serializable
    const sanitizedMetadata = event.metadata
      ? JSON.parse(JSON.stringify(event.metadata))
      : null;

    await prisma.auditLog.create({
      data: {
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: sanitizedMetadata
      }
    });
  } catch (error) {
    // Log audit failures silently - never block operations
    console.error('Audit logging failed:', {
      error: error instanceof Error ? error.message : String(error),
      event
    });
  }
}

/**
 * Log user authentication events
 */
export async function logAuthEvent(
  userId: string,
  action: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN' | 'PASSWORD_CHANGE',
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    actorId: userId,
    action,
    entityType: 'USER',
    entityId: userId,
    metadata
  });
}

/**
 * Log design-related events
 */
export async function logDesignEvent(
  actorId: string,
  action: 'CREATE_DESIGN' | 'UPDATE_DESIGN' | 'DELETE_DESIGN' | 'APPROVE_DESIGN' | 'REJECT_DESIGN' | 'PUBLISH_DESIGN' | 'ARCHIVE_DESIGN',
  designId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    actorId,
    action,
    entityType: 'DESIGN',
    entityId: designId,
    metadata
  });
}

/**
 * Log license and payment events
 */
export async function logLicenseEvent(
  actorId: string,
  action: 'CREATE_LICENSE' | 'REVOKE_LICENSE' | 'DOWNLOAD_LICENSE',
  licenseId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    actorId,
    action,
    entityType: 'LICENSE',
    entityId: licenseId,
    metadata
  });
}

/**
 * Log messaging and contact events
 */
export async function logMessagingEvent(
  actorId: string,
  action: 'START_CONVERSATION' | 'SEND_MESSAGE' | 'CONTACT_UNLOCK' | 'MESSAGE_FILTERED',
  entityId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    actorId,
    action,
    entityType: 'MESSAGING',
    entityId,
    metadata
  });
}

/**
 * Log file access events
 */
export async function logFileEvent(
  actorId: string,
  action: 'DOWNLOAD_FILE' | 'UPLOAD_FILE' | 'DELETE_FILE',
  fileId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    actorId,
    action,
    entityType: 'FILE',
    entityId: fileId,
    metadata
  });
}

/**
 * Log admin actions
 */
export async function logAdminEvent(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    actorId: adminId,
    action,
    entityType,
    entityId,
    metadata
  });
}