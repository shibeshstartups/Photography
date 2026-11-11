import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { Assignment, NewAssignment } from "@studio-erp/database";

export function registerAssignmentHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List assignments for a project/event
  createHandler("assignments:list", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    eventId?: string;
    employeeId?: string;
    date?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { projectId, eventId, employeeId, date, status, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (eventId) { where += " AND event_id = ?"; params.push(eventId); }
    if (employeeId) { where += " AND employee_id = ?"; params.push(employeeId); }
    if (date) { where += " AND assignment_date = ?"; params.push(date); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (assignment_date < ? OR (assignment_date = ? AND id < ?))";
      params.push(decoded.date, decoded.date, decoded.id);
    }

    const sql = `SELECT * FROM studio_assignments ${where} ORDER BY assignment_date ASC, id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ date: last.assignment_date, id: last.id })).toString("base64url");
    }

    // Enrich with employee and segment info
    for (const item of items) {
      item.employee = db.get<{ id: string; full_name: string; email: string; phone?: string; designation?: string }>("SELECT id, full_name, email, phone, designation FROM studio_employees WHERE id = ?", [item.employee_id]);
      if (item.segment_id) {
        item.segment = db.get<{ id: string; service: string; required_count: number }>("SELECT id, service, required_count FROM studio_event_segments WHERE id = ?", [item.segment_id]);
      }
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single assignment
  createHandler("assignments:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const assignment = db.get<Assignment>("SELECT * FROM studio_assignments WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!assignment) throw new Error("Assignment not found");

    assignment.employee = db.get<{ id: string; full_name: string; email?: string; designation?: string }>("SELECT id, full_name, email, phone, designation FROM studio_employees WHERE id = ?", [assignment.employee_id]);
    if (assignment.segment_id) {
      assignment.segment = db.get<{ id: string; service: string; required_count: number }>("SELECT id, service, required_count FROM studio_event_segments WHERE id = ?", [assignment.segment_id]);
    }
    return assignment;
  }, db);

  // Create assignment (provisional by default)
  createHandler("assignments:create", async (event: IpcMainInvokeEvent, data: Omit<NewAssignment, "id" | "createdAt" | "updatedAt" | "deletedAt">) => {
    requireAuth(event);
    const id = uuid();

    db.run(
      `INSERT INTO studio_assignments (id, project_id, event_id, segment_id, employee_id, assignment_date, time_window, status, is_provisional, validation, conflicts, logistics, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.projectId, data.eventId || null, data.segmentId || null, data.employeeId,
        data.assignmentDate, data.timeWindow || null, data.status || "pending_validation",
        1, // is_provisional = true
        data.validation || null, data.conflicts || null, data.logistics || null, data.notes || null,
        nowIso(), nowIso()
      ]
    );

    const assignment = db.get<Assignment>("SELECT * FROM studio_assignments WHERE id = ?", [id]);
    if (!assignment) throw new Error("Failed to create assignment");

    // Update segment assigned_count if applicable
    if (data.segmentId) {
      await updateSegmentAssignedCount(db, data.segmentId);
    }

    return assignment;
  }, db);

  // Update assignment
  createHandler("assignments:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewAssignment, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<Assignment>("SELECT * FROM studio_assignments WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Assignment not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "eventId", "segmentId", "employeeId", "assignmentDate", "timeWindow", "status", "validation", "conflicts", "logistics", "notes", "isProvisional"];

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

    db.run(`UPDATE studio_assignments SET ${updates.join(", ")} WHERE id = ?`, params);

    // Update segment assigned_count if segment changed
    if (data.segmentId && data.segmentId !== existing.segment_id) {
      if (existing.segment_id) await updateSegmentAssignedCount(db, existing.segment_id);
      await updateSegmentAssignedCount(db, data.segmentId);
    } else if (existing.segment_id) {
      await updateSegmentAssignedCount(db, existing.segment_id);
    }

    return db.get<Assignment>("SELECT * FROM studio_assignments WHERE id = ?", [id]);
  }, db);

  // Validate assignment (server-side validation)
  createHandler("assignments:validate", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const assignment = db.get<Assignment>("SELECT * FROM studio_assignments WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!assignment) throw new Error("Assignment not found");

    // Check employee availability
    const conflicts = await checkAssignmentConflicts(db, assignment);
    const validation = conflicts.length === 0 ? "valid" : "conflict";

    const updates: string[] = ["status = ?", "validation = ?", "conflicts = ?", "is_provisional = 0", "updated_at = ?"];
    const params: unknown[] = [
      conflicts.length === 0 ? "confirmed" : "tentative",
      validation,
      JSON.stringify(conflicts),
      nowIso(), id
    ];

    db.run(`UPDATE studio_assignments SET ${updates.join(", ")} WHERE id = ?`, params);

    // Update segment assigned_count
    if (assignment.segment_id) {
      await updateSegmentAssignedCount(db, assignment.segment_id);
    }

    return { validated: conflicts.length === 0, conflicts };
  }, db);

  // Bulk validate assignments for an event
  createHandler("assignments:validate-event", async (event: IpcMainInvokeEvent, eventId: string) => {
    requireAuth(event);
    const assignments = db.all<Assignment>(
      "SELECT * FROM studio_assignments WHERE event_id = ? AND deleted_at IS NULL AND is_provisional = 1",
      [eventId]
    );

    const results = [];
    for (const assignment of assignments) {
      const conflicts = await checkAssignmentConflicts(db, assignment);
      const validation = conflicts.length === 0 ? "valid" : "conflict";

      db.run(
        `UPDATE studio_assignments SET status = ?, validation = ?, conflicts = ?, is_provisional = 0, updated_at = ? WHERE id = ?`,
        [
          conflicts.length === 0 ? "confirmed" : "tentative",
          validation,
          JSON.stringify(conflicts),
          nowIso(), assignment.id
        ]
      );

      if (assignment.segment_id) {
        await updateSegmentAssignedCount(db, assignment.segment_id);
      }

      results.push({ id: assignment.id, validated: conflicts.length === 0, conflicts });
    }

    return { results };
  }, db);

  // Delete assignment (soft)
  createHandler("assignments:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const assignment = db.get<Assignment>("SELECT * FROM studio_assignments WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!assignment) throw new Error("Assignment not found");

    db.run("UPDATE studio_assignments SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);

    if (assignment.segment_id) {
      await updateSegmentAssignedCount(db, assignment.segment_id);
    }

    return { success: true };
  }, db);

  // Get crew schedule for date range
  createHandler("assignments:schedule", async (event: IpcMainInvokeEvent, dateFrom: string, dateTo: string) => {
    requireAuth(event);
    const assignments = db.all<Assignment>(
      `SELECT a.*, e.full_name as employee_name, e.designation, ev.event_type, ev.event_date, ev.start_time, ev.end_time, p.title as project_title, p.project_id
       FROM studio_assignments a
       JOIN studio_employees e ON a.employee_id = e.id
       LEFT JOIN studio_events ev ON a.event_id = ev.id
       LEFT JOIN studio_projects p ON a.project_id = p.id
       WHERE a.deleted_at IS NULL
       AND a.assignment_date BETWEEN ? AND ?
       ORDER BY a.assignment_date ASC, ev.start_time ASC`,
      [dateFrom, dateTo]
    );

    return assignments;
  }, db);
}

async function updateSegmentAssignedCount(db: Database, segmentId: string): Promise<void> {
  const count = db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM studio_assignments WHERE segment_id = ? AND deleted_at IS NULL AND status IN ('confirmed', 'tentative', 'pending_validation')",
    [segmentId]
  );
  db.run("UPDATE studio_event_segments SET assigned_count = ?, updated_at = ? WHERE id = ?", [count?.count || 0, nowIso(), segmentId]);
}

async function checkAssignmentConflicts(db: Database, assignment: Assignment): Promise<Array<{ type: string; details: any }>> {
  const conflicts: Array<{ type: string; details: any }> = [];

  // Check if employee has another assignment on same date
  const existingAssignments = db.all<Assignment>(
    `SELECT * FROM studio_assignments
     WHERE employee_id = ? AND assignment_date = ? AND id != ? AND deleted_at IS NULL AND status NOT IN ('cancelled')`,
    [assignment.employee_id, assignment.assignment_date, assignment.id]
  );

  if (existingAssignments.length > 0) {
    // Check for time overlap
    const timeWindow = assignment.time_window ? JSON.parse(assignment.time_window) : null;
    for (const existing of existingAssignments) {
      const existingWindow = existing.time_window ? JSON.parse(existing.time_window) : null;
      if (timeWindow && existingWindow) {
        const start1 = new Date(`${assignment.assignment_date}T${timeWindow.start || "00:00"}`).getTime();
        const end1 = new Date(`${assignment.assignment_date}T${timeWindow.end || "23:59"}`).getTime();
        const start2 = new Date(`${existing.assignment_date}T${existingWindow.start || "00:00"}`).getTime();
        const end2 = new Date(`${existing.assignment_date}T${existingWindow.end || "23:59"}`).getTime();

        if (start1 < end2 && start2 < end1) {
          conflicts.push({
            type: "time_overlap",
            details: { existingAssignmentId: existing.id, existingTimeWindow: existingWindow }
          });
        }
      } else {
        // If no time window, consider as potential conflict
        conflicts.push({
          type: "same_day_assignment",
          details: { existingAssignmentId: existing.id }
        });
      }
    }
  }

  // Check employee leaves
  const employee = db.get<{ leaves: string }>("SELECT leaves FROM studio_employees WHERE id = ?", [assignment.employee_id]);
  if (employee?.leaves) {
    const leaves = JSON.parse(employee.leaves);
    for (const leave of leaves) {
      if (leave.startDate <= assignment.assignment_date && leave.endDate >= assignment.assignment_date) {
        conflicts.push({
          type: "employee_on_leave",
          details: leave
        });
      }
    }
  }

  // Check travel time if assignment has event with travel info
  if (assignment.event_id && assignment.time_window) {
    const event = db.get<{ travel: string }>("SELECT travel FROM studio_events WHERE id = ?", [assignment.event_id]);
    if (event?.travel) {
      const travel = JSON.parse(event.travel);
      // This is a simplified check - in reality you'd check against other assignments' travel buffers
      // For now, we just note the travel info in validation
    }
  }

  return conflicts;
}