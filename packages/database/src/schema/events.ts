import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * One project may contain multiple events (Engagement, Haldi, Mehendi,
 * Sangeet, Wedding, Reception, Pre-wedding shoot, Other).
 * Each event is independent: date, time, venue, travel, crew, segments.
 */
export const events = sqliteTable("studio_events", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  /** Business-facing event ID. */
  eventId: text("event_id").notNull().unique(),
  /** e.g. "Wedding", "Engagement", "Pre-wedding shoot", or custom. */
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  venue: text("venue"),
  city: text("city"),
  location: text("location"),
  /** JSON: { mode, distanceKm, durationMin, ... }. */
  travel: text("travel"),
  eventManagerId: text("event_manager_id").references(() => employees.id),
  /** JSON: { status, notes }. */
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;