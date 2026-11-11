import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Attendance is APPEND-ONLY.
 * Each check-in / check-out / correction is an immutable event row.
 * Historical attendance events are NEVER overwritten.
 */
export const attendanceEvents = sqliteTable("studio_attendance_events", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").references(() => assignments.id),
  eventId: text("event_id").references(() => events.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  /** "check_in" | "check_out" | "late" | "absent" | "replacement" | "correction". */
  eventType: text("event_type").notNull(),
  /** ISO timestamp of when this event actually occurred. */
  occurredAt: text("occurred_at").notNull(),
  /** ISO timestamp of when this event was recorded. */
  recordedAt: text("recorded_at").notNull().default(sql`(current_timestamp)`),
  /** Who recorded it (employee id or "system"). */
  recordedBy: text("recorded_by"),
  /** Segment handled (optional). */
  segmentId: text("segment_id").references(() => eventSegments.id),
  /** JSON: { lateMinutes, reason, photoUrl, ... }. */
  metadata: text("metadata"),
  /** For corrections: references the original attendance event id. */
  replacesEventId: text("replaces_event_id"),
  /** Device that recorded this (for sync). */
  deviceId: text("device_id"),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export type AttendanceEvent = typeof attendanceEvents.$inferSelect;
export type NewAttendanceEvent = typeof attendanceEvents.$inferInsert;