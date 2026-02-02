/**
 * Audit Logging Service
 * 
 * Foundation for audit trail - currently logs to console
 * Future: Save to database, export to external systems
 */

export interface AuditLogEntry {
  actorId: string;
  action: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log audit event
 * 
 * Currently logs to console for debugging
 * Production: Save to AuditLog table via Prisma
 */
export const logAudit = ({
  actorId,
  action,
  targetId,
  metadata,
}: AuditLogEntry): void => {
  console.log('[AUDIT]', {
    actorId,
    action,
    targetId,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Query audit logs (stub)
 * 
 * Future: Query from database with filters
 */
export const getAuditLogs = async (filters?: {
  actorId?: string;
  action?: string;
  targetId?: string;
}): Promise<AuditLogEntry[]> => {
  // Stub: return empty array
  // Production: Query from Prisma
  return [];
};
