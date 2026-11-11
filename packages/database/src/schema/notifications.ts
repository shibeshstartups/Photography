import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * In-app notifications.
 * Do not require paid SMS or email services.
 */
export const notifications = sqliteTable("studio_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  /** "assignment" | "event" | "deadline" | "payment" | "approval" | "revision" | "dispute" | "sync_conflict" | "system". */
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  /** JSON: { projectId, eventId, assignmentId, ... }. */
  data: text("data"),
  /** "info" | "warning" | "error" | "success". */
  severity: text("severity").notNull().default("info"),
  /** ISO timestamp the user read this. */
  readAt: text("read_at"),
  /** ISO timestamp. */
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at"),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;