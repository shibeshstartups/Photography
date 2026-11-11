import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "../types.js";

const editingRoutes = new Hono<{ Bindings: Env }>();

const taskSchema = z.object({
  projectId: z.string().uuid(),
  assignedEditorId: z.string().uuid().optional(),
  editorId: z.string().uuid().optional(), // alias
  status: z.string().optional(),
  priority: z.number().int().min(1).max(5).default(3),
  expectedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expectedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const stageSchema = z.object({
  editingTaskId: z.string().uuid(),
  stage: z.enum(["CULLING", "BASIC_EDIT", "COLOR_GRADE", "RETQUING", "FINAL_REVIEW", "EXPORT", "DELIVERED", "CLIENT_REVIEW", "REVISION"]),
  status: z.enum(["pending", "in_progress", "completed", "rejected", "on_hold"]).default("pending"),
  assignedTo: z.string().uuid().optional(),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).optional(),
  completedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const assetSchema = z.object({
  editingTaskId: z.string().uuid(),
  filePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(["raw", "edited", "preview", "final", "export", "reference"]),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
  checksum: z.string().optional(),
  storageProvider: z.enum(["local", "r2", "s3", "gcs", "azure"]).default("local"),
  storagePath: z.string().optional(),
  stage: z.string().optional(),
  version: z.number().int().positive().default(1),
  metadata: z.any().optional(),
});

const updateTaskSchema = taskSchema.partial();
const updateStageSchema = stageSchema.partial();
const updateAssetSchema = assetSchema.partial();

// List editing tasks
editingRoutes.get(
  "/tasks",
  zValidator(
    "query",
    z.object({
      projectId: z.string().uuid().optional(),
      assignedEditorId: z.string().uuid().optional(),
      status: z.string().optional(),
      priority: z.number().int().min(1).max(5).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
  ),
  async (c) => {
    const { projectId, assignedEditorId, status, priority, cursor, limit } = c.req.valid("query");

    let where = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
    if (assignedEditorId) { where += " AND assigned_editor_id = ?"; params.push(assignedEditorId); }
    if (status) { where += " AND status = ?"; params.push(status); }
    if (priority) { where += " AND priority = ?"; params.push(priority); }
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const sql = `SELECT et.*, p.title as project_title, p.project_id as project_code, e.name as editor_name
                 FROM studio_editing_tasks et
                 LEFT JOIN studio_projects p ON et.project_id = p.id
                 LEFT JOIN studio_employees e ON et.assigned_editor_id = e.id
                 ${where} ORDER BY et.priority DESC, et.created_at ASC LIMIT ?`;
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

// Get editing task with stages and assets
editingRoutes.get("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const task = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!task) return c.json({ error: "Editing task not found" }, 404);

  const stages = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_stages WHERE editing_task_id = ? AND deleted_at IS NULL ORDER BY CASE stage WHEN 'CULLING' THEN 1 WHEN 'BASIC_EDIT' THEN 2 WHEN 'COLOR_GRADE' THEN 3 WHEN 'RETQUING' THEN 4 WHEN 'FINAL_REVIEW' THEN 5 WHEN 'EXPORT' THEN 6 WHEN 'DELIVERED' THEN 7 WHEN 'CLIENT_REVIEW' THEN 8 WHEN 'REVISION' THEN 9 ELSE 10 END"
  ).bind(id).all();

  const assets = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_assets WHERE editing_task_id = ? AND deleted_at IS NULL ORDER BY file_type, created_at"
  ).bind(id).all();

  return c.json({ ...task, stages: stages.results, assets: assets.results });
});

// Create editing task
editingRoutes.post(
  "/tasks",
  zValidator("json", taskSchema),
  async (c) => {
    const data = c.req.valid("json");
    const id = createId();

    const project = await c.env.DB.prepare("SELECT id FROM studio_projects WHERE id = ? AND deleted_at IS NULL").bind(data.projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (data.assignedEditorId) {
      const editor = await c.env.DB.prepare("SELECT id FROM studio_employees WHERE id = ? AND deleted_at IS NULL").bind(data.assignedEditorId).first();
      if (!editor) return c.json({ error: "Editor not found" }, 404);
    }

    const editorId = data.assignedEditorId || data.editorId;

    await c.env.DB.prepare(
      `INSERT INTO studio_editing_tasks (id, project_id, assigned_editor_id, status, priority, expected_start_date, expected_end_date, actual_start_date, actual_end_date, notes, metadata, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(
      id, data.projectId, editorId || null, data.status || "WAITING_FOR_FILES", data.priority,
      data.expectedStartDate || null, data.expectedEndDate || null,
      data.actualStartDate || null, data.actualEndDate || null,
      data.notes || null, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    // Create default stages
    const defaultStages = ["CULLING", "BASIC_EDIT", "COLOR_GRADE", "RETQUING", "FINAL_REVIEW", "EXPORT"];
    for (let i = 0; i < defaultStages.length; i++) {
      await c.env.DB.prepare(
        `INSERT INTO studio_editing_stages (id, editing_task_id, stage, status, order_index, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`
      ).bind(createId(), id, defaultStages[i], i, new Date().toISOString(), new Date().toISOString()).run();
    }

    const task = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ?").bind(id).first();
    return c.json(task, 201);
  }
);

// Update editing task
editingRoutes.patch(
  "/tasks/:id",
  zValidator("json", updateTaskSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!existing) return c.json({ error: "Editing task not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["projectId", "assignedEditorId", "editorId", "status", "priority", "expectedStartDate", "expectedEndDate", "actualStartDate", "actualEndDate", "notes", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    updates.push("version = version + 1");
    params.push(new Date().toISOString());
    params.push(id);

    await c.env.DB.prepare(`UPDATE studio_editing_tasks SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const task = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ?").bind(id).first();
    return c.json(task);
  }
);

// Delete editing task (soft)
editingRoutes.delete("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE studio_editing_tasks SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return c.json({ success: true });
});

// Stages
editingRoutes.get("/tasks/:taskId/stages", async (c) => {
  const taskId = c.req.param("taskId");
  const stages = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_stages WHERE editing_task_id = ? AND deleted_at IS NULL ORDER BY order_index"
  ).bind(taskId).all();
  return c.json(stages.results);
});

editingRoutes.post(
  "/tasks/:taskId/stages",
  zValidator("json", stageSchema),
  async (c) => {
    const taskId = c.req.param("taskId");
    const data = c.req.valid("json");

    if (data.editingTaskId !== taskId) return c.json({ error: "Task ID mismatch" }, 400);

    const task = await c.env.DB.prepare("SELECT id FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL").bind(taskId).first();
    if (!task) return c.json({ error: "Editing task not found" }, 404);

    const id = createId();
    const orderIndex = await c.env.DB.prepare(
      "SELECT COALESCE(MAX(order_index), -1) + 1 as next FROM studio_editing_stages WHERE editing_task_id = ?"
    ).bind(taskId).first<{ next: number }>();

    await c.env.DB.prepare(
      `INSERT INTO studio_editing_stages (id, editing_task_id, stage, status, assigned_to, started_at, completed_at, notes, metadata, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.editingTaskId, data.stage, data.status, data.assignedTo || null,
      data.startedAt || null, data.completedAt || null, data.notes || null,
      data.metadata ? JSON.stringify(data.metadata) : null, orderIndex?.next || 0,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const stage = await c.env.DB.prepare("SELECT * FROM studio_editing_stages WHERE id = ?").bind(id).first();
    return c.json(stage, 201);
  }
);

editingRoutes.patch(
  "/tasks/:taskId/stages/:stageId",
  zValidator("json", updateStageSchema),
  async (c) => {
    const taskId = c.req.param("taskId");
    const stageId = c.req.param("stageId");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_editing_stages WHERE id = ? AND editing_task_id = ? AND deleted_at IS NULL").bind(stageId, taskId).first();
    if (!existing) return c.json({ error: "Stage not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["stage", "status", "assignedTo", "startedAt", "completedAt", "notes", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(stageId);

    await c.env.DB.prepare(`UPDATE studio_editing_stages SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const stage = await c.env.DB.prepare("SELECT * FROM studio_editing_stages WHERE id = ?").bind(stageId).first();
    return c.json(stage);
  }
);

editingRoutes.delete("/tasks/:taskId/stages/:stageId", async (c) => {
  const taskId = c.req.param("taskId");
  const stageId = c.req.param("stageId");
  await c.env.DB.prepare("UPDATE studio_editing_stages SET deleted_at = ?, updated_at = ? WHERE id = ? AND editing_task_id = ?").bind(new Date().toISOString(), new Date().toISOString(), stageId, taskId).run();
  return c.json({ success: true });
});

// Reorder stages
editingRoutes.post("/tasks/:taskId/stages/reorder", async (c) => {
  const taskId = c.req.param("taskId");
  const { stageIds } = await c.req.json<{ stageIds: string[] }>();

  for (let i = 0; i < stageIds.length; i++) {
    await c.env.DB.prepare(
      "UPDATE studio_editing_stages SET order_index = ?, updated_at = ? WHERE id = ? AND editing_task_id = ?"
    ).bind(i, new Date().toISOString(), stageIds[i], taskId).run();
  }

  const stages = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_stages WHERE editing_task_id = ? AND deleted_at IS NULL ORDER BY order_index"
  ).bind(taskId).all();
  return c.json(stages.results);
});

// Assets
editingRoutes.get("/tasks/:taskId/assets", async (c) => {
  const taskId = c.req.param("taskId");
  const assets = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_assets WHERE editing_task_id = ? AND deleted_at IS NULL ORDER BY file_type, created_at"
  ).bind(taskId).all();
  return c.json(assets.results);
});

editingRoutes.post(
  "/tasks/:taskId/assets",
  zValidator("json", assetSchema),
  async (c) => {
    const taskId = c.req.param("taskId");
    const data = c.req.valid("json");

    if (data.editingTaskId !== taskId) return c.json({ error: "Task ID mismatch" }, 400);

    const task = await c.env.DB.prepare("SELECT id FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL").bind(taskId).first();
    if (!task) return c.json({ error: "Editing task not found" }, 404);

    const id = createId();
    await c.env.DB.prepare(
      `INSERT INTO studio_editing_assets (id, editing_task_id, file_path, file_name, file_type, file_size, mime_type, width, height, duration, checksum, storage_provider, storage_path, stage, version, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.editingTaskId, data.filePath, data.fileName, data.fileType,
      data.fileSize || null, data.mimeType || null, data.width || null, data.height || null,
      data.duration || null, data.checksum || null, data.storageProvider, data.storagePath || null,
      data.stage || null, data.version, data.metadata ? JSON.stringify(data.metadata) : null,
      new Date().toISOString(), new Date().toISOString()
    ).run();

    const asset = await c.env.DB.prepare("SELECT * FROM studio_editing_assets WHERE id = ?").bind(id).first();
    return c.json(asset, 201);
  }
);

editingRoutes.patch(
  "/tasks/:taskId/assets/:assetId",
  zValidator("json", updateAssetSchema),
  async (c) => {
    const taskId = c.req.param("taskId");
    const assetId = c.req.param("assetId");
    const data = c.req.valid("json");

    const existing = await c.env.DB.prepare("SELECT * FROM studio_editing_assets WHERE id = ? AND editing_task_id = ? AND deleted_at IS NULL").bind(assetId, taskId).first();
    if (!existing) return c.json({ error: "Asset not found" }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ["filePath", "fileName", "fileType", "fileSize", "mimeType", "width", "height", "duration", "checksum", "storageProvider", "storagePath", "stage", "version", "metadata"];

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        const col = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${col} = ?`);
        const value = data[field as keyof typeof data];
        params.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(assetId);

    await c.env.DB.prepare(`UPDATE studio_editing_assets SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

    const asset = await c.env.DB.prepare("SELECT * FROM studio_editing_assets WHERE id = ?").bind(assetId).first();
    return c.json(asset);
  }
);

editingRoutes.delete("/tasks/:taskId/assets/:assetId", async (c) => {
  const taskId = c.req.param("taskId");
  const assetId = c.req.param("assetId");
  await c.env.DB.prepare("UPDATE studio_editing_assets SET deleted_at = ?, updated_at = ? WHERE id = ? AND editing_task_id = ?").bind(new Date().toISOString(), new Date().toISOString(), assetId, taskId).run();
  return c.json({ success: true });
});

// QC workflow endpoints
editingRoutes.post("/tasks/:id/submit-for-qc", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const task = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!task) return c.json({ error: "Editing task not found" }, 404);

  // Check all stages are completed
  const stages = await c.env.DB.prepare(
    "SELECT * FROM studio_editing_stages WHERE editing_task_id = ? AND deleted_at IS NULL"
  ).bind(id).all();

  const allCompleted = stages.results.every((s: any) => s.status === "completed");
  if (!allCompleted) {
    return c.json({ error: "All stages must be completed before submitting for QC" }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE studio_editing_tasks SET status = 'QC_PENDING', updated_at = ?, version = version + 1 WHERE id = ?"
  ).bind(new Date().toISOString(), id).run();

  // Create notification for QC team
  await c.env.DB.prepare(
    `INSERT INTO studio_notifications (id, user_id, type, title, message, reference_type, reference_id, metadata, created_at)
     VALUES (?, ?, 'qc_review', 'QC Review Required', ?, 'editing_task', ?, ?, ?)`
  ).bind(createId(), task.assigned_editor_id, `Editing task for project ${task.project_id} submitted for QC`, id, JSON.stringify({ taskId: id }), new Date().toISOString()).run();

  const updated = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ?").bind(id).first();
  return c.json(updated);
});

editingRoutes.post("/tasks/:id/approve-qc", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const task = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!task) return c.json({ error: "Editing task not found" }, 404);

  await c.env.DB.prepare(
    "UPDATE studio_editing_tasks SET status = 'APPROVED', actual_end_date = ?, updated_at = ?, version = version + 1 WHERE id = ?"
  ).bind(new Date().toISOString().split("T")[0], new Date().toISOString(), id).run();

  const updated = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ?").bind(id).first();
  return c.json(updated);
});

editingRoutes.post("/tasks/:id/request-revision", async (c) => {
  const id = c.req.param("id");
  const { notes } = await c.req.json<{ notes: string }>();

  const task = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!task) return c.json({ error: "Editing task not found" }, 404);

  // Add revision stage
  const stageId = createId();
  await c.env.DB.prepare(
    `INSERT INTO studio_editing_stages (id, editing_task_id, stage, status, notes, order_index, created_at, updated_at)
     VALUES (?, ?, 'REVISION', 'pending', ?, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM studio_editing_stages WHERE editing_task_id = ?), ?, ?)`
  ).bind(stageId, id, notes, id, new Date().toISOString(), new Date().toISOString()).run();

  await c.env.DB.prepare(
    "UPDATE studio_editing_tasks SET status = 'REVISION_REQUESTED', updated_at = ?, version = version + 1 WHERE id = ?"
  ).bind(new Date().toISOString(), id).run();

  const updated = await c.env.DB.prepare("SELECT * FROM studio_editing_tasks WHERE id = ?").bind(id).first();
  return c.json(updated);
});

export { editingRoutes };