import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso, round2 } from "@studio-erp/shared";
import type { Quotation, Invoice, Payment, Expense } from "@studio-erp/database";

export function registerFinanceHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // ===== QUOTATIONS =====
  createHandler("finance:quotations:list", async (event: IpcMainInvokeEvent, projectId?: string) => {
    requireAuth(event);
    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];
    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    return db.all<Quotation>(`SELECT * FROM studio_quotations ${where} ORDER BY created_at DESC`, params);
  }, db);

  createHandler("finance:quotations:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const quotation = db.get<Quotation>("SELECT * FROM studio_quotations WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!quotation) throw new Error("Quotation not found");
    quotation.items = JSON.parse(quotation.items);
    return quotation;
  }, db);

  createHandler("finance:quotations:create", async (event: IpcMainInvokeEvent, data: {
    projectId: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    totalAmount: number;
  }) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_quotations (id, project_id, items, total_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [id, data.projectId, JSON.stringify(data.items), data.totalAmount, nowIso(), nowIso()]
    );
    return db.get<Quotation>("SELECT * FROM studio_quotations WHERE id = ?", [id]);
  }, db);

  createHandler("finance:quotations:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<{ items: any[]; totalAmount: number; status: string; sentAt: string }>) => {
    requireAuth(event);
    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.items !== undefined) { updates.push("items = ?"); params.push(JSON.stringify(data.items)); }
    if (data.totalAmount !== undefined) { updates.push("total_amount = ?"); params.push(data.totalAmount); }
    if (data.status !== undefined) { updates.push("status = ?"); params.push(data.status); }
    if (data.sentAt !== undefined) { updates.push("sent_at = ?"); params.push(data.sentAt); }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    db.run(`UPDATE studio_quotations SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Quotation>("SELECT * FROM studio_quotations WHERE id = ?", [id]);
  }, db);

  createHandler("finance:quotations:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_quotations SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // ===== INVOICES =====
  createHandler("finance:invoices:list", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { projectId, status, cursor, limit = 50 } = filters || {};
    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];
    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (issue_date < ? OR (issue_date = ? AND id < ?))";
      params.push(decoded.issueDate, decoded.issueDate, decoded.id);
    }
    const sql = `SELECT * FROM studio_invoices ${where} ORDER BY issue_date DESC, id DESC LIMIT ?`;
    params.push(limit + 1);
    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ issueDate: last.issue_date, id: last.id })).toString("base64url");
    }
    for (const item of items) {
      item.items = JSON.parse(item.items);
    }
    return { items, nextCursor, hasMore };
  }, db);

  createHandler("finance:invoices:get", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    const invoice = db.get<Invoice>("SELECT * FROM studio_invoices WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!invoice) throw new Error("Invoice not found");
    invoice.items = JSON.parse(invoice.items);
    return invoice;
  }, db);

  createHandler("finance:invoices:create", async (event: IpcMainInvokeEvent, data: {
    projectId: string;
    invoiceNumber: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    totalAmount: number;
    issueDate: string;
    dueDate?: string;
  }) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_invoices (id, project_id, invoice_number, items, total_amount, issue_date, due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [id, data.projectId, data.invoiceNumber, JSON.stringify(data.items), data.totalAmount, data.issueDate, data.dueDate || null, nowIso(), nowIso()]
    );
    return db.get<Invoice>("SELECT * FROM studio_invoices WHERE id = ?", [id]);
  }, db);

  createHandler("finance:invoices:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<{ items: any[]; totalAmount: number; issueDate: string; dueDate: string; status: string }>) => {
    requireAuth(event);
    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["items", "totalAmount", "issueDate", "dueDate", "status"];
    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        params.push(typeof data[field as keyof typeof data] === "object" ? JSON.stringify(data[field as keyof typeof data]) : data[field as keyof typeof data]);
      }
    }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    db.run(`UPDATE studio_invoices SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Invoice>("SELECT * FROM studio_invoices WHERE id = ?", [id]);
  }, db);

  createHandler("finance:invoices:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_invoices SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // ===== PAYMENTS =====
  createHandler("finance:payments:list", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    invoiceId?: string;
    type?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { projectId, invoiceId, type, cursor, limit = 100 } = filters || {};
    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];
    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (invoiceId) { where += " AND invoice_id = ?"; params.push(invoiceId); }
    if (type) { where += " AND type = ?"; params.push(type); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (paid_at < ? OR (paid_at = ? AND id < ?))";
      params.push(decoded.paidAt, decoded.paidAt, decoded.id);
    }
    const sql = `SELECT * FROM studio_payments ${where} ORDER BY paid_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);
    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ paidAt: last.paid_at, id: last.id })).toString("base64url");
    }
    for (const item of items) {
      item.receiptRef = item.receipt_ref ? JSON.parse(item.receipt_ref) : null;
    }
    return { items, nextCursor, hasMore };
  }, db);

  createHandler("finance:payments:create", async (event: IpcMainInvokeEvent, data: {
    projectId: string;
    invoiceId?: string;
    type: "advance" | "balance" | "adjustment" | "refund";
    amount: number;
    method?: string;
    paidAt: string;
    replacesPaymentId?: string;
    notes?: string;
    receiptRef?: any;
  }) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_payments (id, project_id, invoice_id, type, amount, method, paid_at, replaces_payment_id, notes, receipt_ref, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, data.projectId, data.invoiceId || null, data.type, data.amount, data.method || null, data.paidAt, data.replacesPaymentId || null, data.notes || null, data.receiptRef ? JSON.stringify(data.receiptRef) : null, nowIso(), nowIso()]
    );
    return db.get<Payment>("SELECT * FROM studio_payments WHERE id = ?", [id]);
  }, db);

  createHandler("finance:payments:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_payments SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // ===== EXPENSES =====
  createHandler("finance:expenses:list", async (event: IpcMainInvokeEvent, filters?: {
    projectId?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
  }) => {
    requireAuth(event);
    const { projectId, category, dateFrom, dateTo, cursor, limit = 100 } = filters || {};
    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];
    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (category) { where += " AND category = ?"; params.push(category); }
    if (dateFrom) { where += " AND spent_at >= ?"; params.push(dateFrom); }
    if (dateTo) { where += " AND spent_at <= ?"; params.push(dateTo); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (spent_at < ? OR (spent_at = ? AND id < ?))";
      params.push(decoded.spentAt, decoded.spentAt, decoded.id);
    }
    const sql = `SELECT * FROM studio_expenses ${where} ORDER BY spent_at DESC, id DESC LIMIT ?`;
    params.push(limit + 1);
    const rows = db.all<any>(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ spentAt: last.spent_at, id: last.id })).toString("base64url");
    }
    for (const item of items) {
      item.receiptRef = item.receipt_ref ? JSON.parse(item.receipt_ref) : null;
    }
    return { items, nextCursor, hasMore };
  }, db);

  createHandler("finance:expenses:create", async (event: IpcMainInvokeEvent, data: {
    projectId?: string;
    category: "travel" | "accommodation" | "equipment" | "staff_fee" | "other";
    description: string;
    amount: number;
    method?: string;
    spentAt: string;
    incurredBy?: string;
    receiptRef?: any;
  }) => {
    requireAuth(event);
    const id = uuid();
    db.run(
      `INSERT INTO studio_expenses (id, project_id, category, description, amount, method, spent_at, incurred_by, receipt_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.projectId || null, data.category, data.description, data.amount, data.method || null, data.spentAt, data.incurredBy || null, data.receiptRef ? JSON.stringify(data.receiptRef) : null, nowIso(), nowIso()]
    );
    return db.get<Expense>("SELECT * FROM studio_expenses WHERE id = ?", [id]);
  }, db);

  createHandler("finance:expenses:update", async (event: IpcMainInvokeEvent, id: string, data: Partial<{ category: string; description: string; amount: number; method: string; spentAt: string; incurredBy: string; receiptRef: any }>) => {
    requireAuth(event);
    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["category", "description", "amount", "method", "spentAt", "incurredBy", "receiptRef"];
    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        params.push(typeof data[field as keyof typeof data] === "object" ? JSON.stringify(data[field as keyof typeof data]) : data[field as keyof typeof data]);
      }
    }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    db.run(`UPDATE studio_expenses SET ${updates.join(", ")} WHERE id = ?`, params);
    return db.get<Expense>("SELECT * FROM studio_expenses WHERE id = ?", [id]);
  }, db);

  createHandler("finance:expenses:delete", async (event: IpcMainInvokeEvent, id: string) => {
    requireAuth(event);
    db.run("UPDATE studio_expenses SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
    return { success: true };
  }, db);

  // ===== PROJECT FINANCE SUMMARY =====
  createHandler("finance:project-summary", async (event: IpcMainInvokeEvent, projectId: string) => {
    requireAuth(event);
    const project = db.get<{ id: string; project_id: string; title: string; total_agreed_amount: number; advance_payment: number }>("SELECT * FROM studio_projects WHERE id = ? AND deleted_at IS NULL", [projectId]);
    if (!project) throw new Error("Project not found");

    const payments = db.all<Payment>("SELECT * FROM studio_payments WHERE project_id = ? AND deleted_at IS NULL", [projectId]);
    const expenses = db.all<Expense>("SELECT * FROM studio_expenses WHERE project_id = ? AND deleted_at IS NULL", [projectId]);
    const invoices = db.all<Invoice>("SELECT * FROM studio_invoices WHERE project_id = ? AND deleted_at IS NULL", [projectId]);

    const totalAdvances = payments.filter(p => p.type === "advance").reduce((sum, p) => sum + p.amount, 0);
    const totalBalances = payments.filter(p => p.type === "balance").reduce((sum, p) => sum + p.amount, 0);
    const totalAdjustments = payments.filter(p => p.type === "adjustment").reduce((sum, p) => sum + p.amount, 0);
    const totalRefunds = payments.filter(p => p.type === "refund").reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const expensesByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const invoicedTotal = invoices.reduce((sum, i) => sum + i.total_amount, 0);
    const paidTotal = totalAdvances + totalBalances + totalAdjustments - totalRefunds;
    const balance = (project.total_agreed_amount || 0) - paidTotal;

    return {
      project: { id: project.id, projectId: project.project_id, title: project.title, totalAgreedAmount: project.total_agreed_amount, advancePayment: project.advance_payment },
      payments: { advances: totalAdvances, balances: totalBalances, adjustments: totalAdjustments, refunds: totalRefunds, netPaid: paidTotal },
      expenses: { total: totalExpenses, byCategory: expensesByCategory },
      invoices: { count: invoices.length, total: invoicedTotal },
      balance,
      profit: paidTotal - totalExpenses,
      profitMargin: paidTotal > 0 ? round2(((paidTotal - totalExpenses) / paidTotal) * 100) : 0,
    };
  }, db);

  // ===== FINANCE DASHBOARD =====
  createHandler("finance:dashboard", async (event: IpcMainInvokeEvent, dateFrom: string, dateTo: string) => {
    requireAuth(event);
    const payments = db.all<Payment>(
      `SELECT * FROM studio_payments WHERE deleted_at IS NULL AND paid_at BETWEEN ? AND ?`,
      [dateFrom, dateTo]
    );
    const expenses = db.all<Expense>(
      `SELECT * FROM studio_expenses WHERE deleted_at IS NULL AND spent_at BETWEEN ? AND ?`,
      [dateFrom, dateTo]
    );
    const invoices = db.all<Invoice>(
      `SELECT * FROM studio_invoices WHERE deleted_at IS NULL AND issue_date BETWEEN ? AND ?`,
      [dateFrom, dateTo]
    );

    const totalRevenue = payments.filter(p => p.type !== "refund").reduce((sum, p) => sum + p.amount, 0);
    const totalRefunds = payments.filter(p => p.type === "refund").reduce((sum, p) => sum + p.amount, 0);
    const netRevenue = totalRevenue - totalRefunds;
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const revenueByType = payments.reduce((acc, p) => {
      if (p.type !== "refund") acc[p.type] = (acc[p.type] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    const expensesByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const invoicedTotal = invoices.reduce((sum, i) => sum + i.total_amount, 0);
    const invoicesByStatus = invoices.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      period: { from: dateFrom, to: dateTo },
      revenue: { total: totalRevenue, refunds: totalRefunds, net: netRevenue, byType: revenueByType },
      expenses: { total: totalExpenses, byCategory: expensesByCategory },
      invoices: { count: invoices.length, total: invoicedTotal, byStatus: invoicesByStatus },
      profit: netRevenue - totalExpenses,
      profitMargin: netRevenue > 0 ? round2(((netRevenue - totalExpenses) / netRevenue) * 100) : 0,
    };
  }, db);
}