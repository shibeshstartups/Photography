/**
 * Centralized error hierarchy.
 * All errors carry a stable `code` so clients can branch on it.
 */
export class StudioError extends Error {
  readonly _tag = "StudioError";
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends StudioError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends StudioError {
  constructor(message: string = "Authentication required") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends StudioError {
  constructor(message: string = "Insufficient permissions") {
    super(message, "AUTHZ_ERROR", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends StudioError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} not found: ${id}` : `${entity} not found`,
      "NOT_FOUND",
      404,
    );
    this.name = "NotFoundError";
  }
}

export class ConflictError extends StudioError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFLICT", 409, details);
    this.name = "ConflictError";
  }
}

export class SyncConflictError extends StudioError {
  constructor(message: string, public readonly conflicts: unknown[]) {
    super(message, "SYNC_CONFLICT", 409, conflicts);
    this.name = "SyncConflictError";
  }
}

export class RateLimitError extends StudioError {
  constructor(retryAfterSeconds: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds}s`,
      "RATE_LIMIT",
      429,
      { retryAfterSeconds },
    );
    this.name = "RateLimitError";
  }
}

export class IdempotencyConflictError extends StudioError {
  constructor(idempotencyKey: string) {
    super(
      `Idempotency key already used: ${idempotencyKey}`,
      "IDEMPOTENCY_CONFLICT",
      409,
      { idempotencyKey },
    );
    this.name = "IdempotencyConflictError";
  }
}

export class QuotaExceededError extends StudioError {
  constructor(message: string, details?: unknown) {
    super(message, "QUOTA_EXCEEDED", 507, details);
    this.name = "QuotaExceededError";
  }
}

export class InternalError extends StudioError {
  constructor(message: string = "Internal server error", details?: unknown) {
    super(message, "INTERNAL_ERROR", 500, details);
    this.name = "InternalError";
  }
}

/** Type guard for any StudioError. */
export function isStudioError(value: unknown): value is StudioError {
  return value instanceof StudioError;
}