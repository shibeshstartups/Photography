import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Editing and post-production workflow.
 * Suggested workflow:
 * WAITING_FOR_FILES → FILES_RECEIVED → EDITING → INTERNAL_REVIEW →
 * REVISION_REQUIRED → CLIENT_REVIEW → APPROVED → FINAL_EXPORT → DELIVERED
 */
export const editingTasks = sqliteTable("studio_editing_tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  eventId: text("event_id").references(() => events.id),
  /** One of EDITING_TASK_STATUSES. */
  status: text("status").notNull().default("WAITING_FOR_FILES"),
  editorId: text("editor_id").references(() => employees.id),
  albumDesignerId: text("album_designer_id").references(() => employees.id),
  /** Source folder reference (relative path only — never a raw filesystem path). */
  sourceFolderRef: text("source_folder_ref"),
  /** Output folder reference. */
  outputFolderRef: text("output_folder_ref"),
  /** ISO date. */
  deadline: text("deadline"),
  /** ISO timestamp of completion. */
  completedAt: text("completed_at"),
  /** JSON: { qcChecks, ... }. */
  qcChecks: text("qc_checks"),
  /** JSON free-text comments. */
  comments: text("comments"),
  /** JSON revision history. */
  revisions: text("revisions"),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type EditingTask = typeof editingTasks.$inferSelect;
export type NewEditingTask = typeof editingTasks.$inferInsert;