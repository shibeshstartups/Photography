import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Configurable system settings.
 * Project statuses, segment services, roles, etc. can be configured here.
 */
export const systemConfig = sqliteTable("studio_system_config", {
  id: text("id").primaryKey(),
  /** e.g. "project_statuses", "segment_services", "employee_roles". */
  key: text("key").notNull().unique(),
  /** JSON value. */
  value: text("value").notNull(),
  /** ISO timestamp. */
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type SystemConfig = typeof systemConfig.$inferSelect;