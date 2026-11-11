import { format, parseISO } from "date-fns";

/** Generate a UUID v4. Works in browser and Node 20+. */
export function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Fallback (shouldn't be needed in modern environments)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Today's date as YYYY-MM-DD in the local timezone. */
export function todayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Current ISO timestamp. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Parse an ISO string to a Date. */
export function parseDate(s: string): Date {
  return parseISO(s);
}

/** Format a Date to YYYY-MM-DD. */
export function formatDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Format a Date to HH:MM. */
export function formatTime(d: Date): string {
  return format(d, "HH:mm");
}

/** Encode an opaque pagination cursor. */
export function encodeCursor(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/** Decode an opaque pagination cursor. */
export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("Invalid cursor");
  }
}

/** Simple deterministic hash for idempotency keys (not for passwords). */
export function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Sleep for ms milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff delay. */
export function backoffDelay(attempt: number, base = 1000, cap = 30000): number {
  const delay = Math.min(cap, base * Math.pow(2, attempt));
  return delay + Math.floor(Math.random() * delay * 0.25);
}

/** Round a number to 2 decimal places. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}