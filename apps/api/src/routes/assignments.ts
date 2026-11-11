import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const assignmentRoutes = new Hono<{ Bindings: Env }>();

const assignmentSchema = z.object({
  projectId: z.string().uuid(),
  eventId: z.string().uuid().optional(),
  segmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  role: z.string().min(1).max(100),
  callTime: z.string().regex(/^\d{2}:\d{2}$/),
  expectedEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const updateAssignmentSchema = assignmentSchema.partial();

// List assignments
assignmentRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      eventId: z.string().uuid().optional(),
      employeeId: z.string().uuid().optional(),
      status: z.string().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, eventId, employeeId, status, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE a.deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND a.project_id = ?"; params.push(projectId); }
    if (eventId) { where += " AND a.event_id = ?"; params.push(eventId); }
    if (employeeId) { where += " AND a.employee_id = ?"; params.push(employeeId); }
    if (status) { where += " AND a.status = ?"; params.push(status); }
    if (dateFrom || dateTo) {
      // Join events to filter by date
      where += " AND EXISTS (SELECT 1 FROM studio_events e WHERE e.id = a.event_id AND e.deleted_at IS NULL";
      if (dateFrom) { where += " AND e.event_date >= ?"; params.push(dateFrom); }
      if (dateTo) { where += " AND e.event_date <= ?"; params.push(dateTo); }
      where += ")";
    }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (a.created_at < ? OR (a.created_at = ? AND a.id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT a.*, e.employee_id as emp_id, e.name as employee_name, e.role as employee_role
                 FROM studio_assignments a
                 LEFT JOIN studio_employees e ON a.employee_id = e.id
                 ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get assignment
assignmentRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const assignment = await c.env.DB.prepare(
    "SELECT * FROM studio_assignments WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!assignment) return c.json({ error: "Assignment not found" }, 404);
  return c.json(assignment);
});

// Create assignment with conflict detection
assignmentRoutes.post(
  "/",
  zValidator("json", assignmentSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    // Verify employee exists
    const employee = await c.env.DB.prepare("SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(data.employeeId).first();
    if (!employee) return c.json({ error: "Employee not found" }, 404);

    // Verify project exists
    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (data.eventId) {
      const event = await c.env.DB.prepare("SELECT id FROM studio_events WHERE id = ? AND deleted_at IS NULL").bind(data.eventId).first();
      if (!event) return c.json({ error: "Event not found" }, 404);
    }

    if (data.segmentId) {
      const segment = await c.env.DB.prepare("SELECT id FROM studio_event_segments WHERE id = ? AND deleted_at IS NULL").bind(data.segmentId).first();
      if (!segment) return c.json({ error: "Segment not found" }, 404);
    }

    // Conflict detection: check for overlapping assignments for same employee
    if (data.eventId) {
      const event = await c.env.DB.prepare("SELECT event_date, start_time, end_time FROM studio_events WHERE id = ?").bind(data.eventId).first();
      if (event) {
        const eventDate = event.event_date;
        const startTime = event.start_time;
        const endTime = event.end_time || "23:59";

        const conflicts = await c.env.DB.prepare(
          `SELECT a.id, a.role, e.event_date, e.start_time, e.end_time
           FROM studio_assignments a
           JOIN studio_events e ON a.event_id = e.id
           WHERE a.employee_id = ? AND a.id != ? AND a.deleted_at IS NULL AND e.deleted_at IS NULL
           AND e.event_date = ?
           AND (
             (a.call_time < ? AND IFNULL(e.end_time, '23:59') > ?) OR
             (a.call_time >= ? AND a.call_time < ?)
           )`
        ).bind(data.employeeId, id, eventDate, startTime, startTime, startTime, endTime).all();

        if (conflicts.results.length > 0) {
          return c.json({
            error: "Employee has conflicting assignment",
            conflicts: conflicts.results
          }, 409);
        }
      }
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_assignments (id, project_id, event_id, segment_id, employee_id, role, call_time, expected_end_time, status, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId, data.eventId || null, data.segmentId || null, data.employeeId,
      data.role, data.callTime, data.expectedEndTime || null, data.status || "pending",
      data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const assignment = await c.env.DB.prepare("SELECT * FROM studio_assignments WHERE id = ?").bind(id).first();
    return c.json(assignment, 201);
  }
);

// Update assignment
assignmentRoutes.patch(
  "/:id",
  zValidator("json", updateAssignmentSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_assignments WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Assignment not found" }, 404);

    // Conflict detection if employee or event/time changed
    if (data.employeeId || data.eventId) {
      const employeeId = data.employeeId || existing.employee_id;
      const eventId = data.eventId || existing.event_id;

      if (eventId) {
        const event = await c.env.DB.prepare("SELECT event_date, start_time, end_time FROM studio_events WHERE id = ?").bind(eventId).first();
        if (event) {
          const eventDate = event.event_date;
          const startTime = event.start_time;
          const endTime = event.end_time || "23:59";

          const conflicts = await c.env.DB.prepare(
            `SELECT a.id, a.role, e.event_date, e.start_time, e.end_time
             FROM studio_assignments a
             JOIN studio_events e ON a.event_id = e.id
             WHERE a.employee_id = ? AND a.id != ? AND a.deleted_at IS NULL AND e.deleted_at IS NULL
             AND e.event_date = ?
             AND (
               (a.call_time < ? AND IFNULL(e.end_time, '23:59') > ?) OR
               (a.call_time >= ? AND a.call_time < ?)
             )`
          ).bind(employeeId, id, eventDate, startTime, startTime, startTime, endTime).all();

          if (conflicts.results.length > 0) {
            return c.json({
              error: "Employee has conflicting assignment",
              conflicts: conflicts.results
            }, 409);
          }
        }
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "eventId", "segmentId", "employeeId", "role", "callTime", "expectedEndTime", "status", "notes", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_assignments SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const assignment = await c.env.DB.prepare("SELECT * FROM studio_assignments WHERE id = ?").bind(id).first();
    return c.json(assignment);
  }
);

// Delete assignment (soft)
assignmentRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_assignments SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Bulk create assignments
assignmentRoutes.post("/bulk", async (c) => {
  const { assignments } = await c.req.json<{ assignments: z.infer<typeof assignmentSchema>[] }>();

  const results = [];
  const errors = [];

  for (let i = 0; i < assignments.length; i++) {
    const data = assignments[i];
    try {
      const id = createId();

      const employee = await c.env.DB.prepare("SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(data.employeeId).first();
      if (!employee) throw new Error("Employee not found");

      const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
      if (!project) throw new Error("Project not found");

      if (data.eventId) {
        const event = await c.env.DB.prepare("SELECT id FROM studio_events WHERE id = ? AND deleted_at IS NULL").bind(data.eventId).first();
        if (!event) throw new Error("Event not found");
      }

      await c.env.DB.prepare(
        `INSERT INTO studio_assignments (id, project_id, event_id, segment_id, employee_id, role, call_time, expected_end_time, status, notes, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, data.projectId, data.eventId || null, data.segmentId || null, data.employeeId,
        data.role, data.callTime, data.expectedEndTime || null, data.status || "pending",
        data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
        new Date().toISOString(), new Date().toISOString()
      ).run();

      results.push({ id, ...data });
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return c.json({ created: results, errors }, errors.length > 0 ? 207 : 201);
});

// Get assignments for employee on date
assignmentRoutes.get("/employee/:employeeId/date/:date", async (c) => {
  const employeeId = c.req.param("employeeId");
  const date = c.req.param("date");

  const assignments = await c.env.DB.prepare(
    `SELECT a.*, e.title as event_title, e.event_type, e.start_time, e.end_time, e.venue
     FROM studio_assignments a
     JOIN studio_events e ON a.event_id = e.id
     WHERE a.employee_id = ? AND e.event_date = ? AND a.deleted_at IS NULL AND e.deleted_at IS NULL
     ORDER BY e.start_time`
  ).bind(employeeId, date).all();

  return c.json(assignments.results);
});

export { assignmentRoutes };