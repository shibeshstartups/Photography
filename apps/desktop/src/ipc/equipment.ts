import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { Equipment, EquipmentAllocation, NewEquipment } from "@studio-erp/database";

export function registerEquipmentHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List equipment
  createHandler("equipment:list", async (event: IpcMainInvokeEvent, filters?: {
    category?: string;
    availability?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { category, availability, search, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (category) { where += " AND category = ?"; params.push(category); }
    if (availability) { where += " AND availability = ?"; params.push(availability); }
    if (search) {
      where += " AND (name LIKE ? OR equipment_id LIKE ? OR serial_number LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (name < ? OR (name = ? AND id < ?))";
      params.push(decoded.name, decoded.name, decoded.id);
    }

    const sql = `SELECT * FROM studio_equipment ${where} ORDER BY name ASC, id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ name: last.name, id: last.id })).toString("base64url");
    }

    for (const item of items) {
      item.metadata = item.metadata ? JSON.parse(item.metadata) : null;
      item.maintenance = item.maintenance ? JSON.parse(item.maintenance) : [];
      item.damageReports = item.damage_reports ? JSON.parse(item.damage_reports) : [];
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single equipment
  createHandler("equipment:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const equipment = db.get<Equipment>("SELECT * FROM studio_equipment WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!equipment) throw new Error("Equipment not found");
    equipment.metadata = equipment.metadata ? JSON.parse(equipment.metadata) : null;
    equipment.maintenance = equipment.maintenance ? JSON.parse(equipment.maintenance) : [];
    equipment.damageReports = equipment.damage_reports ? JSON.parse(equipment.damage_reports) : [];
    return equipment;
  }, db);

  // Create equipment
  createHandler("equipment:create", async (event: IpcMainInvokeEvent, data: Omit<NewEquipment, "id" | "createdAt" | "updatedAt">) => {
    requireAuth(event);
    const id = uuid();
    const equipmentId = await generateEquipmentId(db);

    db.run(
      `INSERT INTO studio_equipment (id, equipment_id, name, category, serial_number, owner, condition, availability, current_holder, metadata, maintenance, damage_reports, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, equipmentId, data.name, data.category, data.serialNumber || null,
        data.owner || null, data.condition || "good", data.availability || "available",
        data.currentHolder || null, data.metadata ? JSON.stringify(data.metadata) : null,
        data.maintenance ? JSON.stringify(data.maintenance) : "[]",
        data.damageReports ? JSON.stringify(data.damageReports) : "[]",
        nowIso(), nowIso()
      ]
    );

    return db.get<Equipment>("SELECT * FROM studio_equipment WHERE id = ?", [id]);
  }, db);

  // Update equipment
  createHandler("equipment:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewEquipment, "id" | "createdAt" | "updatedAt">>) => {
    requireAuth(event);
    const existing = db.get<Equipment>("SELECT * FROM studio_equipment WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Equipment not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["name", "category", "serialNumber", "owner", "condition", "availability", "currentHolder", "metadata", "maintenance", "damageReports"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);

    db.run(`UPDATE studio_equipment SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Equipment>("SELECT * FROM studio_equipment WHERE id = ?", [id]);
  }, db);

  // Delete equipment (soft)
  createHandler("equipment:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const allocations = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_equipment_allocations WHERE equipment_id = ? AND checked_in_at IS NULL", [id]);
    if (allocations && allocations.count > 0) {
      throw new Error("Cannot delete equipment that is currently checked out");
    }
    db.run("UPDATE studio_equipment SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // Check out equipment
  createHandler("equipment:check-out", async (event: IpcMainInvokeEvent, data: {
    equipmentId: string;
    projectId?: string;
    eventId?: string;
    assignedTo: string;
    checkedOutAt: string;
    conditionOut: string;
    notes?: string;
  }) => {
    requireAuth(event);
    const equipment = db.get<Equipment>("SELECT * FROM studio_equipment WHERE id = ? AND deleted_at IS NULL", [data.equipmentId]);
    if (!equipment) throw new Error("Equipment not found");
    if (equipment.availability !== "available") {
      throw new Error(`Equipment is not available (current: ${equipment.availability})`);
    }

    const id = uuid();
    db.run(
      `INSERT INTO studio_equipment_allocations (id, equipment_id, project_id, event_id, assigned_to, checked_out_at, condition_out, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.equipmentId, data.projectId || null, data.eventId || null, data.assignedTo, data.checkedOutAt, data.conditionOut, data.notes || null, nowIso(), nowIso()]
    );

    db.run("UPDATE studio_equipment SET availability = 'in_use', current_holder = ?, updated_at = ? WHERE id = ?", [data.assignedTo, nowIso(), data.equipmentId]);

    return db.get<EquipmentAllocation>("SELECT * FROM studio_equipment_allocations WHERE id = ?", [id]);
  }, db);

  // Check in equipment
  createHandler("equipment:check-in", async (event: IpcMainInvokeEvent, data: {
    allocationId: string;
    checkedInAt: string;
    conditionIn: string;
    notes?: string;
  }) => {
    requireAuth(event);
    const allocation = db.get<EquipmentAllocation>("SELECT * FROM studio_equipment_allocations WHERE id = ? AND deleted_at IS NULL", [data.allocationId]);
    if (!allocation) throw new Error("Allocation not found");
    if (allocation.checked_in_at) {
      throw new Error("Equipment already checked in");
    }

    db.run(
      `UPDATE studio_equipment_allocations SET checked_in_at = ?, condition_in = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [data.checkedInAt, data.conditionIn, data.notes || null, nowIso(), data.allocationId]
    );

    db.run("UPDATE studio_equipment SET availability = 'available', current_holder = NULL, updated_at = ? WHERE id = ?", [nowIso(), allocation.equipment_id]);

    return db.get<EquipmentAllocation>("SELECT * FROM studio_equipment_allocations WHERE id = ?", [data.allocationId]);
  }, db);

  // List allocations
  createHandler("equipment:allocations:list", async (event: IpcMainInvokeEvent, filters?: {
    equipmentId?: string;
    projectId?: string;
    eventId?: string;
    assignedTo?: string;
    activeOnly?: boolean;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { equipmentId, projectId, eventId, assignedTo, activeOnly, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (equipmentId) { where += " AND equipment_id = ?"; params.push(equipmentId); }
    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (eventId) { where += " AND event_id = ?"; params.push(eventId); }
    if (assignedTo) { where += " AND assigned_to = ?"; params.push(assignedTo); }
    if (activeOnly) { where += " AND checked_in_at IS NULL"; }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (checked_out_at < ? OR (checked_out_at = ? AND id < ?))";
      params.push(decoded.checkedOutAt, decoded.checkedOutAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_equipment_allocations ${where} ORDER BY checked_out_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ checkedOutAt: last.checked_out_at, id: last.id })).toString("base64url");
    }

    for (const item of items) {
      item.equipment = db.get("SELECT id, name, equipment_id, category FROM studio_equipment WHERE id = ?", [item.equipment_id]);
      if (item.assigned_to) {
        item.employee = db.get("SELECT id, full_name, designation FROM studio_employees WHERE id = ?", [item.assigned_to]);
      }
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get equipment stats
  createHandler("equipment:stats", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const equipment = db.all<Equipment>("SELECT * FROM studio_equipment WHERE deleted_at IS NULL");

    const stats = {
      total: equipment.length,
      byCategory: {} as Record<string, number>,
      byAvailability: {} as Record<string, number>,
      byCondition: {} as Record<string, number>,
      checkedOut: 0,
    };

    for (const item of equipment) {
      stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
      stats.byAvailability[item.availability] = (stats.byAvailability[item.availability] || 0) + 1;
      stats.byCondition[item.condition] = (stats.byCondition[item.condition] || 0) + 1;
      if (item.availability === "in_use") stats.checkedOut++;
    }

    return stats;
  }, db);
}

async function generateEquipmentId(db: Database): Promise<string> {
  const year = new Date().getFullYear();
  const last = db.get<{ equipmentId: string }>(
    "SELECT equipment_id FROM studio_equipment WHERE equipment_id LIKE ? ORDER BY equipment_id DESC LIMIT 1",
    [`EQP-${year}-%`]
  );
  let num = 1;
  if (last) {
    const match = last.equipmentId.match(/EQP-\d+-(\d+)/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `EQP-${year}-${String(num).padStart(4, "0")}`;
}