import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types.js";

const auditRoutes = new Hono<{ Bindings: Env }>();

// List audit logs
auditRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      action: z.string().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(100),
    })
  ),
  async (c) => {
    const { entityType, entityId, userId, action, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE 1=1";
    const params: unknown[] = [];

    if (entityType) { where += " AND entity_type = ?"; params.push(entityType); }
    if (entityId) { where += " AND entity_id = ?"; params.push(entityId); }
    if (userId) { where += " AND user_id = ?"; params.push(userId); }
    if (action) { where += " AND action = ?"; params.push(action); }
    if (dateFrom) { where += " AND timestamp >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND timestamp <= ?"; params.push(dateTo + "T23:59:59.999Z"); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (timestamp < ? OR (timestamp = ? AND id < ?))";
      params.push(decoded.timestamp, decoded.timestamp, decoded.id);
    }

    const sql = `SELECT a.*, u.name as user_name, u.email as user_email
                 FROM studio_audit_logs a
                 LEFT JOIN studio_users u ON a.user_id = u.id
                 ${where} ORDER BY a.timestamp DESC, a.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ timestamp: last.timestamp, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get audit log
auditRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const audit = await c.env.DB.prepare(
    `SELECT a.*, u.name as user_name, u.email as user_email
     FROM studio_audit_logs a
     LEFT JOIN studio_users u ON a.user_id = u.id
     WHERE a.id = ?`
  ).bind(id).first();

  if (!audit) return c.json({ error: "Audit log not found" }, 404);
  return c.json(audit);
});

// Get audit trail for entity
auditRoutes.get("/entity/:entityType/:entityId", async (c) => {
  const entityType = c.req.param("entityType");
  const entityId = c.req.param("entityId");
  const { cursor, limit = 100 } = c.req.query();

  let where = "WHERE entity_type = ? AND entity_id = ?";
  const params: unknown[] = [entityType, entityId];

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
    where += " AND (timestamp < ? OR (timestamp = ? AND id < ?))";
    params.push(decoded.timestamp, decoded.timestamp, decoded.id);
  }

  params.push(parseInt(limit) + 1);

  const sql = `SELECT a.*, u.name as user_name, u.email as user_email
               FROM studio_audit_logs a
               LEFT JOIN studio_users u ON a.user_id = u.id
               ${where} ORDER BY a.timestamp DESC, a.id DESC LIMIT ?`;

  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  const hasMore = rows.results.length > parseInt(limit);
  const items = hasMore ? rows.results.slice(0, parseInt(limit)) : rows.results;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ timestamp: last.timestamp, id: last.id })).toString("base64url");
  }

  return c.json({ items, nextCursor, hasMore });
});

// Get user activity
auditRoutes.get("/user/:userId/activity", async (c) => {
  const userId = c.req.param("userId");
  const { dateFrom, dateTo, limit = 100 } = c.req.query();

  let where = "WHERE user_id = ?";
  const params: unknown[] = [userId];

  if (dateFrom) { where += " AND timestamp >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND timestamp <= ?"; params.push(dateTo + "T23:59:59.999Z"); }
  params.push(parseInt(limit) + 1);

  const sql = `SELECT * FROM studio_audit_logs ${where} ORDER BY timestamp DESC LIMIT ?`;
  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  const hasMore = rows.results.length > parseInt(limit);
  const items = hasMore ? rows.results.slice(0, parseInt(limit)) : rows.results;

  // Group by action
  const byAction: Record<string, number> = {};
  for (const item of items) {
    byAction[item.action] = (byAction[item.action] || 0) + 1;
  }

  // Group by date
  const byDate: Record<string, number> = {};
  for (const item of items) {
    const date = item.timestamp.split("T")[0];
    byDate[date] = (byDate[date] || 0) + 1;
  }

  return c.json({
    items,
    summary: {
      total: items.length,
      byAction,
      byDate,
    },
  });
});

// Get audit stats
auditRoutes.get("/stats", async (c) => {
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (dateFrom) { where += " AND timestamp >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND timestamp <= ?"; params.push(dateTo + "T23:59:59.999Z"); }

  const total = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM studio_audit_logs ${where}`).bind(...params).first<{ count: number }>();

  const byAction = await c.env.DB.prepare(`SELECT action, COUNT(*) as count FROM studio_audit_logs ${where} GROUP BY action ORDER BY count DESC`).bind(...params).all();

  const byEntity = await c.env.DB.prepare(`SELECT entity_type, COUNT(*) as count FROM studio_audit_logs ${where} GROUP BY entity_type ORDER BY count DESC`).bind(...params).all();

  const byUser = await c.env.DB.prepare(
    `SELECT a.user_id, u.name, u.email, COUNT(*) as count
     FROM studio_audit_logs a
     LEFT JOIN studio_users u ON a.user_id = u.id
     ${where} GROUP BY a.user_id ORDER BY count DESC LIMIT 20`
  ).bind(...params).all();

  return c.json({
    total: total?.count || 0,
    byAction: byAction.results,
    byEntity: byEntity.results,
    topUsers: byUser.results,
  });
});

// Get recent activity feed
auditRoutes.get("/feed/recent", async (c) => {
  const { limit = 50 } = c.req.query();

  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.name as user_name, u.email as user_email
     FROM studio_audit_logs a
     LEFT JOIN studio_users u ON a.user_id = u.id
     ORDER BY a.timestamp DESC LIMIT ?`
  ).bind(parseInt(limit)).all();

  return c.json(rows.results);
});

export { auditRoutes };