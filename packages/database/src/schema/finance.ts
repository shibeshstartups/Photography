import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Finance.
 * Payments are IMMUTABLE ledger entries.
 * Corrections create ADJUSTMENT entries rather than overwriting history.
 */

export const quotations = sqliteTable("studio_quotations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  /** JSON quotation breakdown. */
  items: text("items").notNull(),
  totalAmount: real("total_amount").notNull().default(0),
  /** "draft" | "sent" | "accepted" | "rejected". */
  status: text("status").notNull().default("draft"),
  /** ISO date. */
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Quotation = typeof quotations.$inferSelect;

/** Invoices. */
export const invoices = sqliteTable("studio_invoices", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  /** JSON line items. */
  items: text("items").notNull(),
  totalAmount: real("total_amount").notNull().default(0),
  /** ISO date. */
  issueDate: text("issue_date").notNull(),
  /** ISO date. */
  dueDate: text("due_date"),
  /** "draft" | "issued" | "paid" | "partially_paid" | "cancelled". */
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Invoice = typeof invoices.$inferSelect;

/**
 * Payments — IMMUTABLE ledger.
 * Corrections create a new row with type="adjustment" referencing the original.
 */
export const payments = sqliteTable("studio_payments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  invoiceId: text("invoice_id").references(() => invoices.id),
  /** "advance" | "balance" | "adjustment" | "refund". */
  type: text("type").notNull().default("advance"),
  amount: real("amount").notNull(),
  /** "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other". */
  method: text("method"),
  /** ISO date. */
  paidAt: text("paid_at").notNull(),
  /** For adjustments: references the original payment id. */
  replacesPaymentId: text("replaces_payment_id"),
  /** Immutable once created. */
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  /** Never updated after creation — use adjustments instead. */
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  notes: text("notes"),
  /** JSON receipt reference. */
  receiptRef: text("receipt_ref"),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at"),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

/** Expenses — project, travel, accommodation, equipment rental, staff fees, other. */
export const expenses = sqliteTable("studio_expenses", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  /** "travel" | "accommodation" | "equipment" | "staff_fee" | "other". */
  category: text("category").notNull().default("other"),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  /** ISO date. */
  spentAt: text("spent_at").notNull(),
  /** "cash" | "upi" | "card" | "bank_transfer" | "other". */
  method: text("method"),
  /** Employee who incurred it. */
  incurredBy: text("incurred_by").references(() => employees.id),
  /** JSON receipt reference. */
  receiptRef: text("receipt_ref"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type Expense = typeof expenses.$inferSelect;