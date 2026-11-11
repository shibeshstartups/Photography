import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { Employee, NewEmployee } from "@studio-erp/database";

export function registerEmployeeHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List employees with filters
  createHandler("employees:list", async (event: IpcMainInvokeEvent, filters?: {
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { status, search, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (status) { where += " AND status = ?"; params.push(status); }
    if (search) {
      where += " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR employee_id LIKE ? OR designation LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (full_name < ? OR (full_name = ? AND id < ?))";
      params.push(decoded.name, decoded.name, decoded.id);
    }

    const sql = `SELECT * FROM studio_employees ${where} ORDER BY full_name ASC, id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ name: last.full_name, id: last.id })).toString("base64url");
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single employee
  createHandler("employees:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const employee = db.get<Employee>("SELECT * FROM studio_employees WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!employee) throw new Error("Employee not found");
    return employee;
  }, db);

  // Create employee
  createHandler("employees:create", async (event: IpcMainInvokeEvent, data: Omit<NewEmployee, "id" | "createdAt" | "updatedAt" | "deletedAt">) => {
    requireAuth(event);
    const id = uuid();
    const employeeId = await generateEmployeeId(db);

    db.run(
      `INSERT INTO studio_employees (id, employee_id, full_name, phone, email, address, designation, skills, specializations, experience, status, compensation, availability, leaves, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, employeeId, data.fullName, data.phone || null, data.email || null, data.address || null,
        data.designation || null, data.skills || "[]", data.specializations || "[]", data.experience || null,
        data.status || "active", data.compensation || null, data.availability || null, data.leaves || "[]",
        data.notes || null, nowIso(), nowIso()
      ]
    );

    const employee = db.get<Employee>("SELECT * FROM studio_employees WHERE id = ?", [id]);
    if (!employee) throw new Error("Failed to create employee");

    return employee;
  }, db);

  // Update employee
  createHandler("employees:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewEmployee, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<Employee>("SELECT * FROM studio_employees WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Employee not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["fullName", "phone", "email", "address", "designation", "skills", "specializations", "experience", "status", "compensation", "availability", "leaves", "notes"];

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

    db.run(`UPDATE studio_employees SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Employee>("SELECT * FROM studio_employees WHERE id = ?", [id]);
  }, db);

  // Delete employee (soft)
  createHandler("employees:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    // Check if employee has active assignments
    const assignments = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_assignments WHERE employee_id = ? AND deleted_at IS NULL AND status NOT IN ('cancelled')", [id]);
    if (assignments && assignments.count > 0) {
      throw new Error("Cannot delete employee with active assignments");
    }

    db.run("UPDATE studio_employees SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // Get available employees for a date range (for crew scheduling)
  createHandler("employees:available", async (event: IpcMainInvokeEvent, date: string, excludeEmployeeId?: string) => {
    requireAuth(event);
    // Get all active employees
    let where = "WHERE deleted_at IS NULL AND status = 'active'";
    const params: unknown[] = [];
    if (excludeEmployeeId) { where += " AND id != ?"; params.push(excludeEmployeeId); }

    const employees = db.all<Employee>(`SELECT * FROM studio_employees ${where}`, params);

    // Check assignments for the date
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const assignments = db.all<{ employee_id: string; time_window: string; status: string }>(
      `SELECT employee_id, time_window, status FROM studio_assignments
       WHERE assignment_date = ? AND deleted_at IS NULL AND status NOT IN ('cancelled')`,
      [date]
    );

    const busyEmployees = new Set(assignments.map(a => a.employee_id));

    return employees.map(e => ({
      ...e,
      isAvailable: !busyEmployees.has(e.id),
      skills: JSON.parse(e.skills || "[]"),
      specializations: JSON.parse(e.specializations || "[]"),
      compensation: e.compensation ? JSON.parse(e.compensation) : null,
      availability: e.availability ? JSON.parse(e.availability) : null,
      leaves: JSON.parse(e.leaves || "[]"),
    }));
  }, db);
}

async function generateEmployeeId(db: Database): Promise<string> {
  const year = new Date().getFullYear();
  const last = db.get<{ employeeId: string }>(
    "SELECT employee_id FROM studio_employees WHERE employee_id LIKE ? ORDER BY employee_id DESC LIMIT 1",
    [`EMP-${year}-%`]
  );
  let num = 1;
  if (last) {
    const match = last.employeeId.match(/EMP-\d+-(\d+)/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `EMP-${year}-${String(num).padStart(4, "0")}`;
}