import type { ProjectStatus, EditingTaskStatus, EmployeeRole, SegmentService } from "./constants.js";

/** Base fields present on every synced entity. */
export interface SyncMeta {
  id: string;
  version: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single validated business operation pushed from a device. */
export interface SyncOperation {
  id: string; // client-generated idempotency key
  clientId: string; // device id
  userId: string;
  type: string; // e.g. "project.create", "assignment.create"
  entity: string; // e.g. "project", "assignment"
  entityId: string;
  data: Record<string, unknown>;
  baseVersion: number | null; // version the client built this op against
  timestamp: string; // ISO
}

export interface SyncPushRequest {
  deviceId: string;
  userId: string;
  lastCheckpoint: string | null;
  operations: SyncOperation[];
}

export interface SyncPushResult {
  accepted: Array<{
    opId: string;
    entityId: string;
    newVersion: number;
    newCheckpoint: string;
  }>;
  rejected: Array<{
    opId: string;
    reason: string;
    code: string;
  }>;
  conflicts: Array<{
    opId: string;
    entity: string;
    entityId: string;
    serverVersion: number;
    clientVersion: number;
    serverData: Record<string, unknown>;
  }>;
  nextCheckpoint: string;
}

export interface SyncPullRequest {
  deviceId: string;
  userId: string;
  checkpoint: string | null;
  limit?: number;
}

export interface SyncPullChange {
  entity: string;
  entityId: string;
  version: number;
  operation: "upsert" | "delete";
  data: Record<string, unknown> | null;
  timestamp: string;
}

export interface SyncPullResponse {
  changes: SyncPullChange[];
  tombstones: SyncPullChange[];
  nextCheckpoint: string;
  hasMore: boolean;
}

/** Lightweight user record for auth context. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  status: "active" | "inactive" | "suspended";
}

/** Device record. */
export interface Device {
  id: string;
  userId: string;
  name: string;
  platform: "windows" | "macos" | "linux" | "web";
  userAgent: string;
  createdAt: string;
  lastSeen: string;
  revoked: boolean;
}

/** Audit event. */
export interface AuditEvent {
  id: string;
  userId: string;
  deviceId: string | null;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  previous: Record<string, unknown> | null;
  next: Record<string, unknown> | null;
  projectId: string | null;
  sessionId: string | null;
  operationId: string | null;
  ip?: string;
}

/** Re-export status types. */
export type { ProjectStatus, EditingTaskStatus, EmployeeRole, SegmentService };