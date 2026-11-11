import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const eventRoutes = new Hono<{ Bindings: Env }>();

const eventSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  eventType: z.enum(["wedding", "engagement", "pre_wedding", "corporate", "portrait", "product", "event", "other"]),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  venue: z.any().optional(),
  clientRequirements: z.any().optional(),
  status: z.string().optional(),
  metadata: z.any().optional(),
});

const segmentSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(1).max(200),
  segmentType: z.enum(["preparation", "ceremony", "reception", "portraits", "details", "candid", "group", "drone", "video_highlights", "other"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().max(200).optional(),
  requiredRoles: z.array(z.string()).optional(),
  notes: z.string().optional(),
  orderIndex: z.number().int().nonnegative().default(0),
});

const updateEventSchema = eventSchema.partial();
const updateSegmentSchema = segmentSchema.partial();

// List events
eventRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      eventType: z.string().optional(),
      status: z.string().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, eventType, status, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (eventType) { where += " AND event_type = ?"; params.push(eventType); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (dateFrom) { where += " AND event_date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND event_date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (event_date < ? OR (event_date = ? AND id < ?))";
      params.push(decoded.eventDate, decoded.eventDate, decoded.id);
    }

    const sql = `SELECT * FROM studio_events ${where} ORDER BY event_date DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ eventDate: last.event_date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get event with segments
eventRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const event = await c.env.DB.prepare(
    "SELECT * FROM studio_events WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!event) return c.json({ error: "Event not found" }, 404);

  const segments = await c.env.DB.prepare(
    "SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL ORDER BY order_index, start_time"
  ).bind(id).all();

  return c.json({ ...event, segments: segments.results });
});

// Create event
eventRoutes.post(
  "/",
  zValidator("json", eventSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    // Verify project exists
    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    await c.env.DB.prepare(
      `INSERT INTO studio_events (id, project_id, title, event_type, event_date, start_time, end_time, venue, client_requirements, status, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId, data.title, data.eventType, data.eventDate, data.startTime,
      data.endTime || null, data.venue ? JSON.stringify(data.venue) : null,
      data.clientRequirements ? JSON.stringify(data.clientRequirements) : null,
      data.status || "scheduled", data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const event = await c.env.DB.prepare("SELECT * FROM studio_events WHERE id = ?").bind(id).first();
    return c.json(event, 201);
  }
);

// Update event
eventRoutes.patch(
  "/:id",
  zValidator("json", updateEventSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_events WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Event not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "title", "eventType", "eventDate", "startTime", "endTime", "venue", "clientRequirements", "status", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_events SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const event = await c.env.DB.prepare("SELECT * FROM studio_events WHERE id = ?").bind(id).first();
    return c.json(event);
  }
);

// Delete event (soft)
eventRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_events SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Segments
eventRoutes.get("/:eventId/segments", async (c) => {
  const eventId = c.req.param("eventId");
  const segments = await c.env.DB.prepare(
    "SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL ORDER BY order_index, start_time"
  ).bind(eventId).all();
  return c.json(segments.results);
});

eventRoutes.post(
  "/:eventId/segments",
  zValidator("json", segmentSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const data = c.req.valid("json");

    if (data.eventId !== eventId) return c.json({ error: "Event ID mismatch" }, 400);

    const event = await c.env.DB.prepare("SELECT id FROM studio_events WHERE id = ? AND deleted_at IS NULL").bind(eventId).first();
    if (!event) return c.json({ error: "Event not found" }, 404);

    const id = createId();
    await c.env.DB.prepare(
      `INSERT INTO studio_event_segments (id, event_id, title, segment_type, start_time, end_time, location, required_roles, notes, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.eventId, data.title, data.segmentType, data.startTime, data.endTime,
      data.location || null, data.requiredRoles ? JSON.stringify(data.requiredRoles) : null,
      data.notes || null, data.orderIndex,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const segment = await c.env.DB.prepare("SELECT * FROM studio_event_segments WHERE id = ?").bind(id).first();
    return c.json(segment, 201);
  }
);

eventRoutes.patch(
  "/:eventId/segments/:segmentId",
  zValidator("json", updateSegmentSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const segmentId = c.req.param("segmentId");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_event_segments WHERE id = ? AND event_id = ? AND deleted_at IS NULL").bind(segmentId, eventId).first();
    if (!existing) return c.json({ error: "Segment not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["title", "segmentType", "startTime", "endTime", "location", "requiredRoles", "notes", "orderIndex"];

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
    params.push(segmentId);

    await c.env.DB.prepare(`UPDATE studio_event_segments SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const segment = await c.env.DB.prepare("SELECT * FROM studio_event_segments WHERE id = ?").bind(segmentId).first();
    return c.json(segment);
  }
);

eventRoutes.delete("/:eventId/segments/:segmentId", async (c) => {
  const eventId = c.req.param("eventId");
  const segmentId = c.req.param("segmentId");
  await c.env.DB.prepare("UPDATE studio_event_segments SET deleted_at = ?, updated_at = ? WHERE id = ? AND event_id = ?").bind(new Date().toISOString(), new Date().toISOString(), segmentId, eventId).run();
  return c.json({ success: true });
});

// Reorder segments
eventRoutes.post("/:eventId/segments/reorder", async (c) => {
  const eventId = c.req.param("eventId");
  const { segmentIds } = await c.req.json<{ segmentIds: string[] }>();

  for (let i = 0; i < segmentIds.length; i++) {
    await c.env.DB.prepare(
      "UPDATE studio_event_segments SET order_index = ?, updated_at = ? WHERE id = ? AND event_id = ?"
    ).bind(i, new Date().toISOString(), segmentIds[i], eventId).run();
  }

  const segments = await c.env.DB.prepare(
    "SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL ORDER BY order_index, start_time"
  ).bind(eventId).all();
  return c.json(segments.results);
});

export { eventRoutes };