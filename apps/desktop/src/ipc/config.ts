import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";

export function registerConfigHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // Get config value
  createHandler("config:get", async (event: IpcMainInvokeEvent, key: string) => {
    requireAuth(event);
    const config = db.get<{ value: string }>("SELECT value FROM studio_system_config WHERE key = ? AND deleted_at IS NULL", [key]);
    if (!config) return null;
    try {
      return JSON.parse(config.value);
    } catch {
      return config.value;
    }
  }, db);

  // Set config value
  createHandler("config:set", async (event: IpcMainInvokeEvent, key: string, value: unknown) => {
    requireAuth(event);
    const existing = db.get<{ id: string }>("SELECT id FROM studio_system_config WHERE key = ? AND deleted_at IS NULL", [key]);
    const jsonValue = JSON.stringify(value);

    if (existing) {
      db.run("UPDATE studio_system_config SET value = ?, updated_at = ? WHERE key = ?", [jsonValue, nowIso(), key]);
    } else {
      const id = uuid();
      db.run("INSERT INTO studio_system_config (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, key, jsonValue, nowIso(), nowIso()]);
    }
    return { success: true };
  }, db);

  // List all configs
  createHandler("config:list", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const configs = db.all<{ key: string; value: string }>("SELECT key, value FROM studio_system_config WHERE deleted_at IS NULL");
    const result: Record<string, unknown> = {};
    for (const c of configs) {
      try {
        result[c.key] = JSON.parse(c.value);
      } catch {
        result[c.key] = c.value;
      }
    }
    return result;
  }, db);

  // Delete config
  createHandler("config:delete", async (event: IpcMainInvokeEvent, key: string) => {
    requireAuth(event);
    db.run("UPDATE studio_system_config SET deleted_at = ?, updated_at = ? WHERE key = ?", [nowIso(), nowIso(), key]);
    return { success: true };
  }, db);

  // Initialize default configs
  createHandler("config:init-defaults", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const defaults = {
      project_statuses: [
        "ENQUIRY",
        "QUOTATION_SENT",
        "BOOKED",
        "PLANNING",
        "CREW_PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "POST_PRODUCTION",
        "CLIENT_SELECTION",
        "REVISION",
        "APPROVAL_PENDING",
        "DELIVERY_PENDING",
        "COMPLETED",
        "CANCELLED",
      ],
      segment_services: [
        "Traditional Photography",
        "Candid Photography",
        "Traditional Videography",
        "Cinematic Videography",
        "Drone",
        "Lighting",
        "Behind-the-scenes",
      ],
      employee_roles: [
        "Lead Photographer",
        "Candid Photographer",
        "Traditional Photographer",
        "Cinematographer",
        "Traditional Videographer",
        "Drone Operator",
        "Editor",
        "Album Designer",
        "Graphic Designer",
        "Project Manager",
        "Production Assistant",
        "Administrator",
      ],
      expense_categories: [
        "travel",
        "accommodation",
        "equipment",
        "staff_fee",
        "other",
      ],
      equipment_categories: [
        "camera_body",
        "lens",
        "flash",
        "lighting",
        "modifier",
        "audio",
        "drone",
        "accessory",
        "storage",
      ],
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existing = db.get("SELECT 1 FROM studio_system_config WHERE key = ?", [key]);
      if (!existing) {
        const id = uuid();
        db.run("INSERT INTO studio_system_config (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, key, JSON.stringify(value), nowIso(), nowIso()]);
      }
    }

    return { success: true };
  }, db);
}