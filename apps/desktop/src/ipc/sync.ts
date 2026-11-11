import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso, hashString, backoffDelay } from "@studio-erp/shared";
import type { SyncOperation, SyncPushRequest, SyncPushResult, SyncPullRequest, SyncPullResponse, SyncPullChange } from "@studio-erp/shared";

export function registerSyncHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // Get sync checkpoint
  createHandler("sync:checkpoint:get", async (event: IpcMainInvokeEvent, deviceId: string) => {
    requireAuth(event);
    const checkpoint = db.get<{ checkpoint: string; last_pulled_at: string; pending_count: number }>(
      "SELECT checkpoint, last_pulled_at, pending_count FROM studio_sync_checkpoints WHERE device_id = ?",
      [deviceId]
    );
    return checkpoint || { checkpoint: null, lastPulledAt: null, pendingCount: 0 };
  }, db);

  // Push operations to server
  createHandler("sync:push", async (event: IpcMainInvokeEvent, request: SyncPushRequest) => {
    requireAuth(event);
    const { deviceId, userId, lastCheckpoint, operations } = request;

    // Update or create checkpoint record
    const existingCheckpoint = db.get<{ id: string }>("SELECT id FROM studio_sync_checkpoints WHERE device_id = ?", [deviceId]);
    if (existingCheckpoint) {
      db.run("UPDATE studio_sync_checkpoints SET updated_at = ? WHERE device_id = ?", [nowIso(), deviceId]);
    } else {
      db.run(
        "INSERT INTO studio_sync_checkpoints (id, device_id, user_id, checkpoint, last_pulled_at, pending_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uuid(), deviceId, userId, lastCheckpoint || "", null, operations.length, nowIso(), nowIso()]
      );
    }

    const result: SyncPushResult = {
      accepted: [],
      rejected: [],
      conflicts: [],
      nextCheckpoint: nowIso(),
    };

    // Process each operation in a transaction
    const tx = db.transaction(() => {
      for (const op of operations) {
        try {
          const processed = processOperation(db, op, userId, deviceId);
          if (processed.conflict) {
            result.conflicts.push({
              opId: op.id,
              entity: op.entity,
              entityId: op.entityId,
              serverVersion: processed.serverVersion || 0,
              clientVersion: op.baseVersion || 0,
              serverData: processed.serverData || {},
            });
            // Record conflict
            recordConflict(db, deviceId, userId, op, processed.serverData || null);
          } else if (processed.rejected) {
            result.rejected.push({
              opId: op.id,
              reason: processed.reason || "Unknown error",
              code: processed.code || "REJECTED",
            });
            // Update outbox status
            db.run("UPDATE studio_sync_outbox SET status = 'rejected', rejection_reason = ? WHERE id = ?", [processed.reason, op.id]);
          } else {
            result.accepted.push({
              opId: op.id,
              entityId: op.entityId,
              newVersion: processed.newVersion || 1,
              newCheckpoint: nowIso(),
            });
            // Update outbox status
            db.run("UPDATE studio_sync_outbox SET status = 'accepted', accepted_at = ? WHERE id = ?", [nowIso(), op.id]);
          }
        } catch (error) {
          result.rejected.push({
            opId: op.id,
            reason: (error as Error).message,
            code: "ERROR",
          });
          logger.error("Sync operation failed", { opId: op.id, error: (error as Error).message });
        }
      }
    });

    tx();

    // Update checkpoint
    db.run("UPDATE studio_sync_checkpoints SET checkpoint = ?, pending_count = ?, updated_at = ? WHERE device_id = ?",
      [result.nextCheckpoint, result.rejected.length + result.conflicts.length, nowIso(), deviceId]);

    return result;
  }, db);

  // Pull changes from server
  createHandler("sync:pull", async (event: IpcMainInvokeEvent, request: SyncPullRequest) => {
    requireAuth(event);
    const { deviceId, userId, checkpoint, limit = 500 } = request;

    // Get changes since checkpoint
    let where = "WHERE timestamp > ?";
    const params: unknown[] = [checkpoint || "1970-01-01T00:00:00.000Z"];

    // Get all tables that support sync
    const tables = [
      "studio_users", "studio_devices", "studio_clients", "studio_client_contacts",
      "studio_employees", "studio_projects", "studio_events", "studio_event_segments",
      "studio_assignments", "studio_editing_tasks", "studio_quotations", "studio_invoices",
      "studio_payments", "studio_expenses", "studio_equipment", "studio_equipment_allocations",
      "studio_storage_locations", "studio_media_references", "studio_notifications",
      "studio_system_config"
    ];

    const changes: SyncPullChange[] = [];
    const tombstones: SyncPullChange[] = [];

    for (const table of tables) {
      // Get entity name from table name
      const entity = table.replace("studio_", "").replace(/_/g, "");

      const rows = db.all<any>(
        `SELECT * FROM ${table} WHERE updated_at > ? AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT ?`,
        [checkpoint || "1970-01-01T00:00:00.000Z", limit]
      );

      for (const row of rows) {
        // Determine version (use updated_at as pseudo-version for now)
        const version = parseInt(row.updated_at.replace(/[^0-9]/g, "").substring(0, 10)) || 1;

        changes.push({
          entity,
          entityId: row.id,
          version,
          operation: "upsert",
          data: sanitizeRowForSync(row, table),
          timestamp: row.updated_at,
        });
      }

      // Get tombstones (soft deletes)
      const deleted = db.all<any>(
        `SELECT id, deleted_at FROM ${table} WHERE deleted_at > ? ORDER BY deleted_at ASC LIMIT ?`,
        [checkpoint || "1970-01-01T00:00:00.000Z", limit]
      );

      for (const row of deleted) {
        tombstones.push({
          entity,
          entityId: row.id,
          version: 0,
          operation: "delete",
          data: null,
          timestamp: row.deleted_at!,
        });
      }
    }

    // Sort by timestamp
    changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    tombstones.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const hasMore = changes.length >= limit || tombstones.length >= limit;
    const nextCheckpoint = changes.length > 0
      ? changes[changes.length - 1].timestamp
      : (tombstones.length > 0 ? tombstones[tombstones.length - 1].timestamp : nowIso());

    // Update checkpoint
    db.run("UPDATE studio_sync_checkpoints SET last_pulled_at = ?, updated_at = ? WHERE device_id = ?",
      [nextCheckpoint, nowIso(), deviceId]);

    return {
      changes: changes.slice(0, limit),
      tombstones: tombstones.slice(0, limit),
      nextCheckpoint,
      hasMore,
    };
  }, db);

  // Get outbox status
  createHandler("sync:outbox:status", async (event: IpcMainInvokeEvent, deviceId: string) => {
    requireAuth(event);
    const pending = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_sync_outbox WHERE device_id = ? AND status = 'pending'", [deviceId]);
    const conflicts = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_sync_outbox WHERE device_id = ? AND status = 'conflict'", [deviceId]);
    const rejected = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_sync_outbox WHERE device_id = ? AND status = 'rejected'", [deviceId]);
    return { pending: pending?.count || 0, conflicts: conflicts?.count || 0, rejected: rejected?.count || 0 };
  }, db);

  // Retry failed operations
  createHandler("sync:outbox:retry", async (event: IpcMainInvokeEvent, deviceId: string) => {
    requireAuth(event);
    db.run("UPDATE studio_sync_outbox SET status = 'pending', attempts = 0 WHERE device_id = ? AND status IN ('rejected', 'conflict')", [deviceId]);
    return { success: true };
  }, db);

  // Queue operation for sync (local-first)
  createHandler("sync:queue", async (event: IpcMainInvokeEvent, operation: SyncOperation) => {
    requireAuth(event);
    // Check if operation already exists (idempotency)
    const existing = db.get("SELECT 1 FROM studio_sync_outbox WHERE id = ?", [operation.id]);
    if (existing) return { success: true, duplicate: true };

    db.run(
      `INSERT INTO studio_sync_outbox (id, device_id, user_id, operation, queued_at, attempts, status)
       VALUES (?, ?, ?, ?, ?, 0, 'pending')`,
      [operation.id, operation.clientId, operation.userId, JSON.stringify(operation), nowIso()]
    );

    // Update pending count
    db.run("UPDATE studio_sync_checkpoints SET pending_count = pending_count + 1, updated_at = ? WHERE device_id = ?", [nowIso(), operation.clientId]);

    return { success: true };
  }, db);

  // Resolve conflict
  createHandler("sync:conflict:resolve", async (event: IpcMainInvokeEvent, conflictId: string, resolution: "client" | "server" | "merged", mergedData?: Record<string, unknown>) => {
    requireAuth(event);
    const conflict = db.get<{ operations: string; server_snapshot?: string | null; entity: string; entity_id: string }>("SELECT * FROM studio_sync_conflicts WHERE id = ?", [conflictId]);
    if (!conflict) throw new Error("Conflict not found");

    const operations = JSON.parse(conflict.operations);
    const serverSnapshot = conflict.server_snapshot ? JSON.parse(conflict.server_snapshot) : null;

    let finalData: Record<string, unknown>;
    if (resolution === "client") {
      finalData = operations[operations.length - 1].data;
    } else if (resolution === "server") {
      finalData = serverSnapshot || {};
    } else {
      finalData = mergedData || {};
    }

    // Apply the resolved data
    const entity = conflict.entity;
    const entityId = conflict.entity_id;
    const tableName = `studio_${entity}s`.replace("ys", "ies").replace("ss", "s"); // crude pluralization

    // Update the entity
    const updates = Object.keys(finalData).map(k => `${k} = ?`).join(", ");
    const values = Object.values(finalData);
    db.run(`UPDATE ${tableName} SET ${updates}, updated_at = ? WHERE id = ?`, [...values, nowIso(), entityId]);

    // Mark conflict resolved
    db.run(
      "UPDATE studio_sync_conflicts SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?",
      [`resolved_${resolution}`, nowIso(), "current-user", conflictId]
    );

    return { success: true };
  }, db);

  // Get pending conflicts
  createHandler("sync:conflicts:list", async (event: IpcMainInvokeEvent, deviceId?: string) => {
    requireAuth(event);
    const auth = requireAuth(event);
    let where = "WHERE status = 'unresolved'";
    const params: unknown[] = [];
    if (deviceId) { where += " AND device_id = ?"; params.push(deviceId); }
    const conflicts = db.all(`SELECT * FROM studio_sync_conflicts ${where} ORDER BY created_at DESC`, params);
    for (const c of conflicts) {
      c.operations = JSON.parse(c.operations);
      c.serverSnapshot = c.server_snapshot ? JSON.parse(c.server_snapshot) : null;
    }
    return conflicts;
  }, db);

  // Full sync (initial pull)
  createHandler("sync:full", async (event: IpcMainInvokeEvent, deviceId: string, userId: string) => {
    requireAuth(event);
    // Initial full pull - get all data for this user
    const tables = [
      "studio_users", "studio_clients", "studio_client_contacts",
      "studio_employees", "studio_projects", "studio_events", "studio_event_segments",
      "studio_assignments", "studio_editing_tasks", "studio_quotations", "studio_invoices",
      "studio_payments", "studio_expenses", "studio_equipment", "studio_equipment_allocations",
      "studio_storage_locations", "studio_media_references", "studio_notifications",
      "studio_system_config"
    ];

    const data: Record<string, any[]> = {};
    for (const table of tables) {
      data[table] = db.all(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
    }

    // Create checkpoint
    const checkpoint = nowIso();
    db.run(
      `INSERT OR REPLACE INTO studio_sync_checkpoints (id, device_id, user_id, checkpoint, last_pulled_at, pending_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [uuid(), deviceId, userId, checkpoint, checkpoint, nowIso(), nowIso()]
    );

    return { data, checkpoint };
  }, db);
}

function processOperation(
  db: Database,
  op: SyncOperation,
  userId: string,
  deviceId: string
): { conflict?: boolean; rejected?: boolean; reason?: string; code?: string; newVersion?: number; serverVersion?: number; serverData?: Record<string, unknown> } {
  const { entity, entityId, data, baseVersion, type } = op;

  // Map entity to table
  const tableMap: Record<string, string> = {
    project: "studio_projects",
    event: "studio_events",
    segment: "studio_event_segments",
    assignment: "studio_assignments",
    client: "studio_clients",
    contact: "studio_client_contacts",
    employee: "studio_employees",
    editingTask: "studio_editing_tasks",
    quotation: "studio_quotations",
    invoice: "studio_invoices",
    payment: "studio_payments",
    expense: "studio_expenses",
    equipment: "studio_equipment",
    allocation: "studio_equipment_allocations",
    storageLocation: "studio_storage_locations",
    media: "studio_media_references",
    notification: "studio_notifications",
    config: "studio_system_config",
  };

  const table = tableMap[entity];
  if (!table) {
    return { rejected: true, reason: `Unknown entity: ${entity}`, code: "UNKNOWN_ENTITY" };
  }

  // Check if entity exists
  const existing = db.get(`SELECT * FROM ${table} WHERE id = ?`, [entityId]);

  if (type === "delete") {
    if (!existing) return { rejected: true, reason: "Entity not found", code: "NOT_FOUND" };
    // Soft delete
    db.run(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), entityId]);
    return { newVersion: (existing.version || 0) + 1 };
  }

  // Check version for conflict detection
  if (existing && baseVersion !== null && existing.version !== baseVersion) {
    return {
      conflict: true,
      serverVersion: existing.version,
      serverData: sanitizeRowForSync(existing, table),
    };
  }

  if (existing) {
    // Update
    const updates = Object.keys(data).filter(k => k !== "id" && k !== "created_at" && k !== "version").map(k => `${k} = ?`).join(", ");
    const values = Object.keys(data).filter(k => k !== "id" && k !== "created_at" && k !== "version").map(k => data[k]);
    db.run(`UPDATE ${table} SET ${updates}, version = version + 1, updated_at = ? WHERE id = ?`, [...values, nowIso(), entityId]);
    return { newVersion: (existing.version || 0) + 1 };
  } else {
    // Insert
    const columns = ["id", ...Object.keys(data).filter(k => k !== "version")];
    const placeholders = columns.map(() => "?").join(", ");
    const values = [entityId, ...Object.keys(data).filter(k => k !== "version").map(k => data[k])];
    db.run(`INSERT INTO ${table} (${columns.join(", ")}, version, created_at, updated_at) VALUES (${placeholders}, 1, ?, ?)`, [...values, nowIso(), nowIso()]);
    return { newVersion: 1 };
  }
}

function sanitizeRowForSync(row: any, table: string): Record<string, unknown> {
  const { deleted_at, ...rest } = row;
  // Parse JSON fields
  const jsonFields = ["permissions", "skills", "specializations", "compensation", "availability", "leaves",
    "quotation", "venue", "locations", "metadata", "travel", "time_window", "validation", "conflicts",
    "logistics", "items", "qc_checks", "comments", "revisions", "receipt_ref", "config",
    "maintenance", "damage_reports", "data", "previous", "next", "additional_info", "notes"];
  for (const field of jsonFields) {
    if (rest[field] && typeof rest[field] === "string") {
      try {
        rest[field] = JSON.parse(rest[field]);
      } catch { }
    }
  }
  return rest;
}

function recordConflict(db: Database, deviceId: string, userId: string, op: SyncOperation, serverData: Record<string, unknown> | null) {
  const conflictId = uuid();
  db.run(
    `INSERT INTO studio_sync_conflicts (id, device_id, user_id, entity, entity_id, operations, server_snapshot, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'unresolved', ?)`,
    [conflictId, deviceId, userId, op.entity, op.entityId, JSON.stringify([op]), serverData ? JSON.stringify(serverData) : null, nowIso()]
  );
}