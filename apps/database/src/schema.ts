// Database schema using Drizzle ORM - matches the SQL migration in apps/desktop/src/migrations/0001_initial.sql
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import type { UUID, ISODateString } from "@studio-erp/shared";

// ============================================
// Core Tables (matching studio_* prefix and snake_case columns)
// ============================================

export const users = sqliteTable("studio_users", {
  id: text("id").primaryKey().$type<UUID>(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("editor"),
  permissions: text("permissions").notNull().default("[]"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  lastLoginAt: text("last_login_at").$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
  version: integer("version").notNull().default(1),
}, (table) => ({
  emailIdx: index("idx_studio_users_email").on(table.email),
  statusIdx: index("idx_studio_users_status").on(table.status),
  deletedIdx: index("idx_studio_users_deleted").on(table.deletedAt),
}));

export const devices = sqliteTable("studio_devices", {
  id: text("id").primaryKey().$type<UUID>(),
  userId: text("user_id").notNull().$type<UUID>().references(() => users.id),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  userAgent: text("user_agent").notNull().default(""),
  deviceKeyHash: text("device_key_hash").notNull(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  lastSeenAt: text("last_seen_at").$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  userIdx: index("idx_studio_devices_user").on(table.userId),
  revokedIdx: index("idx_studio_devices_revoked").on(table.revoked),
}));

export const clients = sqliteTable("studio_clients", {
  id: text("id").primaryKey().$type<UUID>(),
  clientId: text("client_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  additionalInfo: text("additional_info"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  clientIdIdx: index("idx_studio_clients_client_id").on(table.clientId),
  nameIdx: index("idx_studio_clients_name").on(table.fullName),
  deletedIdx: index("idx_studio_clients_deleted").on(table.deletedAt),
}));

export const clientContacts = sqliteTable("studio_client_contacts", {
  id: text("id").primaryKey().$type<UUID>(),
  clientId: text("client_id").notNull().$type<UUID>().references(() => clients.id),
  name: text("name").notNull(),
  relationship: text("relationship"),
  phone: text("phone"),
  email: text("email"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  clientIdx: index("idx_studio_client_contacts_client").on(table.clientId),
}));

export const employees = sqliteTable("studio_employees", {
  id: text("id").primaryKey().$type<UUID>(),
  employeeId: text("employee_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  designation: text("designation"),
  skills: text("skills").notNull().default("[]"),
  specializations: text("specializations").notNull().default("[]"),
  experience: real("experience"),
  status: text("status").notNull().default("active"),
  compensation: text("compensation"),
  availability: text("availability"),
  leaves: text("leaves").notNull().default("[]"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  employeeIdIdx: index("idx_studio_employees_employee_id").on(table.employeeId),
  statusIdx: index("idx_studio_employees_status").on(table.status),
  deletedIdx: index("idx_studio_employees_deleted").on(table.deletedAt),
}));

export const projects = sqliteTable("studio_projects", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().unique(),
  clientId: text("client_id").notNull().$type<UUID>().references(() => clients.id),
  title: text("title").notNull(),
  projectManagerId: text("project_manager_id").$type<UUID>().references(() => employees.id),
  bookingDate: text("booking_date").$type<ISODateString>(),
  status: text("status").notNull().default("ENQUIRY"),
  quotation: text("quotation"),
  totalAgreedAmount: real("total_agreed_amount").notNull().default(0),
  advancePayment: real("advance_payment").notNull().default(0),
  venue: text("venue"),
  locations: text("locations"),
  internalNotes: text("internal_notes"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdIdx: index("idx_studio_projects_project_id").on(table.projectId),
  clientIdx: index("idx_studio_projects_client").on(table.clientId),
  statusIdx: index("idx_studio_projects_status").on(table.status),
  bookingDateIdx: index("idx_studio_projects_booking_date").on(table.bookingDate),
  deletedIdx: index("idx_studio_projects_deleted").on(table.deletedAt),
}));

export const events = sqliteTable("studio_events", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().$type<UUID>().references(() => projects.id),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull().$type<ISODateString>(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  venue: text("venue"),
  city: text("city"),
  location: text("location"),
  travel: text("travel"),
  eventManagerId: text("event_manager_id").$type<UUID>().references(() => employees.id),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_events_project").on(table.projectId),
  dateIdx: index("idx_studio_events_date").on(table.eventDate),
  eventIdIdx: index("idx_studio_events_event_id").on(table.eventId),
  deletedIdx: index("idx_studio_events_deleted").on(table.deletedAt),
}));

export const eventSegments = sqliteTable("studio_event_segments", {
  id: text("id").primaryKey().$type<UUID>(),
  eventId: text("event_id").notNull().$type<UUID>().references(() => events.id),
  service: text("service").notNull(),
  requiredCount: integer("required_count").notNull().default(1),
  assignedCount: integer("assigned_count").notNull().default(0),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  eventIdx: index("idx_studio_event_segments_event").on(table.eventId),
  deletedIdx: index("idx_studio_event_segments_deleted").on(table.deletedAt),
}));

export const assignments = sqliteTable("studio_assignments", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().$type<UUID>().references(() => projects.id),
  eventId: text("event_id").$type<UUID>().references(() => events.id),
  segmentId: text("segment_id").$type<UUID>().references(() => eventSegments.id),
  employeeId: text("employee_id").notNull().$type<UUID>().references(() => employees.id),
  assignmentDate: text("assignment_date").notNull().$type<ISODateString>(),
  timeWindow: text("time_window"),
  status: text("status").notNull().default("pending_validation"),
  isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(true),
  validation: text("validation"),
  conflicts: text("conflicts"),
  logistics: text("logistics"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_assignments_project").on(table.projectId),
  eventIdx: index("idx_studio_assignments_event").on(table.eventId),
  employeeIdx: index("idx_studio_assignments_employee").on(table.employeeId),
  dateIdx: index("idx_studio_assignments_date").on(table.assignmentDate),
  statusIdx: index("idx_studio_assignments_status").on(table.status),
  deletedIdx: index("idx_studio_assignments_deleted").on(table.deletedAt),
}));

export const attendance = sqliteTable("studio_attendance_events", {
  id: text("id").primaryKey().$type<UUID>(),
  assignmentId: text("assignment_id").$type<UUID>().references(() => assignments.id),
  eventId: text("event_id").$type<UUID>().references(() => events.id),
  employeeId: text("employee_id").notNull().$type<UUID>().references(() => employees.id),
  eventType: text("event_type").notNull(),
  occurredAt: text("occurred_at").notNull().$type<ISODateString>(),
  recordedAt: text("recorded_at").notNull().$type<ISODateString>(),
  recordedBy: text("recorded_by"),
  segmentId: text("segment_id").$type<UUID>().references(() => eventSegments.id),
  metadata: text("metadata"),
  replacesEventId: text("replaces_event_id").$type<UUID>(),
  deviceId: text("device_id"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
}, (table) => ({
  assignmentIdx: index("idx_studio_attendance_assignment").on(table.assignmentId),
  eventIdx: index("idx_studio_attendance_event").on(table.eventId),
  employeeIdx: index("idx_studio_attendance_employee").on(table.employeeId),
  occurredIdx: index("idx_studio_attendance_occurred").on(table.occurredAt),
}));

export const editingTasks = sqliteTable("studio_editing_tasks", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().$type<UUID>().references(() => projects.id),
  eventId: text("event_id").$type<UUID>().references(() => events.id),
  status: text("status").notNull().default("WAITING_FOR_FILES"),
  editorId: text("editor_id").$type<UUID>().references(() => employees.id),
  albumDesignerId: text("album_designer_id").$type<UUID>().references(() => employees.id),
  sourceFolderRef: text("source_folder_ref"),
  outputFolderRef: text("output_folder_ref"),
  deadline: text("deadline").$type<ISODateString>(),
  completedAt: text("completed_at").$type<ISODateString>(),
  qcChecks: text("qc_checks"),
  comments: text("comments"),
  revisions: text("revisions"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_editing_tasks_project").on(table.projectId),
  statusIdx: index("idx_studio_editing_tasks_status").on(table.status),
  deletedIdx: index("idx_studio_editing_tasks_deleted").on(table.deletedAt),
}));

export const quotations = sqliteTable("studio_quotations", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().$type<UUID>().references(() => projects.id),
  items: text("items").notNull(),
  totalAmount: real("total_amount").notNull().default(0),
  status: text("status").notNull().default("draft"),
  sentAt: text("sent_at").$type<ISODateString>(),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_quotations_project").on(table.projectId),
  deletedIdx: index("idx_studio_quotations_deleted").on(table.deletedAt),
}));

export const invoices = sqliteTable("studio_invoices", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().$type<UUID>().references(() => projects.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  items: text("items").notNull(),
  totalAmount: real("total_amount").notNull().default(0),
  issueDate: text("issue_date").notNull().$type<ISODateString>(),
  dueDate: text("due_date").$type<ISODateString>(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_invoices_project").on(table.projectId),
  numberIdx: index("idx_studio_invoices_number").on(table.invoiceNumber),
  deletedIdx: index("idx_studio_invoices_deleted").on(table.deletedAt),
}));

export const payments = sqliteTable("studio_payments", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").notNull().$type<UUID>().references(() => projects.id),
  invoiceId: text("invoice_id").$type<UUID>().references(() => invoices.id),
  type: text("type").notNull().default("advance"),
  amount: real("amount").notNull(),
  method: text("method"),
  paidAt: text("paid_at").notNull().$type<ISODateString>(),
  replacesPaymentId: text("replaces_payment_id").$type<UUID>(),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  notes: text("notes"),
  receiptRef: text("receipt_ref"),
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_payments_project").on(table.projectId),
  invoiceIdx: index("idx_studio_payments_invoice").on(table.invoiceId),
  paidAtIdx: index("idx_studio_payments_paid_at").on(table.paidAt),
  deletedIdx: index("idx_studio_payments_deleted").on(table.deletedAt),
}));

export const expenses = sqliteTable("studio_expenses", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").$type<UUID>().references(() => projects.id),
  category: text("category").notNull().default("other"),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  method: text("method"),
  spentAt: text("spent_at").notNull().$type<ISODateString>(),
  incurredBy: text("incurred_by").$type<UUID>().references(() => employees.id),
  receiptRef: text("receipt_ref"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_expenses_project").on(table.projectId),
  categoryIdx: index("idx_studio_expenses_category").on(table.category),
  spentAtIdx: index("idx_studio_expenses_spent_at").on(table.spentAt),
  deletedIdx: index("idx_studio_expenses_deleted").on(table.deletedAt),
}));

export const equipment = sqliteTable("studio_equipment", {
  id: text("id").primaryKey().$type<UUID>(),
  equipmentId: text("equipment_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  serialNumber: text("serial_number"),
  owner: text("owner").$type<UUID>().references(() => employees.id),
  condition: text("condition").notNull().default("good"),
  availability: text("availability").notNull().default("available"),
  currentHolder: text("current_holder"),
  metadata: text("metadata"),
  maintenance: text("maintenance"),
  damageReports: text("damage_reports"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  equipmentIdIdx: index("idx_studio_equipment_equipment_id").on(table.equipmentId),
  categoryIdx: index("idx_studio_equipment_category").on(table.category),
  availabilityIdx: index("idx_studio_equipment_availability").on(table.availability),
  deletedIdx: index("idx_studio_equipment_deleted").on(table.deletedAt),
}));

export const equipmentAllocations = sqliteTable("studio_equipment_allocations", {
  id: text("id").primaryKey().$type<UUID>(),
  equipmentId: text("equipment_id").notNull().$type<UUID>().references(() => equipment.id),
  projectId: text("project_id").$type<UUID>().references(() => projects.id),
  eventId: text("event_id").$type<UUID>().references(() => events.id),
  assignedTo: text("assigned_to").$type<UUID>().references(() => employees.id),
  checkedOutAt: text("checked_out_at").notNull().$type<ISODateString>(),
  checkedInAt: text("checked_in_at").$type<ISODateString>(),
  conditionOut: text("condition_out"),
  conditionIn: text("condition_in"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  equipmentIdx: index("idx_studio_equipment_allocations_equipment").on(table.equipmentId),
  projectIdx: index("idx_studio_equipment_allocations_project").on(table.projectId),
  assignedToIdx: index("idx_studio_equipment_allocations_assigned_to").on(table.assignedTo),
  deletedIdx: index("idx_studio_equipment_allocations_deleted").on(table.deletedAt),
}));

export const storageLocations = sqliteTable("studio_storage_locations", {
  id: text("id").primaryKey().$type<UUID>(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  basePath: text("base_path").notNull(),
  config: text("config"),
  freeBytes: real("free_bytes"),
  totalBytes: real("total_bytes"),
  status: text("status").notNull().default("online"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  deletedIdx: index("idx_studio_storage_locations_deleted").on(table.deletedAt),
}));

export const mediaReferences = sqliteTable("studio_media_references", {
  id: text("id").primaryKey().$type<UUID>(),
  projectId: text("project_id").$type<UUID>().references(() => projects.id),
  eventId: text("event_id").$type<UUID>().references(() => events.id),
  storageLocationId: text("storage_location_id").notNull().$type<UUID>().references(() => storageLocations.id),
  relativePath: text("relative_path").notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  size: real("size"),
  checksum: text("checksum"),
  importedAt: text("imported_at").notNull().$type<ISODateString>(),
  accessPermission: text("access_permission").notNull().default("private"),
  availabilityStatus: text("availability_status").notNull().default("available"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  projectIdx: index("idx_studio_media_project").on(table.projectId),
  eventIdx: index("idx_studio_media_event").on(table.eventId),
  locationIdx: index("idx_studio_media_location").on(table.storageLocationId),
  typeIdx: index("idx_studio_media_type").on(table.fileType),
  deletedIdx: index("idx_studio_media_deleted").on(table.deletedAt),
}));

export const notifications = sqliteTable("studio_notifications", {
  id: text("id").primaryKey().$type<UUID>(),
  userId: text("user_id").$type<UUID>().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  data: text("data"),
  severity: text("severity").notNull().default("info"),
  readAt: text("read_at").$type<ISODateString>(),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  userIdx: index("idx_studio_notifications_user").on(table.userId),
  readIdx: index("idx_studio_notifications_read").on(table.readAt),
  deletedIdx: index("idx_studio_notifications_deleted").on(table.deletedAt),
}));

export const auditLogs = sqliteTable("studio_audit_log", {
  id: text("id").primaryKey().$type<UUID>(),
  userId: text("user_id").$type<UUID>().references(() => users.id),
  deviceId: text("device_id"),
  timestamp: text("timestamp").notNull().$type<ISODateString>(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull().$type<UUID>(),
  previous: text("previous"),
  next: text("next"),
  projectId: text("project_id").$type<UUID>().references(() => projects.id),
  sessionId: text("session_id"),
  operationId: text("operation_id"),
  ip: text("ip"),
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  userIdx: index("idx_studio_audit_user").on(table.userId),
  entityIdx: index("idx_studio_audit_entity").on(table.entityType, table.entityId),
  timestampIdx: index("idx_studio_audit_timestamp").on(table.timestamp),
  projectIdx: index("idx_studio_audit_project").on(table.projectId),
  deletedIdx: index("idx_studio_audit_deleted").on(table.deletedAt),
}));

export const systemConfig = sqliteTable("studio_system_config", {
  id: text("id").primaryKey().$type<UUID>(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
  deletedAt: text("deleted_at").$type<ISODateString>(),
}, (table) => ({
  keyIdx: index("idx_studio_system_config_key").on(table.key),
  deletedIdx: index("idx_studio_system_config_deleted").on(table.deletedAt),
}));

// ============================================
// Sync Tables
// ============================================

export const syncCheckpoints = sqliteTable("studio_sync_checkpoints", {
  id: text("id").primaryKey().$type<UUID>(),
  deviceId: text("device_id").notNull(),
  userId: text("user_id").notNull().$type<UUID>().references(() => users.id),
  checkpoint: text("checkpoint").$type<ISODateString>(),
  lastPulledAt: text("last_pulled_at").$type<ISODateString>(),
  pendingCount: integer("pending_count").notNull().default(0),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  updatedAt: text("updated_at").notNull().$type<ISODateString>(),
}, (table) => ({
  deviceIdx: index("idx_studio_sync_checkpoints_device").on(table.deviceId),
  userIdx: index("idx_studio_sync_checkpoints_user").on(table.userId),
}));

export const syncOutbox = sqliteTable("studio_sync_outbox", {
  id: text("id").primaryKey().$type<UUID>(),
  deviceId: text("device_id").notNull(),
  userId: text("user_id").notNull().$type<UUID>().references(() => users.id),
  operation: text("operation").notNull(),
  queuedAt: text("queued_at").notNull().$type<ISODateString>(),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: text("last_attempt_at").$type<ISODateString>(),
  acceptedAt: text("accepted_at").$type<ISODateString>(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
}, (table) => ({
  deviceIdx: index("idx_studio_sync_outbox_device").on(table.deviceId),
  statusIdx: index("idx_studio_sync_outbox_status").on(table.status),
  queuedIdx: index("idx_studio_sync_outbox_queued").on(table.queuedAt),
}));

export const syncConflicts = sqliteTable("studio_sync_conflicts", {
  id: text("id").primaryKey().$type<UUID>(),
  deviceId: text("device_id").notNull(),
  userId: text("user_id").notNull().$type<UUID>().references(() => users.id),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull().$type<UUID>(),
  operations: text("operations").notNull(),
  serverSnapshot: text("server_snapshot"),
  status: text("status").notNull().default("unresolved"),
  createdAt: text("created_at").notNull().$type<ISODateString>(),
  resolvedAt: text("resolved_at").$type<ISODateString>(),
  resolvedBy: text("resolved_by"),
}, (table) => ({
  deviceIdx: index("idx_studio_sync_conflicts_device").on(table.deviceId),
  entityIdx: index("idx_studio_sync_conflicts_entity").on(table.entity, table.entityId),
  statusIdx: index("idx_studio_sync_conflicts_status").on(table.status),
}));

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  syncCheckpoints: many(syncCheckpoints),
  syncOutbox: many(syncOutbox),
  syncConflicts: many(syncConflicts),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
  syncCheckpoints: many(syncCheckpoints),
  syncOutbox: many(syncOutbox),
  syncConflicts: many(syncConflicts),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  contacts: many(clientContacts),
  projects: many(projects),
  quotations: many(quotations),
  invoices: many(invoices),
}));

export const clientContactsRelations = relations(clientContacts, ({ one }) => ({
  client: one(clients, { fields: [clientContacts.clientId], references: [clients.id] }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  managedProjects: many(projects, { relationName: "projectManager" }),
  assignments: many(assignments),
  attendance: many(attendance),
  editingTasksAsEditor: many(editingTasks, { relationName: "editor" }),
  editingTasksAsAlbumDesigner: many(editingTasks, { relationName: "albumDesigner" }),
  equipmentAllocations: many(equipmentAllocations),
  expenses: many(expenses),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  projectManager: one(employees, { fields: [projects.projectManagerId], references: [employees.id], relationName: "projectManager" }),
  events: many(events),
  assignments: many(assignments),
  editingTasks: many(editingTasks),
  quotations: many(quotations),
  invoices: many(invoices),
  expenses: many(expenses),
  equipmentAllocations: many(equipmentAllocations),
  mediaReferences: many(mediaReferences),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  project: one(projects, { fields: [events.projectId], references: [projects.id] }),
  eventManager: one(employees, { fields: [events.eventManagerId], references: [employees.id] }),
  segments: many(eventSegments),
  attendance: many(attendance),
  editingTasks: many(editingTasks),
  equipmentAllocations: many(equipmentAllocations),
  mediaReferences: many(mediaReferences),
}));

export const eventSegmentsRelations = relations(eventSegments, ({ one }) => ({
  event: one(events, { fields: [eventSegments.eventId], references: [events.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  project: one(projects, { fields: [assignments.projectId], references: [projects.id] }),
  event: one(events, { fields: [assignments.eventId], references: [events.id] }),
  segment: one(eventSegments, { fields: [assignments.segmentId], references: [eventSegments.id] }),
  employee: one(employees, { fields: [assignments.employeeId], references: [employees.id] }),
  attendance: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  assignment: one(assignments, { fields: [attendance.assignmentId], references: [assignments.id] }),
  event: one(events, { fields: [attendance.eventId], references: [events.id] }),
  employee: one(employees, { fields: [attendance.employeeId], references: [employees.id] }),
  segment: one(eventSegments, { fields: [attendance.segmentId], references: [eventSegments.id] }),
}));

export const editingTasksRelations = relations(editingTasks, ({ one }) => ({
  project: one(projects, { fields: [editingTasks.projectId], references: [projects.id] }),
  event: one(events, { fields: [editingTasks.eventId], references: [events.id] }),
  editor: one(employees, { fields: [editingTasks.editorId], references: [employees.id], relationName: "editor" }),
  albumDesigner: one(employees, { fields: [editingTasks.albumDesignerId], references: [employees.id], relationName: "albumDesigner" }),
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  project: one(projects, { fields: [quotations.projectId], references: [projects.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  project: one(projects, { fields: [payments.projectId], references: [projects.id] }),
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  project: one(projects, { fields: [expenses.projectId], references: [projects.id] }),
  employee: one(employees, { fields: [expenses.incurredBy], references: [employees.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  owner: one(employees, { fields: [equipment.owner], references: [employees.id] }),
  allocations: many(equipmentAllocations),
}));

export const equipmentAllocationsRelations = relations(equipmentAllocations, ({ one }) => ({
  equipment: one(equipment, { fields: [equipmentAllocations.equipmentId], references: [equipment.id] }),
  project: one(projects, { fields: [equipmentAllocations.projectId], references: [projects.id] }),
  event: one(events, { fields: [equipmentAllocations.eventId], references: [events.id] }),
  assignedTo: one(employees, { fields: [equipmentAllocations.assignedTo], references: [employees.id] }),
}));

export const storageLocationsRelations = relations(storageLocations, ({ many }) => ({
  mediaReferences: many(mediaReferences),
}));

export const mediaReferencesRelations = relations(mediaReferences, ({ one }) => ({
  project: one(projects, { fields: [mediaReferences.projectId], references: [projects.id] }),
  event: one(events, { fields: [mediaReferences.eventId], references: [events.id] }),
  storageLocation: one(storageLocations, { fields: [mediaReferences.storageLocationId], references: [storageLocations.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  project: one(projects, { fields: [auditLogs.projectId], references: [projects.id] }),
}));

export const syncCheckpointsRelations = relations(syncCheckpoints, ({ one }) => ({
  user: one(users, { fields: [syncCheckpoints.userId], references: [users.id] }),
}));

export const syncOutboxRelations = relations(syncOutbox, ({ one }) => ({
  user: one(users, { fields: [syncOutbox.userId], references: [users.id] }),
}));

export const syncConflictsRelations = relations(syncConflicts, ({ one }) => ({
  user: one(users, { fields: [syncConflicts.userId], references: [users.id] }),
}));

// ============================================
// Export all tables
// ============================================

export const schema = {
  users,
  devices,
  clients,
  clientContacts,
  employees,
  projects,
  events,
  eventSegments,
  assignments,
  attendance,
  editingTasks,
  quotations,
  invoices,
  payments,
  expenses,
  equipment,
  equipmentAllocations,
  storageLocations,
  mediaReferences,
  notifications,
  systemConfig,
  auditLogs,
  syncCheckpoints,
  syncOutbox,
  syncConflicts,
};

export type Schema = typeof schema;

// ============================================
// Inferred Type Exports (camelCase for app code)
// ============================================
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Device = InferSelectModel<typeof devices>;
export type NewDevice = InferInsertModel<typeof devices>;
export type Client = InferSelectModel<typeof clients>;
export type NewClient = InferInsertModel<typeof clients>;
export type ClientContact = InferSelectModel<typeof clientContacts>;
export type NewClientContact = InferInsertModel<typeof clientContacts>;
export type Employee = InferSelectModel<typeof employees>;
export type NewEmployee = InferInsertModel<typeof employees>;
export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;
export type Event = InferSelectModel<typeof events>;
export type NewEvent = InferInsertModel<typeof events>;
export type EventSegment = InferSelectModel<typeof eventSegments>;
export type NewEventSegment = InferInsertModel<typeof eventSegments>;
export type Assignment = InferSelectModel<typeof assignments>;
export type NewAssignment = InferInsertModel<typeof assignments>;
export type AttendanceEvent = InferSelectModel<typeof attendance>;
export type NewAttendanceEvent = InferInsertModel<typeof attendance>;
export type EditingTask = InferSelectModel<typeof editingTasks>;
export type NewEditingTask = InferInsertModel<typeof editingTasks>;
export type Quotation = InferSelectModel<typeof quotations>;
export type NewQuotation = InferInsertModel<typeof quotations>;
export type Invoice = InferSelectModel<typeof invoices>;
export type NewInvoice = InferInsertModel<typeof invoices>;
export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;
export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;
export type Equipment = InferSelectModel<typeof equipment>;
export type NewEquipment = InferInsertModel<typeof equipment>;
export type EquipmentAllocation = InferSelectModel<typeof equipmentAllocations>;
export type NewEquipmentAllocation = InferInsertModel<typeof equipmentAllocations>;
export type StorageLocation = InferSelectModel<typeof storageLocations>;
export type NewStorageLocation = InferInsertModel<typeof storageLocations>;
export type MediaReference = InferSelectModel<typeof mediaReferences>;
export type NewMediaReference = InferInsertModel<typeof mediaReferences>;
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
export type SystemConfig = InferSelectModel<typeof systemConfig>;
export type NewSystemConfig = InferInsertModel<typeof systemConfig>;
export type SyncCheckpoint = InferSelectModel<typeof syncCheckpoints>;
export type NewSyncCheckpoint = InferInsertModel<typeof syncCheckpoints>;
export type SyncOutbox = InferSelectModel<typeof syncOutbox>;
export type NewSyncOutbox = InferInsertModel<typeof syncOutbox>;
export type SyncConflict = InferSelectModel<typeof syncConflicts>;
export type NewSyncConflict = InferInsertModel<typeof syncConflicts>;