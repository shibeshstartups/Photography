import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Clients and their contacts.
 * Multiple contacts per client are supported via client_contacts.
 */
export const clients = sqliteTable("studio_clients", {
  id: text("id").primaryKey(),
  /** Business-facing unique ID, e.g. "CLT-0001". */
  clientId: text("client_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  /** Additional JSON contact info (social, website, etc.). */
  additionalInfo: text("additional_info"),
  /** JSON free-text notes. */
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

/** One client may have multiple contacts. */
export const clientContacts = sqliteTable("studio_client_contacts", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  relationship: text("relationship"),
  phone: text("phone"),
  email: text("email"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type ClientContact = typeof clientContacts.$inferSelect;