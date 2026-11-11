import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { verify, sign } from "hono/jwt";
import type { Env } from "../types.js";

const portalRoutes = new Hono<{ Bindings: Env }>();

// Client portal authentication (separate from admin)
const portalAuthSchema = z.object({
  email: z.string().email(),
  accessCode: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

portalRoutes.post(
  "/auth",
  zValidator("json", portalAuthSchema),
  async (c) => {
    const { email, accessCode, projectId } = c.req.valid("json");

    // Find client by email
    const client = await c.env.DB.prepare(
      "SELECT * FROM studio_clients WHERE email = ? AND deleted_at IS NULL"
    ).bind(email).first();

    if (!client) return c.json({ error: "Client not found" }, 404);

    // If projectId provided, verify access
    if (projectId) {
      const project = await c.env.DB.prepare(
        "SELECT * FROM studio_projects WHERE id = ? AND client_id = ? AND deleted_at IS NULL"
      ).bind(projectId, client.id).first();

      if (!project) return c.json({ error: "Project not found or access denied" }, 403);

      // Generate portal token
      const token = await sign(
        {
          clientId: client.id,
          projectId: project.id,
          type: "portal",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
        c.env.JWT_SECRET
      );

      return c.json({
        client: { id: client.id, name: client.name, email: client.email, type: client.type },
        project: { id: project.id, projectId: project.project_id, title: project.title, status: project.status },
        token,
      });
    }

    // If accessCode provided, find album
    if (accessCode) {
      const album = await c.env.DB.prepare(
        "SELECT * FROM studio_albums WHERE access_code = ? AND is_public = 1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at >= ?)"
      ).bind(accessCode, new Date().toISOString().split("T")[0]).first();

      if (!album) return c.json({ error: "Invalid or expired access code" }, 404);

      // Verify client owns this album
      if (album.client_id && album.client_id !== client.id) {
        return c.json({ error: "Access denied" }, 403);
      }

      const token = await sign(
        {
          clientId: client.id,
          albumId: album.id,
          type: "portal_album",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
        c.env.JWT_SECRET
      );

      return c.json({
        client: { id: client.id, name: client.name, email: client.email, type: client.type },
        album: { id: album.id, title: album.title, description: album.description },
        token,
      });
    }

    // List client's projects
    const projects = await c.env.DB.prepare(
      "SELECT id, project_id, title, status, booking_date, venue FROM studio_projects WHERE client_id = ? AND deleted_at IS NULL ORDER BY booking_date DESC"
    ).bind(client.id).all();

    return c.json({
      client: { id: client.id, name: client.name, email: client.email, type: client.type },
      projects: projects.results,
    });
  }
);

// Portal middleware for client tokens
async function portalAuthMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verify(token, c.env.JWT_SECRET) as any;
    if (payload.type !== "portal" && payload.type !== "portal_album") {
      return c.json({ error: "Invalid token type" }, 401);
    }
    if (payload.exp * 1000 < Date.now()) {
      return c.json({ error: "Token expired" }, 401);
    }

    const client = await c.env.DB.prepare(
      "SELECT * FROM studio_clients WHERE id = ? AND deleted_at IS NULL"
    ).bind(payload.clientId).first();

    if (!client) return c.json({ error: "Client not found" }, 401);

    c.set("client", client);
    c.set("portalPayload", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

// Get client profile
portalRoutes.get("/profile", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  return c.json({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    type: client.type,
    address: client.address ? JSON.parse(client.address) : null,
    companyName: client.company_name,
    contactPerson: client.contact_person,
  });
});

// Update client profile
portalRoutes.patch("/profile", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const { name, phone, address } = await c.req.json();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (name) { updates.push("name = ?"); params.push(name); }
  if (phone) { updates.push("phone = ?"); params.push(phone); }
  if (address) { updates.push("address = ?"); params.push(JSON.stringify(address)); }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(client.id);
    await c.env.DB.prepare(`UPDATE studio_clients SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
  }

  const updated = await c.env.DB.prepare("SELECT * FROM studio_clients WHERE id = ?").bind(client.id).first();
  return c.json(updated);
});

// List client's projects
portalRoutes.get("/projects", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const { status } = c.req.query();

  let where = "WHERE client_id = ? AND deleted_at IS NULL";
  const params: unknown[] = [client.id];

  if (status) { where += " AND status = ?"; params.push(status); }

  const projects = await c.env.DB.prepare(
    `SELECT * FROM studio_projects ${where} ORDER BY booking_date DESC`
  ).bind(...params).all();

  return c.json(projects.results);
});

// Get project details
portalRoutes.get("/projects/:id", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const projectId = c.req.param("id");

  const project = await c.env.DB.prepare(
    "SELECT * FROM studio_projects WHERE id = ? AND client_id = ? AND deleted_at IS NULL"
  ).bind(projectId, client.id).first();

  if (!project) return c.json({ error: "Project not found" }, 404);

  // Get events
  const events = await c.env.DB.prepare(
    "SELECT * FROM studio_events WHERE project_id = ? AND deleted_at IS NULL ORDER BY event_date, start_time"
  ).bind(projectId).all();

  // Get payments
  const payments = await c.env.DB.prepare(
    "SELECT id, amount, payment_date, payment_method, type, reference_number FROM studio_payments WHERE project_id = ? AND deleted_at IS NULL ORDER BY payment_date DESC"
  ).bind(projectId).all();

  // Get invoices
  const invoices = await c.env.DB.prepare(
    "SELECT id, invoice_number, total, due_date, status FROM studio_invoices WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
  ).bind(projectId).all();

  // Get albums
  const albums = await c.env.DB.prepare(
    "SELECT id, title, description, cover_media_id, is_public, access_code, expires_at FROM studio_albums WHERE project_id = ? AND client_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
  ).bind(projectId, client.id).all();

  return c.json({
    ...project,
    events: events.results,
    payments: payments.results,
    invoices: invoices.results,
    albums: albums.results,
  });
});

// Get project events
portalRoutes.get("/projects/:id/events", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const projectId = c.req.param("id");

  const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND client_id = ?").bind(projectId, client.id).first();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const events = await c.env.DB.prepare(
    "SELECT * FROM studio_events WHERE project_id = ? AND deleted_at IS NULL ORDER BY event_date, start_time"
  ).bind(projectId).all();

  // Get segments for each event
  const eventsWithSegments = await Promise.all(events.results.map(async (event: any) => {
    const segments = await c.env.DB.prepare(
      "SELECT * FROM studio_event_segments WHERE event_id = ? AND deleted_at IS NULL ORDER BY order_index, start_time"
    ).bind(event.id).all();
    return { ...event, segments: segments.results };
  }));

  return c.json(eventsWithSegments);
});

// Get project albums
portalRoutes.get("/projects/:id/albums", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const projectId = c.req.param("id");

  const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND client_id = ?").bind(projectId, client.id).first();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const albums = await c.env.DB.prepare(
    "SELECT * FROM studio_albums WHERE project_id = ? AND client_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
  ).bind(projectId, client.id).all();

  return c.json(albums.results);
});

// Get album with media (public access via token)
portalRoutes.get("/albums/:id", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const albumId = c.req.param("id");
  const payload = c.get("portalPayload");

  const album = await c.env.DB.prepare(
    "SELECT * FROM studio_albums WHERE id = ? AND deleted_at IS NULL"
  ).bind(albumId).first();

  if (!album) return c.json({ error: "Album not found" }, 404);

  // Check access
  if (album.client_id && album.client_id !== client.id) {
    // Check if public with access code
    if (!album.is_public || (payload.type !== "portal_album" || payload.albumId !== albumId)) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  // Check expiry
  if (album.expires_at && album.expires_at < new Date().toISOString().split("T")[0]) {
    return c.json({ error: "Album expired" }, 404);
  }

  const media = await c.env.DB.prepare(
    "SELECT id, file_name, file_type, mime_type, width, height, duration, storage_provider, storage_path, created_at FROM studio_media WHERE album_id = ? AND is_client_visible = 1 AND deleted_at IS NULL ORDER BY created_at"
  ).bind(albumId).all();

  return c.json({
    album: {
      id: album.id,
      title: album.title,
      description: album.description,
      coverMediaId: album.cover_media_id,
      isPublic: album.is_public,
      accessCode: album.access_code,
      expiresAt: album.expires_at,
    },
    media: media.results,
  });
});

// Download media (generate signed URL)
portalRoutes.get("/media/:id/download", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const mediaId = c.req.param("id");

  const media = await c.env.DB.prepare(
    `SELECT m.*, a.client_id as album_client_id, p.client_id as project_client_id
     FROM studio_media m
     LEFT JOIN studio_albums a ON m.album_id = a.id
     LEFT JOIN studio_projects p ON m.project_id = p.id
     WHERE m.id = ? AND m.deleted_at IS NULL`
  ).bind(mediaId).first();

  if (!media) return c.json({ error: "Media not found" }, 404);

  // Check access
  const hasAccess = media.project_client_id === client.id || media.album_client_id === client.id || media.client_id === client.id;
  if (!hasAccess && !media.is_client_visible) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Generate signed URL for R2 or return local path
  let downloadUrl = media.storage_path;
  if (media.storage_provider === "r2" && c.env.R2_BUCKET) {
    // In production, generate presigned URL
    downloadUrl = `/api/portal/media/${mediaId}/signed-url`;
  }

  return c.json({ url: downloadUrl, fileName: media.file_name, mimeType: media.mime_type });
});

// Get signed URL for R2
portalRoutes.get("/media/:id/signed-url", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const mediaId = c.req.param("id");

  const media = await c.env.DB.prepare(
    `SELECT m.*, a.client_id as album_client_id, p.client_id as project_client_id
     FROM studio_media m
     LEFT JOIN studio_albums a ON m.album_id = a.id
     LEFT JOIN studio_projects p ON m.project_id = p.id
     WHERE m.id = ? AND m.deleted_at IS NULL`
  ).bind(mediaId).first();

  if (!media) return c.json({ error: "Media not found" }, 404);

  const hasAccess = media.project_client_id === client.id || media.album_client_id === client.id || media.client_id === client.id;
  if (!hasAccess && !media.is_client_visible) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (media.storage_provider !== "r2") {
    return c.json({ error: "Not an R2 object" }, 400);
  }

  // Generate presigned URL (simplified - use AWS SDK in production)
  const url = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${c.env.R2_BUCKET}/${media.storage_path}`;
  // In production: use @aws-sdk/s3-request-presigner

  return c.json({ url, expiresIn: 3600 });
});

// Client messages/feedback
portalRoutes.post("/projects/:id/messages", portalAuthMiddleware, async (c) => {
  const client = c.get("client");
  const projectId = c.req.param("id");
  const { subject, message } = await c.req.json();

  const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND client_id = ?").bind(projectId, client.id).first();
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Create notification for studio team
  const id = createId();
  await c.env.DB.prepare(
    `INSERT INTO studio_notifications (id, user_id, type, title, message, reference_type, reference_id, priority, metadata, created_at)
     VALUES (?, (SELECT id FROM studio_users WHERE role = 'Administrator' AND deleted_at IS NULL LIMIT 1), 'client_message', ?, ?, 'project', ?, 'normal', ?, ?)`
  ).bind(id, subject, `Client message from ${client.name}: ${message}`, projectId, JSON.stringify({ clientId: client.id, clientName: client.name }), new Date().toISOString()).run();

  return c.json({ success: true });
});

// Get portal config (public)
portalRoutes.get("/config", async (c) => {
  const configs = await c.env.DB.prepare(
    "SELECT key, value FROM studio_config WHERE is_public = 1 AND key LIKE 'portal.%'"
  ).all();

  const result: Record<string, any> = {};
  for (const cfg of configs.results) {
    result[cfg.key] = JSON.parse(cfg.value);
  }

  return c.json(result);
});

export { portalRoutes };