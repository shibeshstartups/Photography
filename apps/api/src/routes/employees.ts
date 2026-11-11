import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const employeeRoutes = new Hono<{ Bindings: Env }>();

const employeeSchema = z.object({
  employeeId: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(["photographer", "videographer", "editor", "assistant", "lighting", "makeup", "stylist", "coordinator", "driver", "other"]),
  skills: z.array(z.string()).optional(),
  payRate: z.number().nonnegative().optional(),
  payType: z.enum(["hourly", "daily", "project"]).optional(),
  availability: z.any().optional(),
  bankDetails: z.any().optional(),
  idProof: z.any().optional(),
  emergencyContact: z.any().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isRecurring: z.boolean().default(true),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateEmployeeSchema = employeeSchema.partial();
const updateAvailabilitySchema = availabilitySchema.partial();

// List employees
employeeRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      role: z.enum(["photographer", "videographer", "editor", "assistant", "lighting", "makeup", "stylist", "coordinator", "driver", "other"]).optional(),
      status: z.string().optional(),
      skill: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { role, status, skill, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (role) { where += " AND role = ?"; params.push(role); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (skill) { where += " AND JSON_EXTRACT(skills, '$') LIKE ?"; params.push(`%${skill}%`); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (name < ? OR (name = ? AND id < ?))";
      params.push(decoded.name, decoded.name, decoded.id);
    }

    const sql = `SELECT * FROM studio_employees ${where} ORDER BY name ASC, id ASC LIMIT ?`;
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

// Get employee
employeeRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const employee = await c.env.DB.prepare(
    "SELECT * FROM studio_employees WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!employee) return c.json({ error: "Employee not found" }, 404);

  // Get availability
  const availability = await c.env.DB.prepare(
    "SELECT * FROM studio_employee_availability WHERE employee_id = ? AND deleted_at IS NULL ORDER BY day_of_week, start_time"
  ).bind(id).all();

  return c.json({ ...employee, availability: availability.results });
});

// Create employee
employeeRoutes.post(
  "/",
  zValidator("json", employeeSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();
    let empId = data.employeeId;

    if (!empId) {
      const count = await c.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM studio_employees WHERE deleted_at IS NULL"
      ).first<{ cnt: number }>();
      empId = `EMP-${String((count?.cnt || 0) + 1).padStart(4, "0")}`;
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_employees (id, employee_id, name, email, phone, role, skills, pay_rate, pay_type, availability, bank_details, id_proof, emergency_contact, status, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, empId, data.name, data.email || null, data.phone || null, data.role,
      data.skills ? JSON.stringify(data.skills) : null, data.payRate || null, data.payType || null,
      data.availability ? JSON.stringify(data.availability) : null, data.bankDetails ? JSON.stringify(data.bankDetails) : null,
      data.idProof ? JSON.stringify(data.idProof) : null, data.emergencyContact ? JSON.stringify(data.emergencyContact) : null,
      data.status || "active", data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const employee = await c.env.DB.prepare("SELECT * FROM studio_employees WHERE id = ?").bind(id).first();
    return c.json(employee, 201);
  }
);

// Update employee
employeeRoutes.patch(
  "/:id",
  zValidator("json", updateEmployeeSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Employee not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["employeeId", "name", "email", "phone", "role", "skills", "payRate", "payType", "availability", "bankDetails", "idProof", "emergencyContact", "status", "notes", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_employees SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const employee = await c.env.DB.prepare("SELECT * FROM studio_employees WHERE id = ?").bind(id).first();
    return c.json(employee);
  }
);

// Delete employee (soft)
employeeRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_employees SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Availability
employeeRoutes.get("/:id/availability", async (c) => {
  const id = c.req.param("id");
  const availability = await c.env.DB.prepare(
    "SELECT * FROM studio_employee_availability WHERE employee_id = ? AND deleted_at IS NULL ORDER BY day_of_week, start_time"
  ).bind(id).all();
  return c.json(availability.results);
});

employeeRoutes.post(
  "/:id/availability",
  zValidator("json", availabilitySchema),
  async (c) => {
    const employeeId = c.req.param("id");
    const data = c.req.valid("json");

    const employee = await c.env.DB.prepare("SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(employeeId).first();
    if (!employee) return c.json({ error: "Employee not found" }, 404);

    const id = createId();
    await c.env.DB.prepare(
      `INSERT INTO studio_employee_availability (id, employee_id, day_of_week, start_time, end_time, is_recurring, valid_from, valid_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, employeeId, data.dayOfWeek, data.startTime, data.endTime, data.isRecurring ? 1 : 0,
      data.validFrom || null, data.validTo || null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const availability = await c.env.DB.prepare("SELECT * FROM studio_employee_availability WHERE id = ?").bind(id).first();
    return c.json(availability, 201);
  }
);

employeeRoutes.patch(
  "/:employeeId/availability/:availId",
  zValidator("json", updateAvailabilitySchema),
  async (c) => {
    const employeeId = c.req.param("employeeId");
    const availId = c.req.param("availId");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_employee_availability WHERE id = ? AND employee_id = ? AND deleted_at IS NULL").bind(availId, employeeId).first();
    if (!existing) return c.json({ error: "Availability not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["dayOfWeek", "startTime", "endTime", "isRecurring", "validFrom", "validTo"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(availId);

    await c.env.DB.prepare(`UPDATE studio_employee_availability SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const availability = await c.env.DB.prepare("SELECT * FROM studio_employee_availability WHERE id = ?").bind(availId).first();
    return c.json(availability);
  }
);

employeeRoutes.delete("/:employeeId/availability/:availId", async (c) => {
  const employeeId = c.req.param("employeeId");
  const availId = c.req.param("availId");
  await c.env.DB.prepare("UPDATE studio_employee_availability SET deleted_at = ?, updated_at = ? WHERE id = ? AND employee_id = ?").bind(new Date().toISOString(), new Date().toISOString(), availId, employeeId).run();
  return c.json({ success: true });
});

// Employee skills list
employeeRoutes.get("/meta/skills", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT skills FROM studio_employees WHERE deleted_at IS NULL AND skills IS NOT NULL"
  ).all();

  const skills = new Set<string>();
  for (const row of rows.results) {
    if (row.skills) {
      try {
        const arr = JSON.parse(row.skills as string);
        if (Array.isArray(arr)) arr.forEach(s => skills.add(s));
      } catch {}
    }
  }
  return c.json(Array.from(skills).sort());
});

export { employeeRoutes };