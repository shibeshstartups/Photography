import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { AttendanceEvent, NewAttendanceEvent } from "@studio-erp/database";

export function registerAttendanceHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List attendance events for an assignment/event/employee
  createHandler("attendance:list", async (event: IpcMainInvokeEvent, filters?: {
    assignmentId?: string;
    eventId?: string;
    employeeId?: string;
    dateFrom?: string;
    dateTo?: string;
    eventType?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { assignmentId, eventId, employeeId, dateFrom, dateTo, eventType, cursor, limit = 100 } = filters || {};

    let where = "WHERE 1=1";
    const params: unknown[] = [];

    if (assignmentId) { where += " AND assignment_id = ?"; params.push(assignmentId); }
    if (eventId) { where += " AND event_id = ?"; params.push(eventId); }
    if (employeeId) { where += " AND employee_id = ?"; params.push(employeeId); }
    if (dateFrom) { where += " AND occurred_at >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND occurred_at <= ?"; params.push(dateTo); }
    if (eventType) { where += " AND event_type = ?"; params.push(eventType); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (occurred_at < ? OR (occurred_at = ? AND id < ?))";
      params.push(decoded.occurredAt, decoded.occurredAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_attendance_events ${where} ORDER BY occurred_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ occurredAt: last.occurred_at, id: last.id })).toString("base64url");
    }

    // Enrich with employee info
    for (const item of items) {
      item.employee = db.get("SELECT id, full_name, designation FROM studio_employees WHERE id = ?", [item.employee_id]);
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Check-in
  createHandler("attendance:check-in", async (event: IpcMainInvokeEvent, data: {
    assignmentId?: string;
    eventId: string;
    employeeId: string;
    segmentId?: string;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }) => {
    requireAuth(event);
    const { assignmentId, eventId, employeeId, segmentId, occurredAt, metadata } = data;
    const id = uuid();

    // Check if already checked in for this assignment/event
    const existing = db.get<AttendanceEvent>(
      `SELECT * FROM studio_attendance_events
       WHERE employee_id = ? AND event_id = ? AND event_type = 'check_in'
       AND occurred_at >= date(?) AND occurred_at < date(?, '+1 day')`,
      [employeeId, eventId, occurredAt, occurredAt]
    );
    if (existing) {
      throw new Error("Already checked in for this event");
    }

    db.run(
      `INSERT INTO studio_attendance_events (id, assignment_id, event_id, employee_id, event_type, occurred_at, recorded_at, recorded_by, segment_id, metadata, device_id, version, created_at)
       VALUES (?, ?, ?, ?, 'check_in', ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, assignmentId || null, eventId, employeeId, occurredAt, nowIso(), "current-user", segmentId || null, JSON.stringify(metadata || {}), "current-device", nowIso()]
    );

    return db.get<AttendanceEvent>("SELECT * FROM studio_attendance_events WHERE id = ?", [id]);
  }, db);

  // Check-out
  createHandler("attendance:check-out", async (event: IpcMainInvokeEvent, data: {
    assignmentId?: string;
    eventId: string;
    employeeId: string;
    segmentId?: string;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }) => {
    requireAuth(event);
    const { assignmentId, eventId, employeeId, segmentId, occurredAt, metadata } = data;
    const id = uuid();

    // Check if checked in
    const checkIn = db.get<AttendanceEvent>(
      `SELECT * FROM studio_attendance_events
       WHERE employee_id = ? AND event_id = ? AND event_type = 'check_in'
       AND occurred_at >= date(?) AND occurred_at < date(?, '+1 day')`,
      [employeeId, eventId, occurredAt, occurredAt]
    );
    if (!checkIn) {
      throw new Error("Not checked in for this event");
    }

    // Check if already checked out
    const existingOut = db.get<AttendanceEvent>(
      `SELECT * FROM studio_attendance_events
       WHERE employee_id = ? AND event_id = ? AND event_type = 'check_out'
       AND occurred_at >= date(?) AND occurred_at < date(?, '+1 day')`,
      [employeeId, eventId, occurredAt, occurredAt]
    );
    if (existingOut) {
      throw new Error("Already checked out for this event");
    }

    db.run(
      `INSERT INTO studio_attendance_events (id, assignment_id, event_id, employee_id, event_type, occurred_at, recorded_at, recorded_by, segment_id, metadata, device_id, version, created_at)
       VALUES (?, ?, ?, ?, 'check_out', ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, assignmentId || null, eventId, employeeId, occurredAt, nowIso(), "current-user", segmentId || null, JSON.stringify(metadata || {}), "current-device", nowIso()]
    );

    return db.get<AttendanceEvent>("SELECT * FROM studio_attendance_events WHERE id = ?", [id]);
  }, db);

  // Mark late/absent/replacement
  createHandler("attendance:mark", async (event: IpcMainInvokeEvent, data: {
    assignmentId?: string;
    eventId: string;
    employeeId: string;
    eventType: "late" | "absent" | "replacement";
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }) => {
    requireAuth(event);
    const { assignmentId, eventId, employeeId, eventType, occurredAt, metadata } = data;
    const id = uuid();

    db.run(
      `INSERT INTO studio_attendance_events (id, assignment_id, event_id, employee_id, event_type, occurred_at, recorded_at, recorded_by, segment_id, metadata, device_id, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, assignmentId || null, eventId, employeeId, eventType, occurredAt, nowIso(), "current-user", null, JSON.stringify(metadata || {}), "current-device", nowIso()]
    );

    return db.get<AttendanceEvent>("SELECT * FROM studio_attendance_events WHERE id = ?", [id]);
  }, db);

  // Correction (append-only - creates new event referencing original)
  createHandler("attendance:correct", async (event: IpcMainInvokeEvent, data: {
    replacesEventId: string;
    assignmentId?: string;
    eventId: string;
    employeeId: string;
    eventType: "check_in" | "check_out" | "late" | "absent" | "replacement" | "correction";
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }) => {
    requireAuth(event);
    const { replacesEventId, assignmentId, eventId, employeeId, eventType, occurredAt, metadata } = data;
    const id = uuid();

    // Verify the event being replaced exists
    const original = db.get<AttendanceEvent>("SELECT * FROM studio_attendance_events WHERE id = ?", [replacesEventId]);
    if (!original) throw new Error("Original attendance event not found");

    db.run(
      `INSERT INTO studio_attendance_events (id, assignment_id, event_id, employee_id, event_type, occurred_at, recorded_at, recorded_by, segment_id, metadata, replaces_event_id, device_id, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, assignmentId || null, eventId, employeeId, eventType, occurredAt, nowIso(), "current-user", original.segment_id, JSON.stringify(metadata || {}), replacesEventId, "current-device", nowIso()]
    );

    return db.get<AttendanceEvent>("SELECT * FROM studio_attendance_events WHERE id = ?", [id]);
  }, db);

  // Get attendance summary for an event
  createHandler("attendance:event-summary", async (event: IpcMainInvokeEvent, eventId: string) => {
    requireAuth(event);
    const assignments = db.all<{ employee_id: string; segment_id: string }>(
      "SELECT employee_id, segment_id FROM studio_assignments WHERE event_id = ? AND deleted_at IS NULL AND status IN ('confirmed', 'tentative')",
      [eventId]
    );

    const summary = [];
    for (const assignment of assignments) {
      const employee = db.get<{ id: string; full_name: string; designation: string }>(
        "SELECT id, full_name, designation FROM studio_employees WHERE id = ?", [assignment.employee_id]
      );

      const events = db.all<AttendanceEvent>(
        `SELECT * FROM studio_attendance_events
         WHERE employee_id = ? AND event_id = ?
         ORDER BY occurred_at ASC`,
        [assignment.employee_id, eventId]
      );

      const checkIn = events.find(e => e.event_type === "check_in");
      const checkOut = events.find(e => e.event_type === "check_out");
      const late = events.find(e => e.event_type === "late");
      const absent = events.find(e => e.event_type === "absent");

      let hoursWorked = 0;
      if (checkIn && checkOut) {
        const inTime = new Date(checkIn.occurred_at).getTime();
        const outTime = new Date(checkOut.occurred_at).getTime();
        hoursWorked = Math.round((outTime - inTime) / 1000 / 60 / 60 * 100) / 100;
      }

      summary.push({
        employee,
        segmentId: assignment.segment_id,
        checkIn: checkIn?.occurred_at || null,
        checkOut: checkOut?.occurred_at || null,
        late: !!late,
        absent: !!absent,
        hoursWorked,
        events: events.map(e => ({ type: e.event_type, occurredAt: e.occurred_at, metadata: e.metadata ? JSON.parse(e.metadata) : {} }))
      });
    }

    return summary;
  }, db);

  // Get attendance stats for employee
  createHandler("attendance:employee-stats", async (event: IpcMainInvokeEvent, employeeId: string, dateFrom: string, dateTo: string) => {
    requireAuth(event);
    const events = db.all<AttendanceEvent>(
      `SELECT * FROM studio_attendance_events
       WHERE employee_id = ? AND occurred_at BETWEEN ? AND ?
       ORDER BY occurred_at ASC`,
      [employeeId, dateFrom, dateTo]
    );

    const totalDays = new Set(events.map(e => e.occurred_at.split("T")[0])).size;
    const checkIns = events.filter(e => e.event_type === "check_in").length;
    const checkOuts = events.filter(e => e.event_type === "check_out").length;
    const late = events.filter(e => e.event_type === "late").length;
    const absent = events.filter(e => e.event_type === "absent").length;

    let totalHours = 0;
    const byDate = new Map<string, { in: string | null; out: string | null }>();
    for (const e of events) {
      const date = e.occurred_at.split("T")[0];
      if (!byDate.has(date)) byDate.set(date, { in: null, out: null });
      const day = byDate.get(date)!;
      if (e.event_type === "check_in") day.in = e.occurred_at;
      if (e.event_type === "check_out") day.out = e.occurred_at;
    }
    for (const [, day] of byDate) {
      if (day.in && day.out) {
        const inTime = new Date(day.in).getTime();
        const outTime = new Date(day.out).getTime();
        totalHours += (outTime - inTime) / 1000 / 60 / 60;
      }
    }

    return {
      totalDays,
      checkIns,
      checkOuts,
      late,
      absent,
      totalHours: Math.round(totalHours * 100) / 100,
      attendanceRate: totalDays > 0 ? Math.round((checkIns / totalDays) * 100) : 0,
    };
  }, db);
}