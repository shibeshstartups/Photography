import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { Event, NewEvent, EventSegment, NewEventSegment } from "@studio-erp/database";

export function registerEventHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List events for a project
  createHandler("events:list", async (event: IpcMainInvokeEvent, projectId: string, filters?: {
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { cursor, limit = 50 } = filters || {};

    let where = "WHERE project_id = ? AND deleted_at IS NULL";
    const params: unknown[] = [projectId];

    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (event_date < ? OR (event_date = ? AND id < ?))";
      params.push(decoded.eventDate, decoded.eventDate, decoded.id);
    }

    const sql = `SELECT * FROM studio_events ${where} ORDER BY event_date ASC, start_time ASC, id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ eventDate: last.event_date, id: last.id })).toString("base64url");
    }

    // Add segments for each event
    for (const item of items) {
      item.segments = db.all<EventSegment>("SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL", [item.id]);
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single event with segments
  createHandler("events:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const evt = db.get<Event>("SELECT * FROM studio_events WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!evt) throw new Error("Event not found");

    const segments = db.all<EventSegment>("SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL", [id]);
    return { ...evt, segments };
  }, db);

  // Create event
  createHandler("events:create", async (event: IpcMainInvokeEvent, data: Omit<NewEvent, "id" | "createdAt" | "updatedAt" | "deletedAt">) => {
    requireAuth(event);
    const id = uuid();
    const eventId = await generateEventId(db, data.projectId);

    db.run(
      `INSERT INTO studio_events (id, project_id, event_id, event_type, event_date, start_time, end_time, venue, city, location, travel, event_manager_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.projectId, eventId, data.eventType, data.eventDate, data.startTime, data.endTime,
        data.venue || null, data.city || null, data.location || null, data.travel || null,
        data.eventManagerId || null, data.metadata || null, nowIso(), nowIso()
      ]
    );

    const evt = db.get<Event>("SELECT * FROM studio_events WHERE id = ?", [id]);
    if (!evt) throw new Error("Failed to create event");

    return evt;
  }, db);

  // Update event
  createHandler("events:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewEvent, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<Event>("SELECT * FROM studio_events WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Event not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["eventType", "eventDate", "startTime", "endTime", "venue", "city", "location", "travel", "eventManagerId", "metadata"];

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

    db.run(`UPDATE studio_events SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Event>("SELECT * FROM studio_events WHERE id = ?", [id]);
  }, db);

  // Delete event (soft)
  createHandler("events:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    // Check for assignments
    const assignments = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_assignments WHERE event_id = ? AND deleted_at IS NULL", [id]);
    if (assignments && assignments.count > 0) {
      throw new Error("Cannot delete event with active assignments");
    }

    db.run("UPDATE studio_events SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    db.run("UPDATE studio_event_segments SET deleted_at = ?, updated_at = ? WHERE event_id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // Segments for an event
  createHandler("events:segments:list", async (event: IpcMainInvokeEvent, eventId: string) => {
    requireAuth(event);
    return db.all<EventSegment>("SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL ORDER BY service ASC", [eventId]);
  }, db);

  createHandler("events:segments:create", async (event: IpcMainInvokeEvent, data: Omit<NewEventSegment, "id" | "createdAt" | "updatedAt">) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_event_segments (id, event_id, service, required_count, assigned_count, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, data.eventId, data.service, data.requiredCount, data.metadata || null, nowIso(), nowIso()]
    );
    return db.get<EventSegment>("SELECT * FROM studio_event_segments WHERE id = ?", [id]);
  }, db);

  createHandler("events:segments:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<EventSegment, "id" | "eventId" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<EventSegment>("SELECT * FROM studio_event_segments WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Segment not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["service", "requiredCount", "metadata"];

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

    db.run(`UPDATE studio_event_segments SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<EventSegment>("SELECT * FROM studio_event_segments WHERE id = ?", [id]);
  }, db);

  createHandler("events:segments:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    // Check for assignments
    const assignments = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_assignments WHERE segment_id = ? AND deleted_at IS NULL", [id]);
    if (assignments && assignments.count > 0) {
      throw new Error("Cannot delete segment with active assignments");
    }

    db.run("UPDATE studio_event_segments SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);
}

async function generateEventId(db: Database, projectId: string): Promise<string> {
  // Get project for project ID prefix
  const project = db.get<{ projectId: string }>("SELECT project_id FROM studio_projects WHERE id = ?", [projectId]);
  if (!project) throw new Error("Project not found");

  const last = db.get<{ eventId: string }>(
    "SELECT event_id FROM studio_events WHERE project_id = ? AND deleted_at IS NULL ORDER BY event_id DESC LIMIT 1",
    [projectId]
  );

  let num = 1;
  if (last) {
    const match = last.eventId.match(/EVT-(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `${project.projectId}-EVT-${String(num).padStart(3, "0")}`;
}