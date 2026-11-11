import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { AuditLog } from "@studio-erp/database";

export function registerAuditHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List audit logs with filters
  createHandler("audit:list", async (event: IpcMainInvokeEvent, filters?: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    projectId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const auth = requireAuth(event);
    // Check admin permission
    const user = db.get<{ permissions: string }>("SELECT permissions FROM studio_users WHERE id = ?", [auth.userId]);
    if (!user || !JSON.parse(user.permissions).includes("audit:read")) {
      throw new Error("Insufficient permissions");
    }

    const { userId, entityType, entityId, projectId, action, dateFrom, dateTo, cursor, limit = 100 } = filters || {};

    let where = "WHERE 1=1";
    const params: unknown[] = [];

    if (userId) { where += " AND user_id = ?"; params.push(userId); }
    if (entityType) { where += " AND entity_type = ?"; params.push(entityType); }
    if (entityId) { where += " AND entity_id = ?"; params.push(entityId); }
    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (action) { where += " AND action = ?"; params.push(action); }
    if (dateFrom) { where += " AND timestamp >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND timestamp <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (timestamp < ? OR (timestamp = ? AND id < ?))";
      params.push(decoded.timestamp, decoded.timestamp, decoded.id);
    }

    const sql = `SELECT * FROM studio_audit_log ${where} ORDER BY timestamp DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ timestamp: last.timestamp, id: last.id })).toString("base64url");
    }

    for (const item of items) {
      item.previous = item.previous ? JSON.parse(item.previous) : null;
      item.next = item.next ? JSON.parse(item.next) : null;
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single audit log
  createHandler("audit:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const auth = requireAuth(event);
    const user = db.get<{ permissions: string }>("SELECT permissions FROM studio_users WHERE id = ?", [auth.userId]);
    if (!user || !JSON.parse(user.permissions).includes("audit:read")) {
      throw new Error("Insufficient permissions");
    }

    const log = db.get<AuditLog>("SELECT * FROM studio_audit_log WHERE id = ?", [id]);
    if (!log) throw new Error("Audit log not found");
    log.previous = log.previous ? JSON.parse(log.previous) : null;
    log.next = log.next ? JSON.parse(log.next) : null;
    return log;
  }, db);

  // Write audit log entry (internal use)
  createHandler("audit:write", async (event: IpcMainInvokeEvent, data: {
    userId: string;
    deviceId?: string;
    action: string;
    entityType: string;
    entityId: string;
    previous?: Record<string, unknown> | null;
    next?: Record<string, unknown> | null;
    projectId?: string;
    sessionId?: string;
    operationId?: string;
    ip?: string;
  }) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_audit_log (id, user_id, device_id, timestamp, action, entity_type, entity_id, previous, next, project_id, session_id, operation_id, ip, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id, data.userId, data.deviceId || null, nowIso(), data.action, data.entityType, data.entityId,
        data.previous ? JSON.stringify(data.previous) : null, data.next ? JSON.stringify(data.next) : null,
        data.projectId || null, data.sessionId || null, data.operationId || null, data.ip || null, nowIso()
      ]
    );
    return { success: true };
  }, db);

  // Get audit trail for an entity
  createHandler("audit:entity-trail", async (event: IpcMainInvokeEvent, entityType: string, entityId: string) => {
    requireAuth(event);
    const auth = requireAuth(event);
    const user = db.get<{ permissions: string }>("SELECT permissions FROM studio_users WHERE id = ?", [auth.userId]);
    if (!user || !JSON.parse(user.permissions).includes("audit:read")) {
      throw new Error("Insufficient permissions");
    }

    const logs = db.all<AuditLog>(
      "SELECT * FROM studio_audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp ASC",
      [entityType, entityId]
    );

    for (const log of logs) {
      log.previous = log.previous ? JSON.parse(log.previous) : null;
      log.next = log.next ? JSON.parse(log.next) : null;
    }

    return logs;
  }, db);
}