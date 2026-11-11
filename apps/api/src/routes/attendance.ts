import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const attendanceRoutes = new Hono<{ Bindings: Env }>();

const attendanceSchema = z.object({
  assignmentId: z.string().uuid(),
  employeeId: z.string().uuid(),
  eventId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "left_early", "on_break"]),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakDuration: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
  location: z.any().optional(),
  metadata: z.any().optional(),
});

const updateAttendanceSchema = attendanceSchema.partial();

// List attendance records
attendanceRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      employeeId: z.string().uuid().optional(),
      eventId: z.string().uuid().optional(),
      assignmentId: z.string().uuid().optional(),
      status: z.enum(["present", "absent", "late", "left_early", "on_break"]).optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { employeeId, eventId, assignmentId, status, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE a.deleted_at IS NULL";
    const params: unknown[] = [];

    if (employeeId) { where += " AND a.employee_id = ?"; params.push(employeeId); }
    if (eventId) { where += " AND a.event_id = ?"; params.push(eventId); }
    if (assignmentId) { where += " AND a.assignment_id = ?"; params.push(assignmentId); }
    if (status) { where += " AND a.status = ?"; params.push(status); }
    if (dateFrom) { where += " AND a.date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND a.date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (a.date < ? OR (a.date = ? AND a.id < ?))";
      params.push(decoded.date, decoded.date, decoded.id);
    }

    const sql = `SELECT a.*, e.name as employee_name, ev.title as event_title, ev.event_date
                 FROM studio_attendance a
                 LEFT JOIN studio_employees e ON a.employee_id = e.id
                 LEFT JOIN studio_events ev ON a.event_id = ev.id
                 ${where} ORDER BY a.date DESC, a.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ date: last.date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get attendance record
attendanceRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const attendance = await c.env.DB.prepare(
    "SELECT * FROM studio_attendance WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!attendance) return c.json({ error: "Attendance record not found" }, 404);
  return c.json(attendance);
});

// Create attendance record (append-only)
attendanceRoutes.post(
  "/",
  zValidator("json", attendanceSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();
    const user = c.get("user");

    // Verify assignment exists
    const assignment = await c.env.DB.prepare(
      "SELECT id FROM studio_assignments WHERE id = ? AND deleted_at IS NULL"
    ).bind(data.assignmentId).first();
    if (!assignment) return c.json({ error: "Assignment not found" }, 404);

    // Verify employee
    const employee = await c.env.DB.prepare(
      "SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL"
    ).bind(data.employeeId).first();
    if (!employee) return c.json({ error: "Employee not found" }, 404);

    // Verify event
    const event = await c.env.DB.prepare(
      "SELECT id, event_date FROM studio_events WHERE id = ? AND deleted_at IS NULL"
    ).bind(data.eventId).first();
    if (!event) return c.json({ error: "Event not found" }, 404);

    // Check for existing attendance for this assignment
    const existing = await c.env.DB.prepare(
      "SELECT id FROM studio_attendance WHERE assignment_id = ? AND deleted_at IS NULL"
    ).bind(data.assignmentId).first();

    if (existing) {
      return c.json({ error: "Attendance already recorded for this assignment" }, 409);
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_attendance (id, assignment_id, employee_id, event_id, date, status, check_in_time, check_out_time, break_duration, notes, location, recorded_by, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.assignmentId, data.employeeId, data.eventId, event.event_date,
      data.status, data.checkInTime || null, data.checkOutTime || null, data.breakDuration,
      data.notes || null, data.location ? JSON.stringify(data.location) : null,
      user.id, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString()
    ).run();

    const attendance = await c.env.DB.prepare("SELECT * FROM studio_attendance WHERE id = ?").bind(id).first();
    return c.json(attendance, 201);
  }
);

// Update attendance (append-only: creates new record with version tracking)
attendanceRoutes.patch(
  "/:id",
  zValidator("json", updateAttendanceSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const user = c.get("user");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_attendance WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Attendance record not found" }, 404);

    // For append-only: we don't modify existing records
    // Instead, we create a new record with updated info and link to original
    const newId = createId();
    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["status", "checkInTime", "checkOutTime", "breakDuration", "notes", "location", "metadata"];

    let status = existing.status;
    let checkInTime = existing.check_in_time;
    let checkOutTime = existing.check_out_time;
    let breakDuration = existing.break_duration;
    let notes = existing.notes;
    let location = existing.location;
    let metadata = existing.metadata;

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        switch (field) {
          case "status": status = data.status; break;
          case "checkInTime": checkInTime = data.checkInTime; break;
          case "checkOutTime": checkOutTime = data.checkOutTime; break;
          case "breakDuration": breakDuration = data.breakDuration; break;
          case "notes": notes = data.notes; break;
          case "location": location = data.location ? JSON.stringify(data.location) : null; break;
          case "metadata": metadata = data.metadata ? JSON.stringify(data.metadata) : null; break;
        }
      }
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_attendance (id, assignment_id, employee_id, event_id, date, status, check_in_time, check_out_time, break_duration, notes, location, recorded_by, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId, existing.assignment_id, existing.employee_id, existing.event_id, existing.date,
      status, checkInTime, checkOutTime, breakDuration, notes, location,
      user.id, metadata, new Date().toISOString()
    ).run();

    // Mark old as superseded (soft delete with note)
    await c.env.DB.prepare(
      "UPDATE studio_attendance SET notes = COALESCE(notes, '') || ' [SUPERSEDED BY ' || ? || ']', deleted_at = ? WHERE id = ?"
    ).bind(newId, new Date().toISOString(), id).run();

    const attendance = await c.env.DB.prepare("SELECT * FROM studio_attendance WHERE id = ?").bind(newId).first();
    return c.json(attendance);
  }
);

// Get attendance history for assignment
attendanceRoutes.get("/assignment/:assignmentId/history", async (c) => {
  const assignmentId = c.req.param("assignmentId");
  const records = await c.env.DB.prepare(
    "SELECT * FROM studio_attendance WHERE assignment_id = ? ORDER BY created_at"
  ).bind(assignmentId).all();
  return c.json(records.results);
});

// Get attendance summary for event
attendanceRoutes.get("/event/:eventId/summary", async (c) => {
  const eventId = c.req.param("eventId");

  const summary = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
       SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
       SUM(CASE WHEN status = 'left_early' THEN 1 ELSE 0 END) as left_early,
       SUM(CASE WHEN status = 'on_break' THEN 1 ELSE 0 END) as on_break
     FROM studio_attendance
     WHERE event_id = ? AND deleted_at IS NULL`
  ).bind(eventId).first();

  return c.json(summary);
});

// Get employee attendance stats
attendanceRoutes.get("/employee/:employeeId/stats", async (c) => {
  const employeeId = c.req.param("employeeId");
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE employee_id = ? AND deleted_at IS NULL";
  const params: unknown[] = [employeeId];

  if (dateFrom) { where += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND date <= ?"; params.push(dateTo); }

  const stats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
       SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
       SUM(CASE WHEN status = 'left_early' THEN 1 ELSE 0 END) as left_early,
       SUM(CASE WHEN status = 'on_break' THEN 1 ELSE 0 END) as on_break
     FROM studio_attendance
     ${where}`
  ).bind(...params).first();

  return c.json(stats);
});

export { attendanceRoutes };