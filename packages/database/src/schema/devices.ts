import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const devices = sqliteTable("studio_devices", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  userAgent: text("user_agent").notNull().default(""),
  /** Device signing key hash (not the raw secret). */
  deviceKeyHash: text("device_key_hash").notNull(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  lastSeenAt: text("last_seen_at"),
  deletedAt: text("deleted_at"),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;