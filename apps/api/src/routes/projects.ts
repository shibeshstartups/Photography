import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const projectRoutes = new Hono<{ Bindings: Env }>();

const projectSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(200),
  projectManagerId: z.string().uuid().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  quotation: z.any().optional(),
  totalAgreedAmount: z.number().nonnegative().optional(),
  advancePayment: z.number().nonnegative().optional(),
  venue: z.any().optional(),
  locations: z.any().optional(),
  internalNotes: z.string().optional(),
  metadata: z.any().optional(),
});

const updateProjectSchema = projectSchema.partial();

// List projects
projectRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      clientId: z.string().uuid().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { status, clientId, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (status) { where += " AND status = ?"; params.push(status); }
    if (clientId) { where += " AND client_id = ?"; params.push(clientId); }
    if (dateFrom) { where += " AND booking_date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND booking_date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (booking_date < ? OR (booking_date = ? AND id < ?))";
      params.push(decoded.bookingDate, decoded.bookingDate, decoded.id);
    }

    const sql = `SELECT * FROM studio_projects ${where} ORDER BY booking_date DESC, id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ bookingDate: last.booking_date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get single project
projectRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare(
    "SELECT * FROM studio_projects WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json(project);
});

// Create project
projectRoutes.post(
  "/",
  zValidator("json", projectSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    const id = createId();
    const projectId = await generateProjectId(c.env.DB);

    await c.env.DB.prepare(
      `INSERT INTO studio_projects (id, project_id, client_id, title, project_manager_id, booking_date, status, quotation, total_agreed_amount, advance_payment, venue, locations, internal_notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, projectId, data.clientId, data.title, data.projectManagerId || null,
      data.bookingDate || new Date().toISOString().split("T")[0], data.status || "ENQUIRY",
      data.quotation ? JSON.stringify(data.quotation) : null, data.totalAgreedAmount || 0, data.advancePayment || 0,
      data.venue ? JSON.stringify(data.venue) : null, data.locations ? JSON.stringify(data.locations) : null,
      data.internalNotes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    // Create default editing task
    await c.env.DB.prepare(
      `INSERT INTO studio_editing_tasks (id, project_id, status, version, created_at, updated_at)
       VALUES (?, ?, 'WAITING_FOR_FILES', 1, ?, ?)`
    ).bind(createId(), id, new Date().toISOString(), new Date().toISOString()).run();

    const project = await c.env.DB.prepare("SELECT * FROM studio_projects WHERE id = ?").bind(id).first();
    return c.json(project, 201);
  }
);

// Update project
projectRoutes.patch(
  "/:id",
  zValidator("json", updateProjectSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Project not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["clientId", "title", "projectManagerId", "bookingDate", "status", "quotation", "totalAgreedAmount", "advancePayment", "venue", "locations", "internalNotes", "metadata"];

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

    await c.env.DB.prepare(`UPDATE studio_projects SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const project = await c.env.DB.prepare("SELECT * FROM studio_projects WHERE id = ?").bind(id).first();
    return c.json(project);
  }
);

// Delete project (soft)
projectRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_projects SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Project stats
projectRoutes.get("/:id/stats", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare("SELECT * FROM studio_projects WHERE id = ?").bind(id).first();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const events = await c.env.DB.prepare("SELECT * FROM studio_events WHERE project_id = ? AND deleted_at IS NULL").bind(id).all();
  const assignments = await c.env.DB.prepare("SELECT * FROM studio_assignments WHERE project_id = ? AND deleted_at IS NULL").bind(id).all();
  const payments = await c.env.DB.prepare("SELECT * FROM studio_payments WHERE project_id = ? AND deleted_at IS NULL").bind(id).all();
  const expenses = await c.env.DB.prepare("SELECT * FROM studio_expenses WHERE project_id = ? AND deleted_at IS NULL").bind(id).all();
  const editingTasks = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE project_id = ? AND deleted_at IS NULL").bind(id).all();

  const totalPaid = payments.results.filter((p: any) => p.type !== "refund" && p.type !== "adjustment").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalRefunds = payments.results.filter((p: any) => p.type === "refund").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalAdjustments = payments.results.filter((p: any) => p.type === "adjustment").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalExpenses = expenses.results.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  return c.json({
    project,
    eventsCount: events.results.length,
    assignmentsCount: assignments.results.length,
    confirmedAssignments: assignments.results.filter((a: any) => a.status === "confirmed").length,
    totalPaid: totalPaid - totalRefunds + totalAdjustments,
    totalExpenses,
    balance: (project.total_agreed_amount || 0) - (totalPaid - totalRefunds + totalAdjustments),
    editingTasksCount: editingTasks.results.length,
    completedEditingTasks: editingTasks.results.filter((e: any) => e.status === "DELIVERED").length,
  });
});

export { projectRoutes };

async function generateProjectId(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.prepare(
    "SELECT project_id FROM studio_projects WHERE project_id LIKE ? ORDER BY project_id DESC LIMIT 1"
  ).bind(`PRJ-${year}-%`).first<{ project_id: string }>();

  let num = 1;
  if (last) {
    const match = last.project_id.match(/PRJ-\d+-(\d+)/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `PRJ-${year}-${String(num).padStart(4, "0")}`;
}