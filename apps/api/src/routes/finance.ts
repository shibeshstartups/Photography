import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const financeRoutes = new Hono<{ Bindings: Env }>();

const quotationSchema = z.object({
  projectId: z.string().uuid(),
  version: z.number().int().positive().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxRate: z.number().nonnegative().default(0),
    discount: z.number().nonnegative().default(0),
  })),
  terms: z.string().optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const invoiceSchema = z.object({
  projectId: z.string().uuid(),
  quotationId: z.string().uuid().optional(),
  invoiceNumber: z.string().max(50).optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxRate: z.number().nonnegative().default(0),
    discount: z.number().nonnegative().default(0),
  })),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const paymentSchema = z.object({
  projectId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  referenceNumber: z.string().max(100).optional(),
  type: z.enum(["advance", "progress", "final", "refund", "adjustment"]).default("progress"),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const expenseSchema = z.object({
  projectId: z.string().uuid().optional(),
  category: z.string().min(1).max(100),
  description: z.string().min(1),
  amount: z.number().positive(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidTo: z.string().max(200).optional(),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]).optional(),
  referenceNumber: z.string().max(100).optional(),
  receiptPath: z.string().max(500).optional(),
  isReimbursable: z.boolean().default(false),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const updateQuotationSchema = quotationSchema.partial();
const updateInvoiceSchema = invoiceSchema.partial();
const updatePaymentSchema = paymentSchema.partial();
const updateExpenseSchema = expenseSchema.partial();

// ============ QUOTATIONS ============
financeRoutes.get(
  "/quotations",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      status: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, status, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT q.*, p.title as project_title, p.project_id as project_code
                 FROM studio_quotations q
                 LEFT JOIN studio_projects p ON q.project_id = p.id
                 ${where} ORDER BY q.created_at DESC, q.id DESC LIMIT ?`;
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

financeRoutes.get("/quotations/:id", async (c) => {
  const id = c.req.param("id");
  const quotation = await c.env.DB.prepare(
    "SELECT * FROM studio_quotations WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!quotation) return c.json({ error: "Quotation not found" }, 404);
  return c.json(quotation);
});

financeRoutes.post(
  "/quotations",
  zValidator("json", quotationSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    // Generate quotation number
    const year = new Date().getFullYear();
    const last = await c.env.DB.prepare(
      "SELECT quotation_number FROM studio_quotations WHERE quotation_number LIKE ? ORDER BY quotation_number DESC LIMIT 1"
    ).bind(`QUO-${year}-%`).first<{ quotation_number: string }>();

    let num = 1;
    if (last) {
      const match = last.quotation_number.match(/QUO-\d+-(\d+)/);
      if (match) num = parseInt(match[1], 10) + 1;
    }
    const quotationNumber = `QUO-${year}-${String(num).padStart(4, "0")}`;

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate || 0) / 100, 0);
    const discount = data.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal + tax - discount;

    await c.env.DB.prepare(
      `INSERT INTO studio_quotations (id, project_id, quotation_number, version, items, subtotal, tax, discount, total, terms, valid_until, status, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId, quotationNumber, data.version || 1, JSON.stringify(data.items),
      subtotal, tax, discount, total, data.terms || null, data.validUntil || null,
      data.status || "DRAFT", data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const quotation = await c.env.DB.prepare("SELECT * FROM studio_quotations WHERE id = ?").bind(id).first();
    return c.json(quotation, 201);
  }
);

financeRoutes.patch(
  "/quotations/:id",
  zValidator("json", updateQuotationSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_quotations WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Quotation not found" }, 404);

    // Immutable once sent/approved
    if (existing.status === "SENT" || existing.status === "APPROVED" || existing.status === "CONVERTED") {
      return c.json({ error: "Cannot modify quotation in current status" }, 400);
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["version", "items", "terms", "validUntil", "status", "notes", "metadata"];

    let subtotal = existing.subtotal;
    let tax = existing.tax;
    let discount = existing.discount;
    let total = existing.total;

    if (data.items) {
      subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      tax = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate || 0) / 100, 0);
      discount = data.items.reduce((sum, item) => sum + (item.discount || 0), 0);
      total = subtotal + tax - discount;
      updates.push("items = ?", "subtotal = ?", "tax = ?", "discount = ?", "total = ?");
      params.push(JSON.stringify(data.items), subtotal, tax, discount, total);
    }

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined && !["items"].includes(field)) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_quotations SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const quotation = await c.env.DB.prepare("SELECT * FROM studio_quotations WHERE id = ?").bind(id).first();
    return c.json(quotation);
  }
);

financeRoutes.delete("/quotations/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT status FROM studio_quotations WHERE id = ?").bind(id).first();
  if (existing && (existing.status === "SENT" || existing.status === "APPROVED" || existing.status === "CONVERTED")) {
    return c.json({ error: "Cannot delete quotation in current status" }, 400);
  }
  await c.env.DB.prepare("UPDATE studio_quotations SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// ============ INVOICES ============
financeRoutes.get(
  "/invoices",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      status: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, status, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT i.*, p.title as project_title, p.project_id as project_code
                 FROM studio_invoices i
                 LEFT JOIN studio_projects p ON i.project_id = p.id
                 ${where} ORDER BY i.created_at DESC, i.id DESC LIMIT ?`;
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

financeRoutes.get("/invoices/:id", async (c) => {
  const id = c.req.param("id");
  const invoice = await c.env.DB.prepare(
    "SELECT * FROM studio_invoices WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  return c.json(invoice);
});

financeRoutes.post(
  "/invoices",
  zValidator("json", invoiceSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (data.quotationId) {
      const quotation = await c.env.DB.prepare("SELECT id FROM studio_quotations WHERE id = ? AND deleted_at IS NULL").bind(data.quotationId).first();
      if (!quotation) return c.json({ error: "Quotation not found" }, 404);
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const last = await c.env.DB.prepare(
      "SELECT invoice_number FROM studio_invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1"
    ).bind(`INV-${year}-%`).first<{ invoice_number: string }>();

    let num = 1;
    if (last) {
      const match = last.invoice_number.match(/INV-\d+-(\d+)/);
      if (match) num = parseInt(match[1], 10) + 1;
    }
    const invoiceNumber = data.invoiceNumber || `INV-${year}-${String(num).padStart(4, "0")}`;

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate || 0) / 100, 0);
    const discount = data.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal + tax - discount;

    await c.env.DB.prepare(
      `INSERT INTO studio_invoices (id, project_id, quotation_id, invoice_number, items, subtotal, tax, discount, total, due_date, terms, notes, metadata, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`
    ).bind(
      id, data.projectId, data.quotationId || null, invoiceNumber, JSON.stringify(data.items),
      subtotal, tax, discount, total, data.dueDate || null, data.terms || null,
      data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const invoice = await c.env.DB.prepare("SELECT * FROM studio_invoices WHERE id = ?").bind(id).first();
    return c.json(invoice, 201);
  }
);

financeRoutes.patch(
  "/invoices/:id",
  zValidator("json", updateInvoiceSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_invoices WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Invoice not found" }, 404);

    // Immutable once sent/paid
    if (["SENT", "PAID", "PARTIAL", "OVERDUE"].includes(existing.status)) {
      return c.json({ error: "Cannot modify invoice in current status" }, 400);
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["quotationId", "items", "dueDate", "terms", "notes", "metadata"];

    let subtotal = existing.subtotal;
    let tax = existing.tax;
    let discount = existing.discount;
    let total = existing.total;

    if (data.items) {
      subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      tax = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate || 0) / 100, 0);
      discount = data.items.reduce((sum, item) => sum + (item.discount || 0), 0);
      total = subtotal + tax - discount;
      updates.push("items = ?", "subtotal = ?", "tax = ?", "discount = ?", "total = ?");
      params.push(JSON.stringify(data.items), subtotal, tax, discount, total);
    }

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined && !["items"].includes(field)) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_invoices SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const invoice = await c.env.DB.prepare("SELECT * FROM studio_invoices WHERE id = ?").bind(id).first();
    return c.json(invoice);
  }
);

financeRoutes.delete("/invoices/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT status FROM studio_invoices WHERE id = ?").bind(id).first();
  if (existing && ["SENT", "PAID", "PARTIAL", "OVERDUE"].includes(existing.status)) {
    return c.json({ error: "Cannot delete invoice in current status" }, 400);
  }
  await c.env.DB.prepare("UPDATE studio_invoices SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// ============ PAYMENTS ============
financeRoutes.get(
  "/payments",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      invoiceId: z.string().uuid().optional(),
      type: z.string().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, invoiceId, type, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (invoiceId) { where += " AND invoice_id = ?"; params.push(invoiceId); }
    if (type) { where += " AND type = ?"; params.push(type); }
    if (dateFrom) { where += " AND payment_date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND payment_date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (payment_date < ? OR (payment_date = ? AND id < ?))";
      params.push(decoded.paymentDate, decoded.paymentDate, decoded.id);
    }

    const sql = `SELECT p.*, pr.title as project_title, pr.project_id as project_code
                 FROM studio_payments p
                 LEFT JOIN studio_projects pr ON p.project_id = pr.id
                 ${where} ORDER BY p.payment_date DESC, p.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ paymentDate: last.payment_date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

financeRoutes.get("/payments/:id", async (c) => {
  const id = c.req.param("id");
  const payment = await c.env.DB.prepare(
    "SELECT * FROM studio_payments WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!payment) return c.json({ error: "Payment not found" }, 404);
  return c.json(payment);
});

financeRoutes.post(
  "/payments",
  zValidator("json", paymentSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    const id = createId();

    const project = await c.env.DB.prepare("SELECT id, total_agreed_amount, advance_payment FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (data.invoiceId) {
      const invoice = await c.env.DB.prepare("SELECT id, total, status FROM studio_invoices WHERE id = ? AND deleted_at IS NULL").bind(data.invoiceId).first();
      if (!invoice) return c.json({ error: "Invoice not found" }, 404);
    }

    // Immutable payment ledger - just insert
    await c.env.DB.prepare(
      `INSERT INTO studio_payments (id, project_id, invoice_id, amount, payment_date, payment_method, reference_number, type, notes, recorded_by, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId, data.invoiceId || null, data.amount, data.paymentDate,
      data.paymentMethod, data.referenceNumber || null, data.type, data.notes || null,
      user.id, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString()
    ).run();

    // Update invoice status if linked
    if (data.invoiceId) {
      const payments = await c.env.DB.prepare(
        "SELECT SUM(amount) as total FROM studio_payments WHERE invoice_id = ? AND type != 'refund' AND type != 'adjustment' AND deleted_at IS NULL"
      ).bind(data.invoiceId).first<{ total: number }>();

      const invoice = await c.env.DB.prepare("SELECT total FROM studio_invoices WHERE id = ?").bind(data.invoiceId).first<{ total: number }>();
      if (invoice && payments) {
        let status = "PARTIAL";
        if (payments.total >= invoice.total) status = "PAID";
        else if (payments.total > 0) status = "PARTIAL";
        await c.env.DB.prepare("UPDATE studio_invoices SET status = ?, updated_at = ? WHERE id = ?").bind(status, new Date().toISOString(), data.invoiceId).run();
      }
    }

    const payment = await c.env.DB.prepare("SELECT * FROM studio_payments WHERE id = ?").bind(id).first();
    return c.json(payment, 201);
  }
);

// Payments are immutable - no PATCH/DELETE
financeRoutes.patch("/payments/:id", async (c) => {
  return c.json({ error: "Payments are immutable. Create a refund or adjustment instead." }, 400);
});

financeRoutes.delete("/payments/:id", async (c) => {
  return c.json({ error: "Payments are immutable. Create a refund or adjustment instead." }, 400);
});

// ============ EXPENSES ============
financeRoutes.get(
  "/expenses",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      category: z.string().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, category, dateFrom, dateTo, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (category) { where += " AND category = ?"; params.push(category); }
    if (dateFrom) { where += " AND expense_date >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND expense_date <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (expense_date < ? OR (expense_date = ? AND id < ?))";
      params.push(decoded.expenseDate, decoded.expenseDate, decoded.id);
    }

    const sql = `SELECT e.*, p.title as project_title, p.project_id as project_code
                 FROM studio_expenses e
                 LEFT JOIN studio_projects p ON e.project_id = p.id
                 ${where} ORDER BY e.expense_date DESC, e.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ expenseDate: last.expense_date, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

financeRoutes.get("/expenses/:id", async (c) => {
  const id = c.req.param("id");
  const expense = await c.env.DB.prepare(
    "SELECT * FROM studio_expenses WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!expense) return c.json({ error: "Expense not found" }, 404);
  return c.json(expense);
});

financeRoutes.post(
  "/expenses",
  zValidator("json", expenseSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    if (data.projectId) {
      const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
      if (!project) return c.json({ error: "Project not found" }, 404);
    }

    if (data.assignedTo) {
      const employee = await c.env.DB.prepare("SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(data.assignedTo).first();
      if (!employee) return c.json({ error: "Employee not found" }, 404);
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_expenses (id, project_id, category, description, amount, expense_date, paid_to, payment_method, reference_number, receipt_path, is_reimbursable, assigned_to, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId || null, data.category, data.description, data.amount, data.expenseDate,
      data.paidTo || null, data.paymentMethod || null, data.referenceNumber || null,
      data.receiptPath || null, data.isReimbursable ? 1 : 0, data.assignedTo || null,
      data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const expense = await c.env.DB.prepare("SELECT * FROM studio_expenses WHERE id = ?").bind(id).first();
    return c.json(expense, 201);
  }
);

financeRoutes.patch(
  "/expenses/:id",
  zValidator("json", updateExpenseSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_expenses WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Expense not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "category", "description", "amount", "expenseDate", "paidTo", "paymentMethod", "referenceNumber", "receiptPath", "isReimbursable", "assignedTo", "notes", "metadata"];

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
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_expenses SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const expense = await c.env.DB.prepare("SELECT * FROM studio_expenses WHERE id = ?").bind(id).first();
    return c.json(expense);
  }
);

financeRoutes.delete("/expenses/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_expenses SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// ============ FINANCIAL SUMMARY ============
financeRoutes.get("/project/:projectId/summary", async (c) => {
  const projectId = c.req.param("projectId");

  const project = await c.env.DB.prepare("SELECT * FROM studio_projects WHERE id = ?").bind(projectId).first();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const quotations = await c.env.DB.prepare("SELECT * FROM studio_quotations WHERE project_id = ? AND deleted_at IS NULL ORDER BY version DESC").bind(projectId).all();
  const invoices = await c.env.DB.prepare("SELECT * FROM studio_invoices WHERE project_id = ? AND deleted_at IS NULL").bind(projectId).all();
  const payments = await c.env.DB.prepare("SELECT * FROM studio_payments WHERE project_id = ? AND deleted_at IS NULL").bind(projectId).all();
  const expenses = await c.env.DB.prepare("SELECT * FROM studio_expenses WHERE project_id = ? AND deleted_at IS NULL").bind(projectId).all();

  const totalInvoiced = invoices.results.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
  const totalPaid = payments.results.filter((p: any) => p.type !== "refund" && p.type !== "adjustment").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalRefunds = payments.results.filter((p: any) => p.type === "refund").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalAdjustments = payments.results.filter((p: any) => p.type === "adjustment").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalExpenses = expenses.results.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  return c.json({
    project,
    quotations: quotations.results,
    invoices: invoices.results,
    payments: payments.results,
    expenses: expenses.results,
    totals: {
      agreedAmount: project.total_agreed_amount || 0,
      totalInvoiced,
      totalPaid: totalPaid - totalRefunds + totalAdjustments,
      totalRefunds,
      totalAdjustments,
      totalExpenses,
      balance: (project.total_agreed_amount || 0) - (totalPaid - totalRefunds + totalAdjustments),
      profit: (totalPaid - totalRefunds + totalAdjustments) - totalExpenses,
    },
  });
});

export { financeRoutes };