import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Append-only audit system.
 * Ordinary application users CANNOT modify or delete historical audit entries.
 * Only administrators can, and that itself is audited.
 */
export const auditLog = sqliteTable("studio_audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  deviceId: text("device_id"),
  /** ISO timestamp. */
  timestamp: text("timestamp").notNull().default(sql`(current_timestamp)`),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  /** JSON previous value. */
  previous: text("previous"),
  /** JSON new value. */
  next: text("next"),
  projectId: text("project_id").references(() => projects.id),
  sessionId: text("session_id"),
  operationId: text("operation_id"),
  ip: text("ip"),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  /** Audit entries are NEVER soft-deleted. */
  deletedAt: text("deleted_at"),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;