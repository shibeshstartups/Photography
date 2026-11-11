import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const clientRoutes = new Hono<{ Bindings: Env }>();

const clientSchema = z.object({
  type: z.enum(["individual", "corporate"]),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  altPhone: z.string().max(20).optional(),
  address: z.any().optional(),
  gstNumber: z.string().max(20).optional(),
  panNumber: z.string().max(15).optional(),
  companyName: z.string().max(200).optional(),
  contactPerson: z.string().max(200).optional(),
  leadSource: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  relation: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  isPrimary: z.boolean().default(false),
  metadata: z.any().optional(),
});

const updateClientSchema = clientSchema.partial();
const updateContactSchema = contactSchema.partial();

// List clients
clientRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      type: z.enum(["individual", "corporate"]).optional(),
      search: z.string().optional(),
      tag: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { type, search, tag, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (type) { where += " AND type = ?"; params.push(type); }
    if (search) { where += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (tag) { where += " AND JSON_EXTRACT(tags, '$') LIKE ?"; params.push(`%${tag}%`); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT * FROM studio_clients ${where} ORDER BY created_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get client
clientRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = await c.env.DB.prepare(
    "SELECT * FROM studio_clients WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!client) return c.json({ error: "Client not found" }, 404);

  // Get contacts
  const contacts = await c.env.DB.prepare(
    "SELECT * FROM studio_client_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, name"
  ).bind(id).all();

  return c.json({ ...client, contacts: contacts.results });
});

// Create client
clientRoutes.post(
  "/",
  zValidator("json", clientSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    await c.env.DB.prepare(
      `INSERT INTO studio_clients (id, type, name, email, phone, alt_phone, address, gst_number, pan_number, company_name, contact_person, lead_source, tags, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.type, data.name, data.email || null, data.phone || null, data.altPhone || null,
      data.address ? JSON.stringify(data.address) : null, data.gstNumber || null, data.panNumber || null,
      data.companyName || null, data.contactPerson || null, data.leadSource || null,
      data.tags ? JSON.stringify(data.tags) : null, data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const client = await c.env.DB.prepare("SELECT * FROM studio_clients WHERE id = ?").bind(id).first();
    return c.json(client, 201);
  }
);

// Update client
clientRoutes.patch(
  "/:id",
  zValidator("json", updateClientSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_clients WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Client not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["type", "name", "email", "phone", "altPhone", "address", "gstNumber", "panNumber", "companyName", "contactPerson", "leadSource", "tags", "notes", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_clients SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const client = await c.env.DB.prepare("SELECT * FROM studio_clients WHERE id = ?").bind(id).first();
    return c.json(client);
  }
);

// Delete client (soft)
clientRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_clients SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Contacts
clientRoutes.get("/:id/contacts", async (c) => {
  const id = c.req.param("id");
  const contacts = await c.env.DB.prepare(
    "SELECT * FROM studio_client_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, name"
  ).bind(id).all();
  return c.json(contacts.results);
});

clientRoutes.post(
  "/:id/contacts",
  zValidator("json", contactSchema),
  async (c) => {
    const clientId = c.req.param("id");
    const data = c.req.valid("json");

    const client = await c.env.DB.prepare("SELECT id FROM studio_clients WHERE id = ? AND deleted_at IS NULL").bind(clientId).first();
    if (!client) return c.json({ error: "Client not found" }, 404);

    const id = createId();
    await c.env.DB.prepare(
      `INSERT INTO studio_client_contacts (id, client_id, name, relation, email, phone, is_primary, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, clientId, data.name, data.relation || null, data.email || null, data.phone || null,
      data.isPrimary ? 1 : 0, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    // If primary, unset others
    if (data.isPrimary) {
      await c.env.DB.prepare(
        "UPDATE studio_client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?"
      ).bind(clientId, id).run();
    }

    const contact = await c.env.DB.prepare("SELECT * FROM studio_client_contacts WHERE id = ?").bind(id).first();
    return c.json(contact, 201);
  }
);

clientRoutes.patch(
  "/:clientId/contacts/:contactId",
  zValidator("json", updateContactSchema),
  async (c) => {
    const clientId = c.req.param("clientId");
    const contactId = c.req.param("contactId");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_client_contacts WHERE id = ? AND client_id = ? AND deleted_at IS NULL").bind(contactId, clientId).first();
    if (!existing) return c.json({ error: "Contact not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["name", "relation", "email", "phone", "isPrimary", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : (typeof value === "boolean" ? (value ? 1 : 0) : value));
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(contactId);

    await c.env.DB.prepare(`UPDATE studio_client_contacts SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    // If primary, unset others
    if (data.isPrimary) {
      await c.env.DB.prepare("UPDATE studio_client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?").bind(clientId, contactId).run();
    }

    const contact = await c.env.DB.prepare("SELECT * FROM studio_client_contacts WHERE id = ?").bind(contactId).first();
    return c.json(contact);
  }
);

clientRoutes.delete("/:clientId/contacts/:contactId", async (c) => {
  const clientId = c.req.param("clientId");
  const contactId = c.req.param("contactId");
  await c.env.DB.prepare("UPDATE studio_client_contacts SET deleted_at = ?, updated_at = ? WHERE id = ? AND client_id = ?").bind(new Date().toISOString(), new Date().toISOString(), contactId, clientId).run();
  return c.json({ success: true });
});

export { clientRoutes };