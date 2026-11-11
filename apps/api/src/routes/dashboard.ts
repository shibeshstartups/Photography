import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types.js";

const dashboardRoutes = new Hono<{ Bindings: Env }>();

// Executive dashboard
dashboardRoutes.get("/executive", async (c) => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  // Project stats
  const totalProjects = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_projects WHERE deleted_at IS NULL").first<{ count: number }>();
  const activeProjects = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_projects WHERE status IN ('CONFIRMED', 'IN_PROGRESS') AND deleted_at IS NULL").first<{ count: number }>();
  const completedThisMonth = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_projects WHERE status = 'COMPLETED' AND updated_at >= ? AND deleted_at IS NULL").bind(thisMonthStart).first<{ count: number }>();

  // Revenue
  const revenueThisMonth = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM studio_payments
     WHERE payment_date >= ? AND type NOT IN ('refund', 'adjustment') AND deleted_at IS NULL`
  ).bind(thisMonthStart).first<{ total: number }>();

  const revenueLastMonth = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM studio_payments
     WHERE payment_date >= ? AND payment_date <= ? AND type NOT IN ('refund', 'adjustment') AND deleted_at IS NULL`
  ).bind(lastMonthStart, lastMonthEnd).first<{ total: number }>();

  // Expenses
  const expensesThisMonth = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM studio_expenses
     WHERE expense_date >= ? AND deleted_at IS NULL`
  ).bind(thisMonthStart).first<{ total: number }>();

  // Upcoming events
  const upcomingEvents = await c.env.DB.prepare(
    `SELECT e.*, p.title as project_title, p.project_id as project_code
     FROM studio_events e
     LEFT JOIN studio_projects p ON e.project_id = p.id
     WHERE e.event_date >= ? AND e.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY e.event_date ASC LIMIT 10`
  ).bind(now.toISOString().split("T")[0]).all();

  // Pending tasks
  const pendingQuotes = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_quotations WHERE status = 'DRAFT' AND deleted_at IS NULL").first<{ count: number }>();
  const pendingInvoices = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_invoices WHERE status = 'DRAFT' AND deleted_at IS NULL").first<{ count: number }>();
  const overdueInvoices = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_invoices WHERE status = 'OVERDUE' AND deleted_at IS NULL").first<{ count: number }>();
  const pendingEditing = await c.env.DB.prepare("SELECT COUNT(*) as count FROM studio_editing_tasks WHERE status IN ('WAITING_FOR_FILES', 'IN_PROGRESS', 'QC_PENDING') AND deleted_at IS NULL").first<{ count: number }>();

  // Equipment due
  const equipmentDue = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM studio_equipment_allocations
     WHERE actual_return_date IS NULL AND expected_return_date < ? AND deleted_at IS NULL`
  ).bind(now.toISOString().split("T")[0]).first<{ count: number }>();

  // Team utilization
  const teamStats = await c.env.DB.prepare(
    `SELECT e.id, e.name, e.role,
       COUNT(DISTINCT a.id) as assignments_this_month,
       COUNT(DISTINCT CASE WHEN at.status = 'present' THEN at.id END) as days_present
     FROM studio_employees e
     LEFT JOIN studio_assignments a ON e.id = a.employee_id AND a.deleted_at IS NULL
     LEFT JOIN studio_events ev ON a.event_id = ev.id AND ev.event_date >= ?
     LEFT JOIN studio_attendance at ON a.id = at.assignment_id AND at.deleted_at IS NULL
     WHERE e.deleted_at IS NULL AND e.status = 'active'
     GROUP BY e.id ORDER BY assignments_this_month DESC`
  ).bind(thisMonthStart).all();

  return c.json({
    overview: {
      totalProjects: totalProjects?.count || 0,
      activeProjects: activeProjects?.count || 0,
      completedThisMonth: completedThisMonth?.count || 0,
      revenueThisMonth: revenueThisMonth?.total || 0,
      revenueLastMonth: revenueLastMonth?.total || 0,
      revenueGrowth: revenueLastMonth?.total ? ((revenueThisMonth?.total || 0) - revenueLastMonth.total) / revenueLastMonth.total * 100 : 0,
      expensesThisMonth: expensesThisMonth?.total || 0,
      profitThisMonth: (revenueThisMonth?.total || 0) - (expensesThisMonth?.total || 0),
    },
    pending: {
      quotations: pendingQuotes?.count || 0,
      invoices: pendingInvoices?.count || 0,
      overdueInvoices: overdueInvoices?.count || 0,
      editingTasks: pendingEditing?.count || 0,
      equipmentDue: equipmentDue?.count || 0,
    },
    upcomingEvents: upcomingEvents.results,
    teamUtilization: teamStats.results,
  });
});

// Project pipeline
dashboardRoutes.get("/pipeline", async (c) => {
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE deleted_at IS NULL";
  const params: unknown[] = [];

  if (dateFrom) { where += " AND booking_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND booking_date <= ?"; params.push(dateTo); }

  const projects = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as count, SUM(total_agreed_amount) as total_value
     FROM studio_projects ${where}
     GROUP BY status`
  ).bind(...params).all();

  const stages = [
    "ENQUIRY", "QUOTE_SENT", "NEGOTIATION", "CONFIRMED",
    "PRE_PRODUCTION", "IN_PROGRESS", "POST_PRODUCTION",
    "QC_REVIEW", "DELIVERED", "COMPLETED", "CANCELLED"
  ];

  const pipeline = stages.map(stage => {
    const found = projects.results.find((p: any) => p.status === stage);
    return {
      stage,
      count: found?.count || 0,
      value: found?.total_value || 0,
    };
  });

  return c.json({ pipeline });
});

// Revenue analytics
dashboardRoutes.get("/revenue", async (c) => {
  const { months = 12 } = c.req.query();
  const numMonths = parseInt(months);

  const revenue = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', payment_date) as month,
       SUM(CASE WHEN type NOT IN ('refund', 'adjustment') THEN amount ELSE 0 END) as revenue,
       SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END) as refunds,
       SUM(CASE WHEN type = 'adjustment' THEN amount ELSE 0 END) as adjustments
     FROM studio_payments
     WHERE payment_date >= date('now', ? || ' months') AND deleted_at IS NULL
     GROUP BY month ORDER BY month`
  ).bind(-numMonths).all();

  const expenses = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', expense_date) as month,
       SUM(amount) as expenses
     FROM studio_expenses
     WHERE expense_date >= date('now', ? || ' months') AND deleted_at IS NULL
     GROUP BY month ORDER BY month`
  ).bind(-numMonths).all();

  const expenseMap = new Map(expenses.results.map((e: any) => [e.month, e.expenses]));

  const chartData = revenue.results.map((r: any) => ({
    month: r.month,
    revenue: r.revenue || 0,
    refunds: r.refunds || 0,
    adjustments: r.adjustments || 0,
    expenses: expenseMap.get(r.month) || 0,
    profit: (r.revenue || 0) - (r.refunds || 0) + (r.adjustments || 0) - (expenseMap.get(r.month) || 0),
  }));

  return c.json({ data: chartData });
});

// Booking calendar
dashboardRoutes.get("/calendar", async (c) => {
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE e.deleted_at IS NULL AND p.deleted_at IS NULL";
  const params: unknown[] = [];

  if (dateFrom) { where += " AND e.event_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND e.event_date <= ?"; params.push(dateTo); }

  const events = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_type, e.event_date, e.start_time, e.end_time, e.venue,
       p.id as project_id, p.title as project_title, p.project_id as project_code, p.status as project_status
     FROM studio_events e
     LEFT JOIN studio_projects p ON e.project_id = p.id
     ${where} ORDER BY e.event_date, e.start_time`
  ).bind(...params).all();

  // Group by date
  const byDate: Record<string, any[]> = {};
  for (const event of events.results) {
    const date = event.event_date;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(event);
  }

  return c.json({ events: byDate });
});

// Team performance
dashboardRoutes.get("/team-performance", async (c) => {
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE e.deleted_at IS NULL AND e.status = 'active'";
  const params: unknown[] = [];

  if (dateFrom) { where += " AND ev.event_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND ev.event_date <= ?"; params.push(dateTo); }

  const performance = await c.env.DB.prepare(
    `SELECT e.id, e.name, e.employee_id, e.role,
       COUNT(DISTINCT a.id) as total_assignments,
       COUNT(DISTINCT CASE WHEN at.status = 'present' THEN at.id END) as days_present,
       COUNT(DISTINCT CASE WHEN at.status = 'late' THEN at.id END) as days_late,
       COUNT(DISTINCT CASE WHEN at.status = 'absent' THEN at.id END) as days_absent,
       COUNT(DISTINCT CASE WHEN at.status = 'left_early' THEN at.id END) as days_left_early
     FROM studio_employees e
     LEFT JOIN studio_assignments a ON e.id = a.employee_id AND a.deleted_at IS NULL
     LEFT JOIN studio_events ev ON a.event_id = ev.id AND ev.deleted_at IS NULL
     LEFT JOIN studio_attendance at ON a.id = at.assignment_id AND at.deleted_at IS NULL
     ${where}
     GROUP BY e.id ORDER BY total_assignments DESC`
  ).bind(...params).all();

  return c.json({ team: performance.results });
});

// Client insights
dashboardRoutes.get("/clients", async (c) => {
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE c.deleted_at IS NULL";
  const params: unknown[] = [];

  if (dateFrom) { where += " AND p.booking_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND p.booking_date <= ?"; params.push(dateTo); }

  const clients = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.type, c.email, c.phone, c.lead_source,
       COUNT(DISTINCT p.id) as total_projects,
       COUNT(DISTINCT CASE WHEN p.status = 'COMPLETED' THEN p.id END) as completed_projects,
       SUM(p.total_agreed_amount) as total_value,
       MAX(p.booking_date) as last_project_date
     FROM studio_clients c
     LEFT JOIN studio_projects p ON c.id = p.client_id AND p.deleted_at IS NULL
     ${where}
     GROUP BY c.id ORDER BY total_value DESC NULLS LAST LIMIT 50`
  ).bind(...params).all();

  // Lead source breakdown
  const leadSources = await c.env.DB.prepare(
    `SELECT lead_source, COUNT(*) as count FROM studio_clients
     WHERE lead_source IS NOT NULL AND deleted_at IS NULL
     GROUP BY lead_source ORDER BY count DESC`
  ).all();

  return c.json({ topClients: clients.results, leadSources: leadSources.results });
});

// Equipment utilization
dashboardRoutes.get("/equipment-utilization", async (c) => {
  const { dateFrom, dateTo } = c.req.query();

  let where = "WHERE eq.deleted_at IS NULL";
  const params: unknown[] = [];

  if (dateFrom) { where += " AND a.checkout_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND a.checkout_date <= ?"; params.push(dateTo); }

  const utilization = await c.env.DB.prepare(
    `SELECT eq.id, eq.name, eq.equipment_id, eq.category, eq.status,
       COUNT(a.id) as total_allocations,
       SUM(CASE WHEN a.actual_return_date IS NOT NULL THEN
         julianday(a.actual_return_date) - julianday(a.checkout_date)
       ELSE
         julianday('now') - julianday(a.checkout_date)
       END) as total_days_allocated
     FROM studio_equipment eq
     LEFT JOIN studio_equipment_allocations a ON eq.id = a.equipment_id AND a.deleted_at IS NULL
     ${where}
     GROUP BY eq.id ORDER BY total_allocations DESC`
  ).bind(...params).all();

  return c.json({ utilization: utilization.results });
});

export { dashboardRoutes };