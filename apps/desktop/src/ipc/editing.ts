import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { EditingTask, NewEditingTask } from "@studio-erp/database";
import { EDITING_TASK_STATUSES } from "@studio-erp/shared";

export function registerEditingHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List editing tasks
  createHandler("editing:list", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    eventId?: string;
    status?: string;
    editorId?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { projectId, eventId, status, editorId, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (eventId) { where += " AND event_id = ?"; params.push(eventId); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (editorId) { where += " AND editor_id = ?"; params.push(editorId); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (updated_at < ? OR (updated_at = ? AND id < ?))";
      params.push(decoded.updatedAt, decoded.updatedAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_editing_tasks ${where} ORDER BY updated_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ updatedAt: last.updated_at, id: last.id })).toString("base64url");
    }

    // Enrich with project and employee info
    for (const item of items) {
      item.project = db.get<{ id: string; title: string; project_id: string }>("SELECT id, title, project_id FROM studio_projects WHERE id = ?", [item.project_id]);
      if (item.event_id) {
        item.event = db.get<{ id: string; event_type: string; event_date: string }>("SELECT id, event_type, event_date FROM studio_events WHERE id = ?", [item.event_id]);
      }
      if (item.editor_id) {
        item.editor = db.get<{ id: string; full_name: string }>("SELECT id, full_name FROM studio_employees WHERE id = ?", [item.editor_id]);
      }
      if (item.album_designer_id) {
        item.albumDesigner = db.get<{ id: string; full_name: string }>("SELECT id, full_name FROM studio_employees WHERE id = ?", [item.album_designer_id]);
      }
      item.qcChecks = item.qc_checks ? JSON.parse(item.qc_checks) : [];
      item.revisions = item.revisions ? JSON.parse(item.revisions) : [];
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single editing task
  createHandler("editing:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const task = db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!task) throw new Error("Editing task not found");

    task.project = db.get<{ id: string; title: string; project_id: string }>("SELECT id, title, project_id FROM studio_projects WHERE id = ?", [task.project_id]);
    if (task.event_id) {
      task.event = db.get<{ id: string; event_type: string; event_date: string }>("SELECT id, event_type, event_date FROM studio_events WHERE id = ?", [task.event_id]);
    }
    if (task.editor_id) {
      task.editor = db.get<{ id: string; full_name: string }>("SELECT id, full_name FROM studio_employees WHERE id = ?", [task.editor_id]);
    }
    if (task.album_designer_id) {
      task.albumDesigner = db.get<{ id: string; full_name: string }>("SELECT id, full_name FROM studio_employees WHERE id = ?", [task.album_designer_id]);
    }
    task.qcChecks = task.qc_checks ? JSON.parse(task.qc_checks) : [];
    task.revisions = task.revisions ? JSON.parse(task.revisions) : [];

    return task;
  }, db);

  // Create editing task
  createHandler("editing:create", async (event: IpcMainInvokeEvent, data: Omit<NewEditingTask, "id" | "createdAt" | "updatedAt" | "deletedAt">) => {
    requireAuth(event);
    const id = uuid();

    db.run(
      `INSERT INTO studio_editing_tasks (id, project_id, event_id, status, editor_id, album_designer_id, source_folder_ref, output_folder_ref, deadline, qc_checks, comments, revisions, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id, data.projectId, data.eventId || null, data.status || "WAITING_FOR_FILES",
        data.editorId || null, data.albumDesignerId || null,
        data.sourceFolderRef || null, data.outputFolderRef || null, data.deadline || null,
        data.qcChecks ? JSON.stringify(data.qcChecks) : "[]",
        data.comments || null, data.revisions ? JSON.stringify(data.revisions) : "[]",
        nowIso(), nowIso()
      ]
    );

    const task = db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ?", [id]);
    if (!task) throw new Error("Failed to create editing task");

    return task;
  }, db);

  // Update editing task
  createHandler("editing:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewEditingTask, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Editing task not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "eventId", "status", "editorId", "albumDesignerId", "sourceFolderRef", "outputFolderRef", "deadline", "completedAt", "qcChecks", "comments", "revisions"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);

    db.run(`UPDATE studio_editing_tasks SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ?", [id]);
  }, db);

  // Update status with validation
  createHandler("editing:update-status", async (event: IpcMainInvokeEvent, id: string, newStatus: string) => {
    requireAuth(event);
    if (!EDITING_TASK_STATUSES.includes(newStatus as any)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const existing = db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Editing task not found");

    const updates: string[] = ["status = ?", "updated_at = ?"];
    const params: unknown[] = [newStatus, nowIso()];

    if (newStatus === "DELIVERED") {
      updates.push("completed_at = ?");
      params.push(nowIso());
    }

    params.push(id);
    db.run(`UPDATE studio_editing_tasks SET ${updates.join(", ")} WHERE id = ?`, params);

    return db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ?", [id]);
  }, db);

  // Add revision
  createHandler("editing:add-revision", async (event: IpcMainInvokeEvent, id: string, revision: {
    version: number;
    changes: string;
    requestedBy: string;
    files?: string[];
  }) => {
    requireAuth(event);
    const task = db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!task) throw new Error("Editing task not found");

    const revisions = task.revisions ? JSON.parse(task.revisions) : [];
    revisions.push({
      ...revision,
      timestamp: nowIso(),
      id: uuid(),
    });

    db.run(
      `UPDATE studio_editing_tasks SET revisions = ?, status = 'REVISION_REQUIRED', updated_at = ? WHERE id = ?`,
      [JSON.stringify(revisions), nowIso(), id]
    );

    return db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ?", [id]);
  }, db);

  // Add QC check result
  createHandler("editing:add-qc-check", async (event: IpcMainInvokeEvent, id: string, qcCheck: {
    checkName: string;
    passed: boolean;
    notes?: string;
    checkedBy: string;
  }) => {
    requireAuth(event);
    const task = db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!task) throw new Error("Editing task not found");

    const qcChecks = task.qc_checks ? JSON.parse(task.qc_checks) : [];
    qcChecks.push({
      ...qcCheck,
      timestamp: nowIso(),
      id: uuid(),
    });

    const allPassed = qcChecks.every((c: any) => c.passed);
    const newStatus = allPassed && qcChecks.length > 0 ? "APPROVED" : "INTERNAL_REVIEW";

    db.run(
      `UPDATE studio_editing_tasks SET qc_checks = ?, status = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(qcChecks), newStatus, nowIso(), id]
    );

    return db.get<EditingTask>("SELECT * FROM studio_editing_tasks WHERE id = ?", [id]);
  }, db);

  // Delete editing task (soft)
  createHandler("editing:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_editing_tasks SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // Get editing pipeline stats
  createHandler("editing:stats", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    requireAuth(event);
    const { projectId, dateFrom, dateTo } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (dateFrom) { where += " AND updated_at >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND updated_at <= ?"; params.push(dateTo); }

    const tasks = db.all<EditingTask>(`SELECT * FROM studio_editing_tasks ${where}`, params);

    const stats = {
      total: tasks.length,
      byStatus: {} as Record<string, number>,
      avgDaysToComplete: 0,
      overdue: 0,
    };

    let completedCount = 0;
    let totalDays = 0;
    for (const task of tasks) {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;

      if (task.status === "DELIVERED" && task.completed_at && task.created_at) {
        const created = new Date(task.created_at).getTime();
        const completed = new Date(task.completed_at).getTime();
        totalDays += (completed - created) / 1000 / 60 / 60 / 24;
        completedCount++;
      }

      if (task.deadline && task.status !== "DELIVERED" && new Date(task.deadline) < new Date()) {
        stats.overdue++;
      }
    }

    if (completedCount > 0) {
      stats.avgDaysToComplete = Math.round((totalDays / completedCount) * 100) / 100;
    }

    return stats;
  }, db);
}