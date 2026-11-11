import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Crew assignments.
 * The server MUST validate availability before confirming.
 * Offline assignments are marked PROVISIONAL or PENDING_VALIDATION.
 */
export const assignments = sqliteTable("studio_assignments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  eventId: text("event_id").references(() => events.id),
  segmentId: text("segment_id").references(() => eventSegments.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  assignmentDate: text("assignment_date").notNull(),
  /** JSON: { start, end, setupBuffer, travelBuffer }. */
  timeWindow: text("time_window"),
  /** "confirmed" | "tentative" | "pending_validation" | "provisional" | "cancelled". */
  status: text("status").notNull().default("pending_validation"),
  /** When true, this was created offline and has NOT been server-validated. */
  isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
  /** Server-side validation result when confirmed. */
  validation: text("validation"),
  /** JSON conflict details if validation failed. */
  conflicts: text("conflicts"),
  /** JSON: { travel, accommodation, equipment, ... }. */
  logistics: text("logistics"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;