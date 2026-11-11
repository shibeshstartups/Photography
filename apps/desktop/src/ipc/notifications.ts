import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { Notification } from "@studio-erp/database";

export function registerNotificationHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List notifications for current user
  createHandler("notifications:list", async (event: IpcMainInvokeEvent, filters?: {
    unreadOnly?: boolean;
    type?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const auth = requireAuth(event);
    const { unreadOnly, type, cursor, limit = 50 } = filters || {};

    let where = "WHERE user_id = ?";
    const params: unknown[] = [auth.userId];

    if (unreadOnly) { where += " AND read_at IS NULL"; }
    if (type) { where += " AND type = ?"; params.push(type); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url");
    }

    for (const item of items) {
      item.data = item.data ? JSON.parse(item.data) : null;
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get unread count
  createHandler("notifications:unread-count", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const auth = requireAuth(event);
    const count = db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM studio_notifications WHERE user_id = ? AND read_at IS NULL AND deleted_at IS NULL",
      [auth.userId]
    );
    return { count: count?.count || 0 };
  }, db);

  // Mark as read
  createHandler("notifications:mark-read", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_notifications SET read_at = ? WHERE id = ?", [nowIso(), id]);
    return { success: true };
  }, db);

  // Mark all as read
  createHandler("notifications:mark-all-read", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const auth = requireAuth(event);
    db.run("UPDATE studio_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [nowIso(), auth.userId]);
    return { success: true };
  }, db);

  // Create notification (internal use)
  createHandler("notifications:create", async (event: IpcMainInvokeEvent, data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    severity?: "info" | "warning" | "error" | "success";
  }) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_notifications (id, user_id, type, title, body, data, severity, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, data.userId, data.type, data.title, data.body || null, data.data ? JSON.stringify(data.data) : null, data.severity || "info", nowIso()]
    );
    return db.get<Notification>("SELECT * FROM studio_notifications WHERE id = ?", [id]);
  }, db);

  // Delete notification
  createHandler("notifications:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_notifications SET deleted_at = ? WHERE id = ?", [nowIso(), id]);
    return { success: true };
  }, db);
}