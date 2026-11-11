import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const equipmentRoutes = new Hono<{ Bindings: Env }>();

const equipmentSchema = z.object({
  equipmentId: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  category: z.enum(["camera", "lens", "lighting", "audio", "grip", "accessory", "computer", "storage", "drone", "other"]),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  purchasePrice: z.number().nonnegative().optional(),
  warrantyExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  location: z.string().max(200).optional(),
  condition: z.enum(["new", "excellent", "good", "fair", "poor", "damaged"]).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const allocationSchema = z.object({
  equipmentId: z.string().uuid(),
  projectId: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  conditionAtCheckout: z.enum(["new", "excellent", "good", "fair", "poor", "damaged"]).optional(),
  conditionAtReturn: z.enum(["new", "excellent", "good", "fair", "poor", "damaged"]).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const maintenanceSchema = z.object({
  equipmentId: z.string().uuid(),
  type: z.enum(["routine", "repair", "calibration", "cleaning", "inspection"]),
  description: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cost: z.number().nonnegative().optional(),
  performedBy: z.string().max(200).optional(),
  vendor: z.string().max(200).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const updateEquipmentSchema = equipmentSchema.partial();
const updateAllocationSchema = allocationSchema.partial();
const updateMaintenanceSchema = maintenanceSchema.partial();

// List equipment
equipmentRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
      status: z.string().optional(),
      location: z.string().optional(),
      search: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { category, status, location, search, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (category) { where += " AND category = ?"; params.push(category); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (location) { where += " AND location = ?"; params.push(location); }
    if (search) { where += " AND (name LIKE ? OR brand LIKE ? OR model LIKE ? OR serial_number LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (name < ? OR (name = ? AND id < ?))";
      params.push(decoded.name, decoded.name, decoded.id);
    }

    const sql = `SELECT * FROM studio_equipment ${where} ORDER BY name ASC, id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ name: last.name, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get equipment
equipmentRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const equipment = await c.env.DB.prepare(
    "SELECT * FROM studio_equipment WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!equipment) return c.json({ error: "Equipment not found" }, 404);

  // Get current allocation
  const allocation = await c.env.DB.prepare(
    `SELECT a.*, p.title as project_title, e.name as assigned_to_name
     FROM studio_equipment_allocations a
     LEFT JOIN studio_projects p ON a.project_id = p.id
     LEFT JOIN studio_employees e ON a.assigned_to = e.id
     WHERE a.equipment_id = ? AND a.actual_return_date IS NULL AND a.deleted_at IS NULL
     ORDER BY a.checkout_date DESC LIMIT 1`
  ).bind(id).first();

  // Get maintenance history
  const maintenance = await c.env.DB.prepare(
    "SELECT * FROM studio_equipment_maintenance WHERE equipment_id = ? AND deleted_at IS NULL ORDER BY scheduled_date DESC"
  ).bind(id).all();

  return c.json({ ...equipment, currentAllocation: allocation, maintenanceHistory: maintenance.results });
});

// Create equipment
equipmentRoutes.post(
  "/",
  zValidator("json", equipmentSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();
    let equipId = data.equipmentId;

    if (!equipId) {
      const count = await c.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM studio_equipment WHERE deleted_at IS NULL"
      ).first<{ cnt: number }>();
      equipId = `EQP-${String((count?.cnt || 0) + 1).padStart(4, "0")}`;
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_equipment (id, equipment_id, name, category, brand, model, serial_number, purchase_date, purchase_price, warranty_expiry, status, location, condition, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, equipId, data.name, data.category, data.brand || null, data.model || null,
      data.serialNumber || null, data.purchaseDate || null, data.purchasePrice || null,
      data.warrantyExpiry || null, data.status || "available", data.location || null,
      data.condition || "new", data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const equipment = await c.env.DB.prepare("SELECT * FROM studio_equipment WHERE id = ?").bind(id).first();
    return c.json(equipment, 201);
  }
);

// Update equipment
equipmentRoutes.patch(
  "/:id",
  zValidator("json", updateEquipmentSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_equipment WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Equipment not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["equipmentId", "name", "category", "brand", "model", "serialNumber", "purchaseDate", "purchasePrice", "warrantyExpiry", "status", "location", "condition", "notes", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_equipment SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const equipment = await c.env.DB.prepare("SELECT * FROM studio_equipment WHERE id = ?").bind(id).first();
    return c.json(equipment);
  }
);

// Delete equipment (soft)
equipmentRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  // Check if currently allocated
  const allocation = await c.env.DB.prepare(
    "SELECT id FROM studio_equipment_allocations WHERE equipment_id = ? AND actual_return_date IS NULL AND deleted_at IS NULL"
  ).bind(id).first();

  if (allocation) {
    return c.json({ error: "Cannot delete equipment currently checked out" }, 400);
  }

  await c.env.DB.prepare("UPDATE studio_equipment SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// ============ ALLOCATIONS ============
equipmentRoutes.get(
  "/allocations",
  zValidator(
    "query",
    z.object({
      equipmentId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      assignedTo: z.string().uuid().optional(),
      status: z.enum(["active", "returned", "overdue"]).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { equipmentId, projectId, assignedTo, status, cursor, limit } = c.req.valid("query");

    let where = "WHERE a.deleted_at IS NULL";
    const params: unknown[] = [];

    if (equipmentId) { where += " AND a.equipment_id = ?"; params.push(equipmentId); }
    if (projectId) { where += " AND a.project_id = ?"; params.push(projectId); }
    if (assignedTo) { where += " AND a.assigned_to = ?"; params.push(assignedTo); }
    if (status === "active") { where += " AND a.actual_return_date IS NULL"; }
    else if (status === "returned") { where += " AND a.actual_return_date IS NOT NULL"; }
    else if (status === "overdue") { where += " AND a.actual_return_date IS NULL AND a.expected_return_date < ?"; params.push(new Date().toISOString().split("T")[0]); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (a.checkout_date < ? OR (a.checkout_date = ? AND a.id < ?))";
      params.push(decoded.checkoutDate, decoded.checkoutDate, decoded.id);
    }

    const sql = `SELECT a.*, eq.name as equipment_name, eq.equipment_id as equipment_code, p.title as project_title, e.name as assigned_to_name
                 FROM studio_equipment_allocations a
                 LEFT JOIN studio_equipment eq ON a.equipment_id = eq.id
                 LEFT JOIN studio_projects p ON a.project_id = p.id
                 LEFT JOIN studio_employees e ON a.assigned_to = e.id
                 ${where} ORDER BY a.checkout_date DESC, a.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ checkoutDate: last.checkout_date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

equipmentRoutes.post(
  "/allocations",
  zValidator("json", allocationSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    // Verify equipment
    const equipment = await c.env.DB.prepare("SELECT id, status FROM studio_equipment WHERE id = ? AND deleted_at IS NULL").bind(data.equipmentId).first();
    if (!equipment) return c.json({ error: "Equipment not found" }, 404);
    if (equipment.status === "maintenance" || equipment.status === "retired") {
      return c.json({ error: "Equipment not available for allocation" }, 400);
    }

    // Check for active allocation
    const active = await c.env.DB.prepare(
      "SELECT id FROM studio_equipment_allocations WHERE equipment_id = ? AND actual_return_date IS NULL AND deleted_at IS NULL"
    ).bind(data.equipmentId).first();
    if (active) return c.json({ error: "Equipment already checked out" }, 409);

    // Verify project
    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (data.assignedTo) {
      const employee = await c.env.DB.prepare("SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(data.assignedTo).first();
      if (!employee) return c.json({ error: "Employee not found" }, 404);
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_equipment_allocations (id, equipment_id, project_id, assigned_to, checkout_date, expected_return_date, actual_return_date, condition_at_checkout, condition_at_return, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.equipmentId, data.projectId, data.assignedTo || null,
      data.checkoutDate, data.expectedReturnDate, data.actualReturnDate || null,
      data.conditionAtCheckout || null, data.conditionAtReturn || null,
      data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    // Update equipment status
    await c.env.DB.prepare("UPDATE studio_equipment SET status = 'allocated', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), data.equipmentId).run();

    const allocation = await c.env.DB.prepare("SELECT * FROM studio_equipment_allocations WHERE id = ?").bind(id).first();
    return c.json(allocation, 201);
  }
);

equipmentRoutes.patch(
  "/allocations/:id",
  zValidator("json", updateAllocationSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_equipment_allocations WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Allocation not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "assignedTo", "checkoutDate", "expectedReturnDate", "actualReturnDate", "conditionAtCheckout", "conditionAtReturn", "notes", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_equipment_allocations SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    // If returned, update equipment status
    if (data.actualReturnDate && !existing.actual_return_date) {
      await c.env.DB.prepare("UPDATE studio_equipment SET status = 'available', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), existing.equipment_id).run();
    }

    const allocation = await c.env.DB.prepare("SELECT * FROM studio_equipment_allocations WHERE id = ?").bind(id).first();
    return c.json(allocation);
  }
);

equipmentRoutes.post("/allocations/:id/return", async (c) => {
  const id = c.req.param("id");
  const { conditionAtReturn, notes } = await c.req.json<{ conditionAtReturn?: string; notes?: string }>();

  const existing = await c.env.DB.prepare("SELECT * FROM studio_equipment_allocations WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!existing) return c.json({ error: "Allocation not found" }, 404);
  if (existing.actual_return_date) return c.json({ error: "Already returned" }, 400);

  await c.env.DB.prepare(
    "UPDATE studio_equipment_allocations SET actual_return_date = ?, condition_at_return = ?, notes = COALESCE(notes, '') || ? || ' ', updated_at = ? WHERE id = ?"
  ).bind(new Date().toISOString().split("T")[0], conditionAtReturn || null, notes || "", new Date().toISOString(), id).run();

  await c.env.DB.prepare("UPDATE studio_equipment SET status = 'available', condition = ?, updated_at = ? WHERE id = ?").bind(conditionAtReturn || "good", new Date().toISOString(), existing.equipment_id).run();

  const allocation = await c.env.DB.prepare("SELECT * FROM studio_equipment_allocations WHERE id = ?").bind(id).first();
  return c.json(allocation);
});

// ============ MAINTENANCE ============
equipmentRoutes.get(
  "/maintenance",
  zValidator(
    "query",
    z.object({
      equipmentId: z.string().uuid().optional(),
      type: z.string().optional(),
      status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { equipmentId, type, status, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (equipmentId) { where += " AND equipment_id = ?"; params.push(equipmentId); }
    if (type) { where += " AND type = ?"; params.push(type); }
    if (status) {
      const now = new Date().toISOString().split("T")[0];
      if (status === "scheduled") { where += " AND completed_date IS NULL AND scheduled_date >= ?"; params.push(now); }
      else if (status === "in_progress") { where += " AND completed_date IS NULL AND scheduled_date < ?"; params.push(now); }
      else if (status === "completed") { where += " AND completed_date IS NOT NULL"; }
      else if (status === "cancelled") { where += " AND notes LIKE '%cancelled%'"; }
    }
    if (dateFrom) { where += " AND scheduled_date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND scheduled_date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (scheduled_date < ? OR (scheduled_date = ? AND id < ?))";
      params.push(decoded.scheduledDate, decoded.scheduledDate, decoded.id);
    }

    const sql = `SELECT m.*, eq.name as equipment_name
                 FROM studio_equipment_maintenance m
                 LEFT JOIN studio_equipment eq ON m.equipment_id = eq.id
                 ${where} ORDER BY m.scheduled_date ASC, m.id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ scheduledDate: last.scheduled_date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

equipmentRoutes.post(
  "/maintenance",
  zValidator("json", maintenanceSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    const equipment = await c.env.DB.prepare("SELECT id FROM studio_equipment WHERE id = ? AND deleted_at IS NULL").bind(data.equipmentId).first();
    if (!equipment) return c.json({ error: "Equipment not found" }, 404);

    await c.env.DB.prepare(
      `INSERT INTO studio_equipment_maintenance (id, equipment_id, type, description, scheduled_date, completed_date, cost, performed_by, vendor, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.equipmentId, data.type, data.description, data.scheduledDate,
      data.completedDate || null, data.cost || null, data.performedBy || null,
      data.vendor || null, data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    // Update equipment status
    await c.env.DB.prepare("UPDATE studio_equipment SET status = 'maintenance', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), data.equipmentId).run();

    const maintenance = await c.env.DB.prepare("SELECT * FROM studio_equipment_maintenance WHERE id = ?").bind(id).first();
    return c.json(maintenance, 201);
  }
);

equipmentRoutes.patch(
  "/maintenance/:id",
  zValidator("json", updateMaintenanceSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_equipment_maintenance WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Maintenance record not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["type", "description", "scheduledDate", "completedDate", "cost", "performedBy", "vendor", "notes", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_equipment_maintenance SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    // If completed, update equipment status
    if (data.completedDate && !existing.completed_date) {
      await c.env.DB.prepare("UPDATE studio_equipment SET status = 'available', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), existing.equipment_id).run();
    }

    const maintenance = await c.env.DB.prepare("SELECT * FROM studio_equipment_maintenance WHERE id = ?").bind(id).first();
    return c.json(maintenance);
  }
);

equipmentRoutes.delete("/maintenance/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_equipment_maintenance SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Equipment categories
equipmentRoutes.get("/meta/categories", async (c) => {
  return c.json(["camera", "lens", "lighting", "audio", "grip", "accessory", "computer", "storage", "drone", "other"]);
});

export { equipmentRoutes };