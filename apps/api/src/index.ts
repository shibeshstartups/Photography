import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { clientRoutes } from "./routes/clients.js";
import { employeeRoutes } from "./routes/employees.js";
import { eventRoutes } from "./routes/events.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { editingRoutes } from "./routes/editing.js";
import { financeRoutes } from "./routes/finance.js";
import { equipmentRoutes } from "./routes/equipment.js";
import { mediaRoutes } from "./routes/media.js";
import { notificationRoutes } from "./routes/notifications.js";
import { syncRoutes } from "./routes/sync.js";
import { auditRoutes } from "./routes/audit.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { configRoutes } from "./routes/config.js";
import { portalRoutes } from "./routes/portal.js";

import { authMiddleware } from "./middleware/auth.js";
import { permissionMiddleware } from "./middleware/permissions.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";

import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "https://*.pages.dev"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Device-ID"],
  credentials: true,
}));

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Rate limiting
app.use("*", rateLimitMiddleware);

// Public routes (no auth)
app.route("/api/auth", authRoutes);

// Protected routes
app.use("/api/*", authMiddleware);
app.use("/api/*", permissionMiddleware);

// API routes
app.route("/api/projects", projectRoutes);
app.route("/api/clients", clientRoutes);
app.route("/api/employees", employeeRoutes);
app.route("/api/events", eventRoutes);
app.route("/api/assignments", assignmentRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/editing", editingRoutes);
app.route("/api/finance", financeRoutes);
app.route("/api/equipment", equipmentRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/sync", syncRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/config", configRoutes);

// Client portal routes (separate auth)
app.route("/api/portal", portalRoutes);

// Error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;