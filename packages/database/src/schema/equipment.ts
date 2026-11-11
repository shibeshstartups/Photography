import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const equipment = sqliteTable("studio_equipment", {
  id: text("id").primaryKey(),
  /** Business-facing ID. */
  equipmentId: text("equipment_id").notNull().unique(),
  name: text("name").notNull(),
  /** "camera_body" | "lens" | "flash" | "lighting" | "modifier" | "audio" | "drone" | "accessory" | "storage". */
  category: text("category").notNull(),
  serialNumber: text("serial_number"),
  /** Employee id or null (company-owned). */
  owner: text("owner").references(() => employees.id),
  /** "excellent" | "good" | "fair" | "poor" | "broken". */
  condition: text("condition").notNull().default("good"),
  /** "available" | "in_use" | "in_repair" | "retired". */
  availability: text("availability").notNull().default("available"),
  /** Current holder (employee id or assignment id). */
  currentHolder: text("current_holder"),
  /** JSON: { purchaseDate, purchasePrice, warrantyUntil, ... }. */
  metadata: text("metadata"),
  /** JSON maintenance log. */
  maintenance: text("maintenance"),
  /** JSON damage reports. */
  damageReports: text("damageReports"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Equipment = typeof equipment.$inferSelect;
export type NewEquipment = typeof equipment.$inferInsert;

/** Allocation history. */
export const equipmentAllocations = sqliteTable("studio_equipment_allocations", {
  id: text("id").primaryKey(),
  equipmentId: text("equipment_id").notNull().references(() => equipment.id),
  projectId: text("project_id").references(() => projects.id),
  eventId: text("event_id").references(() => events.id),
  assignedTo: text("assigned_to").references(() => employees.id),
  /** ISO date. */
  checkedOutAt: text("checked_out_at").notNull(),
  /** ISO date. */
  checkedInAt: text("checked_in_at"),
  conditionOut: text("condition_out"),
  conditionIn: text("condition_in"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type EquipmentAllocation = typeof equipmentAllocations.$inferSelect;