import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Media references.
 * NEVER store RAW images or large video files inside D1 or SQLite.
 * Store metadata and references only.
 * Original media remains on local HDD, SSD or NAS.
 */
export const mediaReferences = sqliteTable("studio_media_references", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  eventId: text("event_id").references(() => events.id),
  /** Storage location id (see storageLocations). */
  storageLocationId: text("storage_location_id").references(() => storageLocations.id),
  /** Relative path — NEVER an absolute path or drive letter. */
  relativePath: text("relative_path").notNull(),
  filename: text("filename").notNull(),
  /** "image" | "video" | "raw" | "preview" | "document" | "other". */
  fileType: text("file_type").notNull(),
  size: real("size"),
  /** e.g. "sha256:..." */
  checksum: text("checksum"),
  /** ISO date. */
  importedAt: text("imported_at").notNull().default(sql`(current_timestamp)`),
  /** "private" | "shared" | "public_preview". */
  accessPermission: text("access_permission").notNull().default("private"),
  /** "available" | "archived" | "deleted" | "missing". */
  availabilityStatus: text("availability_status").notNull().default("available"),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type MediaReference = typeof mediaReferences.$inferSelect;
export type NewMediaReference = typeof mediaReferences.$inferInsert;

/** Storage locations (HDD, SSD, NAS, cloud). */
export const storageLocations = sqliteTable("studio_storage_locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** "local_hdd" | "local_ssd" | "nas" | "cloud_r2" | "cloud_other". */
  type: text("type").notNull(),
  /** Base relative path — no drive letters. */
  basePath: text("base_path").notNull(),
  /** JSON: { host, mountPoint, ... }. */
  config: text("config"),
  /** Free bytes (denormalized). */
  freeBytes: real("free_bytes"),
  /** Total bytes. */
  totalBytes: real("total_bytes"),
  /** "online" | "offline" | "degraded". */
  status: text("status").notNull().default("online"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type StorageLocation = typeof storageLocations.$inferSelect;