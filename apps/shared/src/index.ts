// Shared types, utilities, and constants for Studio ERP

// ============================================
// Type Utilities
// ============================================

export type UUID = string & { readonly __brand: unique symbol };
export type ISODateString = string & { readonly __brand: unique symbol };

export function uuid(): UUID {
  return crypto.randomUUID() as UUID;
}

export function nowIso(): ISODateString {
  return new Date().toISOString() as ISODateString;
}

export function hashString(input: string): string {
  // Simple hash for offline-first compatibility (replace with proper crypto in production)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  return delay + Math.random() * 1000; // jitter
}

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================
// Permission System
// ============================================

export const PERMISSIONS = {
  // User management
  "users:create": "Create users",
  "users:read": "View users",
  "users:update": "Update users",
  "users:delete": "Delete users",

  // Projects
  "projects:create": "Create projects",
  "projects:read": "View projects",
  "projects:update": "Update projects",
  "projects:delete": "Delete projects",
  "projects:manage_status": "Manage project status transitions",

  // Clients
  "clients:create": "Create clients",
  "clients:read": "View clients",
  "clients:update": "Update clients",
  "clients:delete": "Delete clients",

  // Employees/Crew
  "employees:create": "Create employees",
  "employees:read": "View employees",
  "employees:update": "Update employees",
  "employees:delete": "Delete employees",

  // Assignments
  "assignments:create": "Create assignments",
  "assignments:read": "View assignments",
  "assignments:update": "Update assignments",
  "assignments:delete": "Delete assignments",
  "assignments:manage_status": "Manage assignment status",

  // Attendance
  "attendance:create": "Log attendance",
  "attendance:read": "View attendance",
  "attendance:update": "Update attendance",
  "attendance:delete": "Delete attendance",
  "attendance:correct": "Correct attendance records",

  // Editing
  "editing:create": "Create editing tasks",
  "editing:read": "View editing tasks",
  "editing:update": "Update editing tasks",
  "editing:delete": "Delete editing tasks",
  "editing:manage_status": "Manage editing status",

  // Finance
  "finance:create": "Create financial records",
  "finance:read": "View financial records",
  "finance:update": "Update financial records",
  "finance:delete": "Delete financial records",
  "finance:manage_payments": "Manage payments",

  // Equipment
  "equipment:create": "Create equipment",
  "equipment:read": "View equipment",
  "equipment:update": "Update equipment",
  "equipment:delete": "Delete equipment",
  "equipment:allocate": "Allocate/checkin equipment",

  // Media
  "media:create": "Add media references",
  "media:read": "View media",
  "media:update": "Update media",
  "media:delete": "Delete media",

  // Notifications
  "notifications:read": "View notifications",
  "notifications:manage": "Manage notifications",

  // Settings/Config
  "config:read": "View settings",
  "config:write": "Modify settings",

  // Sync
  "sync:read": "View sync status",
  "sync:manage": "Manage sync operations",

  // Audit
  "audit:read": "View audit logs",

  // Admin
  "admin:all": "Full admin access",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.keys(PERMISSIONS) as Permission[],
  manager: [
    "users:read",
    "projects:create", "projects:read", "projects:update", "projects:manage_status",
    "clients:create", "clients:read", "clients:update",
    "employees:create", "employees:read", "employees:update",
    "assignments:create", "assignments:read", "assignments:update", "assignments:manage_status",
    "attendance:create", "attendance:read", "attendance:update", "attendance:correct",
    "editing:create", "editing:read", "editing:update", "editing:manage_status",
    "finance:create", "finance:read", "finance:update", "finance:manage_payments",
    "equipment:create", "equipment:read", "equipment:update", "equipment:allocate",
    "media:create", "media:read", "media:update",
    "notifications:read", "notifications:manage",
    "config:read", "config:write",
    "sync:read", "sync:manage",
    "audit:read",
  ],
  editor: [
    "projects:read", "projects:update",
    "clients:read",
    "employees:read",
    "assignments:read",
    "attendance:create", "attendance:read",
    "editing:create", "editing:read", "editing:update", "editing:manage_status",
    "finance:read",
    "equipment:read", "equipment:allocate",
    "media:create", "media:read", "media:update",
    "notifications:read",
    "sync:read",
  ],
  viewer: [
    "projects:read",
    "clients:read",
    "employees:read",
    "assignments:read",
    "attendance:read",
    "editing:read",
    "finance:read",
    "equipment:read",
    "media:read",
    "notifications:read",
  ],
};

// ============================================
// Entity Types
// ============================================

export interface User {
  id: UUID;
  email: string;
  password_hash: string;
  full_name: string;
  role: "admin" | "manager" | "editor" | "viewer";
  is_active: boolean;
  last_login_at?: ISODateString;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Device {
  id: UUID;
  user_id: UUID;
  name: string;
  platform: string;
  app_version: string;
  last_seen_at: ISODateString;
  created_at: ISODateString;
  deleted_at?: ISODateString;
}

export interface Client {
  id: UUID;
  client_id: string; // CLT-YYYY-NNNN
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface ClientContact {
  id: UUID;
  client_id: UUID;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  is_primary: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
}

export interface Employee {
  id: UUID;
  employee_id: string; // EMP-YYYY-NNNN
  full_name: string;
  phone?: string;
  email?: string;
  designation?: string;
  skills?: string[];
  compensation?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  leaves?: Record<string, unknown>;
  status: "active" | "inactive" | "on_leave" | "terminated";
  joined_date?: ISODateString;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Project {
  id: UUID;
  project_id: string; // PRJ-YYYY-NNNN
  title: string;
  client_id: UUID;
  booking_date?: ISODateString;
  venue?: Record<string, unknown>;
  locations?: Record<string, unknown>;
  status: ProjectStatus;
  metadata?: Record<string, unknown>;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export type ProjectStatus =
  | "ENQUIRY"
  | "QUOTATION_SENT"
  | "BOOKED"
  | "PLANNING"
  | "CREW_PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "POST_PRODUCTION"
  | "CLIENT_SELECTION"
  | "REVISION"
  | "APPROVAL_PENDING"
  | "DELIVERY_PENDING"
  | "COMPLETED"
  | "CANCELLED";

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "ENQUIRY",
  "QUOTATION_SENT",
  "BOOKED",
  "PLANNING",
  "CREW_PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "POST_PRODUCTION",
  "CLIENT_SELECTION",
  "REVISION",
  "APPROVAL_PENDING",
  "DELIVERY_PENDING",
  "COMPLETED",
  "CANCELLED",
];

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  ENQUIRY: ["QUOTATION_SENT", "CANCELLED"],
  QUOTATION_SENT: ["BOOKED", "ENQUIRY", "CANCELLED"],
  BOOKED: ["PLANNING", "QUOTATION_SENT", "CANCELLED"],
  PLANNING: ["CREW_PENDING", "BOOKED", "CANCELLED"],
  CREW_PENDING: ["CONFIRMED", "PLANNING", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CREW_PENDING", "CANCELLED"],
  IN_PROGRESS: ["POST_PRODUCTION", "CONFIRMED", "CANCELLED"],
  POST_PRODUCTION: ["CLIENT_SELECTION", "IN_PROGRESS", "CANCELLED"],
  CLIENT_SELECTION: ["REVISION", "APPROVAL_PENDING", "POST_PRODUCTION"],
  REVISION: ["CLIENT_SELECTION", "APPROVAL_PENDING"],
  APPROVAL_PENDING: ["DELIVERY_PENDING", "REVISION", "CLIENT_SELECTION"],
  DELIVERY_PENDING: ["COMPLETED", "APPROVAL_PENDING"],
  COMPLETED: [],
  CANCELLED: [],
};

export interface Event {
  id: UUID;
  project_id: UUID;
  title: string;
  event_date: ISODateString;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  venue?: Record<string, unknown>;
  type: "shoot" | "meeting" | "rehearsal" | "delivery" | "other";
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  notes?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface EventSegment {
  id: UUID;
  event_id: UUID;
  title: string;
  start_time: string;
  end_time: string;
  assigned_employees?: UUID[];
  equipment_needed?: string[];
  notes?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Assignment {
  id: UUID;
  project_id: UUID;
  employee_id: UUID;
  assignment_date: ISODateString;
  status: "pending_validation" | "tentative" | "confirmed" | "provisional" | "cancelled";
  role?: string;
  validation?: Record<string, unknown>;
  conflicts?: Record<string, unknown>;
  logistics?: Record<string, unknown>;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface AttendanceEvent {
  id: UUID;
  employee_id: UUID;
  event_id?: UUID;
  event_type: "check_in" | "check_out" | "break_start" | "break_end";
  timestamp: ISODateString;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  is_correction: boolean;
  original_event_id?: UUID;
  correction_reason?: string;
  created_at: ISODateString;
  deleted_at?: ISODateString;
  // No update - append-only
}

export const EDITING_TASK_STATUSES = [
  "WAITING_FOR_FILES",
  "FILES_RECEIVED",
  "CULLING_IN_PROGRESS",
  "CULLING_COMPLETED",
  "EDITING_IN_PROGRESS",
  "EDITING_COMPLETED",
  "INTERNAL_REVIEW",
  "APPROVED",
  "REVISION_REQUIRED",
  "QC_PENDING",
  "QC_COMPLETED",
  "DELIVERED",
] as const;

export type EditingTaskStatus = typeof EDITING_TASK_STATUSES[number];

export interface EditingTask {
  id: UUID;
  project_id: UUID;
  assignee_id?: UUID;
  type: "culling" | "editing" | "color_grading" | "retouching" | "qc";
  priority: "low" | "normal" | "high" | "urgent";
  status: EditingTaskStatus;
  due_date?: ISODateString;
  items?: Record<string, unknown>; // media references, counts
  qc_checks?: Record<string, unknown>;
  comments?: Record<string, unknown>;
  revisions?: Record<string, unknown>;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Quotation {
  id: UUID;
  quotation_number: string;
  project_id: UUID;
  client_id: UUID;
  items: Record<string, unknown>[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  valid_until: ISODateString;
  notes?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Invoice {
  id: UUID;
  invoice_number: string;
  project_id: UUID;
  client_id: UUID;
  quotation_id?: UUID;
  items: Record<string, unknown>[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";
  due_date: ISODateString;
  paid_amount: number;
  notes?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Payment {
  id: UUID;
  invoice_id: UUID;
  amount: number;
  method: "cash" | "bank_transfer" | "upi" | "card" | "cheque" | "other";
  reference?: string;
  receipt_ref?: Record<string, unknown>;
  payment_date: ISODateString;
  notes?: string;
  created_at: ISODateString;
  // Immutable - no update, no delete
}

export interface Expense {
  id: UUID;
  project_id?: UUID;
  category: "equipment" | "travel" | "accommodation" | "meals" | "software" | "marketing" | "other";
  amount: number;
  description: string;
  expense_date: ISODateString;
  receipt_ref?: Record<string, unknown>;
  notes?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Equipment {
  id: UUID;
  equipment_id: string;
  name: string;
  category: "camera" | "lens" | "lighting" | "audio" | "accessory" | "storage" | "computer" | "other";
  serial_number?: string;
  purchase_date?: ISODateString;
  purchase_cost?: number;
  specifications?: Record<string, unknown>;
  status: "available" | "allocated" | "maintenance" | "retired" | "damaged" | "lost";
  condition: "excellent" | "good" | "fair" | "poor";
  location?: string;
  maintenance?: Record<string, unknown>;
  damage_reports?: Record<string, unknown>;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface EquipmentAllocation {
  id: UUID;
  equipment_id: UUID;
  project_id?: UUID;
  employee_id?: UUID;
  checkout_date: ISODateString;
  expected_return_date?: ISODateString;
  actual_return_date?: ISODateString;
  purpose?: string;
  condition_at_checkout?: string;
  condition_at_return?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface StorageLocation {
  id: UUID;
  name: string;
  location_type: "local" | "nas" | "cloud" | "external_drive" | "other";
  path?: string;
  credentials_ref?: string; // Reference to encrypted credentials
  capacity_bytes?: number;
  used_bytes?: number;
  is_default: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface MediaReference {
  id: UUID;
  project_id?: UUID;
  title: string;
  type: "photo" | "video" | "audio" | "document" | "raw" | "other";
  storage_location_id: UUID;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  duration?: number; // seconds for video/audio
  checksum?: string; // SHA256
  metadata?: Record<string, unknown>;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

export interface Notification {
  id: UUID;
  user_id: UUID;
  type: "info" | "warning" | "success" | "error" | "assignment" | "payment" | "project" | "system";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  read_at?: ISODateString;
  created_at: ISODateString;
}

export interface SystemConfig {
  id: UUID;
  key: string;
  value: string;
  value_type: "string" | "number" | "boolean" | "json";
  scope: "global" | "user" | "device";
  user_id?: UUID;
  device_id?: UUID;
  description?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface AuditLog {
  id: UUID;
  user_id?: UUID;
  action: string;
  entity: string;
  entity_id: UUID;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  created_at: ISODateString;
  // Append-only - no update, no delete
}

// ============================================
// Sync Types
// ============================================

export interface SyncOperation {
  id: UUID;
  clientId: UUID;
  userId: UUID;
  entity: string;
  entityId: UUID;
  type: "upsert" | "delete";
  data?: Record<string, unknown>;
  baseVersion?: number;
  timestamp: ISODateString;
}

export interface SyncPushRequest {
  deviceId: UUID;
  userId: UUID;
  lastCheckpoint: ISODateString;
  operations: SyncOperation[];
}

export interface SyncPushResult {
  accepted: { opId: UUID; entityId: UUID; newVersion: number; newCheckpoint: ISODateString }[];
  rejected: { opId: UUID; reason: string; code: string }[];
  conflicts: { opId: UUID; entity: string; entityId: UUID; serverVersion: number; clientVersion: number; serverData: Record<string, unknown> }[];
  nextCheckpoint: ISODateString;
}

export interface SyncPullRequest {
  deviceId: UUID;
  userId: UUID;
  checkpoint: ISODateString;
  limit?: number;
}

export interface SyncPullChange {
  entity: string;
  entityId: UUID;
  version: number;
  operation: "upsert" | "delete";
  data: Record<string, unknown> | null;
  timestamp: ISODateString;
}

export interface SyncPullResponse {
  changes: SyncPullChange[];
  tombstones: SyncPullChange[];
  nextCheckpoint: ISODateString;
  hasMore: boolean;
}

export interface SyncConflict {
  id: UUID;
  device_id: UUID;
  user_id: UUID;
  entity: string;
  entity_id: UUID;
  operations: string; // JSON array of SyncOperation
  server_snapshot?: string; // JSON
  status: "unresolved" | "resolved_client" | "resolved_server" | "resolved_merged";
  resolved_at?: ISODateString;
  resolved_by?: string;
  created_at: ISODateString;
}

// ============================================
// Pagination
// ============================================

export interface PaginationParams {
  limit?: number;
  cursor?: string; // ISO date string for cursor-based pagination
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================
// Validation Helpers
// ============================================

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{4,10}$/.test(phone);
}

export function generateProjectId(prefix = "PRJ"): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${year}-${random}`;
}

export function generateClientId(prefix = "CLT"): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${year}-${random}`;
}

export function generateEmployeeId(prefix = "EMP"): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${year}-${random}`;
}

// ============================================
// Date Helpers
// ============================================

export function formatDate(date: Date | string, format = "DD/MM/YYYY"): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  switch (format) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    default:
      return d.toISOString().split("T")[0];
  }
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString();
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================
// Deep Clone / Merge
// ============================================

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }
  return result;
}