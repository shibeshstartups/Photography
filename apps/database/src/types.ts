// Type definitions matching the database schema
// Row types use snake_case (matching SELECT * column names)
// Input types (New*) use camelCase (matching renderer IPC payloads)

import type { UUID, ISODateString } from "@studio-erp/shared";

// Base fields common to most entities (snake_case for DB rows)
interface BaseEntity {
  id: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at?: ISODateString;
  version: number;
}

// User
export interface User extends BaseEntity {
  email: string;
  password_hash: string;
  name: string;
  role: string;
  permissions: string; // JSON string
  status: string;
  last_login_at?: ISODateString;
}

export interface NewUser {
  id: UUID;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  permissions: string[];
  status: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Device
export interface Device extends BaseEntity {
  user_id: UUID;
  name: string;
  platform: string;
  user_agent: string;
  device_key_hash: string;
  revoked: number;
  last_seen_at?: ISODateString;
}

export interface NewDevice {
  id: UUID;
  userId: UUID;
  name: string;
  platform: string;
  userAgent: string;
  deviceKeyHash: string;
  revoked: number;
  lastSeenAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Client
export interface Client extends BaseEntity {
  client_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  additional_info?: string;
  notes?: string;
}

export interface NewClient {
  id: UUID;
  clientId: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  additionalInfo?: string;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ClientContact extends BaseEntity {
  client_id: UUID;
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  is_primary: number;
}

export interface NewClientContact {
  id: UUID;
  clientId: UUID;
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Employee
export interface Employee extends BaseEntity {
  employee_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  designation?: string;
  skills: string; // JSON string
  specializations: string; // JSON string
  experience?: number;
  status: string;
  compensation?: string; // JSON string
  availability?: string; // JSON string
  leaves: string; // JSON string
  notes?: string;
  joined_date?: ISODateString;
}

export interface NewEmployee {
  id: UUID;
  employeeId: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  designation?: string;
  skills: string[];
  specializations: string[];
  experience?: number;
  status: string;
  compensation?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  leaves: Record<string, unknown>;
  notes?: string;
  joinedDate?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Project
export interface Project extends BaseEntity {
  project_id: string;
  client_id: UUID;
  title: string;
  project_manager_id?: UUID;
  booking_date?: ISODateString;
  status: string;
  quotation?: string;
  total_agreed_amount: number;
  advance_payment: number;
  venue?: string;
  locations?: string;
  internal_notes?: string;
  metadata?: string;
}

export interface NewProject {
  id: UUID;
  projectId: string;
  clientId: UUID;
  title: string;
  projectManagerId?: UUID;
  bookingDate?: ISODateString;
  status: string;
  quotation?: string;
  totalAgreedAmount: number;
  advancePayment: number;
  venue?: string;
  locations?: string;
  internalNotes?: string;
  metadata?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Event
export interface Event extends BaseEntity {
  project_id: UUID;
  event_id: string;
  event_type: string;
  event_date: ISODateString;
  start_time: string;
  end_time: string;
  venue?: string;
  city?: string;
  location?: string;
  travel?: string;
  event_manager_id?: UUID;
  metadata?: string;
}

export interface NewEvent {
  id: UUID;
  projectId: UUID;
  eventId: string;
  eventType: string;
  eventDate: ISODateString;
  startTime: string;
  endTime: string;
  venue?: string;
  city?: string;
  location?: string;
  travel?: string;
  eventManagerId?: UUID;
  metadata?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Event Segment
export interface EventSegment extends BaseEntity {
  event_id: UUID;
  service: string;
  required_count: number;
  assigned_count: number;
  metadata?: string;
}

export interface NewEventSegment {
  id: UUID;
  eventId: UUID;
  service: string;
  requiredCount: number;
  assignedCount: number;
  metadata?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Assignment
export interface Assignment extends BaseEntity {
  project_id: UUID;
  event_id?: UUID;
  segment_id?: UUID;
  employee_id: UUID;
  assignment_date: ISODateString;
  time_window?: string;
  status: string;
  is_provisional: number;
  validation?: string;
  conflicts?: string;
  logistics?: string;
  notes?: string;
  // Enrichment properties (added at runtime)
  employee?: { id: UUID; full_name: string; email: string; phone?: string; designation?: string };
  segment?: { id: UUID; service: string; required_count: number };
}

export interface NewAssignment {
  id: UUID;
  projectId: UUID;
  eventId?: UUID;
  segmentId?: UUID;
  employeeId: UUID;
  assignmentDate: ISODateString;
  timeWindow?: string;
  status: string;
  isProvisional: number;
  validation?: Record<string, unknown>;
  conflicts?: Record<string, unknown>;
  logistics?: Record<string, unknown>;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Attendance Event (append-only)
export interface AttendanceEvent {
  id: UUID;
  assignment_id?: UUID;
  event_id?: UUID;
  employee_id: UUID;
  event_type: string;
  occurred_at: ISODateString;
  recorded_at: ISODateString;
  recorded_by?: string;
  segment_id?: UUID;
  metadata?: string;
  replaces_event_id?: UUID;
  device_id?: string;
  version: number;
  created_at: ISODateString;
}

export interface NewAttendanceEvent {
  id: UUID;
  assignmentId?: UUID;
  eventId?: UUID;
  employeeId: UUID;
  eventType: string;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  recordedBy?: string;
  segmentId?: UUID;
  metadata?: Record<string, unknown>;
  replacesEventId?: UUID;
  deviceId?: string;
  version: number;
  createdAt: ISODateString;
}

// Editing Task
export interface EditingTask extends BaseEntity {
  project_id: UUID;
  event_id?: UUID;
  status: string;
  editor_id?: UUID;
  album_designer_id?: UUID;
  source_folder_ref?: string;
  output_folder_ref?: string;
  deadline?: ISODateString;
  completed_at?: ISODateString;
  qc_checks?: string;
  comments?: string;
  revisions?: string | Record<string, unknown>[];
  version: number;
  // Enrichment properties (added at runtime)
  project?: { id: UUID; title: string; project_id: string };
  event?: { id: UUID; event_type: string; event_date: string };
  editor?: { id: UUID; full_name: string };
  albumDesigner?: { id: UUID; full_name: string };
  qcChecks?: Record<string, unknown>[];
}

export interface NewEditingTask {
  id: UUID;
  projectId: UUID;
  eventId?: UUID;
  status: string;
  editorId?: UUID;
  albumDesignerId?: UUID;
  sourceFolderRef?: string;
  outputFolderRef?: string;
  deadline?: ISODateString;
  completedAt?: ISODateString;
  qcChecks?: Record<string, unknown>[];
  comments?: Record<string, unknown>;
  revisions?: Record<string, unknown>[];
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Quotation
export interface Quotation extends BaseEntity {
  project_id: UUID;
  items: string; // JSON string
  total_amount: number;
  status: string;
  sent_at?: ISODateString;
}

export interface NewQuotation {
  id: UUID;
  projectId: UUID;
  items: Record<string, unknown>[];
  totalAmount: number;
  status: string;
  sentAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Invoice
export interface Invoice extends BaseEntity {
  project_id: UUID;
  invoice_number: string;
  items: string; // JSON string
  total_amount: number;
  issue_date: ISODateString;
  due_date?: ISODateString;
  status: string;
}

export interface NewInvoice {
  id: UUID;
  projectId: UUID;
  invoiceNumber: string;
  items: Record<string, unknown>[];
  totalAmount: number;
  issueDate: ISODateString;
  dueDate?: ISODateString;
  status: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Payment (immutable ledger)
export interface Payment {
  id: UUID;
  project_id: UUID;
  invoice_id?: UUID;
  type: string;
  amount: number;
  method?: string;
  paid_at: ISODateString;
  replaces_payment_id?: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
  notes?: string;
  receipt_ref?: string;
  version: number;
  deleted_at?: ISODateString;
}

export interface NewPayment {
  id: UUID;
  projectId: UUID;
  invoiceId?: UUID;
  type: string;
  amount: number;
  method?: string;
  paidAt: ISODateString;
  replacesPaymentId?: UUID;
  notes?: string;
  receiptRef?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Expense
export interface Expense extends BaseEntity {
  project_id?: UUID;
  category: string;
  description: string;
  amount: number;
  method?: string;
  spent_at: ISODateString;
  incurred_by?: UUID;
  receipt_ref?: string;
}

export interface NewExpense {
  id: UUID;
  projectId?: UUID;
  category: string;
  description: string;
  amount: number;
  method?: string;
  spentAt: ISODateString;
  incurredBy?: UUID;
  receiptRef?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Equipment
export interface Equipment extends BaseEntity {
  equipment_id: string;
  name: string;
  category: string;
  serial_number?: string;
  owner?: UUID;
  condition: string;
  availability: string;
  current_holder?: string;
  metadata?: string;
  maintenance?: string;
  damage_reports?: string;
  // Enrichment properties (added at runtime)
  damageReports?: Record<string, unknown>[];
}

export interface NewEquipment {
  id: UUID;
  equipmentId: string;
  name: string;
  category: string;
  serialNumber?: string;
  owner?: UUID;
  condition: string;
  availability: string;
  currentHolder?: string;
  metadata?: Record<string, unknown>;
  maintenance?: Record<string, unknown>;
  damageReports?: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Equipment Allocation
export interface EquipmentAllocation extends BaseEntity {
  equipment_id: UUID;
  project_id?: UUID;
  event_id?: UUID;
  assigned_to?: UUID;
  checked_out_at: ISODateString;
  checked_in_at?: ISODateString;
  condition_out?: string;
  condition_in?: string;
  notes?: string;
}

export interface NewEquipmentAllocation {
  id: UUID;
  equipmentId: UUID;
  projectId?: UUID;
  eventId?: UUID;
  assignedTo?: UUID;
  checkedOutAt: ISODateString;
  checkedInAt?: ISODateString;
  conditionOut?: string;
  conditionIn?: string;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Storage Location
export interface StorageLocation extends BaseEntity {
  name: string;
  type: string;
  base_path: string;
  config?: string;
  free_bytes?: number;
  total_bytes?: number;
  status: string;
}

export interface NewStorageLocation {
  id: UUID;
  name: string;
  type: string;
  basePath: string;
  config?: Record<string, unknown>;
  freeBytes?: number;
  totalBytes?: number;
  status: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Media Reference
export interface MediaReference extends BaseEntity {
  project_id?: UUID;
  event_id?: UUID;
  storage_location_id: UUID;
  relative_path: string;
  filename: string;
  file_type: string;
  size?: number;
  checksum?: string;
  imported_at: ISODateString;
  access_permission: string;
  availability_status: string;
  version: number;
}

export interface NewMediaReference {
  id: UUID;
  projectId?: UUID;
  eventId?: UUID;
  storageLocationId: UUID;
  relativePath: string;
  filename: string;
  fileType: string;
  size?: number;
  checksum?: string;
  importedAt: ISODateString;
  accessPermission: string;
  availabilityStatus: string;
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Notification
export interface Notification extends BaseEntity {
  user_id?: UUID;
  type: string;
  title: string;
  body?: string;
  data?: string;
  severity: string;
  read_at?: ISODateString;
  version: number;
}

export interface NewNotification {
  id: UUID;
  userId?: UUID;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  severity: string;
  readAt?: ISODateString;
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Audit Log (append-only)
export interface AuditLog {
  id: UUID;
  user_id?: UUID;
  device_id?: string;
  timestamp: ISODateString;
  action: string;
  entity_type: string;
  entity_id: UUID;
  previous?: string;
  next?: string;
  project_id?: UUID;
  session_id?: string;
  operation_id?: string;
  ip?: string;
  version: number;
  deleted_at?: ISODateString;
}

export interface NewAuditLog {
  id: UUID;
  userId?: UUID;
  deviceId?: string;
  timestamp: ISODateString;
  action: string;
  entityType: string;
  entityId: UUID;
  previous?: string;
  next?: string;
  projectId?: UUID;
  sessionId?: string;
  operationId?: string;
  ip?: string;
  version: number;
  deletedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// System Config
export interface SystemConfig extends BaseEntity {
  key: string;
  value: string;
  deleted_at?: ISODateString;
}

export interface NewSystemConfig {
  id: UUID;
  key: string;
  value: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Sync Checkpoint
export interface SyncCheckpoint {
  id: UUID;
  device_id: string;
  user_id: UUID;
  checkpoint: ISODateString;
  last_pulled_at?: ISODateString;
  pending_count: number;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface NewSyncCheckpoint {
  id: UUID;
  deviceId: string;
  userId: UUID;
  checkpoint: ISODateString;
  lastPulledAt?: ISODateString;
  pendingCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Sync Outbox
export interface SyncOutbox {
  id: UUID;
  device_id: string;
  user_id: UUID;
  operation: string; // JSON string
  queued_at: ISODateString;
  attempts: number;
  last_attempt_at?: ISODateString;
  accepted_at?: ISODateString;
  status: string;
  rejection_reason?: string;
}

export interface NewSyncOutbox {
  id: UUID;
  deviceId: string;
  userId: UUID;
  operation: Record<string, unknown>;
  queuedAt: ISODateString;
  attempts: number;
  lastAttemptAt?: ISODateString;
  acceptedAt?: ISODateString;
  status: string;
  rejectionReason?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Sync Conflict
export interface SyncConflict {
  id: UUID;
  device_id: string;
  user_id: UUID;
  entity: string;
  entity_id: UUID;
  operations: string; // JSON string
  server_snapshot?: string; // JSON string
  status: string;
  created_at: ISODateString;
  resolved_at?: ISODateString;
  resolved_by?: string;
}

export interface NewSyncConflict {
  id: UUID;
  deviceId: string;
  userId: UUID;
  entity: string;
  entityId: UUID;
  operations: Record<string, unknown>;
  serverSnapshot?: Record<string, unknown>;
  status: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}