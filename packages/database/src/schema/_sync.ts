import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Sync infrastructure tables.
 * These are the foundation of the offline-first architecture.
 */

/** Per-device sync checkpoint — the high-water mark of server state. */
export const syncCheckpoints = sqliteTable("studio_sync_checkpoints", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  userId: text("user_id").notNull(),
  /** ISO timestamp of the last successfully applied change. */
  checkpoint: text("checkpoint").notNull(),
  /** ISO timestamp of the last pull. */
  lastPulledAt: text("last_pulled_at"),
  /** Number of pending outbox items remaining. */
  pendingCount: integer("pending_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

/** Outbox — durable local queue of operations awaiting sync. */
export const syncOutbox = sqliteTable("studio_sync_outbox", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  userId: text("user_id").notNull(),
  /** The SyncOperation payload as JSON. */
  operation: text("operation").notNull(),
  /** ISO timestamp when queued. */
  queuedAt: text("queued_at").notNull().default(sql`(current_timestamp)`),
  /** Number of times this has been pushed. */
  attempts: integer("attempts").notNull().default(0),
  /** ISO timestamp of last push attempt. */
  lastAttemptAt: text("last_attempt_at"),
  /** Null while pending; ISO timestamp once accepted. */
  acceptedAt: text("accepted_at"),
  /** Null while pending; set to "rejected" / "conflict" once resolved. */
  status: text("status").notNull().default("pending"),
  /** Server-side reason when rejected. */
  rejectionReason: text("rejection_reason"),
});

/** Conflict records — server-side history of detected conflicts. */
export const syncConflicts = sqliteTable("studio_sync_conflicts", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  userId: text("user_id").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  /** JSON array of conflicting operations. */
  operations: text("operations").notNull(),
  /** JSON of server-side state at conflict time. */
  serverSnapshot: text("server_snapshot"),
  /** "unresolved" | "resolved_client" | "resolved_server" | "merged" */
  status: text("status").notNull().default("unresolved"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by"),
});