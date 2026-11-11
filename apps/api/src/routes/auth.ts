import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sign, verify } from "hono/jwt";
import { createId } from "@paralleldrive/cuid2";
import type { Env, AuthUser, Device } from "../types.js";

const authRoutes = new Hono<{ Bindings: Env }>();

// Login
authRoutes.post(
  "/login",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      deviceId: z.string().optional(),
      deviceName: z.string().optional(),
      platform: z.enum(["windows", "macos", "linux", "web"]).optional(),
    })
  ),
  async (c) => {
    const { email, password, deviceId, deviceName, platform } = c.req.valid("json");

    const user = await c.env.DB.prepare(
      "SELECT * FROM studio_users WHERE email = ? AND status = 'active' AND deleted_at IS NULL"
    ).bind(email).first<AuthUser>();

    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // In production, verify password with bcrypt/argon2
    // For now, simple hash check
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Update last login
    await c.env.DB.prepare(
      "UPDATE studio_users SET last_login_at = ? WHERE id = ?"
    ).bind(new Date().toISOString(), user.id).run();

    // Get or create device
    let device: Device | null = null;
    if (deviceId) {
      device = await c.env.DB.prepare(
        "SELECT * FROM studio_devices WHERE id = ? AND user_id = ? AND revoked = 0 AND deleted_at IS NULL"
      ).bind(deviceId, user.id).first<Device>();
    }

    if (!device) {
      const newDeviceId = createId();
      await c.env.DB.prepare(
        `INSERT INTO studio_devices (id, user_id, name, platform, user_agent, device_key_hash, created_at, last_seen_at, revoked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).bind(
        newDeviceId,
        user.id,
        deviceName || `Device (${platform || "web"})`,
        platform || "web",
        c.req.header("User-Agent") || "",
        await hashDeviceKey(newDeviceId),
        new Date().toISOString(),
        new Date().toISOString()
      ).run();

      device = await c.env.DB.prepare(
        "SELECT * FROM studio_devices WHERE id = ?"
      ).bind(newDeviceId).first<Device>();
    } else {
      // Update last seen
      await c.env.DB.prepare(
        "UPDATE studio_devices SET last_seen_at = ? WHERE id = ?"
      ).bind(new Date().toISOString(), device.id).run();
    }

    // Generate JWT
    const token = await sign(
      {
        userId: user.id,
        deviceId: device!.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      },
      c.env.JWT_SECRET
    );

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: JSON.parse(user.permissions || "[]"),
        status: user.status,
      },
      device: {
        id: device!.id,
        name: device!.name,
        platform: device!.platform,
      },
      token,
    });
  }
);

// Register first admin user
authRoutes.post(
  "/register",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      name: z.string().min(2),
      password: z.string().min(8),
      deviceName: z.string().optional(),
      platform: z.enum(["windows", "macos", "linux", "web"]).optional(),
    })
  ),
  async (c) => {
    const { email, name, password, deviceName, platform } = c.req.valid("json");

    // Check if any users exist
    const existing = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM studio_users WHERE deleted_at IS NULL"
    ).first<{ count: number }>();

    if (existing && existing.count > 0) {
      return c.json({ error: "Registration not allowed - users already exist" }, 403);
    }

    const userId = createId();
    const passwordHash = await hashPassword(password);
    const permissions = [
      "admin", "audit:read", "device:manage",
      "clients:read", "clients:write",
      "projects:read", "projects:write", "projects:manage",
      "events:read", "events:write",
      "crew:read", "crew:write", "crew:assign",
      "attendance:read", "attendance:write",
      "editing:read", "editing:write",
      "finance:read", "finance:write",
      "equipment:read", "equipment:write",
      "reports:read", "portal:access"
    ];

    await c.env.DB.prepare(
      `INSERT INTO studio_users (id, email, name, password_hash, role, permissions, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).bind(
      userId, email, name, passwordHash, "Administrator",
      JSON.stringify(permissions), new Date().toISOString(), new Date().toISOString()
    ).run();

    // Create device
    const deviceId = createId();
    await c.env.DB.prepare(
      `INSERT INTO studio_devices (id, user_id, name, platform, user_agent, device_key_hash, created_at, last_seen_at, revoked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(
      deviceId, userId, deviceName || `Desktop (${platform || "web"})`,
      platform || "web", c.req.header("User-Agent") || "",
      await hashDeviceKey(deviceId), new Date().toISOString(), new Date().toISOString()
    ).run();

    const token = await sign(
      { userId, deviceId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 },
      c.env.JWT_SECRET
    );

    return c.json({
      user: { id: userId, email, name, role: "Administrator", permissions, status: "active" },
      device: { id: deviceId, name: deviceName || `Desktop (${platform || "web"})`, platform: platform || "web" },
      token,
    });
  }
);

// Get current user
authRoutes.get("/me", async (c) => {
  // This would be called with auth middleware
  return c.json({ message: "Use auth middleware" });
});

// Change password
authRoutes.post(
  "/change-password",
  zValidator(
    "json",
    z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    })
  ),
  async (c) => {
    // Would need auth middleware
    return c.json({ message: "Implement with auth middleware" });
  }
);

// List users (admin)
authRoutes.get("/users", async (c) => {
  // Would need admin permission
  return c.json({ message: "Implement with auth middleware" });
});

// Update user (admin)
authRoutes.patch("/users/:id", async (c) => {
  // Would need admin permission
  return c.json({ message: "Implement with auth middleware" });
});

// Device management
authRoutes.get("/devices", async (c) => {
  // Would need auth middleware
  return c.json({ message: "Implement with auth middleware" });
});

authRoutes.post("/devices/:id/revoke", async (c) => {
  // Would need admin permission
  return c.json({ message: "Implement with auth middleware" });
});

export { authRoutes };

// Helper functions
async function hashPassword(password: string): Promise<string> {
  // In production, use bcrypt or argon2
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === passwordHash;
}

async function hashDeviceKey(deviceId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceId + "device-secret");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}