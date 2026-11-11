import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { createHandler, requireAuth } from "./base.js";
import { logger } from "../logger.js";
import { uuid, nowIso, hashString } from "@studio-erp/shared";
import type { User, NewUser } from "@studio-erp/database";

export function registerAuthHandlers(ipcMain: typeof import("electron").ipcMain, db: Database) {
  // Login
  createHandler("auth:login", async (event: IpcMainInvokeEvent, email: string, password: string) => {
    const user = db.get<User>("SELECT * FROM studio_users WHERE email = ? AND status = 'active'", [email]);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // In a real app, verify password hash with bcrypt/argon2
    // For now, we'll do a simple check
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      throw new Error("Invalid credentials");
    }

    // Update last login
    db.run("UPDATE studio_users SET last_login_at = ? WHERE id = ?", [nowIso(), user.id]);

    const deviceId = await getOrCreateDevice(db, user.id, "desktop");

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: JSON.parse(user.permissions),
        status: user.status,
      },
      deviceId,
      token: generateToken(user.id, deviceId),
    };
  }, db);

  // Register first admin user (setup)
  createHandler("auth:register", async (event: IpcMainInvokeEvent, data: { email: string; name: string; password: string }) => {
    const existing = db.get<{ count: number }>("SELECT COUNT(*) as count FROM studio_users");
    if (existing && existing.count > 0) {
      throw new Error("Registration not allowed - users already exist");
    }

    const id = uuid();
    const passwordHash = await hashPassword(data.password);
    const permissions = ["admin", "audit:read", "device:manage", "clients:read", "clients:write", "projects:read", "projects:write", "projects:manage", "events:read", "events:write", "crew:read", "crew:write", "crew:assign", "attendance:read", "attendance:write", "editing:read", "editing:write", "finance:read", "finance:write", "equipment:read", "equipment:write", "reports:read", "portal:access"];

    db.run(
      `INSERT INTO studio_users (id, email, name, password_hash, role, permissions, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.email, data.name, passwordHash, "Administrator", JSON.stringify(permissions), "active", nowIso(), nowIso()]
    );

    const user = db.get<User>("SELECT * FROM studio_users WHERE id = ?", [id]);
    if (!user) throw new Error("Failed to create user");

    const deviceId = await getOrCreateDevice(db, user.id, "desktop");

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: JSON.parse(user.permissions),
        status: user.status,
      },
      deviceId,
      token: generateToken(user.id, deviceId),
    };
  }, db);

  // Get current user
  createHandler("auth:me", async (event: IpcMainInvokeEvent) => {
    const auth = requireAuth(event);
    const user = db.get<User>("SELECT * FROM studio_users WHERE id = ? AND status = 'active'", [auth.userId]);
    if (!user) throw new Error("User not found");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: JSON.parse(user.permissions),
      status: user.status,
    };
  }, db);

  // Change password
  createHandler("auth:change-password", async (event: IpcMainInvokeEvent, currentPassword: string, newPassword: string) => {
    const auth = requireAuth(event);
    const user = db.get<User>("SELECT * FROM studio_users WHERE id = ?", [auth.userId]);
    if (!user) throw new Error("User not found");

    const validPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!validPassword) throw new Error("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    db.run("UPDATE studio_users SET password_hash = ?, updated_at = ? WHERE id = ?", [passwordHash, nowIso(), auth.userId]);

    return { success: true };
  }, db);

  // List users (admin)
  createHandler("auth:list-users", async (event: IpcMainInvokeEvent) => {
    const auth = requireAuth(event);
    // Check admin permission
    const user = db.get<User>("SELECT * FROM studio_users WHERE id = ?", [auth.userId]);
    if (!user || !JSON.parse(user.permissions).includes("admin")) {
      throw new Error("Insufficient permissions");
    }

    const users = db.all<User>("SELECT id, email, name, role, permissions, status, created_at, last_login_at FROM studio_users WHERE deleted_at IS NULL");
    return users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      permissions: JSON.parse(u.permissions),
      status: u.status,
      created_at: u.created_at,
      last_login_at: u.last_login_at,
    }));
  }, db);

  // Update user (admin)
  createHandler("auth:update-user", async (event: IpcMainInvokeEvent, userId: string, data: Partial<{ name: string; role: string; status: string; permissions: string[] }>) => {
    const auth = requireAuth(event);
    const currentUser = db.get<User>("SELECT * FROM studio_users WHERE id = ?", [auth.userId]);
    if (!currentUser || !JSON.parse(currentUser.permissions).includes("admin")) {
      throw new Error("Insufficient permissions");
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.name) { updates.push("name = ?"); params.push(data.name); }
    if (data.role) { updates.push("role = ?"); params.push(data.role); }
    if (data.status) { updates.push("status = ?"); params.push(data.status); }
    if (data.permissions) { updates.push("permissions = ?"); params.push(JSON.stringify(data.permissions)); }
    updates.push("updated_at = ?");
    params.push(nowIso());
    params.push(userId);

    db.run(`UPDATE studio_users SET ${updates.join(", ")} WHERE id = ?`, params);
    return { success: true };
  }, db);
}

async function getOrCreateDevice(db: Database, userId: string, platform: string): Promise<string> {
  const existing = db.get<{ id: string }>("SELECT id FROM studio_devices WHERE user_id = ? AND platform = ? AND revoked = 0 ORDER BY last_seen DESC LIMIT 1", [userId, platform]);
  if (existing) {
    db.run("UPDATE studio_devices SET last_seen = ? WHERE id = ?", [nowIso(), existing.id]);
    return existing.id;
  }

  const id = uuid();
  db.run(
    `INSERT INTO studio_devices (id, user_id, name, platform, user_agent, created_at, last_seen, revoked)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, userId, `Desktop (${platform})`, platform, "Electron", nowIso(), nowIso()]
  );
  return id;
}

function generateToken(userId: string, deviceId: string): string {
  // Simple token for demo - in production use JWT
  return Buffer.from(JSON.stringify({ userId, deviceId, iat: Date.now() })).toString("base64url");
}

async function hashPassword(password: string): Promise<string> {
  // In production, use bcrypt or argon2
  // For now, simple hash with salt
  const salt = uuid().slice(0, 16);
  const hash = hashString(password + salt);
  return `sha256:${salt}:${hash}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash.startsWith("sha256:")) return false;
  const [, salt, hash] = passwordHash.split(":");
  const computedHash = hashString(password + salt);
  return computedHash === hash;
}