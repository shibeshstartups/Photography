import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Client portal — secure project-specific invitations.
 * Clients must never access another client's project.
 */
export const portalInvitations = sqliteTable("studio_portal_invitations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  /** Opaque token (URL-safe). */
  token: text("token").notNull().unique(),
  /** Optional email OTP (SHA-256 of the OTP, never the raw OTP). */
  otpHash: text("otp_hash"),
  /** ISO timestamp when the OTP expires. */
  otpExpiresAt: text("otp_expires_at"),
  /** Max number of OTP attempts. */
  otpAttempts: integer("otp_attempts").notNull().default(0),
  /** ISO timestamp when the invitation expires. */
  expiresAt: text("expires_at").notNull(),
  /** ISO timestamp when revoked. */
  revokedAt: text("revoked_at"),
  /** ISO timestamp of first use. */
  usedAt: text("used_at"),
  /** Number of times used. */
  useCount: integer("use_count").notNull().default(0),
  /** Max uses allowed. */
  maxUses: integer("max_uses").notNull().default(1),
  /** JSON: { allowedEmails, ... }. */
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

export type PortalInvitation = typeof portalInvitations.$inferSelect;
export type NewPortalInvitation = typeof portalInvitations.$inferInsert;

/** Client portal sessions (separate from admin sessions). */
export const portalSessions = sqliteTable("studio_portal_sessions", {
  id: text("id").primaryKey(),
  invitationId: text("invitation_id").notNull().references(() => portalInvitations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  /** Token used for subsequent requests. */
  sessionToken: text("session_token").notNull().unique(),
  /** ISO timestamp. */
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  /** ISO timestamp. */
  expiresAt: text("expires_at").notNull(),
  /** ISO timestamp of last activity. */
  lastActivityAt: text("last_activity_at"),
  /** IP address. */
  ip: text("ip"),
  userAgent: text("user_agent"),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  deletedAt: text("deleted_at"),
});

export type PortalSession = typeof portalSessions.$inferSelect;

/** Client-facing album selections, favorites, revision requests, disputes. */
export const clientFeedback = sqliteTable("studio_client_feedback", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  /** "selection" | "favorite" | "revision" | "dispute" | "comment" | "approval" | "rejection". */
  type: text("type").notNull(),
  /** JSON: { imageIds, comment, ... }. */
  payload: text("payload").notNull(),
  /** "pending" | "acknowledged" | "resolved". */
  status: text("status").notNull().default("pending"),
  /** ISO timestamp. */
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  /** Version for sync. */
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at"),
});

export type ClientFeedback = typeof clientFeedback.$inferSelect;
export type NewClientFeedback = typeof clientFeedback.$inferInsert;

/** Authorized downloads (audit trail of what a client downloaded). */
export const portalDownloads = sqliteTable("studio_portal_downloads", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => portalSessions.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  mediaId: text("media_id").references(() => mediaReferences.id),
  /** ISO timestamp. */
  downloadedAt: text("downloaded_at").notNull().default(sql`(current_timestamp)`),
  ip: text("ip"),
  userAgent: text("user_agent"),
  deletedAt: text("deleted_at"),
});

export type PortalDownload = typeof portalDownloads.$inferSelect;