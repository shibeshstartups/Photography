import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso } from "@studio-erp/shared";
import type { Client, NewClient, ClientContact } from "@studio-erp/database";

export function registerClientHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // List clients with filters
  createHandler("clients:list", async (event: IpcMainInvokeEvent, filters?: {
    search?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { search, cursor, limit = 50 } = filters || {};

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (search) {
      where += " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR client_id LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (full_name < ? OR (full_name = ? AND id < ?))";
      params.push(decoded.name, decoded.name, decoded.id);
    }

    const sql = `SELECT * FROM studio_clients ${where} ORDER BY full_name ASC, id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ name: last.full_name, id: last.id })).toString("base64url");
    }

    return { items, nextCursor, hasMore };
  }, db);

  // Get single client with contacts
  createHandler("clients:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const client = db.get<Client>("SELECT * FROM studio_clients WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!client) throw new Error("Client not found");

    const contacts = db.all<ClientContact>("SELECT * FROM studio_client_contacts WHERE client_id = ? AND deleted_at IS NULL", [id]);
    return { ...client, contacts };
  }, db);

  // Create client
  createHandler("clients:create", async (event: IpcMainInvokeEvent, data: Omit<NewClient, "id" | "createdAt" | "updatedAt" | "deletedAt">) => {
    requireAuth(event);
    const id = uuid();
    const clientId = await generateClientId(db);

    db.run(
      `INSERT INTO studio_clients (id, client_id, full_name, phone, email, address, additional_info, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clientId, data.fullName, data.phone || null, data.email || null, data.address || null, data.additionalInfo || null, data.notes || null, nowIso(), nowIso()]
    );

    const client = db.get<Client>("SELECT * FROM studio_clients WHERE id = ?", [id]);
    if (!client) throw new Error("Failed to create client");

    return client;
  }, db);

  // Update client
  createHandler("clients:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<NewClient, "id" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<Client>("SELECT * FROM studio_clients WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Client not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["fullName", "phone", "email", "address", "additionalInfo", "notes"];

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

    db.run(`UPDATE studio_clients SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Client>("SELECT * FROM studio_clients WHERE id = ?", [id]);
  }, db);

  // Delete client (soft)
  createHandler("clients:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    // Check if client has projects
    const projects = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_projects WHERE client_id = ? AND deleted_at IS NULL", [id]);
    if (projects && projects.count > 0) {
      throw new Error("Cannot delete client with active projects");
    }

    db.run("UPDATE studio_clients SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    db.run("UPDATE studio_client_contacts SET deleted_at = ?, updated_at = ? WHERE client_id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // Client contacts
  createHandler("clients:contacts:list", async (event: IpcMainInvokeEvent, clientId: string) => {
    requireAuth(event);
    return db.all<ClientContact>("SELECT * FROM studio_client_contacts WHERE client_id = ? AND deleted_at IS NULL", [clientId]);
  }, db);

  createHandler("clients:contacts:create", async (event: IpcMainInvokeEvent, data: Omit<ClientContact, "id" | "created_at" | "updated_at" | "deleted_at">) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_client_contacts (id, client_id, name, relationship, phone, email, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.client_id, data.name, data.relationship || null, data.phone || null, data.email || null, data.is_primary ? 1 : 0, nowIso(), nowIso()]
    );
    return db.get<ClientContact>("SELECT * FROM studio_client_contacts WHERE id = ?", [id]);
  }, db);

  createHandler("clients:contacts:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<Omit<ClientContact, "id" | "clientId" | "createdAt" | "updatedAt" | "deletedAt">>) => {
    requireAuth(event);
    const existing = db.get<ClientContact>("SELECT * FROM studio_client_contacts WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!existing) throw new Error("Contact not found");

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["name", "relationship", "phone", "email", "isPrimary"];

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

    db.run(`UPDATE studio_client_contacts SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<ClientContact>("SELECT * FROM studio_client_contacts WHERE id = ?", [id]);
  }, db);

  createHandler("clients:contacts:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_client_contacts SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);
}

async function generateClientId(db: Database): Promise<string> {
  const year = new Date().getFullYear();
  const last = db.get<{ clientId: string }>(
    "SELECT client_id FROM studio_clients WHERE client_id LIKE ? ORDER BY client_id DESC LIMIT 1",
    [`CLT-${year}-%`]
  );
  let num = 1;
  if (last) {
    const match = last.clientId.match(/CLT-\d+-(\d+)/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `CLT-${year}-${String(num).padStart(4, "0")}`;
}