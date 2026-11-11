import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Event segments — configurable services per event.
 * e.g. Wedding: 2 candid photographers, 2 traditional photographers,
 * 1 cinematic videographer, 1 traditional videographer, 1 drone operator.
 * These quantities are configurable per event.
 */
export const eventSegments = sqliteTable("studio_event_segments", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  /** One of SEGMENT_SERVICES or a custom string. */
  service: text("service").notNull(),
  /** Required headcount for this segment. */
  requiredCount: integer("required_count").notNull().default(1),
  /** Actual assigned count (denormalized for fast reads). */
  assignedCount: integer("assigned_count").notNull().default(0),
  /** JSON: { skillOverride, notes, ... }. */
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type EventSegment = typeof eventSegments.$inferSelect;
export type NewEventSegment = typeof eventSegments.$inferInsert;