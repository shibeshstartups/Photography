import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const mediaRoutes = new Hono<{ Bindings: Env }>();

const mediaSchema = z.object({
  projectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  filePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(["photo", "video", "raw", "edited", "preview", "final", "album", "other"]),
  mimeType: z.string().optional(),
  fileSize: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
  checksum: z.string().optional(),
  storageProvider: z.enum(["local", "r2", "s3", "gcs", "azure", "nas"]).default("local"),
  storagePath: z.string().optional(),
  exifData: z.any().optional(),
  tags: z.array(z.string()).optional(),
  isClientVisible: z.boolean().default(false),
  isSelect: z.boolean().default(false),
  metadata: z.any().optional(),
});

const albumSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  coverMediaId: z.string().uuid().optional(),
  isPublic: z.boolean().default(false),
  accessCode: z.string().max(50).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metadata: z.any().optional(),
});

const updateMediaSchema = mediaSchema.partial();
const updateAlbumSchema = albumSchema.partial();

// List media
mediaRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      clientId: z.string().uuid().optional(),
      eventId: z.string().uuid().optional(),
      fileType: z.string().optional(),
      storageProvider: z.string().optional(),
      isClientVisible: z.boolean().optional(),
      isSelect: z.boolean().optional(),
      tag: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, clientId, eventId, fileType, storageProvider, isClientVisible, isSelect, tag, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (clientId) { where += " AND client_id = ?"; params.push(clientId); }
    if (eventId) { where += " AND event_id = ?"; params.push(eventId); }
    if (fileType) { where += " AND file_type = ?"; params.push(fileType); }
    if (storageProvider) { where += " AND storage_provider = ?"; params.push(storageProvider); }
    if (isClientVisible !== undefined) { where += " AND is_client_visible = ?"; params.push(isClientVisible ? 1 : 0); }
    if (isSelect !== undefined) { where += " AND is_select = ?"; params.push(isSelect ? 1 : 0); }
    if (tag) { where += " AND JSON_EXTRACT(tags, '$') LIKE ?"; params.push(`%${tag}%`); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT m.*, p.title as project_title, c.name as client_name
                 FROM studio_media m
                 LEFT JOIN studio_projects p ON m.project_id = p.id
                 LEFT JOIN studio_clients c ON m.client_id = c.id
                 ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

// Get media
mediaRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const media = await c.env.DB.prepare(
    "SELECT * FROM studio_media WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!media) return c.json({ error: "Media not found" }, 404);
  return c.json(media);
});

// Create media reference
mediaRoutes.post(
  "/",
  zValidator("json", mediaSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    if (data.projectId) {
      const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
      if (!project) return c.json({ error: "Project not found" }, 404);
    }

    if (data.clientId) {
      const client = await c.env.DB.prepare("SELECT id FROM studio_clients WHERE id = ? AND deleted_at IS NULL").bind(data.clientId).first();
      if (!client) return c.json({ error: "Client not found" }, 404);
    }

    if (data.eventId) {
      const event = await c.env.DB.prepare("SELECT id FROM studio_events WHERE id = ? AND deleted_at IS NULL").bind(data.eventId).first();
      if (!event) return c.json({ error: "Event not found" }, 404);
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_media (id, project_id, client_id, event_id, file_path, file_name, file_type, mime_type, file_size, width, height, duration, checksum, storage_provider, storage_path, exif_data, tags, is_client_visible, is_select, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId || null, data.clientId || null, data.eventId || null,
      data.filePath, data.fileName, data.fileType, data.mimeType || null,
      data.fileSize || null, data.width || null, data.height || null,
      data.duration || null, data.checksum || null, data.storageProvider,
      data.storagePath || null, data.exifData ? JSON.stringify(data.exifData) : null,
      data.tags ? JSON.stringify(data.tags) : null, data.isClientVisible ? 1 : 0, data.isSelect ? 1 : 0,
      data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const media = await c.env.DB.prepare("SELECT * FROM studio_media WHERE id = ?").bind(id).first();
    return c.json(media, 201);
  }
);

// Bulk create media references
mediaRoutes.post("/bulk", async (c) => {
  const { media: mediaArray } = await c.req.json<{ media: z.infer<typeof mediaSchema>[] }>();

  const results = [];
  const errors = [];

  for (let i = 0; i < mediaArray.length; i++) {
    const data = mediaArray[i];
    try {
      const id = createId();

      if (data.projectId) {
        const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
        if (!project) throw new Error("Project not found");
      }

      if (data.clientId) {
        const client = await c.env.DB.prepare("SELECT id FROM studio_clients WHERE id = ? AND deleted_at IS NULL").bind(data.clientId).first();
        if (!client) throw new Error("Client not found");
      }

      await c.env.DB.prepare(
        `INSERT INTO studio_media (id, project_id, client_id, event_id, file_path, file_name, file_type, mime_type, file_size, width, height, duration, checksum, storage_provider, storage_path, exif_data, tags, is_client_visible, is_select, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, data.projectId || null, data.clientId || null, data.eventId || null,
        data.filePath, data.fileName, data.fileType, data.mimeType || null,
        data.fileSize || null, data.width || null, data.height || null,
        data.duration || null, data.checksum || null, data.storageProvider,
        data.storagePath || null, data.exifData ? JSON.stringify(data.exifData) : null,
        data.tags ? JSON.stringify(data.tags) : null, data.isClientVisible ? 1 : 0, data.isSelect ? 1 : 0,
        data.metadata ? JSON.stringify(data.metadata) : null,
        new Date().toISOString(), new Date().toISOString()
      ).run();

      results.push({ id, ...data });
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return c.json({ created: results, errors }, errors.length > 0 ? 207 : 201);
});

// Update media
mediaRoutes.patch(
  "/:id",
  zValidator("json", updateMediaSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_media WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Media not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "clientId", "eventId", "filePath", "fileName", "fileType", "mimeType", "fileSize", "width", "height", "duration", "checksum", "storageProvider", "storagePath", "exifData", "tags", "isClientVisible", "isSelect", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : (typeof value === "boolean" ? (value ? 1 : 0) : value));
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_media SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const media = await c.env.DB.prepare("SELECT * FROM studio_media WHERE id = ?").bind(id).first();
    return c.json(media);
  }
);

// Delete media (soft)
mediaRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_media SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// ============ ALBUMS ============
mediaRoutes.get(
  "/albums",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      clientId: z.string().uuid().optional(),
      isPublic: z.boolean().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, clientId, isPublic, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (clientId) { where += " AND client_id = ?"; params.push(clientId); }
    if (isPublic !== undefined) { where += " AND is_public = ?"; params.push(isPublic ? 1 : 0); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT a.*, p.title as project_title, c.name as client_name
                 FROM studio_albums a
                 LEFT JOIN studio_projects p ON a.project_id = p.id
                 LEFT JOIN studio_clients c ON a.client_id = c.id
                 ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    const hasMore = rows.results.length > limit;
    const items = hasMore ? rows.results.slice(0, limit) : rows.results;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url");
    }

    return c.json({ items, nextCursor, hasMore });
  }
);

mediaRoutes.get("/albums/:id", async (c) => {
  const id = c.req.param("id");
  const album = await c.env.DB.prepare(
    "SELECT * FROM studio_albums WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!album) return c.json({ error: "Album not found" }, 404);

  // Get album media
  const media = await c.env.DB.prepare(
    "SELECT * FROM studio_media WHERE album_id = ? AND deleted_at IS NULL ORDER BY created_at"
  ).bind(id).all();

  return c.json({ ...album, media: media.results });
});

mediaRoutes.post(
  "/albums",
  zValidator("json", albumSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (data.clientId) {
      const client = await c.env.DB.prepare("SELECT id FROM studio_clients WHERE id = ? AND deleted_at IS NULL").bind(data.clientId).first();
      if (!client) return c.json({ error: "Client not found" }, 404);
    }

    if (data.coverMediaId) {
      const media = await c.env.DB.prepare("SELECT id FROM studio_media WHERE id = ? AND deleted_at IS NULL").bind(data.coverMediaId).first();
      if (!media) return c.json({ error: "Cover media not found" }, 404);
    }

    await c.env.DB.prepare(
      `INSERT INTO studio_albums (id, project_id, client_id, title, description, cover_media_id, is_public, access_code, expires_at, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.projectId, data.clientId || null, data.title, data.description || null,
      data.coverMediaId || null, data.isPublic ? 1 : 0, data.accessCode || null,
      data.expiresAt || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const album = await c.env.DB.prepare("SELECT * FROM studio_albums WHERE id = ?").bind(id).first();
    return c.json(album, 201);
  }
);

mediaRoutes.patch(
  "/albums/:id",
  zValidator("json", updateAlbumSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_albums WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Album not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "clientId", "title", "description", "coverMediaId", "isPublic", "accessCode", "expiresAt", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : (typeof value === "boolean" ? (value ? 1 : 0) : value));
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_albums SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const album = await c.env.DB.prepare("SELECT * FROM studio_albums WHERE id = ?").bind(id).first();
    return c.json(album);
  }
);

mediaRoutes.delete("/albums/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_albums SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Add media to album
mediaRoutes.post("/albums/:albumId/media/:mediaId", async (c) => {
  const albumId = c.req.param("albumId");
  const mediaId = c.req.param("mediaId");

  const album = await c.env.DB.prepare("SELECT id FROM studio_albums WHERE id = ? AND deleted_at IS NULL").bind(albumId).first();
  if (!album) return c.json({ error: "Album not found" }, 404);

  const media = await c.env.DB.prepare("SELECT id FROM studio_media WHERE id = ? AND deleted_at IS NULL").bind(mediaId).first();
  if (!media) return c.json({ error: "Media not found" }, 404);

  await c.env.DB.prepare("UPDATE studio_media SET album_id = ?, updated_at = ? WHERE id = ?").bind(albumId, new Date().toISOString(), mediaId).run();

  return c.json({ success: true });
});

// Remove media from album
mediaRoutes.delete("/albums/:albumId/media/:mediaId", async (c) => {
  const albumId = c.req.param("albumId");
  const mediaId = c.req.param("mediaId");

  await c.env.DB.prepare("UPDATE studio_media SET album_id = NULL, updated_at = ? WHERE id = ? AND album_id = ?").bind(new Date().toISOString(), mediaId, albumId).run();

  return c.json({ success: true });
});

// Client portal access (public)
mediaRoutes.get("/portal/album/:accessCode", async (c) => {
  const accessCode = c.req.param("accessCode");

  const album = await c.env.DB.prepare(
    "SELECT * FROM studio_albums WHERE access_code = ? AND is_public = 1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at >= ?)"
  ).bind(accessCode, new Date().toISOString().split("T")[0]).first();

  if (!album) return c.json({ error: "Album not found or expired" }, 404);

  const media = await c.env.DB.prepare(
    "SELECT id, file_name, file_type, mime_type, width, height, duration, storage_provider, storage_path, created_at FROM studio_media WHERE album_id = ? AND is_client_visible = 1 AND deleted_at IS NULL ORDER BY created_at"
  ).bind(album.id).all();

  return c.json({
    album: {
      id: album.id,
      title: album.title,
      description: album.description,
      coverMediaId: album.cover_media_id,
    },
    media: media.results,
  });
});

// Media stats
mediaRoutes.get("/project/:projectId/stats", async (c) => {
  const projectId = c.req.param("projectId");

  const stats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN file_type = 'photo' THEN 1 ELSE 0 END) as photos,
       SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END) as videos,
       SUM(CASE WHEN file_type = 'raw' THEN 1 ELSE 0 END) as raw,
       SUM(CASE WHEN file_type = 'edited' THEN 1 ELSE 0 END) as edited,
       SUM(CASE WHEN file_type = 'final' THEN 1 ELSE 0 END) as final,
       SUM(file_size) as total_size_bytes,
       SUM(CASE WHEN is_select = 1 THEN 1 ELSE 0 END) as selects,
       SUM(CASE WHEN is_client_visible = 1 THEN 1 ELSE 0 END) as client_visible
     FROM studio_media
     WHERE project_id = ? AND deleted_at IS NULL`
  ).bind(projectId).first();

  return c.json(stats);
});

export { mediaRoutes };