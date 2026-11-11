import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const syncRoutes = new Hono<{ Bindings: Env }>();

const outboxSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  operation: z.enum(["create", "update", "delete"]),
  payload: z.any(),
  idempotencyKey: z.string().max(100).optional(),
  version: z.number().int().positive().default(1),
});

const checkpointSchema = z.object({
  deviceId: z.string().uuid(),
  entityType: z.string().min(1).max(100),
  checkpoint: z.string(), // ISO timestamp or version vector
});

const conflictSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  localVersion: z.any(),
  serverVersion: z.any(),
  localData: z.any(),
  serverData: z.any(),
  resolution: z.enum(["server_wins", "local_wins", "merge", "manual"]).optional(),
  resolvedData: z.any().optional(),
});

// Get sync status for device
syncRoutes.get("/status/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId");

  const device = await c.env.DB.prepare("SELECT * FROM studio_devices WHERE id = ? AND deleted_at IS NULL").bind(deviceId).first();
  if (!device) return c.json({ error: "Device not found" }, 404);

  // Get checkpoints for this device
  const checkpoints = await c.env.DB.prepare(
    "SELECT * FROM studio_sync_checkpoints WHERE device_id = ?"
  ).bind(deviceId).all();

  // Get pending outbox count
  const pending = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM studio_sync_outbox WHERE device_id = ? AND processed_at IS NULL"
  ).bind(deviceId).first<{ count: number }>();

  // Get unresolved conflicts
  const conflicts = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM studio_sync_conflicts WHERE device_id = ? AND resolved_at IS NULL"
  ).bind(deviceId).first<{ count: number }>();

  return c.json({
    deviceId,
    deviceName: device.name,
    lastSeen: device.last_seen_at,
    checkpoints: checkpoints.results.reduce((acc: any, cp: any) => {
      acc[cp.entity_type] = cp.checkpoint;
      return acc;
    }, {}),
    pendingOutbox: pending?.count || 0,
    unresolvedConflicts: conflicts?.count || 0,
  });
});

// Push: client sends local changes
syncRoutes.post(
  "/push",
  zValidator(
    "json",
    z.object({
      deviceId: z.string().uuid(),
      changes: z.array(outboxSchema),
      clientCheckpoints: z.record(z.string()).optional(),
    })
  ),
  async (c) => {
    const { deviceId, changes, clientCheckpoints } = c.req.valid("json");
    const user = c.get("user");

    const device = await c.env.DB.prepare("SELECT * FROM studio_devices WHERE id = ? AND user_id = ? AND revoked = 0 AND deleted_at IS NULL").bind(deviceId, user.id).first();
    if (!device) return c.json({ error: "Device not registered or revoked" }, 401);

    const results: any[] = [];
    const conflicts: any[] = [];

    for (const change of changes) {
      const id = createId();
      const idempotencyKey = change.idempotencyKey || `${deviceId}:${change.entityType}:${change.entityId}:${change.operation}:${change.version}`;

      // Check idempotency
      const existing = await c.env.DB.prepare(
        "SELECT id FROM studio_sync_outbox WHERE idempotency_key = ?"
      ).bind(idempotencyKey).first();

      if (existing) {
        results.push({ idempotencyKey, status: "duplicate", outboxId: existing.id });
        continue;
      }

      // Check for conflicts based on version
      let hasConflict = false;
      let serverData = null;

      if (change.operation === "update" || change.operation === "delete") {
        const tableName = getTableName(change.entityType);
        if (tableName) {
          serverData = await c.env.DB.prepare(
            `SELECT *, version FROM ${tableName} WHERE id = ? AND deleted_at IS NULL`
          ).bind(change.entityId).first();

          if (serverData && serverData.version !== change.version) {
            hasConflict = true;
            // Record conflict
            const conflictId = createId();
            await c.env.DB.prepare(
              `INSERT INTO studio_sync_conflicts (id, device_id, entity_type, entity_id, local_version, server_version, local_data, server_data, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              conflictId, deviceId, change.entityType, change.entityId,
              JSON.stringify(change.version), JSON.stringify(serverData.version),
              JSON.stringify(change.payload), JSON.stringify(serverData),
              new Date().toISOString()
            ).run();

            conflicts.push({
              entityType: change.entityType,
              entityId: change.entityId,
              localVersion: change.version,
              serverVersion: serverData.version,
            });
          }
        }
      }

      // Add to outbox
      await c.env.DB.prepare(
        `INSERT INTO studio_sync_outbox (id, device_id, entity_type, entity_id, operation, payload, version, idempotency_key, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, deviceId, change.entityType, change.entityId, change.operation,
        JSON.stringify(change.payload), change.version, idempotencyKey,
        hasConflict ? "conflict" : "pending", new Date().toISOString()
      ).run();

      results.push({ idempotencyKey, status: hasConflict ? "conflict" : "pending", outboxId: id });
    }

    // Update device last seen
    await c.env.DB.prepare("UPDATE studio_devices SET last_seen_at = ? WHERE id = ?").bind(new Date().toISOString(), deviceId).run();

    return c.json({ results, conflicts, processed: results.length });
  }
);

// Pull: client fetches server changes since checkpoint
syncRoutes.post(
  "/pull",
  zValidator(
    "json",
    z.object({
      deviceId: z.string().uuid(),
      checkpoints: z.record(z.string()), // entityType -> checkpoint
      limit: z.number().int().positive().max(1000).default(500),
    })
  ),
  async (c) => {
    const { deviceId, checkpoints, limit } = c.req.valid("json");
    const user = c.get("user");

    const device = await c.env.DB.prepare("SELECT * FROM studio_devices WHERE id = ? AND user_id = ? AND revoked = 0 AND deleted_at IS NULL").bind(deviceId, user.id).first();
    if (!device) return c.json({ error: "Device not registered or revoked" }, 401);

    // Get user permissions to filter data
    const permissions = user.permissions || [];

    const changes: any[] = [];
    const newCheckpoints: Record<string, string> = {};

    // For each entity type, fetch changes since checkpoint
    const entityTypes = [
      { type: "users", table: "studio_users", perm: "admin" },
      { type: "devices", table: "studio_devices", perm: "device:manage" },
      { type: "clients", table: "studio_clients", perm: "clients:read" },
      { type: "client_contacts", table: "studio_client_contacts", perm: "clients:read" },
      { type: "employees", table: "studio_employees", perm: "crew:read" },
      { type: "employee_availability", table: "studio_employee_availability", perm: "crew:read" },
      { type: "projects", table: "studio_projects", perm: "projects:read" },
      { type: "events", table: "studio_events", perm: "events:read" },
      { type: "event_segments", table: "studio_event_segments", perm: "events:read" },
      { type: "assignments", table: "studio_assignments", perm: "crew:assign" },
      { type: "attendance", table: "studio_attendance", perm: "attendance:read" },
      { type: "editing_tasks", table: "studio_editing_tasks", perm: "editing:read" },
      { type: "editing_stages", table: "studio_editing_stages", perm: "editing:read" },
      { type: "editing_assets", table: "studio_editing_assets", perm: "editing:read" },
      { type: "quotations", table: "studio_quotations", perm: "finance:read" },
      { type: "invoices", table: "studio_invoices", perm: "finance:read" },
      { type: "payments", table: "studio_payments", perm: "finance:read" },
      { type: "expenses", table: "studio_expenses", perm: "finance:read" },
      { type: "equipment", table: "studio_equipment", perm: "equipment:read" },
      { type: "equipment_allocations", table: "studio_equipment_allocations", perm: "equipment:read" },
      { type: "equipment_maintenance", table: "studio_equipment_maintenance", perm: "equipment:read" },
      { type: "media", table: "studio_media", perm: "clients:read" },
      { type: "albums", table: "studio_albums", perm: "clients:read" },
      { type: "notifications", table: "studio_notifications", perm: "" },
      { type: "audit_logs", table: "studio_audit_logs", perm: "audit:read" },
      { type: "config", table: "studio_config", perm: "admin" },
      { type: "sync_checkpoints", table: "studio_sync_checkpoints", perm: "" },
      { type: "sync_outbox", table: "studio_sync_outbox", perm: "" },
      { type: "sync_conflicts", table: "studio_sync_conflicts", perm: "" },
    ];

    let totalFetched = 0;

    for (const entity of entityTypes) {
      if (entity.perm && !permissions.includes(entity.perm) && !permissions.includes("admin")) {
        continue;
      }

      const checkpoint = checkpoints[entity.type] || "1970-01-01T00:00:00.000Z";

      // Use updated_at for incremental sync
      const rows = await c.env.DB.prepare(
        `SELECT * FROM ${entity.table} WHERE updated_at > ? AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT ?`
      ).bind(checkpoint, limit - totalFetched).all();

      for (const row of rows.results) {
        changes.push({
          entityType: entity.type,
          entityId: row.id,
          operation: row.deleted_at ? "delete" : "update",
          payload: row,
          version: row.version || 1,
        });
        totalFetched++;
      }

      // Update checkpoint to latest updated_at in results
      if (rows.results.length > 0) {
        const last = rows.results[rows.results.length - 1];
        newCheckpoints[entity.type] = last.updated_at;
      } else if (checkpoints[entity.type]) {
        newCheckpoints[entity.type] = checkpoints[entity.type];
      }

      if (totalFetched >= limit) break;
    }

    // Store checkpoints
    for (const [entityType, checkpoint] of Object.entries(newCheckpoints)) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO studio_sync_checkpoints (device_id, entity_type, checkpoint, updated_at)
         VALUES (?, ?, ?, ?)`
      ).bind(deviceId, entityType, checkpoint, new Date().toISOString()).run();
    }

    // Update device last seen
    await c.env.DB.prepare("UPDATE studio_devices SET last_seen_at = ? WHERE id = ?").bind(new Date().toISOString(), deviceId).run();

    return c.json({ changes, checkpoints: newCheckpoints, hasMore: totalFetched >= limit });
  }
);

// Resolve conflict
syncRoutes.post(
  "/conflicts/:conflictId/resolve",
  zValidator("json", conflictSchema),
  async (c) => {
    const conflictId = c.req.param("conflictId");
    const data = c.req.valid("json");
    const user = c.get("user");

    const conflict = await c.env.DB.prepare("SELECT * FROM studio_sync_conflicts WHERE id = ? AND resolved_at IS NULL").bind(conflictId).first();
    if (!conflict) return c.json({ error: "Conflict not found or already resolved" }, 404);

    if (conflict.device_id !== user.deviceId && !user.permissions.includes("admin")) {
      return c.json({ error: "Unauthorized to resolve this conflict" }, 403);
    }

    let resolvedData = data.resolvedData;
    if (data.resolution === "server_wins") resolvedData = conflict.server_data;
    else if (data.resolution === "local_wins") resolvedData = conflict.local_data;

    // Apply resolution
    const tableName = getTableName(conflict.entity_type);
    if (tableName && resolvedData) {
      const updates: string[] = [];
      const params: unknown[] = [];
      for (const [key, value] of Object.entries(resolvedData)) {
        if (key !== "id" && key !== "created_at") {
          updates.push(`${key} = ?`);
          params.push(typeof value === "object" ? JSON.stringify(value) : value);
        }
      }
      updates.push("updated_at = ?");
      updates.push("version = version + 1");
      params.push(new Date().toISOString());
      params.push(conflict.entity_id);

      await c.env.DB.prepare(`UPDATE ${tableName} SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
    }

    // Mark conflict resolved
    await c.env.DB.prepare(
      "UPDATE studio_sync_conflicts SET resolution = ?, resolved_data = ?, resolved_by = ?, resolved_at = ? WHERE id = ?"
    ).bind(data.resolution, JSON.stringify(resolvedData), user.id, new Date().toISOString(), conflictId).run();

    // Update outbox status
    await c.env.DB.prepare(
      "UPDATE studio_sync_outbox SET status = 'resolved', processed_at = ? WHERE entity_type = ? AND entity_id = ? AND device_id = ?"
    ).bind(new Date().toISOString(), conflict.entity_type, conflict.entity_id, conflict.device_id).run();

    return c.json({ success: true, resolution: data.resolution });
  }
);

// Get unresolved conflicts
syncRoutes.get("/conflicts", async (c) => {
  const user = c.get("user");
  const { deviceId } = c.req.query();

  let where = "WHERE resolved_at IS NULL";
  const params: unknown[] = [];

  if (deviceId) {
    const device = await c.env.DB.prepare("SELECT id FROM studio_devices WHERE id = ? AND user_id = ?").bind(deviceId, user.id).first();
    if (!device && !user.permissions.includes("admin")) {
      return c.json({ error: "Unauthorized" }, 403);
    }
    where += " AND device_id = ?";
    params.push(deviceId);
  } else if (!user.permissions.includes("admin")) {
    where += " AND device_id = ?";
    params.push(user.deviceId);
  }

  const conflicts = await c.env.DB.prepare(
    `SELECT c.*, d.name as device_name FROM studio_sync_conflicts c
     LEFT JOIN studio_devices d ON c.device_id = d.id
     ${where} ORDER BY c.created_at DESC`
  ).bind(...params).all();

  return c.json(conflicts.results);
});

// Process outbox (server-side)
syncRoutes.post("/process-outbox", async (c) => {
  const user = c.get("user");
  if (!user.permissions.includes("admin")) {
    return c.json({ error: "Admin only" }, 403);
  }

  const { deviceId, limit = 100 } = await c.req.json<{ deviceId?: string; limit?: number }>();

  let where = "WHERE status = 'pending' AND processed_at IS NULL";
  const params: unknown[] = [];

  if (deviceId) {
    where += " AND device_id = ?";
    params.push(deviceId);
  }

  const outbox = await c.env.DB.prepare(
    `SELECT * FROM studio_sync_outbox ${where} ORDER BY created_at ASC LIMIT ?`
  ).bind(...params, limit).all();

  const results = [];

  for (const item of outbox.results) {
    const tableName = getTableName(item.entity_type);
    if (!tableName) {
      await c.env.DB.prepare("UPDATE studio_sync_outbox SET status = 'failed', processed_at = ? WHERE id = ?").bind(new Date().toISOString(), item.id).run();
      results.push({ id: item.id, status: "failed", reason: "Unknown entity type" });
      continue;
    }

    try {
      if (item.operation === "create") {
        // Check if already exists
        const existing = await c.env.DB.prepare(`SELECT id FROM ${tableName} WHERE id = ?`).bind(item.entity_id).first();
        if (!existing) {
          const payload = JSON.parse(item.payload);
          const cols = Object.keys(payload).filter(k => k !== "id");
          const vals = cols.map(k => payload[k]);
          await c.env.DB.prepare(
            `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
          ).bind(...vals).run();
        }
      } else if (item.operation === "update") {
        const payload = JSON.parse(item.payload);
        const updates: string[] = [];
        const params: unknown[] = [];
        for (const [key, value] of Object.entries(payload)) {
          if (key !== "id" && key !== "created_at") {
            updates.push(`${key} = ?`);
            params.push(typeof value === "object" ? JSON.stringify(value) : value);
          }
        }
        updates.push("updated_at = ?");
        updates.push("version = version + 1");
        params.push(new Date().toISOString());
        params.push(item.entity_id);
        await c.env.DB.prepare(`UPDATE ${tableName} SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
      } else if (item.operation === "delete") {
        await c.env.DB.prepare(`UPDATE ${tableName} SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), new Date().toISOString(), item.entity_id).run();
      }

      await c.env.DB.prepare("UPDATE studio_sync_outbox SET status = 'processed', processed_at = ? WHERE id = ?").bind(new Date().toISOString(), item.id).run();
      results.push({ id: item.id, status: "processed" });
    } catch (e) {
      await c.env.DB.prepare("UPDATE studio_sync_outbox SET status = 'failed', processed_at = ? WHERE id = ?").bind(new Date().toISOString(), item.id).run();
      results.push({ id: item.id, status: "failed", reason: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return c.json({ processed: results.length, results });
});

function getTableName(entityType: string): string | null {
  const map: Record<string, string> = {
    users: "studio_users",
    devices: "studio_devices",
    clients: "studio_clients",
    client_contacts: "studio_client_contacts",
    employees: "studio_employees",
    employee_availability: "studio_employee_availability",
    projects: "studio_projects",
    events: "studio_events",
    event_segments: "studio_event_segments",
    assignments: "studio_assignments",
    attendance: "studio_attendance",
    editing_tasks: "studio_editing_tasks",
    editing_stages: "studio_editing_stages",
    editing_assets: "studio_editing_assets",
    quotations: "studio_quotations",
    invoices: "studio_invoices",
    payments: "studio_payments",
    expenses: "studio_expenses",
    equipment: "studio_equipment",
    equipment_allocations: "studio_equipment_allocations",
    equipment_maintenance: "studio_equipment_maintenance",
    media: "studio_media",
    albums: "studio_albums",
    notifications: "studio_notifications",
    audit_logs: "studio_audit_logs",
    config: "studio_config",
    sync_checkpoints: "studio_sync_checkpoints",
    sync_outbox: "studio_sync_outbox",
    sync_conflicts: "studio_sync_conflicts",
  };
  return map[entityType] || null;
}

export { syncRoutes };