import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const projects = sqliteTable("studio_projects", {
  id: text("id").primaryKey(),
  /** Business-facing ID, e.g. "PRJ-0001". */
  projectId: text("project_id").notNull().unique(),
  clientId: text("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  projectManagerId: text("project_manager_id").references(() => employees.id),
  bookingDate: text("booking_date"),
  /** One of PROJECT_STATUSES. */
  status: text("status").notNull().default("ENQUIRY"),
  /** JSON quotation document reference / breakdown. */
  quotation: text("quotation"),
  /** Total agreed amount in smallest currency unit. */
  totalAgreedAmount: real("total_agreed_amount").notNull().default(0),
  /** Advance payment amount. */
  advancePayment: real("advance_payment").notNull().default(0),
  /** JSON: { city, venue, address, ... }. */
  venue: text("venue"),
  /** JSON array of location objects. */
  locations: text("locations"),
  /** JSON free-text. */
  internalNotes: text("internal_notes"),
  /** JSON metadata for extensibility. */
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;