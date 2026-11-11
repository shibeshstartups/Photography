import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const employees = sqliteTable("studio_employees", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  designation: text("designation"),
  /** JSON array of skills. */
  skills: text("skills").notNull().default("[]"),
  /** JSON array of specializations. */
  specializations: text("specializations").notNull().default("[]"),
  /** Years of experience. */
  experience: real("experience"),
  /** "active" | "inactive" | "on_leave" | "terminated". */
  status: text("status").notNull().default("active"),
  /** JSON: { baseRate, feeType, ... }. */
  compensation: text("compensation"),
  /** JSON: { availableDays, unavailableDates, ... }. */
  availability: text("availability"),
  /** JSON array of leave entries. */
  leaves: text("leaves").notNull().default("[]"),
  /** JSON free-text. */
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;