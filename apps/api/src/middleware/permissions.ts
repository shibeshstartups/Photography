import { Context, Next } from "hono";
import type { Env } from "../types.js";

const PERMISSION_MAP: Record<string, string[]> = {
  "/api/projects": ["projects:read", "projects:write", "projects:manage"],
  "/api/clients": ["clients:read", "clients:write"],
  "/api/employees": ["crew:read", "crew:write", "crew:assign"],
  "/api/events": ["events:read", "events:write"],
  "/api/assignments": ["crew:read", "crew:write", "crew:assign"],
  "/api/attendance": ["attendance:read", "attendance:write"],
  "/api/editing": ["editing:read", "editing:write"],
  "/api/finance": ["finance:read", "finance:write"],
  "/api/equipment": ["equipment:read", "equipment:write"],
  "/api/media": ["clients:read", "projects:read"],
  "/api/notifications": [], // Everyone can read their own notifications
  "/api/sync": [], // Sync has its own validation
  "/api/audit": ["audit:read"],
  "/api/dashboard": ["reports:read"],
  "/api/config": ["admin"],
};

function getRequiredPermissions(path: string): string[] {
  for (const [prefix, perms] of Object.entries(PERMISSION_MAP)) {
    if (path.startsWith(prefix)) return perms;
  }
  return [];
}

export async function permissionMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get("user") as { permissions: string[] } | undefined;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const path = c.req.path;
  const required = getRequiredPermissions(path);
  const method = c.req.method;

  // Admin bypasses all permissions
  if (user.permissions.includes("admin")) return next();

  // For write operations, check write permissions
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const hasRead = required.some(p => p.endsWith(":read") && user.permissions.includes(p));
  const hasWrite = required.some(p => p.endsWith(":write") && user.permissions.includes(p));
  const hasManage = required.some(p => p.endsWith(":manage") && user.permissions.includes(p));

  if (isWrite && !(hasWrite || hasManage)) {
    return c.json({ error: "Insufficient permissions for write operation" }, 403);
  }

  if (!isWrite && !hasRead) {
    return c.json({ error: "Insufficient permissions for read operation" }, 403);
  }

  return next();
}