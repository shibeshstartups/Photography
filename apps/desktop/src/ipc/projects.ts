import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso, todayString } from "@studio-erp/shared";
import type { Project, NewProject } from "@studio-erp/database";

export function registerProjectHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List projects with filters
  createHandler("projects:list", async (event: IpcMainInvokeEvent, filters?: {
    status?: string;
    clientId?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { status, clientId, dateFrom, dateTo, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (status) { where += " AND status = ?"; params.push(status); }
    if (clientId) { where += " AND client_id = ?"; params.push(clientId); }
    if (dateFrom) { where += " AND booking_date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND booking_date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (booking_date < ? OR (booking_date = ? AND id < ?))";
      params.push(decoded.bookingDate, decoded.bookingDate, decoded.id);
    }

    const sql = `SELECT * FROM studio_projects ${where} ORDER BY booking_date DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ bookingDate: last.booking_date, id: last.id })).toString("base64url");
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single project
  createHandler("projects:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const project = db.get<Project>("SELECT * FROM studio_projects WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!project) throw new Error("Project not found");
    return project;
  }, db);

  // Create project
  createHandler("projects:create", async (event: IpcMainInvokeEvent, data: Omit<NewProject, "id" | "createdAt" | "updatedAt" | "deletedAt">) => {
    requireAuth(event);
    const id = uuid();
    const projectId = await generateProjectId(db);

    db.run(
      `INSERT INTO studio_projects (id, project_id, client_id, title, project_manager_id, booking_date, status, quotation, total_agreed_amount, advance_payment, venue, locations, internal_notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, projectId, data.clientId, data.title, data.projectManagerId || null,
        data.bookingDate || todayString(), data.status || "ENQUIRY",
        data.quotation || null, data.totalAgreedAmount || 0, data.advancePayment || 0,
        data.venue || null, data.locations || null, data.internalNotes || null,
        data.metadata || null, nowIso(), nowIso()
      ]
    );

    const project = db.get<Project>("SELECT * FROM studio_projects WHERE id = ?", [id]);
    if (!project) throw new Error("Failed to create project");

    // Create default editing task
    await createDefaultEditingTask(db, id);

    return project;
  }, db);

  // Update project
  createHandler("projects:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewProject, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<Project>("SELECT * FROM studio_projects WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Project not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["clientId", "title", "projectManagerId", "bookingDate", "status", "quotation", "totalAgreedAmount", "advancePayment", "venue", "locations", "internalNotes", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        params.push(data[field as keyof typeof data]);
      }
    }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);

    db.run(`UPDATE studio_projects SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Project>("SELECT * FROM studio_projects WHERE id = ?", [id]);
  }, db);

  // Delete project (soft)
  createHandler("projects:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_projects SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // Get project stats
  createHandler("projects:stats", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const project = db.get<Project>("SELECT * FROM studio_projects WHERE id = ?", [id]);
    if (!project) throw new Error("Project not found");

    const events = db.all<any>("SELECT * FROM studio_events WHERE project_id = ? AND deleted_at IS NULL", [id]);
    const assignments = db.all<any>("SELECT * FROM studio_assignments WHERE project_id = ? AND deleted_at IS NULL", [id]);
    const payments = db.all<any>("SELECT * FROM studio_payments WHERE project_id = ? AND deleted_at IS NULL", [id]);
    const expenses = db.all<any>("SELECT * FROM studio_expenses WHERE project_id = ? AND deleted_at IS NULL", [id]);
    const editingTasks = db.all<any>("SELECT * FROM studio_editing_tasks WHERE project_id = ? AND deleted_at IS NULL", [id]);

    const totalPaid = payments.filter(p => p.type !== "refund" && p.type !== "adjustment").reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunds = payments.filter(p => p.type === "refund").reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAdjustments = payments.filter(p => p.type === "adjustment").reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      project,
      eventsCount: events.length,
      assignmentsCount: assignments.length,
      confirmedAssignments: assignments.filter(a => a.status === "confirmed").length,
      totalPaid: totalPaid - totalRefunds + totalAdjustments,
      totalExpenses,
      balance: (project.total_agreed_amount || 0) - (totalPaid - totalRefunds + totalAdjustments),
      editingTasksCount: editingTasks.length,
      completedEditingTasks: editingTasks.filter(e => e.status === "DELIVERED").length,
    };
  }, db);
}

async function generateProjectId(db: Database): Promise<string> {
  const year = new Date().getFullYear();
  const last = db.get<{ projectId: string }>(
    "SELECT project_id FROM studio_projects WHERE project_id LIKE ? ORDER BY project_id DESC LIMIT 1",
    [`PRJ-${year}-%`]
  );
  let num = 1;
  if (last) {
    const match = last.projectId.match(/PRJ-\d+-(\d+)/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `PRJ-${year}-${String(num).padStart(4, "0")}`;
}

async function createDefaultEditingTask(db: Database, projectId: string) {
  const id = uuid();
  db.run(
    `INSERT INTO studio_editing_tasks (id, project_id, status, version, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    [id, projectId, "WAITING_FOR_FILES", nowIso(), nowIso()]
  );
}