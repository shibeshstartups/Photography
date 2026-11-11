export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ENVIRONMENT: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  status: "active" | "inactive" | "suspended";
}

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

export interface SyncOperation {
  id: string;
  clientId: string;
  userId: string;
  type: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  baseVersion: number | null;
  timestamp: string;
}

export interface SyncPushRequest {
  deviceId: string;
  userId: string;
  lastCheckpoint: string | null;
  operations: SyncOperation[];
}

export interface SyncPullRequest {
  deviceId: string;
  userId: string;
  checkpoint: string | null;
  limit?: number;
}

export interface JWTPayload {
  userId: string;
  deviceId: string;
  iat: number;
  exp: number;
}

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  clientId: string;
  projectId: string;
  permissions: string[];
}