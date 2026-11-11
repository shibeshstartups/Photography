import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const notificationRoutes = new Hono<{ Bindings: Env }>();

const notificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  message: z.string(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  metadata: z.any().optional(),
});

const updateNotificationSchema = notificationSchema.partial();

// List notifications for current user
notificationRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      type: z.string().optional(),
      isRead: z.boolean().optional(),
      priority: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const user = c.get("user");
    const { type, isRead, priority, cursor, limit } = c.req.valid("query");

    let where = "WHERE user_id = ? AND deleted_at IS NULL";
    const params: unknown[] = [user.id];

    if (type) { where += " AND type = ?"; params.push(type); }
    if (isRead !== undefined) { where += " AND is_read = ?"; params.push(isRead ? 1 : 0); }
    if (priority) { where += " AND priority = ?"; params.push(priority); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ?`;
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

// Get unread count
notificationRoutes.get("/unread-count", async (c) => {
  const user = c.get("user");
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM studio_notifications WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL"
  ).bind(user.id).first<{ count: number }>();

  return c.json({ count: count?.count || 0 });
});

// Get notification
notificationRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const notification = await c.env.DB.prepare(
    "SELECT * FROM studio_notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
  ).bind(id, user.id).first();

  if (!notification) return c.json({ error: "Notification not found" }, 404);
  return c.json(notification);
});

// Create notification (admin/system)
notificationRoutes.post(
  "/",
  zValidator("json", notificationSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    // Verify user exists
    const user = await c.env.DB.prepare("SELECT id FROM studio_users WHERE id = ? AND deleted_at IS NULL").bind(data.userId).first();
    if (!user) return c.json({ error: "User not found" }, 404);

    await c.env.DB.prepare(
      `INSERT INTO studio_notifications (id, user_id, type, title, message, reference_type, reference_id, priority, is_read, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(
      id, data.userId, data.type, data.title, data.message,
      data.referenceType || null, data.referenceId || null, data.priority,
      data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString()
    ).run();

    const notification = await c.env.DB.prepare("SELECT * FROM studio_notifications WHERE id = ?").bind(id).first();
    return c.json(notification, 201);
  }
);

// Bulk create notifications
notificationRoutes.post("/bulk", async (c) => {
  const { notifications } = await c.req.json<{ notifications: z.infer<typeof notificationSchema>[] }>();

  const results = [];
  const errors = [];

  for (let i = 0; i < notifications.length; i++) {
    const data = notifications[i];
    try {
      const id = createId();

      const user = await c.env.DB.prepare("SELECT id FROM studio_users WHERE id = ? AND deleted_at IS NULL").bind(data.userId).first();
      if (!user) throw new Error("User not found");

      await c.env.DB.prepare(
        `INSERT INTO studio_notifications (id, user_id, type, title, message, reference_type, reference_id, priority, is_read, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ).bind(
        id, data.userId, data.type, data.title, data.message,
        data.referenceType || null, data.referenceId || null, data.priority,
        data.metadata ? JSON.stringify(data.metadata) : null,
        new Date().toISOString()
      ).run();

      results.push({ id, ...data });
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return c.json({ created: results, errors }, errors.length > 0 ? 207 : 201);
});

// Mark as read
notificationRoutes.patch("/:id/read", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  await c.env.DB.prepare(
    "UPDATE studio_notifications SET is_read = 1, read_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
  ).bind(new Date().toISOString(), new Date().toISOString(), id, user.id).run();

  const notification = await c.env.DB.prepare("SELECT * FROM studio_notifications WHERE id = ?").bind(id).first();
  return c.json(notification);
});

// Mark as unread
notificationRoutes.patch("/:id/unread", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  await c.env.DB.prepare(
    "UPDATE studio_notifications SET is_read = 0, read_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
  ).bind(new Date().toISOString(), id, user.id).run();

  const notification = await c.env.DB.prepare("SELECT * FROM studio_notifications WHERE id = ?").bind(id).first();
  return c.json(notification);
});

// Mark all as read
notificationRoutes.post("/read-all", async (c) => {
  const user = c.get("user");

  await c.env.DB.prepare(
    "UPDATE studio_notifications SET is_read = 1, read_at = ?, updated_at = ? WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL"
  ).bind(new Date().toISOString(), new Date().toISOString(), user.id).run();

  return c.json({ success: true });
});

// Update notification
notificationRoutes.patch(
  "/:id",
  zValidator("json", updateNotificationSchema),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(id, user.id).first();
    if (!existing) return c.json({ error: "Notification not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["type", "title", "message", "referenceType", "referenceId", "priority", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_notifications SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const notification = await c.env.DB.prepare("SELECT * FROM studio_notifications WHERE id = ?").bind(id).first();
    return c.json(notification);
  }
);

// Delete notification (soft)
notificationRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  await c.env.DB.prepare("UPDATE studio_notifications SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(new Date().toISOString(), new Date().toISOString(), id, user.id).run();
  return c.json({ success: true });
});

// Notification types meta
notificationRoutes.get("/meta/types", async (c) => {
  return c.json([
    "assignment_created",
    "assignment_updated",
    "assignment_cancelled",
    "attendance_recorded",
    "event_reminder",
    "payment_received",
    "payment_overdue",
    "invoice_sent",
    "quotation_approved",
    "editing_stage_updated",
    "editing_qc_required",
    "editing_revision_requested",
    "editing_delivered",
    "equipment_checked_out",
    "equipment_due_return",
    "equipment_returned",
    "equipment_maintenance_due",
    "project_status_changed",
    "client_message",
    "system_announcement",
  ]);
});

export { notificationRoutes };