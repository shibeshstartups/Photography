import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { MediaReference, StorageLocation, NewMediaReference, NewStorageLocation } from "@studio-erp/database";

export function registerMediaHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List media references
  createHandler("media:list", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    eventId?: string;
    storageLocationId?: string;
    fileType?: string;
    accessPermission?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { projectId, eventId, storageLocationId, fileType, accessPermission, cursor, limit = 100 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (eventId) { where += " AND event_id = ?"; params.push(eventId); }
    if (storageLocationId) { where += " AND storage_location_id = ?"; params.push(storageLocationId); }
    if (fileType) { where += " AND file_type = ?"; params.push(fileType); }
    if (accessPermission) { where += " AND access_permission = ?"; params.push(accessPermission); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (imported_at < ? OR (imported_at = ? AND id < ?))";
      params.push(decoded.importedAt, decoded.importedAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_media_references ${where} ORDER BY imported_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ importedAt: last.imported_at, id: last.id })).toString("base64url");
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single media reference
  createHandler("media:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const media = db.get<MediaReference>("SELECT * FROM studio_media_references WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!media) throw new Error("Media reference not found");
    return media;
  }, db);

  // Create media reference
  createHandler("media:create", async (event: IpcMainInvokeEvent, data: Omit<NewMediaReference, "id" | "createdAt" | "updatedAt">) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_media_references (id, project_id, event_id, storage_location_id, relative_path, filename, file_type, size, checksum, imported_at, access_permission, availability_status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id, data.projectId || null, data.eventId || null, data.storageLocationId || null,
        data.relativePath, data.filename, data.fileType, data.size || null,
        data.checksum || null, data.importedAt || nowIso(),
        data.accessPermission || "private", data.availabilityStatus || "available",
        nowIso(), nowIso()
      ]
    );
    return db.get<MediaReference>("SELECT * FROM studio_media_references WHERE id = ?", [id]);
  }, db);

  // Update media reference
  createHandler("media:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<MediaReference, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<MediaReference>("SELECT * FROM studio_media_references WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Media reference not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "eventId", "storageLocationId", "relativePath", "filename", "fileType", "size", "checksum", "accessPermission", "availabilityStatus"];

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

    db.run(`UPDATE studio_media_references SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<MediaReference>("SELECT * FROM studio_media_references WHERE id = ?", [id]);
  }, db);

  // Delete media reference (soft)
  createHandler("media:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_media_references SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // ===== STORAGE LOCATIONS =====
  createHandler("media:storage:list", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    return db.all<StorageLocation>("SELECT * FROM studio_storage_locations WHERE deleted_at IS NULL ORDER BY name ASC");
  }, db);

  createHandler("media:storage:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const location = db.get<StorageLocation>("SELECT * FROM studio_storage_locations WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!location) throw new Error("Storage location not found");
    location.config = location.config ? JSON.parse(location.config) : null;
    return location;
  }, db);

  createHandler("media:storage:create", async (event: IpcMainInvokeEvent, data: Omit<NewStorageLocation, "id" | "createdAt" | "updatedAt">) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_storage_locations (id, name, type, base_path, config, free_bytes, total_bytes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.type, data.basePath, data.config ? JSON.stringify(data.config) : null, data.freeBytes || null, data.totalBytes || null, data.status || "online", nowIso(), nowIso()]
    );
    return db.get<StorageLocation>("SELECT * FROM studio_storage_locations WHERE id = ?", [id]);
  }, db);

  createHandler("media:storage:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<StorageLocation, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["name", "type", "basePath", "config", "freeBytes", "totalBytes", "status"];
    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        params.push(typeof data[field as keyof typeof data] === "object" ? JSON.stringify(data[field as keyof typeof data]) : data[field as keyof typeof data]);
      }
    }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    db.run(`UPDATE studio_storage_locations SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<StorageLocation>("SELECT * FROM studio_storage_locations WHERE id = ?", [id]);
  }, db);

  createHandler("media:storage:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const refs = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_media_references WHERE storage_location_id = ? AND deleted_at IS NULL", [id]);
    if (refs && refs.count > 0) {
      throw new Error("Cannot delete storage location with active media references");
    }
    db.run("UPDATE studio_storage_locations SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);
}