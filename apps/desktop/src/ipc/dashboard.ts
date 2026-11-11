import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { nowIso, todayString, round2 } from "@studio-erp/shared";

export function registerDashboardHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // Executive dashboard overview
  createHandler("dashboard:overview", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const today = todayString();

    // Projects overview
    const totalProjects = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_projects WHERE deleted_at IS NULL");
    const activeProjects = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_projects WHERE deleted_at IS NULL AND status NOT IN ('COMPLETED', 'CANCELLED')");
    const completedProjects = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_projects WHERE deleted_at IS NULL AND status = 'COMPLETED'");

    // Projects by status
    const projectsByStatus = db.all<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM studio_projects WHERE deleted_at IS NULL GROUP BY status"
    );

    // Upcoming events (next 30 days)
    const upcomingEvents = db.all<any>(
      `SELECT e.*, p.title as project_title, p.project_id
       FROM studio_events e
       JOIN studio_projects p ON e.project_id = p.id
       WHERE e.deleted_at IS NULL AND e.event_date >= ? AND e.event_date <= date(?, '+30 day')
       ORDER BY e.event_date ASC, e.start_time ASC
       LIMIT 10`,
      [today, today]
    );

    // Finance summary (current month)
    const monthStart = todayString().substring(0, 8) + "01";
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const payments = db.all<{ type: string; amount: number }>(
      `SELECT type, amount FROM studio_payments WHERE deleted_at IS NULL AND paid_at BETWEEN ? AND ?`,
      [monthStart, monthEnd]
    );
    const expenses = db.all<{ category: string; amount: number }>(
      `SELECT category, amount FROM studio_expenses WHERE deleted_at IS NULL AND spent_at BETWEEN ? AND ?`,
      [monthStart, monthEnd]
    );

    const totalRevenue = payments.filter(p => p.type !== "refund").reduce((sum, p) => sum + p.amount, 0);
    const totalRefunds = payments.filter(p => p.type === "refund").reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Crew utilization
    const activeAssignments = db.all<any>(
      `SELECT a.*, e.full_name as employee_name
       FROM studio_assignments a
       JOIN studio_employees e ON a.employee_id = e.id
       WHERE a.deleted_at IS NULL AND a.status IN ('confirmed', 'tentative') AND a.assignment_date >= ? AND a.assignment_date <= date(?, '+7 day')
       ORDER BY a.assignment_date ASC`,
      [today, today]
    );

    const employeeWorkload = new Map<string, { name: string; days: number }>();
    for (const a of activeAssignments) {
      const key = a.employee_id;
      const current = employeeWorkload.get(key) || { name: a.employee_name, days: 0 };
      current.days += 1;
      employeeWorkload.set(key, current);
    }

    // Editing pipeline
    const editingTasks = db.all<{ status: string }>(
      "SELECT status FROM studio_editing_tasks WHERE deleted_at IS NULL"
    );
    const editingByStatus = editingTasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Equipment availability
    const equipmentStats = {
      total: db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_equipment WHERE deleted_at IS NULL")?.count || 0,
      available: db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_equipment WHERE deleted_at IS NULL AND availability = 'available'")?.count || 0,
      inUse: db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_equipment WHERE deleted_at IS NULL AND availability = 'in_use'")?.count || 0,
      inRepair: db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_equipment WHERE deleted_at IS NULL AND availability = 'in_repair'")?.count || 0,
    };

    // Sync status
    const pendingSync = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_sync_outbox WHERE status = 'pending'")?.count || 0;
    const conflictedSync = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_sync_outbox WHERE status = 'conflict'")?.count || 0;

    return {
      timestamp: nowIso(),
      projects: {
        total: totalProjects?.count || 0,
        active: activeProjects?.count || 0,
        completed: completedProjects?.count || 0,
        byStatus: projectsByStatus.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {} as Record<string, number>),
      },
      upcomingEvents: upcomingEvents.map(e => ({
        id: e.id,
        eventId: e.event_id,
        eventType: e.event_type,
        eventDate: e.event_date,
        startTime: e.start_time,
        endTime: e.end_time,
        venue: e.venue,
        projectTitle: e.project_title,
        projectId: e.project_id,
      })),
      finance: {
        period: { from: monthStart, to: monthEnd },
        revenue: totalRevenue,
        refunds: totalRefunds,
        netRevenue: totalRevenue - totalRefunds,
        expenses: totalExpenses,
        profit: totalRevenue - totalRefunds - totalExpenses,
        profitMargin: totalRevenue > 0 ? round2(((totalRevenue - totalRefunds - totalExpenses) / totalRevenue) * 100) : 0,
      },
      crew: {
        assignmentsThisWeek: activeAssignments.length,
        topEmployees: Array.from(employeeWorkload.entries())
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => b.days - a.days)
          .slice(0, 5),
      },
      editing: {
        total: editingTasks.length,
        byStatus: editingByStatus,
      },
      equipment: equipmentStats,
      sync: {
        pending: pendingSync,
        conflicts: conflictedSync,
        status: conflictedSync > 0 ? "conflict" : (pendingSync > 0 ? "pending" : "synced"),
      },
    };
  }, db);

  // Project timeline view
  createHandler("dashboard:project-timeline", async (event: IpcMainInvokeEvent, projectId: string) => {
    requireAuth(event);
    const project = db.get("SELECT * FROM studio_projects WHERE id = ? AND deleted_at IS NULL", [projectId]);
    if (!project) throw new Error("Project not found");

    const events = db.all(
      `SELECT * FROM studio_events WHERE project_id = ? AND deleted_at IS NULL ORDER BY event_date ASC, start_time ASC`,
      [projectId]
    );

    const timeline = events.map(e => {
      const assignments = db.all(
        `SELECT a.*, emp.full_name, emp.designation
         FROM studio_assignments a
         JOIN studio_employees emp ON a.employee_id = emp.id
         WHERE a.event_id = ? AND a.deleted_at IS NULL`,
        [e.id]
      );
      return {
        event: e,
        assignments,
        segments: db.all("SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL", [e.id]),
      };
    });

    const editingTasks = db.all("SELECT * FROM studio_editing_tasks WHERE project_id = ? AND deleted_at IS NULL", [projectId]);
    const payments = db.all("SELECT * FROM studio_payments WHERE project_id = ? AND deleted_at IS NULL ORDER BY paid_at DESC", [projectId]);
    const expenses = db.all("SELECT * FROM studio_expenses WHERE project_id = ? AND deleted_at IS NULL ORDER BY spent_at DESC", [projectId]);

    return { project, timeline, editingTasks, payments, expenses };
  }, db);

  // Employee workload calendar
  createHandler("dashboard:employee-workload", async (event: IpcMainInvokeEvent, dateFrom: string, dateTo: string) => {
    requireAuth(event);
    const assignments = db.all<any>(
      `SELECT a.*, e.full_name, e.designation, ev.event_type, ev.event_date, ev.start_time, ev.end_time, p.title as project_title
       FROM studio_assignments a
       JOIN studio_employees e ON a.employee_id = e.id
       LEFT JOIN studio_events ev ON a.event_id = ev.id
       LEFT JOIN studio_projects p ON a.project_id = p.id
       WHERE a.deleted_at IS NULL AND a.assignment_date BETWEEN ? AND ?
       ORDER BY e.full_name, a.assignment_date, ev.start_time`,
      [dateFrom, dateTo]
    );

    const byEmployee = new Map<string, any>();
    for (const a of assignments) {
      if (!byEmployee.has(a.employee_id)) {
        byEmployee.set(a.employee_id, {
          employee: { id: a.employee_id, fullName: a.full_name, designation: a.designation },
          assignments: [],
        });
      }
      byEmployee.get(a.employee_id).assignments.push(a);
    }

    return Array.from(byEmployee.values());
  }, db);

  // Revenue chart data
  createHandler("dashboard:revenue-chart", async (event: IpcMainInvokeEvent, months: number = 12) => {
    requireAuth(event);
    const data: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

      const payments = db.all<{ type: string; amount: number }>(
        `SELECT type, amount FROM studio_payments WHERE deleted_at IS NULL AND paid_at >= ? AND paid_at < ?`,
        [monthStart, monthEnd]
      );
      const expenses = db.all<{ amount: number }>(
        `SELECT amount FROM studio_expenses WHERE deleted_at IS NULL AND spent_at >= ? AND spent_at < ?`,
        [monthStart, monthEnd]
      );

      const revenue = payments.filter(p => p.type !== "refund").reduce((sum, p) => sum + p.amount, 0);
      const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

      data.push({
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        revenue: round2(revenue),
        expenses: round2(expenseTotal),
        profit: round2(revenue - expenseTotal),
      });
    }

    return data;
  }, db);

  // Project status funnel
  createHandler("dashboard:project-funnel", async (event: IpcMainInvokeEvent) => {
    requireAuth(event);
    const stages = [
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
    ];

    const funnel = stages.map(stage => {
      const count = db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM studio_projects WHERE deleted_at IS NULL AND status = ?",
        [stage]
      )?.count || 0;
      return { stage, count };
    });

    return funnel;
  }, db);
}