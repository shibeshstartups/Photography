import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types.js";

const configRoutes = new Hono<{ Bindings: Env }>();

const configSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  category: z.string().max(50).optional(),
});

// List config
configRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
      isPublic: z.boolean().optional(),
      includePrivate: z.boolean().default(false),
    })
  ),
  async (c) => {
    const user = c.get("user");
    const { category, isPublic, includePrivate } = c.req.valid("query");

    let where = "WHERE 1=1";
    const params: unknown[] = [];

    if (!includePrivate || !user.permissions.includes("admin")) {
      where += " AND is_public = 1";
    }
    if (isPublic !== undefined) { where += " AND is_public = ?"; params.push(isPublic ? 1 : 0); }
    if (category) { where += " AND category = ?"; params.push(category); }

    const configs = await c.env.DB.prepare(
      `SELECT ${includePrivate && user.permissions.includes("admin") ? "*" : "key, value, description, is_public, category"} FROM studio_config ${where} ORDER BY category, key`
    ).bind(...params).all();

    return c.json(configs.results);
  }
);

// Get config
configRoutes.get("/:key", async (c) => {
  const key = c.req.param("key");
  const user = c.get("user");

  const config = await c.env.DB.prepare(
    "SELECT * FROM studio_config WHERE key = ?"
  ).bind(key).first();

  if (!config) return c.json({ error: "Config not found" }, 404);

  if (!config.is_public && !user.permissions.includes("admin")) {
    return c.json({ error: "Config not found" }, 404);
  }

  return c.json(config);
});

// Create config (admin only)
configRoutes.post(
  "/",
  zValidator("json", configSchema),
  async (c) => {
    const user = c.get("user");
    if (!user.permissions.includes("admin")) {
      return c.json({ error: "Admin only" }, 403);
    }

    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT key FROM studio_config WHERE key = ?").bind(data.key).first();
    if (existing) return c.json({ error: "Config key already exists" }, 409);

    await c.env.DB.prepare(
      `INSERT INTO studio_config (key, value, description, is_public, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.key, JSON.stringify(data.value), data.description || null,
      data.isPublic ? 1 : 0, data.category || "general",
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const config = await c.env.DB.prepare("SELECT * FROM studio_config WHERE key = ?").bind(data.key).first();
    return c.json(config, 201);
  }
);

// Update config (admin only)
configRoutes.patch(
  "/:key",
  zValidator("json", configSchema.partial()),
  async (c) => {
    const user = c.get("user");
    if (!user.permissions.includes("admin")) {
      return c.json({ error: "Admin only" }, 403);
    }

    const key = c.req.param("key");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_config WHERE key = ?").bind(key).first();
    if (!existing) return c.json({ error: "Config not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.value !== undefined) {
      updates.push("value = ?");
      params.push(JSON.stringify(data.value));
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      params.push(data.description);
    }
    if (data.isPublic !== undefined) {
      updates.push("is_public = ?");
      params.push(data.isPublic ? 1 : 0);
    }
    if (data.category !== undefined) {
      updates.push("category = ?");
      params.push(data.category);
    }

    if (updates.length === 0) return c.json(existing);

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(key);

    await c.env.DB.prepare(`UPDATE studio_config SET ${updates.join(", ")} WHERE key = ?`).bind(...params).run();

    const config = await c.env.DB.prepare("SELECT * FROM studio_config WHERE key = ?").bind(key).first();
    return c.json(config);
  }
);

// Delete config (admin only)
configRoutes.delete("/:key", async (c) => {
  const user = c.get("user");
  if (!user.permissions.includes("admin")) {
    return c.json({ error: "Admin only" }, 403);
  }

  const key = c.req.param("key");
  await c.env.DB.prepare("DELETE FROM studio_config WHERE key = ?").bind(key).run();
  return c.json({ success: true });
});

// Bulk update (admin only)
configRoutes.post("/bulk", async (c) => {
  const user = c.get("user");
  if (!user.permissions.includes("admin")) {
    return c.json({ error: "Admin only" }, 403);
  }

  const { configs } = await c.req.json<{ configs: z.infer<typeof configSchema>[] }>();

  const results = [];
  for (const data of configs) {
    const existing = await c.env.DB.prepare("SELECT * FROM studio_config WHERE key = ?").bind(data.key).first();
    if (existing) {
      await c.env.DB.prepare(
        "UPDATE studio_config SET value = ?, description = ?, is_public = ?, category = ?, updated_at = ? WHERE key = ?"
      ).bind(JSON.stringify(data.value), data.description || null, data.isPublic ? 1 : 0, data.category || "general", new Date().toISOString(), data.key).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO studio_config (key, value, description, is_public, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(data.key, JSON.stringify(data.value), data.description || null, data.isPublic ? 1 : 0, data.category || "general", new Date().toISOString(), new Date().toISOString()).run();
    }
    results.push(data.key);
  }

  return c.json({ updated: results });
});

// Get categories
configRoutes.get("/meta/categories", async (c) => {
  const cats = await c.env.DB.prepare(
    "SELECT DISTINCT category FROM studio_config WHERE category IS NOT NULL ORDER BY category"
  ).all();
  return c.json(cats.results.map((c: any) => c.category).filter(Boolean));
});

// System info (public)
configRoutes.get("/system/info", async (c) => {
  const version = await c.env.DB.prepare("SELECT value FROM studio_config WHERE key = 'app.version'").first<{ value: string }>();
  const name = await c.env.DB.prepare("SELECT value FROM studio_config WHERE key = 'app.name'").first<{ value: string }>();
  const maintenance = await c.env.DB.prepare("SELECT value FROM studio_config WHERE key = 'maintenance.mode'").first<{ value: string }>();

  return c.json({
    name: name?.value ? JSON.parse(name.value) : "Photography Studio ERP",
    version: version?.value ? JSON.parse(version.value) : "1.0.0",
    maintenanceMode: maintenance?.value ? JSON.parse(maintenance.value) : false,
    serverTime: new Date().toISOString(),
  });
});

export { configRoutes };