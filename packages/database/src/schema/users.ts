import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("studio_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** bcrypt/argon2 hash. */
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  /** JSON array of permission strings. */
  permissions: text("permissions").notNull().default("[]"),
  status: text("status").notNull().default("active"),
  /** ISO timestamp. */
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  lastLoginAt: text("last_login_at"),
  deletedAt: text("deleted_at"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;