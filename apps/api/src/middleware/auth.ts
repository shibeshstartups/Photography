import { Context, Next } from "hono";
import { verify } from "hono/jwt";
import type { Env, AuthUser, Device } from "../types.js";

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing or invalid token" }, 401);
  }

  const token = authHeader.substring(7);
  const deviceId = c.req.header("X-Device-ID");

  try {
    const payload = await verify(token, c.env.JWT_SECRET) as { userId: string; deviceId: string; iat: number; exp: number };

    if (payload.exp * 1000 < Date.now()) {
      return c.json({ error: "Token expired" }, 401);
    }

    // Verify user exists and is active
    const user = await c.env.DB.prepare(
      "SELECT * FROM studio_users WHERE id = ? AND status = 'active' AND deleted_at IS NULL"
    ).bind(payload.userId).first<AuthUser>();

    if (!user) {
      return c.json({ error: "User not found or inactive" }, 401);
    }

    // Verify device is registered and not revoked
    const device = await c.env.DB.prepare(
      "SELECT * FROM studio_devices WHERE id = ? AND user_id = ? AND revoked = 0 AND deleted_at IS NULL"
    ).bind(payload.deviceId, payload.userId).first<Device>();

    if (!device) {
      return c.json({ error: "Device not registered or revoked" }, 401);
    }

    // If X-Device-ID provided, verify it matches
    if (deviceId && deviceId !== payload.deviceId) {
      return c.json({ error: "Device ID mismatch" }, 401);
    }

    // Update device last seen
    await c.env.DB.prepare(
      "UPDATE studio_devices SET last_seen_at = ? WHERE id = ?"
    ).bind(new Date().toISOString(), payload.deviceId).run();

    // Attach user and device to context
    c.set("user", {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: JSON.parse(user.permissions || "[]"),
      status: user.status,
    });
    c.set("device", device);
    c.set("tokenPayload", payload);

    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
}